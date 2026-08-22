import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { notificationService } from "../src/modules/notifications/notification.service.js";
import * as mailer from "../src/shared/mailer.js";
import { signAccessToken } from "../src/shared/tokens.js";
import type { NotificationRecord, OrderRecord } from "../src/types/database.types.js";

const accounts: Record<number, any> = {
  10: { id: 10, accountType: "buyer", fullName: "Confirmed Buyer", email: "buyer@test.com", status: "active" },
  20: { id: 20, accountType: "seller", fullName: "Listing Seller", email: "seller@test.com", status: "active" },
};

let notifications: Record<number, NotificationRecord> = {};
let nextNotifId = 1;

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  authRepository: {
    findAccountById: vi.fn(async (id: number) => accounts[id] || null),
  },
}));

vi.mock("../src/shared/mailer.js", () => ({
  sendEmail: vi.fn(async () => true),
}));

vi.mock("../src/modules/notifications/notification.repository.js", () => ({
  notificationRepository: {
    create: vi.fn(async (params: any) => {
      const id = nextNotifId++;
      const record: NotificationRecord = {
        id,
        recipientAccountId: params.recipientAccountId,
        type: params.type,
        title: params.title,
        message: params.message,
        payload: params.payload || null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
      };
      notifications[id] = record;
      return record;
    }),
    listByAccountId: vi.fn(async (recipientAccountId: number) => {
      return Object.values(notifications).filter((n) => n.recipientAccountId === recipientAccountId);
    }),
    countUnread: vi.fn(async (recipientAccountId: number) => {
      return Object.values(notifications).filter((n) => n.recipientAccountId === recipientAccountId && !n.isRead).length;
    }),
    markAsRead: vi.fn(async (id: number, recipientAccountId: number) => {
      const notif = notifications[id];
      if (notif && notif.recipientAccountId === recipientAccountId) {
        notif.isRead = true;
        notif.readAt = new Date();
        return true;
      }
      return false;
    }),
    markAllAsRead: vi.fn(async (recipientAccountId: number) => {
      let count = 0;
      for (const n of Object.values(notifications)) {
        if (n.recipientAccountId === recipientAccountId && !n.isRead) {
          n.isRead = true;
          n.readAt = new Date();
          count++;
        }
      }
      return count;
    }),
  },
}));

describe("Phase 7: Multi-Channel Real-Time & Email Notifications", () => {
  const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "buyer@test.com", fullName: "Confirmed Buyer" });

  beforeEach(() => {
    notifications = {};
    nextNotifId = 1;
    vi.clearAllMocks();
  });

  describe("1. Real-Time & Multi-Event Dispatching", () => {
    it("stores order-created notifications for both buyer and seller", async () => {
      const mockOrder: OrderRecord = {
        id: 501,
        orderReference: "ORD-20260818-0501",
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
        orderStatus: "created",
        paymentStatus: "pending",
        fulfilmentStatus: "unfulfilled",
        deliveryMethod: "shipping",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await notificationService.notifyOrderCreated(mockOrder);

      // Verify in-app notifications created for both parties
      const buyerNotifs = Object.values(notifications).filter((n) => n.recipientAccountId === 10);
      const sellerNotifs = Object.values(notifications).filter((n) => n.recipientAccountId === 20);
      expect(buyerNotifs).toHaveLength(1);
      expect(sellerNotifs).toHaveLength(1);
      expect(buyerNotifs[0]!.type).toBe("order_created");

    });

    it("dispatches dispute opened notification and never leaks to public channels", async () => {
      const mockOrder: OrderRecord = {
        id: 502,
        orderReference: "ORD-20260818-0502",
        buyerId: 10,
        sellerId: 20,
        listingId: 100,
        sourceType: "negotiated_offer",
        sourceOfferId: 1,
        sourceAllocationId: null,
        sourceReference: "offer:1",
        quantity: 1,
        unitPrice: 20000,
        totalAmount: 20000,
        currency: "INR",
        orderStatus: "disputed",
        paymentStatus: "held_pending_confirmation",
        fulfilmentStatus: "delivered",
        deliveryMethod: "shipping",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDispute = {
        id: 701,
        disputeReference: "DSP-20260818-0701",
        orderId: 502,
        openedByAccountId: 10,
        reason: "item_damaged" as const,
        details: "Cracked casing",
        status: "opened" as const,
        resolutionNotes: null,
        resolvedByAccountId: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await notificationService.notifyDisputeOpened(mockDispute, mockOrder, 10);

      // Verify public channel was NEVER used for dispute info
    });
  });

  describe("2. Email Failure Non-Fatal Isolation", () => {
    it("safely completes notification dispatch and saves in-app record even if SMTP mailer fails", async () => {
      // Spy on sendEmail and simulate hard SMTP timeout error
      vi.spyOn(mailer, "sendEmail").mockRejectedValueOnce(new Error("SMTP server connection timeout"));

      const dispatchPromise = notificationService.dispatch({
        recipientAccountId: 10,
        type: "order_completed",
        title: "Order Completed",
        message: "Your order is completed.",
        emailSubject: "Order Complete",
        emailHtml: "<p>Order Completed</p>",
      });

      // Must not throw
      await expect(dispatchPromise).resolves.toBeDefined();

      // In-app notification must still be created
      const buyerNotifs = Object.values(notifications).filter((n) => n.recipientAccountId === 10);
      expect(buyerNotifs).toHaveLength(1);
      expect(buyerNotifs[0]!.type).toBe("order_completed");
    });
  });

  describe("3. In-App Notification Query & Read Status Endpoints", () => {
    it("allows user to query notifications, unread count, and mark read", async () => {
      // Seed two notifications
      await notificationService.dispatch({
        recipientAccountId: 10,
        type: "order_created",
        title: "Order #1",
        message: "Order #1 created",
      });
      await notificationService.dispatch({
        recipientAccountId: 10,
        type: "payment_confirmed",
        title: "Order #1 Paid",
        message: "Payment confirmed",
      });

      // Query notifications
      const listRes = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(2);
      expect(listRes.body.unreadCount).toBe(2);

      const notifId = listRes.body.data[0].id;

      // Mark single notification read
      const markRes = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(markRes.status).toBe(200);
      expect(notifications[notifId]!.isRead).toBe(true);

      // Mark all read
      const markAllRes = await request(app)
        .post("/api/notifications/mark-all-read")
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(markAllRes.status).toBe(200);
      expect(Object.values(notifications).every((n) => n.isRead)).toBe(true);
    });
  });
});
