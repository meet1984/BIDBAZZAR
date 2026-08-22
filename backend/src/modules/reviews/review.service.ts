import { AppError } from "../../shared/AppError.js";
import { withTransaction } from "../../database/pool.js";
import { auditLogService } from "../audit-log/audit-log.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { authRepository } from "../auth/auth.repository.js";
import { orderRepository } from "../orders/order.repository.js";
import { reviewRepository, type ReviewRepository } from "./review.repository.js";
import type {
  BuyerToSellerReviewInput,
  ModerateReviewInput,
  ReportReviewInput,
  SellerToBuyerReviewInput,
} from "./review.schemas.js";
import type {
  ReviewRecord,
  ReviewReportRecord,
  ReviewReportStatus,
} from "./review.types.js";

export class ReviewService {
  constructor(private readonly repository: ReviewRepository) {}

  /**
   * Buyer submits a review and category ratings for the seller.
   */
  async submitBuyerReview(
    orderId: number,
    buyerAccountId: number,
    input: BuyerToSellerReviewInput,
  ): Promise<ReviewRecord> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    if (order.buyerId !== buyerAccountId) {
      throw new AppError(403, "FORBIDDEN", "Only the buyer of this order can submit a buyer review.");
    }

    if (order.orderStatus !== "completed") {
      throw new AppError(
        409,
        "ORDER_NOT_ELIGIBLE_FOR_REVIEW",
        `Reviews can only be submitted after both parties complete the deal. Current status: '${order.orderStatus}'.`,
      );
    }

    const review = await withTransaction(async (connection) => {
      const existing = await this.repository.findByOrderAndDirection(orderId, "buyer_to_seller", connection);
      if (existing) {
        const updatedReview = await this.repository.updateReview(
          existing.id,
          {
            ratingScore: input.ratingScore,
            categoryRatings: input.categoryRatings,
            comment: input.comment,
          },
          connection,
        );
        await auditLogService.record({
          actorAccountId: buyerAccountId,
          action: "review:updated",
          targetEntity: "review",
          targetId: existing.id,
          reason: `Buyer updated review to ${input.ratingScore} stars for seller #${order.sellerId}`,
          metadata: { orderId, ratingScore: input.ratingScore, direction: "buyer_to_seller" },
        }, connection);
        return updatedReview;
      }

      const reviewRecord = await this.repository.create({
        orderId,
        reviewerId: buyerAccountId,
        revieweeId: order.sellerId,
        direction: "buyer_to_seller",
        ratingScore: input.ratingScore,
        categoryRatings: input.categoryRatings,
        comment: input.comment,
        isPublished: true,
      }, connection);

      await auditLogService.record({
        actorAccountId: buyerAccountId,
        action: "review:submitted",
        targetEntity: "review",
        targetId: reviewRecord.id,
        reason: `Buyer submitted a ${input.ratingScore}-star review for seller #${order.sellerId}`,
        metadata: { orderId, ratingScore: input.ratingScore, direction: "buyer_to_seller" },
      }, connection);

      return reviewRecord;
    });

    const reviewer = await authRepository.findAccountById(buyerAccountId);
    await notificationService.notifyReviewReceived(review, reviewer?.fullName || "Buyer").catch(() => undefined);

