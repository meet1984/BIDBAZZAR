import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";
import type { OrderRecord, ReviewRecord, ReviewReportRecord } from "../src/types/database.types.js";

const accounts: Record<number, any> = {
  10: { id: 10, accountType: "buyer", fullName: "Confirmed Buyer", email: "buyer_private@test.com", status: "active" },
  20: { id: 20, accountType: "seller", fullName: "Top Industrial Seller", email: "seller_private@test.com", status: "active" },
  1: { id: 1, accountType: "admin", fullName: "Admin Staff", email: "admin@test.com", status: "active" },
  4: { id: 4, accountType: "admin_employee", fullName: "Mod Employee", email: "mod_emp@test.com", status: "active" },
  5: { id: 5, accountType: "admin_employee", fullName: "No Mod Employee", email: "no_mod_emp@test.com", status: "active" },
};

const employeePermissions: Record<number, string[]> = {
  4: ["review_moderation", "order_oversight"],
  5: ["support_management"],
};

const buyerProfiles: Record<number, any> = {
  10: { accountId: 10, verificationStatus: "verified" },
};

const sellerProfiles: Record<number, any> = {
  20: { accountId: 20, verificationStatus: "verified" },
};

let orders: Record<number, OrderRecord> = {};
let reviews: Record<number, ReviewRecord> = {};
let reviewReports: Record<number, ReviewReportRecord> = {};
let nextReviewId = 1;
let nextReportId = 1;
let auditLogs: any[] = [];

import type * as PoolModule from "../src/database/pool.js";

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

vi.mock("../src/modules/buyer-profile/buyer-profile.repository.js", () => ({
  buyerProfileRepository: {
    findByAccountId: vi.fn(async (id: number) => buyerProfiles[id] || null),
  },
}));

vi.mock("../src/modules/seller-profile/seller-profile.repository.js", () => ({
  sellerProfileRepository: {
    findByAccountId: vi.fn(async (id: number) => sellerProfiles[id] || null),
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
  },
}));

