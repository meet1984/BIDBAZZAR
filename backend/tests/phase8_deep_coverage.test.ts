import { describe, expect, it } from "vitest";
import { validateOrderTransition } from "../src/modules/orders/order-state.machine.js";
import {
  acceptPartialSchema,
  counterMultiUnitOfferSchema,
  submitMultiUnitOfferSchema,
} from "../src/modules/multi-unit-offers/multi-unit-offer.schemas.js";
import {
  acceptOfferSchema,
  counterOfferSchema,
  submitOfferSchema,
} from "../src/modules/offers/offer.schemas.js";
import { pendingPaymentProviderAdapter } from "../src/modules/payments/pending-provider.adapter.js";
import {
  hasExpectedSignature,
  redactDocument,
} from "../src/modules/verification-documents/verification-documents.service.js";
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
  type AccessTokenUser,
} from "../src/shared/tokens.js";
import type { VerificationDocumentRecord } from "../src/types/database.types.js";
import crypto from "node:crypto";

describe("Phase 8 Deep Coverage Suite — Core Flows, State Machines & Security Boundaries", () => {
  describe("1. Order State Machine Transitions & Invariant Boundaries", () => {
    it("allows valid forward workflow transitions along the standard order lifecycle", () => {
      expect(() => validateOrderTransition("created", "awaiting_payment")).not.toThrow();
      expect(() => validateOrderTransition("awaiting_payment", "payment_confirmed")).not.toThrow();
      expect(() => validateOrderTransition("payment_confirmed", "processing")).not.toThrow();
      expect(() => validateOrderTransition("processing", "shipped")).not.toThrow();
      expect(() => validateOrderTransition("shipped", "delivered")).not.toThrow();
      expect(() => validateOrderTransition("delivered", "completed")).not.toThrow();
    });

    it("allows collection delivery flow transitions", () => {
      expect(() => validateOrderTransition("processing", "ready_for_collection")).not.toThrow();
      expect(() => validateOrderTransition("ready_for_collection", "delivered")).not.toThrow();
    });

    it("allows opening disputes from any active fulfillment state and resolving them", () => {
      expect(() => validateOrderTransition("shipped", "disputed")).not.toThrow();
      expect(() => validateOrderTransition("disputed", "refunded")).not.toThrow();
      expect(() => validateOrderTransition("disputed", "completed")).not.toThrow();
      expect(() => validateOrderTransition("disputed", "partially_refunded")).not.toThrow();
    });

    it("rejects invalid backwards transitions or illegal jumps", () => {
      // Completed orders cannot transition to created or shipped
      expect(() => validateOrderTransition("completed", "created")).toThrow();
      expect(() => validateOrderTransition("completed", "shipped")).toThrow();

      // Cancelled orders cannot be completed or shipped
      expect(() => validateOrderTransition("cancelled", "completed")).toThrow();
      expect(() => validateOrderTransition("cancelled", "shipped")).toThrow();

      // Unconfirmed payment cannot jump directly to delivered
      expect(() => validateOrderTransition("created", "delivered")).toThrow();
    });
  });

  describe("2. Money & Offer Boundary Schemas (Zero/Negative/Malformed Inputs)", () => {
    it("rejects zero and negative offer amounts in single-unit negotiated offers", () => {
      const zeroOffer = submitOfferSchema.safeParse({ offeredAmount: 0 });
      expect(zeroOffer.success).toBe(false);

      const negativeOffer = submitOfferSchema.safeParse({ offeredAmount: -500 });
      expect(negativeOffer.success).toBe(false);

      const validOffer = submitOfferSchema.safeParse({ offeredAmount: 25000 });
      expect(validOffer.success).toBe(true);
    });

    it("rejects zero and negative counter amounts in single-unit counter offers", () => {
      const zeroCounter = counterOfferSchema.safeParse({ counterAmount: 0 });
      expect(zeroCounter.success).toBe(false);

      const negativeCounter = counterOfferSchema.safeParse({ counterAmount: -100 });
      expect(negativeCounter.success).toBe(false);

      const validCounter = counterOfferSchema.safeParse({ counterAmount: 18000 });
      expect(validCounter.success).toBe(true);
    });

    it("enforces positive confirmation deadlines in acceptOfferSchema", () => {
      const validDeadline = acceptOfferSchema.safeParse({ confirmDeadlineHours: 24 });
      expect(validDeadline.success).toBe(true);

      const zeroDeadline = acceptOfferSchema.safeParse({ confirmDeadlineHours: 0 });
      expect(zeroDeadline.success).toBe(false);

      const excessiveDeadline = acceptOfferSchema.safeParse({ confirmDeadlineHours: 500 });
      expect(excessiveDeadline.success).toBe(false);
    });

    it("rejects zero, negative, or fractional quantities in multi-unit offer submissions", () => {
      const zeroQty = submitMultiUnitOfferSchema.safeParse({ quantityRequested: 0, offeredPricePerUnit: 100 });
      expect(zeroQty.success).toBe(false);

      const negativeQty = submitMultiUnitOfferSchema.safeParse({ quantityRequested: -5, offeredPricePerUnit: 100 });
      expect(negativeQty.success).toBe(false);

      const fractionalQty = submitMultiUnitOfferSchema.safeParse({ quantityRequested: 2.5, offeredPricePerUnit: 100 });
      expect(fractionalQty.success).toBe(false);

      const zeroPrice = submitMultiUnitOfferSchema.safeParse({ quantityRequested: 10, offeredPricePerUnit: 0 });
      expect(zeroPrice.success).toBe(false);

      const validMulti = submitMultiUnitOfferSchema.safeParse({ quantityRequested: 10, offeredPricePerUnit: 500 });
      expect(validMulti.success).toBe(true);
    });

    it("validates partial allocation schema boundaries", () => {
      const validPartial = acceptPartialSchema.safeParse({ partialQuantity: 5 });
      expect(validPartial.success).toBe(true);

      const zeroPartial = acceptPartialSchema.safeParse({ partialQuantity: 0 });
      expect(zeroPartial.success).toBe(false);

      const fractionalPartial = acceptPartialSchema.safeParse({ partialQuantity: 1.5 });
      expect(fractionalPartial.success).toBe(false);
    });

    it("validates counter multi-unit offer schema boundaries", () => {
      const validCounter = counterMultiUnitOfferSchema.safeParse({ counterQuantity: 8, counterUnitPrice: 450 });
      expect(validCounter.success).toBe(true);

      const invalidCounterQty = counterMultiUnitOfferSchema.safeParse({ counterQuantity: -1 });
      expect(invalidCounterQty.success).toBe(false);

      const invalidCounterPrice = counterMultiUnitOfferSchema.safeParse({ counterUnitPrice: 0 });
      expect(invalidCounterPrice.success).toBe(false);
    });
  });

  describe("3. Payment Webhook Signature & Event Normalization", () => {
    const rawPayload = JSON.stringify({
      event_id: "evt_test_12345",
      event_type: "payment.succeeded",
      order_id: 42,
      transaction_ref: "tx_mock_999",
      status: "succeeded",
    });

    it("verifies authentic HMAC-SHA256 webhook signatures against PAYMENT_WEBHOOK_SECRET", () => {
      const secret = process.env.PAYMENT_WEBHOOK_SECRET || "test-payment-webhook-key-long-enough-32chars";
      const validSignature = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");

      const isValid = pendingPaymentProviderAdapter.verifyWebhookSignature(rawPayload, validSignature);
      expect(isValid).toBe(true);
    });

    it("rejects forged or tampered webhook signatures", () => {
      const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";
      const isValid = pendingPaymentProviderAdapter.verifyWebhookSignature(rawPayload, forgedSignature);
      expect(isValid).toBe(false);
    });

    it("parses and normalizes webhook events correctly", () => {
      const secret = process.env.PAYMENT_WEBHOOK_SECRET || "test-payment-webhook-key-long-enough-32chars";
      const validSignature = crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");

      const event = pendingPaymentProviderAdapter.parseWebhookEvent(rawPayload, { "x-webhook-signature": validSignature });
      expect(event.eventId).toBe("evt_test_12345");
      expect(event.eventType).toBe("payment.succeeded");
      expect(event.orderId).toBe(42);
      expect(event.status).toBe("succeeded");
      expect(event.provider).toBe("pending_provider");
    });
  });

  describe("4. Verification Document Binary Signatures & Data Redaction", () => {
    it("validates magic bytes for legitimate JPEG, PNG, and PDF files", () => {
      const validJpeg = {
        mimetype: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      } as Express.Multer.File;
      expect(hasExpectedSignature(validJpeg)).toBe(true);

      const validPng = {
        mimetype: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      } as Express.Multer.File;
      expect(hasExpectedSignature(validPng)).toBe(true);

      const validPdf = {
        mimetype: "application/pdf",
        buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
      } as Express.Multer.File;
      expect(hasExpectedSignature(validPdf)).toBe(true);
    });

    it("rejects spoofed files whose binary signatures do not match their declared MIME type", () => {
      const spoofedExeAsPdf = {
        mimetype: "application/pdf",
        buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // Windows PE Executable magic bytes 'MZ'
      } as Express.Multer.File;
      expect(hasExpectedSignature(spoofedExeAsPdf)).toBe(false);
    });

    it("guarantees document redaction excludes internal fileKey and storage paths", () => {
      const docRecord: VerificationDocumentRecord = {
        id: 77,
        accountId: 101,
        accountType: "buyer",
        documentType: "government_id",
        fileKey: "verif_12345678-1234-4234-8234-123456789abc.pdf",
        originalName: "passport.pdf",
        fileMime: "application/pdf",
        fileSize: 102400,
        createdAt: new Date(),
      };

      const redacted = redactDocument(docRecord);

      expect(redacted.id).toBe(77);
      expect(redacted.documentType).toBe("government_id");
      expect(redacted.originalName).toBe("passport.pdf");
      expect(redacted.fileMime).toBe("application/pdf");
      expect(redacted.fileSize).toBe(102400);
      expect((redacted as any).fileKey).toBeUndefined();
      expect((redacted as any).accountId).toBeUndefined();
    });
  });

  describe("5. Cryptographic Token Generation & Verification Boundaries", () => {
    it("signs and verifies JWT access tokens with correct user claims", () => {
      const testUser: AccessTokenUser = {
        id: 42,
        accountType: "buyer",
        role: "buyer",
        isBuyer: true,
        isSeller: false,
        isAdmin: false,
        email: "buyer42@example.test",
        fullName: "Test Buyer",
      };

      const token = signAccessToken(testUser);
      expect(typeof token).toBe("string");

      const decoded = verifyAccessToken(token);
      expect(decoded.id).toBe(42);
      expect(decoded.email).toBe("buyer42@example.test");
      expect(decoded.accountType).toBe("buyer");
    });

    it("generates secure refresh tokens and consistent SHA-256 hashes", () => {
      const refresh = createRefreshToken("family_uuid_123");
      expect(refresh.rawToken).toBeDefined();
      expect(refresh.rawToken.length).toBeGreaterThanOrEqual(32);
      expect(refresh.familyId).toBe("family_uuid_123");

      const hash1 = hashRefreshToken(refresh.rawToken);
      const hash2 = hashRefreshToken(refresh.rawToken);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(refresh.rawToken);
    });
  });
});
