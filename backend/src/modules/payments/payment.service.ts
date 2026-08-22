import { isDuplicateEntry, withTransaction } from "../../database/pool.js";
import { AppError } from "../../shared/AppError.js";
import { auditLogService } from "../audit-log/audit-log.service.js";
import { hasAdminCapability } from "../admin-permissions/admin-permission.authorization.js";
import { notificationService } from "../notifications/notification.service.js";
import { authRepository } from "../auth/auth.repository.js";
import { validateOrderTransition } from "../orders/order-state.machine.js";
import { orderRepository } from "../orders/order.repository.js";
import { paymentEventsRepository, type PaymentEventsRepository } from "./payment-events.repository.js";
import type { IPaymentProviderAdapter } from "./payment.interface.js";
import { pendingPaymentProviderAdapter } from "./pending-provider.adapter.js";
import type {
  PaymentEventRecord,
  PaymentSessionResult,
  ProcessWebhookResult,
} from "./payment.types.js";

export class PaymentService {
  constructor(
    private readonly adapter: IPaymentProviderAdapter,
    private readonly eventsRepository: PaymentEventsRepository,
  ) {}

  /**
   * Initializes a payment checkout session.
   * Does NOT mark payment as successful (only verified webhooks can do that).
   */
  async createPaymentSession(
    orderId: number,
    callerAccountId: number,
    callerAccountType: string,
  ): Promise<PaymentSessionResult> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
    }

    const isBuyer = order.buyerId === callerAccountId;
    const isAdmin = await hasAdminCapability(callerAccountId, callerAccountType, "order_oversight");
    if (!isBuyer && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only the buyer or admin can initiate payment.");
    }

    const payableStatuses = ["created", "awaiting_payment", "payment_failed"];

    await withTransaction(async (connection) => {
      const lockedOrder = await orderRepository.findByIdForUpdate(orderId, connection);
      if (!lockedOrder) {
        throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      }
      if (!payableStatuses.includes(lockedOrder.orderStatus)) {
        throw new AppError(
          409,
          "ORDER_NOT_PAYABLE",
          `Orders in '${lockedOrder.orderStatus}' status cannot be paid.`,
        );
      }
      if (lockedOrder.orderStatus === "created") {
        await orderRepository.updateStatus(orderId, "awaiting_payment", undefined, undefined, connection);
      }
    });

    const buyerAccount = await authRepository.findAccountById(order.buyerId);

    const sessionResult = await this.adapter.createSession({
      orderId: order.id,
      orderReference: order.orderReference,
      totalAmount: order.totalAmount,
      currency: order.currency,
      buyerEmail: buyerAccount?.email,
      buyerName: buyerAccount?.fullName,
    });

    await auditLogService.record({
      actorAccountId: callerAccountId,
      action: "payment:session_initiated",
      targetEntity: "order",
      targetId: order.id,
      reason: `Initiated payment checkout with provider '${this.adapter.providerName}'`,
      metadata: {
        provider: this.adapter.providerName,
        totalAmount: order.totalAmount,
        currency: order.currency,
      },
    });

    return sessionResult;
  }

  /**
   * Processes an incoming provider webhook cryptographically and idempotently.
   */
  async handleWebhook(
    rawBody: string | Buffer,
    signatureHeader: string,
    headers: Record<string, string | string[] | undefined> = {},
  ): Promise<ProcessWebhookResult> {
    // 1. Cryptographic signature check
    const isValid = this.adapter.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      throw new AppError(401, "INVALID_WEBHOOK_SIGNATURE", "Provider webhook signature verification failed.");
    }

    // 2. Parse payload into normalized event
    const event = this.adapter.parseWebhookEvent(rawBody, headers);

    // Fast idempotency check; the unique key remains the final race guard.
    const existing = await this.eventsRepository.findByEventId(event.provider, event.eventId);
    if (existing) {
      return {
        processed: false,
        ignored: true,
        eventId: event.eventId,
        orderId: event.orderId,
        message: "Webhook event already processed previously.",
      };
    }

    try {
      const result = await withTransaction(async (connection) => {
        const order = await orderRepository.findByIdForUpdate(event.orderId, connection);
        if (!order) {
          throw new AppError(404, "ORDER_NOT_FOUND", `Order #${event.orderId} referenced in webhook not found.`);
        }

        const eventDbId = await this.eventsRepository.create(
          {
            orderId: event.orderId,
            provider: event.provider,
            providerEventId: event.eventId,
            providerTransactionRef: event.transactionRef,
            eventType: event.eventType,
            rawPayload: event.rawPayload,
            processedStatus: "received",
          },
          connection,
        );

        let targetStatus: "payment_confirmed" | "payment_failed" | "refunded";
        let paymentStatus: "held_pending_confirmation" | "failed" | "refunded";
        let action: string;
        if (event.status === "succeeded") {
          targetStatus = "payment_confirmed";
          paymentStatus = "held_pending_confirmation";
          action = "order:payment_confirmed";
        } else if (event.status === "failed") {
          targetStatus = "payment_failed";
          paymentStatus = "failed";
          action = "order:payment_failed";
        } else {
          targetStatus = "refunded";
          paymentStatus = "refunded";
          action = "order:refunded";
        }

        if (order.orderStatus === targetStatus) {
          await this.eventsRepository.updateProcessedStatus(eventDbId, "ignored", "Order already has the target status", connection);
          return {
            processed: false,
            ignored: true,
            eventId: event.eventId,
            orderId: event.orderId,
            newOrderStatus: order.orderStatus,
            message: "The order already reflects this payment event.",
          };
        }

        validateOrderTransition(order.orderStatus, targetStatus);
        await orderRepository.updateStatus(order.id, targetStatus, paymentStatus, undefined, connection);
        await this.eventsRepository.updateProcessedStatus(eventDbId, "processed", null, connection);
        await auditLogService.record(
          {
            actorAccountId: null,
            action,
            targetEntity: "order",
            targetId: order.id,
            reason: `Verified provider webhook processed [${event.eventId}]`,
            metadata: {
              provider: event.provider,
              transactionRef: event.transactionRef,
              eventType: event.eventType,
              amount: order.totalAmount,
              currency: order.currency,
            },
          },
          connection,
        );

        return {
          processed: true,
          ignored: false,
          eventId: event.eventId,
          orderId: event.orderId,
          newOrderStatus: targetStatus,
          message: "Webhook event processed and verified successfully.",
        };
      });
      if (result.processed) {
        const updatedOrder = await orderRepository.findById(event.orderId);
        if (updatedOrder) {
          if (event.status === "succeeded") await notificationService.notifyPaymentConfirmed(updatedOrder).catch(() => undefined);
          if (event.status === "failed") await notificationService.notifyPaymentFailed(updatedOrder).catch(() => undefined);
        }
      }
      return result;
    } catch (err) {
      if (isDuplicateEntry(err)) {
        return {
          processed: false,
          ignored: true,
          eventId: event.eventId,
          orderId: event.orderId,
          message: "Webhook event already processed (database lock).",
        };
      }
      throw err;
    }
  }

  async listOrderPaymentEvents(orderId: number): Promise<PaymentEventRecord[]> {
    return this.eventsRepository.listByOrderId(orderId);
  }
}

export const paymentService = new PaymentService(
  pendingPaymentProviderAdapter,
  paymentEventsRepository,
);
