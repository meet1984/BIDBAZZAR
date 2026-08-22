import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";
import type { OrderDeliveryRecord, OrderRecord } from "../src/types/database.types.js";
import { deliveryService } from "../src/modules/delivery/delivery.service.js";
import type * as PoolModule from "../src/database/pool.js";

const accounts: Record<number, any> = {
  10: { id: 10, accountType: "buyer", fullName: "Confirmed Buyer", email: "buyer@test.com", status: "active" },
  20: { id: 20, accountType: "seller", fullName: "Listing Seller", email: "seller@test.com", status: "active" },
  30: { id: 30, accountType: "buyer", fullName: "Stranger Buyer", email: "stranger@test.com", status: "active" },
  1: { id: 1, accountType: "admin", fullName: "Admin Staff", email: "admin@test.com", status: "active" },
  2: { id: 2, accountType: "admin_employee", fullName: "Employee With Dispute Perm", email: "emp_disp@test.com", status: "active" },
  3: { id: 3, accountType: "admin_employee", fullName: "Employee No Dispute Perm", email: "emp_no_disp@test.com", status: "active" },
};

const employeePermissions: Record<number, string[]> = {
  2: ["dispute_management", "order_oversight"],
  3: ["listing_review"],
};

let orders: Record<number, OrderRecord> = {};
let orderDeliveries: Record<number, OrderDeliveryRecord> = {};
let disputes: Record<number, any> = {};
let nextDisputeId = 1;
let auditLogs: any[] = [];

vi.mock("../src/database/pool.js", async (importOriginal) => {
  const actual = await importOriginal<typeof PoolModule>();
  return {
    ...actual,
    withTransaction: vi.fn(async (callback: (connection: any) => Promise<unknown>) => callback({
      execute: vi.fn(async () => [[], []]),
    })),
  };
});

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  authRepository: {
    findAccountById: vi.fn(async (id: number) => accounts[id] || null),
  },
}));

vi.mock("../src/modules/admin-permissions/admin-permission.repository.js", () => ({
  adminPermissionRepository: {
    hasPermission: vi.fn(async (accountId: number, perm: string) => {
      const perms = employeePermissions[accountId] || [];
      return perms.includes(perm);
    }),
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
    getWithDelivery: vi.fn(async (id: number) => {
      const order = orders[id];
      if (!order) return null;
      return {
        ...order,
        delivery: orderDeliveries[id] || null,
      };
    }),
    updateStatus: vi.fn(async (id: number, status: any, paymentStatus?: any, fulfilmentStatus?: any) => {
      if (orders[id]) {
        orders[id].orderStatus = status;
        if (paymentStatus) orders[id].paymentStatus = paymentStatus;
        if (fulfilmentStatus) orders[id].fulfilmentStatus = fulfilmentStatus;
      }
    }),
  },
}));

