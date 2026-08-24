import { isDuplicateEntry, withTransaction } from "../../database/pool.js";
import { AppError } from "../../shared/AppError.js";
import { auditLogService } from "../audit-log/audit-log.service.js";
import { hasAdminCapability } from "../admin-permissions/admin-permission.authorization.js";
import { listingRepository } from "../listings/listing.repository.js";
import { multiUnitAllocationRepository } from "../multi-unit-offers/multi-unit-allocation.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { offerRepository } from "../offers/offer.repository.js";
import { validateOrderTransition } from "./order-state.machine.js";
import { orderRepository, type OrderRepository } from "./order.repository.js";
import type { CreateOrderParams, ListOrdersFilter, OrderDetails, OrderRecord } from "./order.types.js";

export class OrderService {
  constructor(private readonly repository: OrderRepository) { }

  /**
   * Idempotently creates an order record from a confirmed single-item negotiated offer.
   */
  async createFromOffer(
    offerId: number,
    callerAccountId: number,
    callerAccountType?: string,
  ): Promise<{ order: OrderRecord; created: boolean }> {
    const offer = await offerRepository.findById(offerId);
    if (!offer) {
      throw new AppError(404, "OFFER_NOT_FOUND", "The requested offer was not found.");
    }

    if (offer.status !== "buyer_confirmed") {
      throw new AppError(
        409,
        "OFFER_NOT_CONFIRMED",
        `Orders can only be created from confirmed offers. Current offer status: '${offer.status}'.`,
      );
    }

    const listing = await listingRepository.findById(offer.listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Associated listing not found.");
    }

    // Permission check: Caller must be the buyer, the seller, or an admin
    const isBuyer = offer.buyerId === callerAccountId;
    const isSeller = listing.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to create an order for this offer.");
    }

    const sourceReference = `offer:${offerId}`;

    // 1. Application-level Idempotency check
    const existingOrder = await this.repository.findBySourceReference(sourceReference);
    if (existingOrder) {
      return { order: existingOrder, created: false };
    }

    const agreedPrice = offer.counterAmount ?? offer.offeredAmount;
    const createParams: CreateOrderParams = {
      buyerId: offer.buyerId,
      sellerId: listing.sellerId,
      listingId: listing.id,
      sourceType: "negotiated_offer",
      sourceOfferId: offer.id,
      sourceAllocationId: null,
      sourceReference,
      quantity: 1,
      unitPrice: agreedPrice,
      totalAmount: agreedPrice,
      currency: offer.currency || listing.currency || "INR",
    };

