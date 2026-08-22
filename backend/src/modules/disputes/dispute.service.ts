import { AppError } from "../../shared/AppError.js";
import { withTransaction } from "../../database/pool.js";
import { auditLogService } from "../audit-log/audit-log.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { hasAdminCapability } from "../admin-permissions/admin-permission.authorization.js";
import { validateOrderTransition } from "../orders/order-state.machine.js";
import { orderRepository } from "../orders/order.repository.js";
import { disputeRepository, type DisputeRepository } from "./dispute.repository.js";
import type { DisputeQueryInput, OpenDisputeInput, ResolveDisputeInput } from "./dispute.schemas.js";
import type { DisputeRecord } from "../../types/database.types.js";

export class DisputeService {
  constructor(private readonly repository: DisputeRepository) {}

  /**
   * Opens a dispute on an order by buyer or seller.
   */
  async openDispute(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
    data: OpenDisputeInput,
  ): Promise<DisputeRecord> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const isBuyer = order.buyerId === callerAccountId;
    const isSeller = order.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "dispute_management");

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only order participants can open a dispute.");
    }

    const disputableStatuses = ["confirmed", "completed"];
    if (!disputableStatuses.includes(order.orderStatus)) {
      throw new AppError(
        409,
        "ORDER_NOT_DISPUTABLE",
        `Cannot open a dispute on an order in '${order.orderStatus}' status.`,
      );
    }

    if (order.orderStatus === "completed" && Date.now() - order.updatedAt.getTime() > 14 * 24 * 60 * 60 * 1000) {
      throw new AppError(409, "DISPUTE_WINDOW_CLOSED", "The 14-day post-completion dispute window has closed.");
    }

    const dispute = await withTransaction(async (connection) => {
      const lockedOrder = await orderRepository.findByIdForUpdate(orderId, connection);
      if (!lockedOrder) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      const activeDispute = await this.repository.findActiveByOrderId(orderId, connection);
      if (activeDispute) {
        throw new AppError(409, "DISPUTE_ALREADY_OPEN", `An active dispute (${activeDispute.disputeReference}) is already open on this order.`);
      }
      validateOrderTransition(lockedOrder.orderStatus, "disputed");
      const dispute = await this.repository.create(orderId, callerAccountId, data, connection);
      await orderRepository.updateStatus(orderId, "disputed", connection);
      await auditLogService.record(
        {
          actorAccountId: callerAccountId,
          action: "order:disputed",
          targetEntity: "dispute",
          targetId: dispute.id,
          reason: `Dispute opened: ${data.reason}`,
          metadata: { disputeReference: dispute.disputeReference, orderId, openedBy: isBuyer ? "buyer" : isSeller ? "seller" : "admin" },
        },
        connection,
      );
      return dispute;
    });
    await notificationService.notifyDisputeOpened(dispute, order, callerAccountId).catch(() => undefined);
    return dispute;
  }

  /**
   * Adjudicates and resolves a dispute by an authorized admin employee.
   */
  async resolveDispute(
    disputeId: number,
    adminAccountId: number,
    data: ResolveDisputeInput,
  ): Promise<DisputeRecord> {
    const result = await withTransaction(async (connection) => {
      const dispute = await this.repository.findByIdForUpdate(disputeId, connection);
      if (!dispute) throw new AppError(404, "DISPUTE_NOT_FOUND", "Dispute not found.");
      if (dispute.status !== "opened" && dispute.status !== "under_review") {
        throw new AppError(409, "DISPUTE_ALREADY_RESOLVED", "This dispute has already been resolved or closed.");
      }
      const order = await orderRepository.findByIdForUpdate(dispute.orderId, connection);
      if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Associated order not found.");

      const newOrderStatus = "resolved" as const;
      validateOrderTransition(order.orderStatus, newOrderStatus);
      await this.repository.resolve(disputeId, adminAccountId, data, connection);
      await orderRepository.updateStatus(order.id, newOrderStatus, connection);
      await auditLogService.record(
        {
          actorAccountId: adminAccountId,
          action: "dispute:resolved",
          targetEntity: "dispute",
          targetId: dispute.id,
          reason: data.resolutionNotes,
          metadata: { disputeReference: dispute.disputeReference, orderId: order.id, resolutionOutcome: data.resolutionOutcome, newOrderStatus },
        },
        connection,
      );
      return (await this.repository.findById(disputeId, connection))!;
    });
    const order = await orderRepository.findById(result.orderId);
    if (order) await notificationService.notifyDisputeResolved(result, order).catch(() => undefined);
    return result;
  }

  async getDispute(
    disputeId: number,
    callerAccountId: number,
    callerAccountType: string,
  ): Promise<DisputeRecord> {
    const dispute = await this.repository.findById(disputeId);
    if (!dispute) {
      throw new AppError(404, "DISPUTE_NOT_FOUND", "Dispute not found.");
    }

    const order = await orderRepository.findById(dispute.orderId);
    const isParty =
      dispute.openedByAccountId === callerAccountId ||
      order?.buyerId === callerAccountId ||
      order?.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "dispute_management");
    if (!isParty && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to view this dispute.");
    }

    return dispute;
  }

  async listOrderDisputes(orderId: number, callerAccountId: number, callerAccountType: string) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    const isParty = order.buyerId === callerAccountId || order.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "dispute_management");
    if (!isParty && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to view disputes for this order.");
    }

    return this.repository.listByOrderId(orderId);
  }

  async listAdminDisputes(filter: DisputeQueryInput) {
    const [items, total] = await Promise.all([
      this.repository.list(filter),
      this.repository.count(filter),
    ]);
    return { items, total };
  }
}

export const disputeService = new DisputeService(disputeRepository);
