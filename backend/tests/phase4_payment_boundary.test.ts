import crypto from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { signAccessToken } from "../src/shared/tokens.js";
import type { OrderRecord } from "../src/types/database.types.js";
import type * as PoolModule from "../src/database/pool.js";

const accounts: Record<number, any> = {
  10: { id: 10, accountType: "buyer", fullName: "Confirmed Buyer", email: "buyer@test.com", status: "active" },
  20: { id: 20, accountType: "seller", fullName: "Listing Seller", email: "seller@test.com", status: "active" },
  1: { id: 1, accountType: "admin", fullName: "Admin Staff", email: "admin@test.com", status: "active" },
};

let orders: Record<number, OrderRecord> = {
  101: {
    id: 101,
    orderReference: "ORD-20260818-0101",
    buyerId: 10,
    sellerId: 20,
    listingId: 50,
    sourceType: "negotiated_offer",
    sourceOfferId: 1,
    sourceAllocationId: null,
    sourceReference: "offer:1",
    quantity: 1,
    unitPrice: 50000,
    totalAmount: 50000,
    currency: "INR",
    orderStatus: "created",
    paymentStatus: "pending",
    fulfilmentStatus: "unfulfilled",
    deliveryMethod: "shipping",
    buyerConfirmationDeadline: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

let paymentEvents: Record<string, any> = {};
let auditLogs: any[] = [];
let nextEventId = 1;

vi.mock("../src/database/pool.js", async (importOriginal) => {
  const actual = await importOriginal<typeof PoolModule>();
  return {
    ...actual,
    withTransaction: vi.fn(async (callback: (connection: any) => Promise<unknown>) => callback({})),
  };
});

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  authRepository: {
    findAccountById: vi.fn(async (id: number) => accounts[id] || null),
  },
}));

vi.mock("../src/modules/audit-log/audit-log.service.js", () => ({
  auditLogService: {
    record: vi.fn(async (params: any) => {
      auditLogs.push(params);
      return 1;
    }),
  },
}));

vi.mock("../src/modules/orders/order.repository.js", () => ({
  orderRepository: {
    findById: vi.fn(async (id: number) => orders[id] || null),
    findByIdForUpdate: vi.fn(async (id: number) => orders[id] || null),
    findByReference: vi.fn(async (ref: string) => Object.values(orders).find((o) => o.orderReference === ref) || null),
    updateStatus: vi.fn(async (id: number, status: any, paymentStatus?: any) => {
      if (orders[id]) {
        orders[id].orderStatus = status;
        if (paymentStatus) orders[id].paymentStatus = paymentStatus;
      }
    }),
  },
}));

vi.mock("../src/modules/payments/payment-events.repository.js", () => ({
  paymentEventsRepository: {
    create: vi.fn(async (event: any) => {
      const id = nextEventId++;
      paymentEvents[event.providerEventId] = {
        id,
        ...event,
        createdAt: new Date(),
      };
      return id;
    }),
    findByEventId: vi.fn(async (eventId: string) => paymentEvents[eventId] || null),
    listByOrderId: vi.fn(async (orderId: number) => {
      return Object.values(paymentEvents).filter((e) => e.orderId === orderId);
    }),
    updateProcessedStatus: vi.fn(async (id: number, status: any) => {
      const event = Object.values(paymentEvents).find((e) => e.id === id);
      if (event) event.processedStatus = status;
    }),
  },
}));

function signPayload(payload: Record<string, unknown>): string {
  const bodyStr = JSON.stringify(payload);
  return crypto
    .createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET)
    .update(bodyStr)
    .digest("hex");
}