vi.mock("../src/modules/reviews/review.repository.js", () => ({
  reviewRepository: {
    create: vi.fn(async (params: any) => {
      const id = nextReviewId++;
      const review: ReviewRecord = {
        id,
        orderId: params.orderId,
        reviewerId: params.reviewerId,
        revieweeId: params.revieweeId,
        direction: params.direction,
        ratingScore: params.ratingScore,
        categoryRatings: params.categoryRatings,
        comment: params.comment,
        isPublished: params.isPublished !== false,
        hiddenReason: null,
        hiddenByAccountId: null,
        hiddenAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      reviews[id] = review;
      return review;
    }),
    findById: vi.fn(async (id: number) => reviews[id] || null),
    updateReview: vi.fn(async (id: number, params: any) => {
      if (reviews[id]) {
        reviews[id].ratingScore = params.ratingScore;
        reviews[id].categoryRatings = params.categoryRatings;
        reviews[id].comment = params.comment;
        reviews[id].updatedAt = new Date();
      }
      return reviews[id];
    }),
    findByOrderAndDirection: vi.fn(async (orderId: number, direction: string) => {
      return (
        Object.values(reviews).find(
          (r) => r.orderId === orderId && r.direction === direction,
        ) || null
      );
    }),
    listByReviewee: vi.fn(async (revieweeId: number, onlyPublished = true) => {
      return Object.values(reviews).filter(
        (r) => r.revieweeId === revieweeId && (!onlyPublished || r.isPublished),
      );
    }),
    updatePublishedStatus: vi.fn(async (id: number, isPublished: boolean) => {
      if (reviews[id]) {
        reviews[id].isPublished = isPublished;
      }
    }),
    createReport: vi.fn(async (params: any) => {
      const id = nextReportId++;
      const report: ReviewReportRecord = {
        id,
        reviewId: params.reviewId,
        reporterId: params.reporterId,
        reason: params.reason,
        details: params.details,
        status: "pending",
        reviewedByAccountId: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      reviewReports[id] = report;
      return id;
    }),
    findReportById: vi.fn(async (id: number) => reviewReports[id] || null),
    listReports: vi.fn(async () => Object.values(reviewReports)),
    resolveReport: vi.fn(async (reportId: number, adminId: number, status: any) => {
      if (reviewReports[reportId]) {
        reviewReports[reportId].status = status;
        reviewReports[reportId].reviewedByAccountId = adminId;
        reviewReports[reportId].reviewedAt = new Date();
      }
    }),
    countCompletedOrders: vi.fn(async (accountId: number, role: string) => {
      return accountId === 20 && role === "seller" ? 12 : accountId === 10 && role === "buyer" ? 6 : 0;
    }),
    countUnresolvedDisputes: vi.fn(async () => 0),
  },
}));

describe("Phase 6: Mutual Reviews, Ratings Aggregation & Trust Profiles", () => {
  const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "buyer@test.com", fullName: "Confirmed Buyer" });
  const sellerToken = signAccessToken({ id: 20, accountType: "seller", email: "seller@test.com", fullName: "Top Industrial Seller" });
  const modEmpToken = signAccessToken({ id: 4, accountType: "admin_employee", email: "mod@test.com", fullName: "Mod Emp" });
  const noModEmpToken = signAccessToken({ id: 5, accountType: "admin_employee", email: "nomod@test.com", fullName: "No Mod Emp" });

  beforeEach(() => {
    orders = {
      301: {
        id: 301,
        orderReference: "ORD-20260818-0301",
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
        orderStatus: "completed",
        paymentStatus: "held_pending_confirmation",
        fulfilmentStatus: "delivered",
        deliveryMethod: "shipping",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      302: {
        id: 302,
        orderReference: "ORD-20260818-0302",
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
        orderStatus: "shipped", // Accepted & shipped order
        paymentStatus: "held_pending_confirmation",
        fulfilmentStatus: "shipped",
        deliveryMethod: "shipping",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      303: {
        id: 303,
        orderReference: "ORD-20260818-0303",
        buyerId: 10,
        sellerId: 20,
        listingId: 102,
        sourceType: "negotiated_offer",
        sourceOfferId: 3,
        sourceAllocationId: null,
        sourceReference: "offer:3",
        quantity: 1,
        unitPrice: 10000,
        totalAmount: 10000,
        currency: "INR",
        orderStatus: "cancelled", // Cancelled order
        paymentStatus: "failed",
        fulfilmentStatus: "unfulfilled",
        deliveryMethod: "shipping",
        buyerConfirmationDeadline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    reviews = {};
    reviewReports = {};
    nextReviewId = 1;
    nextReportId = 1;
    auditLogs = [];
    vi.clearAllMocks();
  });

  describe("1. Review Submission Invariants", () => {
    it("rejects review submission if order is cancelled or failed (409 ORDER_NOT_ELIGIBLE_FOR_REVIEW)", async () => {
      const response = await request(app)
        .post("/api/reviews/orders/303/buyer-review")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          ratingScore: 5,
          categoryRatings: {
            productAccuracy: 5,
            communication: 5,
            packagingDelivery: 5,
            overallExperience: 5,
          },
          comment: "Tried to review a cancelled order.",
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("ORDER_NOT_ELIGIBLE_FOR_REVIEW");
    });

    it("allows buyer to submit a review for seller on completed order", async () => {
      const response = await request(app)
        .post("/api/reviews/orders/301/buyer-review")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          ratingScore: 5,
          categoryRatings: {
            productAccuracy: 5,
            communication: 5,
            packagingDelivery: 4,
            overallExperience: 5,
          },
          comment: "High quality machinery, perfectly calibrated and fast dispatch.",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ratingScore).toBe(5);
      expect(response.body.data.direction).toBe("buyer_to_seller");
    });

    it("updates existing review seamlessly if submitted again for the same order", async () => {
      // First review
      await request(app)
        .post("/api/reviews/orders/301/buyer-review")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          ratingScore: 5,
          categoryRatings: { productAccuracy: 5, communication: 5, packagingDelivery: 5, overallExperience: 5 },
          comment: "Great experience!",
        });

      // Second review updates existing review
      const updateRes = await request(app)
        .post("/api/reviews/orders/301/buyer-review")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          ratingScore: 4,
          categoryRatings: { productAccuracy: 4, communication: 4, packagingDelivery: 4, overallExperience: 4 },
          comment: "Updated review comment.",
        });

      expect(updateRes.status).toBe(201);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.ratingScore).toBe(4);
      expect(updateRes.body.data.comment).toBe("Updated review comment.");
    });

    it("allows seller to submit a review for buyer on completed order", async () => {
      const response = await request(app)
        .post("/api/reviews/orders/301/seller-review")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          ratingScore: 5,
          categoryRatings: {
            paymentReliability: 5,
            communication: 5,
            transactionCooperation: 5,
          },
          comment: "Prompt confirmation and smooth communication.",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.direction).toBe("seller_to_buyer");
    });
  });

  describe("2. Review Moderation & Audit Logging", () => {
    it("allows reporting a review and prevents unpermitted employee from moderating", async () => {
      const revRes = await request(app)
        .post("/api/reviews/orders/301/buyer-review")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          ratingScore: 1,
          categoryRatings: { productAccuracy: 1, communication: 1, packagingDelivery: 1, overallExperience: 1 },
          comment: "Spam commentary with inappropriate claims.",
        });
      const reviewId = revRes.body.data.id;

      // Report review
      const reportRes = await request(app)
        .post(`/api/reviews/${reviewId}/report`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          reason: "offensive_language",
          details: "Contains abusive accusations.",
        });
      expect(reportRes.status).toBe(201);

      // Attempt moderation with unauthorized employee
      const unauthMod = await request(app)
        .post(`/api/reviews/${reviewId}/moderate`)
        .set("Authorization", `Bearer ${noModEmpToken}`)
        .send({
          action: "hide",
          moderationReason: "Violates policy.",
        });
      expect(unauthMod.status).toBe(403);
      expect(unauthMod.body.code).toBe("PERMISSION_DENIED");
    });

    it("authorized moderator can hide review, updating visibility and recomputing public ratings", async () => {
      const revRes = await request(app)
        .post("/api/reviews/orders/301/buyer-review")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          ratingScore: 1,
          categoryRatings: { productAccuracy: 1, communication: 1, packagingDelivery: 1, overallExperience: 1 },
          comment: "Review to be hidden.",
        });
      const reviewId = revRes.body.data.id;

      const modRes = await request(app)
        .post(`/api/reviews/${reviewId}/moderate`)
        .set("Authorization", `Bearer ${modEmpToken}`)
        .send({
          action: "hide",
          moderationReason: "Defamatory review violates community guidelines.",
        });

      expect(modRes.status).toBe(200);
      expect(reviews[reviewId]!.isPublished).toBe(false);

      // Public profile must NOT include the hidden review in ratings or review list
      const profileRes = await request(app).get("/api/users/20/trust-profile");
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.data.ratingsSummary.totalReviews).toBe(0);
      expect(profileRes.body.data.reviews).toHaveLength(0);
    });
  });

  describe("3. Trust Profiles, Badges & Privacy Redaction", () => {
    it("computes badges and NEVER leaks private email, phone, or bank info", async () => {
      // Add a valid 5-star review
      await request(app)
        .post("/api/reviews/orders/301/buyer-review")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({
          ratingScore: 5,
          categoryRatings: { productAccuracy: 5, communication: 5, packagingDelivery: 5, overallExperience: 5 },
          comment: "Outstanding supplier!",
        });

      const response = await request(app).get("/api/users/20/trust-profile");

      expect(response.status).toBe(200);
      const profile = response.body.data;

      expect(profile.id).toBe(20);
      expect(profile.fullName).toBe("Top Industrial Seller");
      expect(profile.accountType).toBe("seller");
      expect(profile.completedTransactionsCount).toBe(12);
      expect(profile.ratingsSummary.averageRating).toBe(5);

      // Verify badges
      const badgeIds = (profile.badges as Array<{ id: string }>).map((b) => b.id);
      expect(badgeIds).toContain("verified_identity");
      expect(badgeIds).toContain("trusted_seller");

      // Privacy Check: Ensure no private fields are leaked
      expect(profile.email).toBeUndefined();
      expect(profile.phone).toBeUndefined();
      expect(profile.bankDetails).toBeUndefined();
      expect(profile.documentPath).toBeUndefined();
      expect(profile.governmentId).toBeUndefined();
      expect(JSON.stringify(profile)).not.toContain("seller_private@test.com");
    });
  });
});
