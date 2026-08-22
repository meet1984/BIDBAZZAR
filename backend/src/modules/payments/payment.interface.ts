import type {
  CreatePaymentSessionInput,
  PaymentSessionResult,
  ProviderWebhookEvent,
} from "./payment.types.js";

/**
 * Provider-Neutral Payment Gateway Interface.
 * All third-party payment adapters (Stripe, Razorpay, Escrow.com, etc.) must implement this interface.
 */
export interface IPaymentProviderAdapter {
  readonly providerName: string;

  /**
   * Initializes a payment checkout session with the external provider.
   */
  createSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult>;

  /**
   * Cryptographically verifies the webhook signature against the raw request body.
   */
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): boolean;

  /**
   * Parses the raw provider webhook payload into a normalized ProviderWebhookEvent.
   */
  parseWebhookEvent(
    rawBody: string | Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): ProviderWebhookEvent;
}