    return review;
  }

  /**
   * Seller submits a review and category ratings for the buyer.
   */
  async submitSellerReview(
    orderId: number,
    sellerAccountId: number,
    input: SellerToBuyerReviewInput,
  ): Promise<ReviewRecord> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");

    if (order.sellerId !== sellerAccountId) {
      throw new AppError(403, "FORBIDDEN", "Only the seller of this order can submit a seller review.");
    }

    if (order.orderStatus !== "completed") {
      throw new AppError(
        409,
        "ORDER_NOT_ELIGIBLE_FOR_REVIEW",
        `Reviews can only be submitted after both parties complete the deal. Current status: '${order.orderStatus}'.`,
      );
    }

    const review = await withTransaction(async (connection) => {
      const existing = await this.repository.findByOrderAndDirection(orderId, "seller_to_buyer", connection);
      if (existing) {
        const updatedReview = await this.repository.updateReview(
          existing.id,
          {
            ratingScore: input.ratingScore,
            categoryRatings: input.categoryRatings,
            comment: input.comment,
          },
          connection,
        );
        await auditLogService.record({
          actorAccountId: sellerAccountId,
          action: "review:updated",
          targetEntity: "review",
          targetId: existing.id,
          reason: `Seller updated review to ${input.ratingScore} stars for buyer #${order.buyerId}`,
          metadata: { orderId, ratingScore: input.ratingScore, direction: "seller_to_buyer" },
        }, connection);
        return updatedReview;
      }

      const reviewRecord = await this.repository.create({
        orderId,
        reviewerId: sellerAccountId,
        revieweeId: order.buyerId,
        direction: "seller_to_buyer",
        ratingScore: input.ratingScore,
        categoryRatings: input.categoryRatings,
        comment: input.comment,
        isPublished: true,
      }, connection);

      await auditLogService.record({
        actorAccountId: sellerAccountId,
        action: "review:submitted",
        targetEntity: "review",
        targetId: reviewRecord.id,
        reason: `Seller submitted a ${input.ratingScore}-star review for buyer #${order.buyerId}`,
        metadata: { orderId, ratingScore: input.ratingScore, direction: "seller_to_buyer" },
      }, connection);

      return reviewRecord;
    });

    const reviewer = await authRepository.findAccountById(sellerAccountId);
    await notificationService.notifyReviewReceived(review, reviewer?.fullName || "Seller").catch(() => undefined);

    return review;
  }

  /**
   * Any authenticated user can report an abusive/fraudulent review.
   */
  async reportReview(
    reviewId: number,
    reporterAccountId: number,
    input: ReportReviewInput,
  ): Promise<number> {
    const review = await this.repository.findById(reviewId);
    if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found.");
    if (review.reviewerId === reporterAccountId) {
      throw new AppError(409, "OWN_REVIEW_REPORT", "You cannot report your own review.");
    }
    if (await this.repository.findReportByReviewAndReporter(reviewId, reporterAccountId)) {
      throw new AppError(409, "REVIEW_ALREADY_REPORTED", "You have already reported this review.");
    }

    const reportId = await this.repository.createReport({
      reviewId,
      reporterId: reporterAccountId,
      reason: input.reason,
      details: input.details,
    });

    await auditLogService.record({
      actorAccountId: reporterAccountId,
      action: "review:reported",
      targetEntity: "review_report",
      targetId: reportId,
      reason: `Review #${reviewId} reported for ${input.reason}`,
      metadata: { reviewId, reason: input.reason },
    });

    return reportId;
  }

  /**
   * Admin moderator hides or restores a review with audited reason.
   */
  async moderateReview(
    reviewId: number,
    adminAccountId: number,
    input: ModerateReviewInput,
  ): Promise<ReviewRecord> {
    const review = await this.repository.findById(reviewId);
    if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found.");

    if (input.action === "hide") {
      await this.repository.updatePublishedStatus(
        reviewId,
        false,
        input.moderationReason,
        adminAccountId,
      );
    } else if (input.action === "restore") {
      await this.repository.updatePublishedStatus(reviewId, true, null, null);
    }

    if (input.reportId) {
      const report = await this.repository.findReportById(input.reportId);
      if (!report || report.reviewId !== reviewId) {
        throw new AppError(404, "REVIEW_REPORT_NOT_FOUND", "The selected report does not belong to this review.");
      }
      await this.repository.resolveReport(
        input.reportId,
        adminAccountId,
        input.action === "hide" ? "action_taken" : "dismissed",
      );
    }

    await auditLogService.record({
      actorAccountId: adminAccountId,
      action: input.action === "hide" ? "review:hidden" : input.action === "restore" ? "review:restored" : "review:report_dismissed",
      targetEntity: "review",
      targetId: reviewId,
      reason: input.moderationReason,
      metadata: { action: input.action, moderationReason: input.moderationReason, reportId: input.reportId },
    });

    return (await this.repository.findById(reviewId))!;
  }

  async listReports(status?: ReviewReportStatus): Promise<ReviewReportRecord[]> {
    return this.repository.listReports(status);
  }
}

export const reviewService = new ReviewService(reviewRepository);