vi.mock("../src/modules/delivery/delivery.repository.js", () => ({
  deliveryRepository: {
    findByOrderId: vi.fn(async (orderId: number) => orderDeliveries[orderId] || null),
    updateShipping: vi.fn(async (orderId: number, data: any) => {
      if (orderDeliveries[orderId]) {
        orderDeliveries[orderId].carrierName = data.carrierName;
        orderDeliveries[orderId].trackingNumber = data.trackingNumber;
        orderDeliveries[orderId].trackingUrl = data.trackingUrl || null;
        orderDeliveries[orderId].dispatchNotes = data.dispatchNotes || null;
        orderDeliveries[orderId].dispatchedAt = new Date();
      }
    }),
    updateCollection: vi.fn(async (orderId: number, data: any) => {
      if (orderDeliveries[orderId]) {
        orderDeliveries[orderId].collectionLocation = data.collectionLocation;
        orderDeliveries[orderId].collectionInstructions = data.collectionInstructions;
        orderDeliveries[orderId].collectionReadyAt = new Date();
      }
    }),
    updateDelivered: vi.fn(async (orderId: number, data: any) => {
      if (orderDeliveries[orderId]) {
        orderDeliveries[orderId].deliveredAt = new Date();
        orderDeliveries[orderId].proofOfDeliveryType = data.proofOfDeliveryType;
        orderDeliveries[orderId].proofOfDeliveryRef = data.proofOfDeliveryRef || null;
        orderDeliveries[orderId].proofOfDeliveryNotes = data.proofOfDeliveryNotes || null;
      }
    }),
    updateBuyerConfirmed: vi.fn(async (orderId: number) => {
      if (orderDeliveries[orderId]) {
        orderDeliveries[orderId].buyerConfirmedAt = new Date();
        orderDeliveries[orderId].collectedAt = new Date();
      }
    }),
    setBuyerConfirmationDeadline: vi.fn(async (orderId: number, deadline: Date) => {
      if (orders[orderId]) {
        orders[orderId].buyerConfirmationDeadline = deadline;
      }
    }),
    findOrdersExpiredForConfirmation: vi.fn(async (now: Date) => {
      return Object.values(orders).filter(
        (o) =>
          (o.orderStatus === "delivered" || o.orderStatus === "buyer_confirmation") &&
          o.buyerConfirmationDeadline &&
          o.buyerConfirmationDeadline <= now,
      );
    }),
  },
}));

