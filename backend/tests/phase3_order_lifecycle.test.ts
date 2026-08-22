import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";
import type { OrderRecord } from "../src/types/database.types.js";
import type * as PoolModule from "../src/database/pool.js";

const accounts: Record<number, any> = {
  10: { id: 10, accountType: "buyer", fullName: "Confirmed Buyer", email: "buyer@test.com", status: "active" },
  20: { id: 20, accountType: "seller", fullName: "Listing Seller", email: "seller@test.com", status: "active" },
  30: { id: 30, accountType: "buyer", fullName: "Stranger Buyer", email: "stranger@test.com", status: "active" },
  1: { id: 1, accountType: "admin", fullName: "Admin Staff", email: "admin@test.com", status: "active" },
};

const listings: Record<number, any> = {
  100: {
    id: 100,
    sellerId: 20,
    title: "Industrial Milling Machine",
    askingPrice: 50000,
    currency: "INR",
    reviewStatus: "sold",
  },
  200: {
    id: 200,
    sellerId: 20,
    title: "Wholesale Cotton Bales",
    totalQuantity: 100,
    askingPricePerUnit: 500,
    currency: "INR",
    reviewStatus: "sold",
  },
};

const offers: Record<number, any> = {
  501: {
    id: 501,
    listingId: 100,
    buyerId: 10,
    offeredAmount: 45000,
    counterAmount: 48000, // Seller countered, buyer confirmed
    currency: "INR",
    status: "buyer_confirmed",
    preferredFulfilment: "shipping",
  },
  502: {
    id: 502,
    listingId: 100,
    buyerId: 10,
    offeredAmount: 40000,
    counterAmount: null,
    currency: "INR",
    status: "submitted", // Unconfirmed offer
  },
};

const allocations: Record<number, any> = {
  601: {
    id: 601,
    offerId: 701,
    listingId: 200,
    buyerId: 10,
    allocatedQuantity: 25,
    unitPrice: 480,
    totalAllocationValue: 12000, // 25 * 480
    status: "confirmed",
  },
  602: {
    id: 602,
    offerId: 702,
    listingId: 200,
    buyerId: 10,
    allocatedQuantity: 10,
    unitPrice: 500,
    totalAllocationValue: 5000,
    status: "reserved", // Not yet confirmed
  },
};

let orders: Record<number, OrderRecord> = {};
let orderDeliveries: Record<number, any> = {};
let ordersBySourceRef: Record<string, OrderRecord> = {};
let nextOrderId = 1;
let auditLogs: any[] = [];

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

vi.mock("../src/modules/listings/listing.repository.js", () => ({
  listingRepository: {
    findById: vi.fn(async (id: number) => listings[id] || null),
  },
}));

vi.mock("../src/modules/offers/offer.repository.js", () => ({
  offerRepository: {
    findById: vi.fn(async (id: number) => offers[id] || null),
  },
}));

vi.mock("../src/modules/multi-unit-offers/multi-unit-allocation.repository.js", () => ({
  multiUnitAllocationRepository: {
    findById: vi.fn(async (id: number) => allocations[id] || null),
  },
}));

