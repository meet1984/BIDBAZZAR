import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import { reviewService } from "./review.service.js";
import { trustProfileService } from "./trust-profile.service.js";
import type {
  BuyerToSellerReviewInput,
  ModerateReviewInput,
  ReportReviewInput,
  SellerToBuyerReviewInput,
} from "./review.schemas.js";
import type { ReviewReportStatus } from "./review.types.js";

export const submitBuyerReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.orderId || req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const buyerAccountId = req.auth!.id;
  const body = req.body as BuyerToSellerReviewInput;

  const review = await reviewService.submitBuyerReview(orderId, buyerAccountId, body);

  res.status(201).json({
    success: true,
    message: "Buyer review submitted successfully.",
    data: review,
  });
});

export const submitSellerReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.orderId || req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const sellerAccountId = req.auth!.id;
  const body = req.body as SellerToBuyerReviewInput;

  const review = await reviewService.submitSellerReview(orderId, sellerAccountId, body);

  res.status(201).json({
    success: true,
    message: "Seller review submitted successfully.",
    data: review,
  });
});

export const reportReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const reviewId = Number(req.params.id);
  if (!reviewId || Number.isNaN(reviewId)) {
    throw new AppError(400, "INVALID_REVIEW_ID", "Invalid review ID.");
  }

  const reporterAccountId = req.auth!.id;
  const body = req.body as ReportReviewInput;

  const reportId = await reviewService.reportReview(reviewId, reporterAccountId, body);

  res.status(201).json({
    success: true,
    message: "Review reported for moderation.",
    data: { reportId },
  });
});

export const moderateReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const reviewId = Number(req.params.id);
  if (!reviewId || Number.isNaN(reviewId)) {
    throw new AppError(400, "INVALID_REVIEW_ID", "Invalid review ID.");
  }

  const adminAccountId = req.auth!.id;
  const body = req.body as ModerateReviewInput;

  const review = await reviewService.moderateReview(reviewId, adminAccountId, body);

  res.status(200).json({
    success: true,
    message: `Review ${body.action === "hide" ? "hidden" : "restored"} successfully.`,
    data: review,
  });
});

export const listReviewReportsHandler = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as ReviewReportStatus | undefined;
  const reports = await reviewService.listReports(status);

  res.status(200).json({
    success: true,
    data: reports,
  });
});

export const getPublicTrustProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  const accountId = Number(req.params.id);
  if (!accountId || Number.isNaN(accountId)) {
    throw new AppError(400, "INVALID_USER_ID", "Invalid user account ID.");
  }

  const profile = await trustProfileService.getPublicTrustProfile(accountId);

  res.status(200).json({
    success: true,
    data: profile,
  });
});
