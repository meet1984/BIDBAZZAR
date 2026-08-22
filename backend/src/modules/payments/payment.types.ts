import type { OrderStatus, PaymentEventProcessedStatus, PaymentEventRecord } from "../../types/database.types.js";

export interface CreatePaymentSessionInput {
  orderId: number;
  orderReference: string;
  totalAmount: number;
  currency: string;
  buyerEmail?: string;
  buyerName?: string;
}

export interface PaymentSessionResult {
  provider: string;
  sessionId?: string;
  paymentUrl?: string;
  clientSecret?: string;
  status: "pending" | "payment_integration_pending";
  message: string;
}

export type WebhookEventStatus = "succeeded" | "failed" | "refunded";

export interface ProviderWebhookEvent {
  provider: string;
  eventId: string;
  eventType: string;
  transactionRef?: string | null;
  orderId: number;
  status: WebhookEventStatus;
  rawPayload: Record<string, unknown>;
}

export interface ProcessWebhookResult {
  processed: boolean;
  ignored: boolean;
  eventId: string;
  orderId: number;
  newOrderStatus?: OrderStatus;
  message: string;
}

export interface PaymentEventRecordInput {
  orderId: number;
  provider: string;
  providerEventId: string;
  providerTransactionRef?: string | null;
  eventType: string;
  rawPayload: Record<string, unknown>;
  processedStatus?: PaymentEventProcessedStatus;
  errorMessage?: string | null;
}

export type { PaymentEventProcessedStatus, PaymentEventRecord };