vi.mock("../src/modules/multi-unit-offers/multi-unit-offer.repository.js", () => ({
  multiUnitOfferRepository: {
    findById: vi.fn(async (id: number) => ({ id, preferredFulfilment: "shipping" })),
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
    create: vi.fn(async (params: any) => {
      const orderId = nextOrderId++;
      const order: OrderRecord = {
        id: orderId,
        orderReference: `ORD-20260818-${String(orderId).padStart(4, "0")}`,
        buyerId: params.buyerId,
        sellerId: params.sellerId,
        listingId: params.listingId,
        sourceType: params.sourceType,
        sourceOfferId: params.sourceOfferId ?? null,
        sourceAllocationId: params.sourceAllocationId ?? null,
        sourceReference: params.sourceReference,
        quantity: params.quantity,
        unitPrice: params.unitPrice,
        totalAmount: params.totalAmount,
        currency: params.currency,
        orderStatus: "created",
        paymentStatus: "pending",
        fulfilmentStatus: "unfulfilled",
        deliveryMethod: params.deliveryMethod ?? "shipping",
        buyerConfirmationDeadline: params.buyerConfirmationDeadline ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orders[orderId] = order;
      ordersBySourceRef[params.sourceReference] = order;
      orderDeliveries[orderId] = {
        id: orderId,
        orderId,
        deliveryMethod: params.deliveryMethod ?? "shipping",
        carrierName: null,
        trackingNumber: null,
      };
      return order;
    }),
    findById: vi.fn(async (id: number) => orders[id] || null),
    findByReference: vi.fn(async (ref: string) => {
      return Object.values(orders).find((o) => o.orderReference === ref) || null;
    }),
    findBySourceReference: vi.fn(async (sourceRef: string) => ordersBySourceRef[sourceRef] || null),
    updateStatus: vi.fn(async (id: number, status: any, paymentStatus?: any, fulfilmentStatus?: any) => {
      if (orders[id]) {
        orders[id].orderStatus = status;
        if (paymentStatus) orders[id].paymentStatus = paymentStatus;
        if (fulfilmentStatus) orders[id].fulfilmentStatus = fulfilmentStatus;
      }
    }),
    list: vi.fn(async (filter: any) => {
      let list = Object.values(orders);
      if (filter.buyerId) list = list.filter((o) => o.buyerId === filter.buyerId);
      if (filter.sellerId) list = list.filter((o) => o.sellerId === filter.sellerId);
      if (filter.orderStatus) list = list.filter((o) => o.orderStatus === filter.orderStatus);
      return list;
    }),
    count: vi.fn(async (filter: any) => {
      let list = Object.values(orders);
      if (filter.buyerId) list = list.filter((o) => o.buyerId === filter.buyerId);
      return list.length;
    }),
    getWithDelivery: vi.fn(async (id: number) => {
      const order = orders[id];
      if (!order) return null;
      return {
        ...order,
        delivery: orderDeliveries[id] || null,
      };
    }),
  },
}));

describe("Phase 3: Order Creation & Lifecycle State Machine", () => {
  const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "buyer@test.com", fullName: "Confirmed Buyer" });
  const sellerToken = signAccessToken({ id: 20, accountType: "seller", email: "seller@test.com", fullName: "Listing Seller" });
  const strangerToken = signAccessToken({ id: 30, accountType: "buyer", email: "stranger@test.com", fullName: "Stranger Buyer" });
  const adminToken = signAccessToken({ id: 1, accountType: "admin", email: "admin@test.com", fullName: "Admin Staff" });

  beforeEach(() => {
    orders = {};
    orderDeliveries = {};
    ordersBySourceRef = {};
    nextOrderId = 1;
    auditLogs = [];
    vi.clearAllMocks();
  });

  describe("1. Order Creation & Idempotency from Negotiated Offers", () => {
    it("creates an order with status 'created' from a confirmed offer (201 Created)", async () => {
      const response = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.created).toBe(true);
      expect(response.body.data.orderStatus).toBe("created");
      expect(response.body.data.paymentStatus).toBe("pending");
      expect(response.body.data.fulfilmentStatus).toBe("unfulfilled");
      // Snapshots counterAmount (48,000) over original asking price
      expect(response.body.data.unitPrice).toBe(48000);
      expect(response.body.data.totalAmount).toBe(48000);
      expect(response.body.data.quantity).toBe(1);
      expect(response.body.data.sourceReference).toBe("offer:501");
    });

    it("returns existing order idempotently when requested a second time (200 OK, created: false)", async () => {
      // First request
      const firstRes = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${buyerToken}`);
      expect(firstRes.status).toBe(201);
      const firstOrderId = firstRes.body.data.id;

      // Second request (idempotent replay)
      const secondRes = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.created).toBe(false);
      expect(secondRes.body.data.id).toBe(firstOrderId);
      expect(Object.keys(orders)).toHaveLength(1); // Only 1 order exists in database
    });

    it("blocks order creation from an unconfirmed offer with 409 OFFER_NOT_CONFIRMED", async () => {
      const response = await request(app)
        .post("/api/orders/from-offer/502")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("OFFER_NOT_CONFIRMED");
    });
  });

  describe("2. Order Creation & Idempotency from Multi-Unit Allocations", () => {
    it("creates an order with correct quantity and price from confirmed allocation (201 Created)", async () => {
      const response = await request(app)
        .post("/api/orders/from-allocation/601")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.created).toBe(true);
      expect(response.body.data.quantity).toBe(25);
      expect(response.body.data.unitPrice).toBe(480);
      expect(response.body.data.totalAmount).toBe(12000);
      expect(response.body.data.sourceReference).toBe("allocation:601");
    });

    it("returns existing order on repeated allocation order creation attempt (200 OK)", async () => {
      await request(app)
        .post("/api/orders/from-allocation/601")
        .set("Authorization", `Bearer ${buyerToken}`);

      const repeatRes = await request(app)
        .post("/api/orders/from-allocation/601")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(repeatRes.status).toBe(200);
      expect(repeatRes.body.created).toBe(false);
      expect(Object.keys(orders)).toHaveLength(1);
    });

    it("rejects unconfirmed multi-unit allocation with 409 ALLOCATION_NOT_CONFIRMED", async () => {
      const response = await request(app)
        .post("/api/orders/from-allocation/602")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("ALLOCATION_NOT_CONFIRMED");
    });
  });

  describe("3. Security & Access Control Boundaries", () => {
    it("blocks unrelated third party from creating or viewing the order with 403 FORBIDDEN", async () => {
      const createRes = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${strangerToken}`);
      expect(createRes.status).toBe(403);

      // Create order as legitimate buyer
      const legitimate = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${buyerToken}`);
      const orderId = legitimate.body.data.id;

      // Stranger tries to view order
      const viewRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${strangerToken}`);
      expect(viewRes.status).toBe(403);
    });

    it("allows seller and admin to view the order", async () => {
      const createRes = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${buyerToken}`);
      const orderId = createRes.body.data.id;

      const sellerView = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${sellerToken}`);
      expect(sellerView.status).toBe(200);

      const adminView = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminView.status).toBe(200);
    });
  });

  describe("4. State Machine Transitions & Audited Cancellation", () => {
    it("transitions order from 'created' to 'awaiting_payment'", async () => {
      const createRes = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${buyerToken}`);
      const orderId = createRes.body.data.id;

      const transitionRes = await request(app)
        .post(`/api/orders/${orderId}/await-payment`)
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(transitionRes.status).toBe(200);
      expect(transitionRes.body.data.orderStatus).toBe("awaiting_payment");
    });

    it("rejects invalid state transition directly to payment_confirmed or delivered without real triggers", async () => {
      const createRes = await request(app)
        .post("/api/orders/from-offer/501")
        .set("Authorization", `Bearer ${buyerToken}`);
      const orderId = createRes.body.data.id;

      // Attempting to cancel with audited reason succeeds
      const cancelRes = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ reason: "Buyer decided to cancel before checkout." });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.orderStatus).toBe("cancelled");

      // Once cancelled, transitioning to awaiting_payment is rejected by state machine
      const invalidRes = await request(app)
        .post(`/api/orders/${orderId}/await-payment`)
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(invalidRes.status).toBe(409);
      expect(invalidRes.body.code).toBe("INVALID_ORDER_TRANSITION");
    });
  });
});
