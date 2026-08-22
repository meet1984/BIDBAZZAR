import { describe, expect, it } from "vitest";
import { transporter } from "../src/shared/mailer.js";
import { trustProfileService } from "../src/modules/reviews/trust-profile.service.js";
import type { ReviewRecord } from "../src/modules/reviews/review.types.js";

describe("Critical Fixes Regression & Boundary Test Suite", () => {
  describe("Bug 4 Regression: SMTP Transporter Configuration & Timeouts", () => {
    it("enforces finite timeouts on the nodemailer transporter instance to prevent infinite hang", () => {
      const options = (transporter as any).options;
      expect(options.connectionTimeout).toBeDefined();
      expect(options.connectionTimeout).toBeLessThanOrEqual(15000);
      expect(options.greetingTimeout).toBeDefined();
      expect(options.greetingTimeout).toBeLessThanOrEqual(15000);
      expect(options.socketTimeout).toBeDefined();
      expect(options.socketTimeout).toBeLessThanOrEqual(30000);
    });
  });

  describe("Bug 3 Regression: Trust Profile Metric Shape & Category Ratings Aggregation", () => {
    it("calculates ratings summary and returns consistent shape matching frontend consumer expectations", () => {
      const mockReviews: ReviewRecord[] = [
        {
          id: 1,
          orderId: 10,
          reviewerId: 100,
          revieweeId: 200,
          direction: "buyer_to_seller",
          ratingScore: 5,
          categoryRatings: { productAccuracy: 5, communication: 5, packagingDelivery: 4 },
          comment: "Excellent seller",
          isPublished: true,
          hiddenReason: null,
          hiddenByAccountId: null,
          hiddenAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          orderId: 11,
          reviewerId: 101,
          revieweeId: 200,
          direction: "buyer_to_seller",
          ratingScore: 4,
          categoryRatings: { productAccuracy: 4, communication: 4, packagingDelivery: 4 },
          comment: "Good experience",
          isPublished: true,
          hiddenReason: null,
          hiddenByAccountId: null,
          hiddenAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const summary = trustProfileService.calculateRatingsSummary(mockReviews);

      expect(summary.averageRating).toBe(4.5);
      expect(summary.totalReviews).toBe(2);
      expect(summary.categoryBreakdown.productAccuracy).toBe(4.5);
      expect(summary.categoryBreakdown.communication).toBe(4.5);
      expect(summary.categoryBreakdown.packagingDelivery).toBe(4);
      expect(summary.starDistribution[5]).toBe(1);
      expect(summary.starDistribution[4]).toBe(1);
    });

    it("handles zero reviews gracefully without NaN or division by zero", () => {
      const summary = trustProfileService.calculateRatingsSummary([]);
      expect(summary.averageRating).toBe(0);
      expect(summary.totalReviews).toBe(0);
      expect(summary.categoryBreakdown).toEqual({});
      expect(summary.starDistribution[5]).toBe(0);
    });
  });

  describe("Bug 1 & 2 Query Structure Invariants", () => {
    it("verifies syncAuctionStatus query includes all active offer states to protect negotiation windows", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const file = await fs.readFile(
        path.resolve(process.cwd(), "src/jobs/sync-auction-status.ts"),
        "utf8",
      );

      // Must check submitted, revised, shortlisted, countered
      expect(file).toContain("'submitted'");
      expect(file).toContain("'revised'");
      expect(file).toContain("'shortlisted'");
      expect(file).toContain("'countered'");
      expect(file).toContain("multi_unit_offers");
    });

    it("verifies listing repository queries contain total_allocated subquery across all management views", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const file = await fs.readFile(
        path.resolve(process.cwd(), "src/modules/listings/listing.repository.ts"),
        "utf8",
      );

      const occurrences = (file.match(/AS total_allocated/g) || []).length;
      // Must be present in findPublic, findPublicByIds, listSeller, findOwned, findById, listAdmin (>= 6 times)
      expect(occurrences).toBeGreaterThanOrEqual(6);
    });
  });
});
