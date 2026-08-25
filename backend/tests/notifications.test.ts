import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { notificationService } from "../src/modules/notifications/notification.service.js";
import { signAccessToken } from "../src/shared/tokens.js";
import type { NotificationRecord } from "../src/types/database.types.js";

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

describe("Notifications API Suite", () => {
  const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "buyer@test.com", fullName: "Confirmed Buyer" });
  const otherUserToken = signAccessToken({ id: 20, accountType: "seller", email: "seller@test.com", fullName: "Listing Seller" });

  beforeEach(() => {
    notifications = {};
    nextNotifId = 1;
    vi.clearAllMocks();
  });

  it("lists user notifications and unread count", async () => {
    await notificationService.dispatch({
      recipientAccountId: 10,
      type: "order_created",
      title: "Order #1",
      message: "Order #1 created",
    });
    await notificationService.dispatch({
      recipientAccountId: 10,
      type: "order_completed",
      title: "Order #1 Paid",
      message: "Payment confirmed",
    });

    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.unreadCount).toBe(2);
  });

  it("marks a single notification as read via PATCH and is idempotent on repeat calls", async () => {
    const notif = await notificationService.dispatch({
      recipientAccountId: 10,
      type: "order_created",
      title: "Single Item",
      message: "Test message",
    });

    // 1. Mark as read first time
    const res1 = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.message).toBe("Notification marked as read.");
    expect(notifications[notif.id]?.isRead).toBe(true);

    // 2. Mark as read second time (must succeed idempotently)
    const res2 = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
  });

  it("marks a single notification as read via POST alias", async () => {
    const notif = await notificationService.dispatch({
      recipientAccountId: 10,
      type: "order_created",
      title: "Single Item POST",
      message: "Test message POST",
    });

    const res = await request(app)
      .post(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(notifications[notif.id]?.isRead).toBe(true);
  });

  it("returns 404 when marking a non-existent notification as read", async () => {
    const res = await request(app)
      .patch("/api/notifications/99999/read")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("returns 404 when marking another user's notification as read", async () => {
    const notif = await notificationService.dispatch({
      recipientAccountId: 10,
      type: "order_created",
      title: "Buyer Only",
      message: "Should not be readable by seller",
    });

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(res.status).toBe(404);
    expect(notifications[notif.id]?.isRead).toBe(false);
  });

  it("marks all notifications as read successfully", async () => {
    await notificationService.dispatch({
      recipientAccountId: 10,
      type: "order_created",
      title: "Item 1",
      message: "Msg 1",
    });
    await notificationService.dispatch({
      recipientAccountId: 10,
      type: "order_completed",
      title: "Item 2",
      message: "Msg 2",
    });

    const res = await request(app)
      .post("/api/notifications/mark-all-read")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.updatedCount).toBe(2);
    expect(Object.values(notifications).every((n) => n.isRead)).toBe(true);
  });
});
