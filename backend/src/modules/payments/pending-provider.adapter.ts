import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/AppError.js";
import type { IPaymentProviderAdapter } from "./payment.interface.js";
import type {
  CreatePaymentSessionInput,
  PaymentSessionResult,
  ProviderWebhookEvent,
  WebhookEventStatus,
} from "./payment.types.js";

export class PendingPaymentProviderAdapter implements IPaymentProviderAdapter {
  readonly providerName = "pending_provider";

  /**
   * Returns a clear 'payment_integration_pending' response.
   * Real card details or simulated automatic successes are strictly never returned.
   */
  createSession(_input: CreatePaymentSessionInput): Promise<PaymentSessionResult> {
    return Promise.resolve({
      provider: this.providerName,
      status: "payment_integration_pending",
      message:
        "Payment integration pending configuration. Live card capture and provider checkout will be activated upon merchant gateway approval.",
    });
  }

  /**
   * Cryptographically validates HMAC SHA256 signature against the raw body payload.
   */
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): boolean {
    if (!signatureHeader || !signatureHeader.trim()) {
      return false;
    }

    try {
      const secret = env.PAYMENT_WEBHOOK_SECRET;
      const expectedHmac = crypto
        .createHmac("sha256", secret)
        .update(typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"))
        .digest("hex");

      const cleanSignature = signatureHeader.replace(/^sha256=/, "").trim();

      return crypto.timingSafeEqual(
        Buffer.from(expectedHmac, "hex"),
        Buffer.from(cleanSignature, "hex"),
      );
    } catch {
      return false;
    }
  }

  /**
   * Parses and normalizes incoming provider webhook events.
   */
  parseWebhookEvent(
    rawBody: string | Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): ProviderWebhookEvent {
    let payload: Record<string, unknown>;
    try {
      const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
      payload = JSON.parse(bodyStr) as Record<string, unknown>;
    } catch {
      throw new AppError(400, "INVALID_WEBHOOK_PAYLOAD", "Webhook body is not valid JSON.");
    }

    const eventId =
      typeof payload.eventId === "string"
        ? payload.eventId
        : typeof payload.event_id === "string"
          ? payload.event_id
          : typeof payload.id === "string"
            ? payload.id
            : "";
    const eventType =
      typeof payload.eventType === "string"
        ? payload.eventType
        : typeof payload.event_type === "string"
          ? payload.event_type
          : typeof payload.type === "string"
            ? payload.type
            : "";
    const dataObj = typeof payload.data === "object" && payload.data !== null ? (payload.data as Record<string, unknown>) : null;
    const rawOrderId = payload.orderId ?? payload.order_id ?? dataObj?.orderId ?? dataObj?.order_id;
    const orderId = typeof rawOrderId === "number" ? rawOrderId : Number(rawOrderId) || 0;
    const transactionRef =
      typeof payload.transactionRef === "string"
        ? payload.transactionRef
        : typeof payload.transaction_ref === "string"
          ? payload.transaction_ref
          : typeof payload.transactionId === "string"
            ? payload.transactionId
            : typeof payload.transaction_id === "string"
              ? payload.transaction_id
              : null;

    if (!eventId || !eventType || !orderId) {
      throw new AppError(422, "MALFORMED_WEBHOOK", "Missing required webhook fields (eventId, eventType, orderId).");
    }

    let status: WebhookEventStatus;
    if (eventType === "payment.succeeded" || eventType === "charge.successful") {
      status = "succeeded";
    } else if (eventType === "payment.failed" || eventType === "charge.failed") {
      status = "failed";
    } else if (eventType === "payment.refunded" || eventType === "charge.refunded") {
      status = "refunded";
    } else {
      throw new AppError(422, "UNSUPPORTED_WEBHOOK_EVENT", `Unsupported payment webhook event type: ${eventType}.`);
    }

    return {
      provider: this.providerName,
      eventId,
      eventType,
      orderId,
      transactionRef,
      status,
      rawPayload: {
        eventId,
        eventType,
        orderId,
        transactionRef,
      },
    };
  }
}

export const pendingPaymentProviderAdapter = new PendingPaymentProviderAdapter();
