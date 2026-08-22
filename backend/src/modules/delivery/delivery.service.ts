import { AppError } from "../../shared/AppError.js";
import { withTransaction } from "../../database/pool.js";
import type { RowDataPacket } from "mysql2/promise";
import { auditLogService } from "../audit-log/audit-log.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { hasAdminCapability } from "../admin-permissions/admin-permission.authorization.js";
import { validateOrderTransition } from "../orders/order-state.machine.js";
import { orderRepository } from "../orders/order.repository.js";
import type { OrderWithDelivery } from "../orders/order.types.js";
import { deliveryRepository, type DeliveryRepository } from "./delivery.repository.js";
import type {
  BuyerConfirmDeliveryInput,
  MarkDeliveredInput,
  ReadyForCollectionInput,
  ShipOrderInput,
} from "./delivery.schemas.js";

export class DeliveryService {
  constructor(private readonly repository: DeliveryRepository) {}

  /**
   * Seller dispatches parcel with verified shipping tracking info.
   */
  async markShipped(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
    data: ShipOrderInput,
  ): Promise<OrderWithDelivery> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    const isSeller = order.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");
    if (!isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only the seller or admin can mark an order as shipped.");
    }

    if (order.deliveryMethod === "collection") {
      throw new AppError(400, "INVALID_DELIVERY_METHOD", "This order is configured for collection, not shipping.");
    }

    await withTransaction(async (connection) => {
      const locked = await orderRepository.findByIdForUpdate(orderId, connection);
      if (!locked) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      validateOrderTransition(locked.orderStatus, "shipped");
      await this.repository.updateShipping(orderId, data, connection);
      await orderRepository.updateStatus(orderId, "shipped", undefined, "shipped", connection);
      await auditLogService.record({
        actorAccountId: callerAccountId, action: "order:shipped", targetEntity: "order", targetId: orderId,
        reason: `Order shipped via carrier ${data.carrierName}, tracking #${data.trackingNumber}`,
        metadata: { carrierName: data.carrierName, trackingNumber: data.trackingNumber, trackingUrl: data.trackingUrl },
      }, connection);
    });