    try {
      const order = await withTransaction(async (connection) => {
        const created = await this.repository.create(createParams, connection);
        await auditLogService.record({
          actorAccountId: callerAccountId,
          action: "order:created",
          targetEntity: "order",
          targetId: created.id,
          reason: `Order created from confirmed offer #${offerId}`,
          metadata: {
            orderReference: created.orderReference,
            offerId,
            totalAmount: created.totalAmount,
            currency: created.currency,
          },
        }, connection);
        return created;
      });

      return { order, created: true };
    } catch (err) {
      // 2. Database-level Idempotency check (handle race condition on unique key uq_orders_source_ref)
      if (isDuplicateEntry(err)) {
        const raceOrder = await this.repository.findBySourceReference(sourceReference);
        if (raceOrder) {
          return { order: raceOrder, created: false };
        }
      }
      throw err;
    }
  }

  /**
   * Idempotently creates an order record from a confirmed multi-unit allocation.
   */
  async createFromAllocation(
    allocationId: number,
    callerAccountId: number,
    callerAccountType?: string,
  ): Promise<{ order: OrderRecord; created: boolean }> {
    const allocation = await multiUnitAllocationRepository.findById(allocationId);
    if (!allocation) {
      throw new AppError(404, "ALLOCATION_NOT_FOUND", "The requested allocation was not found.");
    }

    if (allocation.status !== "confirmed") {
      throw new AppError(
        409,
        "ALLOCATION_NOT_CONFIRMED",
        `Orders can only be created from confirmed allocations. Current allocation status: '${allocation.status}'.`,
      );
    }

    const listing = await listingRepository.findById(allocation.listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "Associated listing not found.");
    }
    const isBuyer = allocation.buyerId === callerAccountId;
    const isSeller = listing.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to create an order for this allocation.");
    }

    const sourceReference = `allocation:${allocationId}`;

    // 1. Application-level Idempotency check
    const existingOrder = await this.repository.findBySourceReference(sourceReference);
    if (existingOrder) {
      return { order: existingOrder, created: false };
    }

    const createParams: CreateOrderParams = {
      buyerId: allocation.buyerId,
      sellerId: listing.sellerId,
      listingId: listing.id,
      sourceType: "multi_unit_allocation",
      sourceOfferId: null,
      sourceAllocationId: allocation.id,
      sourceReference,
      quantity: allocation.allocatedQuantity,
      unitPrice: allocation.unitPrice,
      totalAmount: allocation.totalAllocationValue,
      currency: listing.currency || "INR",
    };

    try {
      const order = await withTransaction(async (connection) => {
        const created = await this.repository.create(createParams, connection);
        await auditLogService.record({
          actorAccountId: callerAccountId,
          action: "order:created",
          targetEntity: "order",
          targetId: created.id,
          reason: `Order created from confirmed multi-unit allocation #${allocationId}`,
          metadata: {
            orderReference: created.orderReference,
            allocationId,
            quantity: created.quantity,
            unitPrice: created.unitPrice,
            totalAmount: created.totalAmount,
          },
        }, connection);
        return created;
      });

      return { order, created: true };
    } catch (err) {
      if (isDuplicateEntry(err)) {
        const raceOrder = await this.repository.findBySourceReference(sourceReference);
        if (raceOrder) {
          return { order: raceOrder, created: false };
        }
      }
      throw err;
    }
  }

  /**
   * Cancels an order with an audited reason.
   */
  async cancelOrder(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
    reason: string,
  ): Promise<OrderRecord> {
    const order = await this.repository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    const isBuyer = order.buyerId === callerAccountId;
    const isSeller = order.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to cancel this order.");
    }

    return withTransaction(async (connection) => {
      const locked = await this.repository.findByIdForUpdate(orderId, connection);
      if (!locked) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      if (!isAdmin && locked.orderStatus !== "confirmed") {
        throw new AppError(
          409,
          "ORDER_NOT_CANCELLABLE",
          "Completed or disputed deals cannot be cancelled directly. Please open a dispute or contact support.",
        );
      }
      validateOrderTransition(locked.orderStatus, "cancelled");
      await this.repository.updateStatus(orderId, "cancelled", connection);
      await auditLogService.record({
        actorAccountId: callerAccountId,
        action: "order:cancelled",
        targetEntity: "order",
        targetId: orderId,
        reason,
        metadata: { previousStatus: locked.orderStatus, cancelledBy: callerAccountType },
      }, connection);
      return (await this.repository.findById(orderId, connection))!;
    });
  }

  /**
   * Records one participant's completion. The deal becomes completed only
   * after both buyer and seller confirm independently.
   */
  async completeOrder(
    orderId: number,
    callerAccountId: number,
    note?: string,
  ): Promise<OrderRecord> {
    const order = await this.repository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    const isBuyer = order.buyerId === callerAccountId;
    const isSeller = order.sellerId === callerAccountId;
    if (!isBuyer && !isSeller) {
      throw new AppError(403, "FORBIDDEN", "Only the buyer or seller can confirm completion of this deal.");
    }

    if (!["confirmed", "completed"].includes(order.orderStatus)) {
      throw new AppError(
        409,
        "ORDER_CANNOT_BE_COMPLETED",
        `Orders in '${order.orderStatus}' status cannot be marked as completed.`,
      );
    }

    const party = isBuyer ? "buyer" : "seller";
    const updated = await withTransaction(async (connection) => {
      const locked = await this.repository.findByIdForUpdate(orderId, connection);
      if (!locked) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      if (locked.orderStatus !== "completed") validateOrderTransition(locked.orderStatus, "completed");
      const result = await this.repository.confirmPartyCompletion(orderId, party, connection);
      await auditLogService.record({
        actorAccountId: callerAccountId,
        action: "order:completion_confirmed",
        targetEntity: "order",
        targetId: orderId,
        reason: note || `${party} confirmed the direct transaction is complete`,
        metadata: { party, finalStatus: result.orderStatus },
      }, connection);
      return result;
    });
    if (updated.orderStatus === "completed" && order.orderStatus !== "completed") {
      await notificationService.notifyOrderCompleted(updated).catch(() => undefined);
    }
    return updated;
  }

  async getOrder(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
  ): Promise<OrderDetails> {
    const order = await this.repository.getDetails(orderId);
    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const isBuyer = order.buyerId === callerAccountId;
    const isSeller = order.sellerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to view this order.");
    }

    return order;
  }

  async getOrderByReference(
    orderReference: string,
    callerAccountId: number,
    callerAccountType: string,
  ): Promise<OrderDetails> {
    const order = await this.repository.findByReference(orderReference);
    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
    }
    return this.getOrder(order.id, callerAccountId, callerAccountType);
  }

  async listBuyerOrders(buyerId: number, filter: ListOrdersFilter = {}) {
    const [items, total] = await Promise.all([
      this.repository.list({ ...filter, buyerId }),
      this.repository.count({ ...filter, buyerId }),
    ]);
    return { items, total };
  }

  async listSellerOrders(sellerId: number, filter: ListOrdersFilter = {}) {
    const [items, total] = await Promise.all([
      this.repository.list({ ...filter, sellerId }),
      this.repository.count({ ...filter, sellerId }),
    ]);
    return { items, total };
  }

  async listAdminOrders(filter: ListOrdersFilter = {}) {
    const [items, total] = await Promise.all([
      this.repository.list(filter),
      this.repository.count(filter),
    ]);
    return { items, total };
  }
}

export const orderService = new OrderService(orderRepository);