describe("Phase 4: Payment Boundary & Webhook Invariants", () => {
  const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "buyer@test.com", fullName: "Confirmed Buyer" });

  beforeEach(() => {
    orders = {
      101: {
        id: 101,
        orderReference: "ORD-20260818-0101",
        buyerId: 10,
        sellerId: 20,
        listingId: 50,
        sourceType: "negotiated_offer",
        sourceOfferId: 1,
        sourceAllocationId: null,
        sourceReference: "offer:1",
        quantity: 1,
        unitPrice: 50000,
        totalAmount: 50000,
        currency: "INR",
        orderStatus: "created",
        paymentStatus: "pending",
        fulfilmentStatus: "unfulfilled",
        deliveryMethod: "shipping",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    paymentEvents = {};
    auditLogs = [];
    nextEventId = 1;
    vi.clearAllMocks();
  });

  describe("1. Client Checkout Session Boundary", () => {
    it("returns 'payment_integration_pending' and ignores any client-supplied payment success flags", async () => {
      const response = await request(app)
        .post("/api/payments/orders/101/checkout")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          paymentSuccessful: true, // Fake client attempt to bypass payment
          simulatedStatus: "succeeded",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("payment_integration_pending");

      // The order must NOT be marked as payment_confirmed
      expect(orders[101]!.orderStatus).toBe("awaiting_payment");
      expect(orders[101]!.paymentStatus).toBe("pending");
    });
  });

  describe("2. Webhook Cryptographic Verification", () => {
    it("rejects unauthenticated/unsigned webhooks with 401 MISSING_SIGNATURE", async () => {
      const response = await request(app)
        .post("/api/payments/webhook")
        .send({
          eventId: "evt_test_001",
          eventType: "payment.succeeded",
          orderId: 101,
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("MISSING_SIGNATURE");
    });

    it("rejects forged/tampered webhook signatures with 401 INVALID_WEBHOOK_SIGNATURE", async () => {
      const payload = {
        eventId: "evt_test_002",
        eventType: "payment.succeeded",
        orderId: 101,
      };

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("x-webhook-signature", "forged_invalid_signature_hex_code_1234567890abcdef")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_WEBHOOK_SIGNATURE");
    });
  });

  describe("3. Verified Webhook Processing & Idempotency", () => {
    it("successfully confirms payment on verified provider webhook event", async () => {
      // Transition order to awaiting_payment
      orders[101]!.orderStatus = "awaiting_payment";

      const payload = {
        eventId: "evt_prov_1001",
        eventType: "payment.succeeded",
        orderId: 101,
        transactionRef: "txn_rzp_987654321",
        amount: 50000,
        currency: "INR",
      };
      const signature = signPayload(payload);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("x-webhook-signature", signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(true);
      expect(response.body.data.newOrderStatus).toBe("payment_confirmed");

      // Verify order status updated to payment_confirmed with held_pending_confirmation
      expect(orders[101]!.orderStatus).toBe("payment_confirmed");
      expect(orders[101]!.paymentStatus).toBe("held_pending_confirmation");

      // Verify event was stored in payment_events
      expect(paymentEvents["evt_prov_1001"]).toBeDefined();
      expect(paymentEvents["evt_prov_1001"].processedStatus).toBe("processed");
    });

    it("idempotently handles duplicate delivery of the same webhook event (ignored: true)", async () => {
      orders[101]!.orderStatus = "awaiting_payment";

      const payload = {
        eventId: "evt_prov_1002",
        eventType: "payment.succeeded",
        orderId: 101,
        transactionRef: "txn_rzp_11223344",
      };
      const signature = signPayload(payload);

      // First webhook delivery
      const firstRes = await request(app)
        .post("/api/payments/webhook")
        .set("x-webhook-signature", signature)
        .send(payload);
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.data.processed).toBe(true);

      // Second webhook delivery (replay/network retry)
      const secondRes = await request(app)
        .post("/api/payments/webhook")
        .set("x-webhook-signature", signature)
        .send(payload);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.processed).toBe(false);
      expect(secondRes.body.data.ignored).toBe(true);
      expect(secondRes.body.data.message).toContain("already");
    });

    it("records payment failure event and transitions order to payment_failed", async () => {
      orders[101]!.orderStatus = "awaiting_payment";

      const payload = {
        eventId: "evt_prov_1003",
        eventType: "payment.failed",
        orderId: 101,
        transactionRef: "txn_failed_001",
      };
      const signature = signPayload(payload);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("x-webhook-signature", signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.data.processed).toBe(true);
      expect(orders[101]!.orderStatus).toBe("payment_failed");
      expect(orders[101]!.paymentStatus).toBe("failed");
    });
  });
});