    const updated = (await orderRepository.getWithDelivery(orderId))!;
    if (updated.delivery) await notificationService.notifyOrderShipped(updated, updated.delivery).catch(() => undefined);
    return updated;
  }

  /**
   * Seller readies lot for buyer collection.
   */
  async markReadyForCollection(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
    data: ReadyForCollectionInput,
  ): Promise<OrderWithDelivery> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    const isSeller = order.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");
    if (!isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only the seller or admin can mark an order as ready for collection.");
    }

    if (order.deliveryMethod === "shipping") {
      throw new AppError(400, "INVALID_DELIVERY_METHOD", "This order is configured for shipping, not collection.");
    }

    await withTransaction(async (connection) => {
      const locked = await orderRepository.findByIdForUpdate(orderId, connection);
      if (!locked) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      validateOrderTransition(locked.orderStatus, "ready_for_collection");
      await this.repository.updateCollection(orderId, data, connection);
      await orderRepository.updateStatus(orderId, "ready_for_collection", undefined, "ready_for_collection", connection);
      await auditLogService.record({
        actorAccountId: callerAccountId, action: "order:ready_for_collection", targetEntity: "order", targetId: orderId,
        reason: `Collection location and instructions provided: ${data.collectionLocation}`,
        metadata: { collectionLocation: data.collectionLocation },
      }, connection);
    });

    const updated = (await orderRepository.getWithDelivery(orderId))!;
    if (updated.delivery) await notificationService.notifyReadyForCollection(updated, updated.delivery).catch(() => undefined);
    return updated;
  }

  /**
   * Marks order delivered/collected with proof of delivery.
   */
  async markDelivered(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
    data: MarkDeliveredInput,
  ): Promise<OrderWithDelivery> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    const isSeller = order.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");
    if (!isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only the seller or admin can record delivery completion proof.");
    }

    const days = data.buyerConfirmationDeadlineDays || 7;
    const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await withTransaction(async (connection) => {
      const locked = await orderRepository.findByIdForUpdate(orderId, connection);
      if (!locked) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      validateOrderTransition(locked.orderStatus, "delivered");
      await this.repository.updateDelivered(orderId, data, connection);
      await this.repository.setBuyerConfirmationDeadline(orderId, deadline, connection);
      await orderRepository.updateStatus(orderId, "delivered", undefined, locked.deliveryMethod === "collection" ? "collected" : "delivered", connection);
      await auditLogService.record({
        actorAccountId: callerAccountId, action: "order:delivered", targetEntity: "order", targetId: orderId,
        reason: `Proof of delivery (${data.proofOfDeliveryType}) recorded. Confirmation deadline: ${deadline.toISOString()}`,
        metadata: { proofOfDeliveryType: data.proofOfDeliveryType, proofOfDeliveryRef: data.proofOfDeliveryRef, confirmationDeadline: deadline.toISOString() },
      }, connection);
    });

    const updated = (await orderRepository.getWithDelivery(orderId))!;
    await notificationService.notifyOrderDelivered(updated).catch(() => undefined);
    return updated;
  }

  /**
   * Buyer confirms receipt, or admin resolves order completion.
   * Advances order to 'completed' and sets payout readiness.
   */
  async buyerConfirmDelivery(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
    data?: BuyerConfirmDeliveryInput,
  ): Promise<OrderWithDelivery> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    const isBuyer = order.buyerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");
    if (!isBuyer && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only the buyer or admin can confirm delivery receipt.");
    }

    if (order.orderStatus === "disputed") {
      throw new AppError(409, "ORDER_DISPUTED", "Cannot confirm delivery while order is under an active dispute.");
    }

    await withTransaction(async (connection) => {
      const locked = await orderRepository.findByIdForUpdate(orderId, connection);
      if (!locked) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      validateOrderTransition(locked.orderStatus, "completed");
      await this.repository.updateBuyerConfirmed(orderId, connection);
      await orderRepository.updateStatus(orderId, "completed", undefined, locked.deliveryMethod === "collection" ? "collected" : "delivered", connection);
      await auditLogService.record({
        actorAccountId: callerAccountId, action: "order:completed", targetEntity: "order", targetId: orderId,
        reason: isBuyer ? `Buyer confirmed successful receipt${data?.notes ? `: ${data.notes}` : ""}` : `Admin marked order completed${data?.notes ? `: ${data.notes}` : ""}`,
        metadata: { confirmedBy: isBuyer ? "buyer" : "admin", notes: data?.notes, payoutStatus: "ready_for_payout" },
      }, connection);
    });

    const updated = (await orderRepository.getWithDelivery(orderId))!;
    await notificationService.notifyOrderCompleted(updated).catch(() => undefined);
    return updated;
  }

  /**
   * Sweeper to auto-complete delivered orders once buyer confirmation window expires with no dispute.
   */
  async sweepTimeoutConfirmations(now: Date = new Date()): Promise<number> {
    const expiredOrders = await this.repository.findOrdersExpiredForConfirmation(now);
    let completedCount = 0;

    for (const order of expiredOrders) {
      const completed = await withTransaction(async (connection) => {
        const locked = await orderRepository.findByIdForUpdate(order.id, connection);
        if (!locked || !["delivered", "buyer_confirmation"].includes(locked.orderStatus) || !locked.buyerConfirmationDeadline || locked.buyerConfirmationDeadline > now) return false;
        const [activeDisputes] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM disputes WHERE order_id = ? AND status IN ('opened', 'under_review') LIMIT 1 FOR UPDATE",
          [order.id],
        );
        if (activeDisputes.length > 0) return false;
        await this.repository.updateBuyerConfirmed(order.id, connection);
        await orderRepository.updateStatus(order.id, "completed", undefined, locked.deliveryMethod === "collection" ? "collected" : "delivered", connection);
        await auditLogService.record({
          actorAccountId: null, action: "order:completed", targetEntity: "order", targetId: order.id,
          reason: "Auto-completed after buyer confirmation window expired with no dispute filed.",
          metadata: { sweptAt: now.toISOString(), previousStatus: locked.orderStatus },
        }, connection);
        return true;
      });
      if (completed) {
        const updated = await orderRepository.findById(order.id);
        if (updated) await notificationService.notifyOrderCompleted(updated).catch(() => undefined);
        completedCount++;
      }
    }

    return completedCount;
  }
}

export const deliveryService = new DeliveryService(deliveryRepository);