vi.mock("../src/modules/disputes/dispute.repository.js", () => ({
  disputeRepository: {
    create: vi.fn(async (orderId: number, openedByAccountId: number, data: any) => {
      const id = nextDisputeId++;
      const dispute = {
        id,
        disputeReference: `DSP-20260818-${String(id).padStart(4, "0")}`,
        orderId,
        openedByAccountId,
        reason: data.reason,
        details: data.details,
        status: "opened",
        resolutionNotes: null,
        resolvedByAccountId: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      disputes[id] = dispute;
      return dispute;
    }),
    findById: vi.fn(async (id: number) => disputes[id] || null),
    findByIdForUpdate: vi.fn(async (id: number) => disputes[id] || null),
    findActiveByOrderId: vi.fn(async (orderId: number) => {
      return (
        Object.values(disputes).find(
          (d) => d.orderId === orderId && (d.status === "opened" || d.status === "under_review"),
        ) || null
      );
    }),
    listByOrderId: vi.fn(async (orderId: number) => {
      return Object.values(disputes).filter((d) => d.orderId === orderId);
    }),
    resolve: vi.fn(async (id: number, adminId: number, data: any) => {
      if (disputes[id]) {
        disputes[id].status = data.resolutionOutcome;
        disputes[id].resolutionNotes = data.resolutionNotes;
        disputes[id].resolvedByAccountId = adminId;
        disputes[id].resolvedAt = new Date();
      }
    }),
    list: vi.fn(async () => Object.values(disputes)),
    count: vi.fn(async () => Object.values(disputes).length),
  },
}));

describe("Phase 5: Delivery Records, Dispute System & Order Completion", () => {
  const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "buyer@test.com", fullName: "Confirmed Buyer" });
  const sellerToken = signAccessToken({ id: 20, accountType: "seller", email: "seller@test.com", fullName: "Listing Seller" });
  const empWithDisputeToken = signAccessToken({ id: 2, accountType: "admin_employee", email: "emp_disp@test.com", fullName: "Emp Dispute" });
  const empNoDisputeToken = signAccessToken({ id: 3, accountType: "admin_employee", email: "emp_no_disp@test.com", fullName: "Emp No Dispute" });

  beforeEach(() => {
    orders = {
      201: {
        id: 201,
        orderReference: "ORD-20260818-0201",
        buyerId: 10,
        sellerId: 20,
        listingId: 100,
        sourceType: "negotiated_offer",
        sourceOfferId: 1,
        sourceAllocationId: null,
        sourceReference: "offer:1",
        quantity: 1,
        unitPrice: 50000,
        totalAmount: 50000,
        currency: "INR",
        orderStatus: "payment_confirmed",
        paymentStatus: "held_pending_confirmation",
        fulfilmentStatus: "unfulfilled",
        deliveryMethod: "shipping",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      202: {
        id: 202,
        orderReference: "ORD-20260818-0202",
        buyerId: 10,
        sellerId: 20,
        listingId: 101,
        sourceType: "negotiated_offer",
        sourceOfferId: 2,
        sourceAllocationId: null,
        sourceReference: "offer:2",
        quantity: 1,
        unitPrice: 15000,
        totalAmount: 15000,
        currency: "INR",
        orderStatus: "payment_confirmed",
        paymentStatus: "held_pending_confirmation",
        fulfilmentStatus: "unfulfilled",
        deliveryMethod: "collection",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    orderDeliveries = {
      201: {
        id: 201,
        orderId: 201,
        deliveryMethod: "shipping",
        carrierName: null,
        trackingNumber: null,
        trackingUrl: null,
        dispatchNotes: null,
        dispatchedAt: null,
        collectionLocation: null,
        collectionInstructions: null,
        collectionReadyAt: null,
        collectedAt: null,
        estimatedDeliveryAt: null,
        deliveredAt: null,
        proofOfDeliveryType: null,
        proofOfDeliveryRef: null,
        proofOfDeliveryNotes: null,
        buyerConfirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      202: {
        id: 202,
        orderId: 202,
        deliveryMethod: "collection",
        carrierName: null,
        trackingNumber: null,
        trackingUrl: null,
        dispatchNotes: null,
        dispatchedAt: null,
        collectionLocation: null,
        collectionInstructions: null,
        collectionReadyAt: null,
        collectedAt: null,
        estimatedDeliveryAt: null,
        deliveredAt: null,
        proofOfDeliveryType: null,
        proofOfDeliveryRef: null,
        proofOfDeliveryNotes: null,
        buyerConfirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    disputes = {};
    nextDisputeId = 1;
    auditLogs = [];
    vi.clearAllMocks();
  });

  describe("1. Shipping & Collection Tracking Workflows", () => {
    it("seller marks order as shipped with carrier tracking info", async () => {
      const response = await request(app)
        .post("/api/delivery/orders/201/ship")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          carrierName: "BlueDart Logistics",
          trackingNumber: "BD-99887766",
          trackingUrl: "https://bluedart.com/track/BD-99887766",
          dispatchNotes: "Dispatched in fragile wooden crate",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(orders[201]!.orderStatus).toBe("shipped");
      expect(orders[201]!.fulfilmentStatus).toBe("shipped");
      expect(orderDeliveries[201]!.carrierName).toBe("BlueDart Logistics");
      expect(orderDeliveries[201]!.trackingNumber).toBe("BD-99887766");
    });

    it("rejects shipping dispatch on an order configured for collection", async () => {
      const response = await request(app)
        .post("/api/delivery/orders/202/ship")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          carrierName: "BlueDart Logistics",
          trackingNumber: "BD-112233",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_DELIVERY_METHOD");
    });

    it("seller marks collection order as ready for collection", async () => {
      const response = await request(app)
        .post("/api/delivery/orders/202/ready-for-collection")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          collectionLocation: "Warehouse B, Industrial Area 4, Surat",
          collectionInstructions: "Show order reference ORD-20260818-0202 at gate security",
        });

      expect(response.status).toBe(200);
      expect(orders[202]!.orderStatus).toBe("ready_for_collection");
      expect(orderDeliveries[202]!.collectionLocation).toContain("Warehouse B");
    });
  });

  describe("2. Proof of Delivery & Buyer Confirmation", () => {
    it("records proof of delivery and opens buyer confirmation deadline", async () => {
      orders[201]!.orderStatus = "shipped";

      const response = await request(app)
        .post("/api/delivery/orders/201/delivered")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          proofOfDeliveryType: "carrier_confirmation",
          proofOfDeliveryRef: "DEL-REC-776655",
          proofOfDeliveryNotes: "Delivered to buyer reception desk",
          buyerConfirmationDeadlineDays: 7,
        });

      expect(response.status).toBe(200);
      expect(orders[201]!.orderStatus).toBe("delivered");
      expect(orders[201]!.buyerConfirmationDeadline).toBeDefined();
      expect(orderDeliveries[201]!.proofOfDeliveryType).toBe("carrier_confirmation");
    });

    it("buyer confirms receipt and advances order to completed", async () => {
      orders[201]!.orderStatus = "delivered";

      const response = await request(app)
        .post("/api/delivery/orders/201/buyer-confirm")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ notes: "Received goods in perfect condition." });

      expect(response.status).toBe(200);
      expect(orders[201]!.orderStatus).toBe("completed");
      expect(orderDeliveries[201]!.buyerConfirmedAt).toBeDefined();
    });

    it("auto-completes delivered orders when confirmation timeout passes with no dispute", async () => {
      orders[201]!.orderStatus = "delivered";
      orders[201]!.buyerConfirmationDeadline = new Date(Date.now() - 1000 * 60); // 1 min ago

      const completedCount = await deliveryService.sweepTimeoutConfirmations();
      expect(completedCount).toBe(1);
      expect(orders[201]!.orderStatus).toBe("completed");
    });
  });

  describe("3. Dispute System & Audited Admin Resolution", () => {
    it("allows buyer to open a dispute, moving order into disputed state", async () => {
      orders[201]!.orderStatus = "delivered";

      const response = await request(app)
        .post("/api/disputes/orders/201/dispute")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          reason: "item_damaged",
          details: "Milling machine casing was cracked during shipping and oil is leaking.",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(orders[201]!.orderStatus).toBe("disputed");

      const disputeId = response.body.data.id;
      expect(disputes[disputeId]!.reason).toBe("item_damaged");
      expect(disputes[disputeId]!.status).toBe("opened");
    });

    it("blocks buyer delivery confirmation while order is under active dispute", async () => {
      orders[201]!.orderStatus = "disputed";

      const response = await request(app)
        .post("/api/delivery/orders/201/buyer-confirm")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("ORDER_DISPUTED");
    });

    it("rejects dispute resolution attempt by employee without dispute_management permission (403)", async () => {
      orders[201]!.orderStatus = "delivered";
      const dispute = await request(app)
        .post("/api/disputes/orders/201/dispute")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          reason: "item_damaged",
          details: "Milling machine casing cracked.",
        });
      const disputeId = dispute.body.data.id;

      const resolveRes = await request(app)
        .post(`/api/disputes/${disputeId}/resolve`)
        .set("Authorization", `Bearer ${empNoDisputeToken}`)
        .send({
          resolutionOutcome: "resolved_buyer_favour",
          resolutionNotes: "Admin verified carrier damage.",
        });

      expect(resolveRes.status).toBe(403);
      expect(resolveRes.body.code).toBe("PERMISSION_DENIED");
    });

    it("allows authorized employee to resolve dispute with audited notes and updates order to refunded", async () => {
      orders[201]!.orderStatus = "delivered";
      const dispute = await request(app)
        .post("/api/disputes/orders/201/dispute")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          reason: "item_damaged",
          details: "Milling machine casing cracked.",
        });
      const disputeId = dispute.body.data.id;

      const resolveRes = await request(app)
        .post(`/api/disputes/${disputeId}/resolve`)
        .set("Authorization", `Bearer ${empWithDisputeToken}`)
        .send({
          resolutionOutcome: "resolved_buyer_favour",
          resolutionNotes: "Inspected carrier damage documentation. Approved full refund to buyer.",
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.success).toBe(true);
      expect(disputes[disputeId]!.status).toBe("resolved_buyer_favour");
      expect(orders[201]!.orderStatus).toBe("refunded");
      expect(orders[201]!.paymentStatus).toBe("refunded");
    });
  });
});
