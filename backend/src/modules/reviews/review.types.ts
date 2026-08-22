import type {
  BuyerToSellerCategoryRatings,
  ReviewDirection,
  ReviewRecord,
  ReviewReportReason,
  ReviewReportRecord,
  ReviewReportStatus,
  SellerToBuyerCategoryRatings,
} from "../../types/database.types.js";

export interface CreateReviewParams {
  orderId: number;
  reviewerId: number;
  revieweeId: number;
  direction: ReviewDirection;
  ratingScore: number;
  categoryRatings: BuyerToSellerCategoryRatings | SellerToBuyerCategoryRatings | Record<string, number>;
  comment: string;
  isPublished?: boolean;
}

export interface UpdateReviewParams {
  ratingScore: number;
  categoryRatings: BuyerToSellerCategoryRatings | SellerToBuyerCategoryRatings | Record<string, number>;
  comment: string;
}

export interface CreateReportParams {
  reviewId: number;
  reporterId: number;
  reason: ReviewReportReason;
  details: string;
}

export interface RatingsSummary {
  averageRating: number;
  totalReviews: number;
  starDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  categoryBreakdown: Record<string, number>;
}

export interface TrustBadge {
  id: string;
  label: string;
  description: string;
  icon?: string;
  earnedAt?: string;
}

export interface PublicTrustProfile {
  id: number;
  fullName: string;
  accountType: "buyer" | "seller" | "admin";
  completedTransactionsCount: number;
  badges: TrustBadge[];
  ratingsSummary: RatingsSummary;
  reviews: {
    id: number;
    reviewerName: string;
    ratingScore: number;
    categoryRatings: Record<string, number>;
    comment: string;
    createdAt: string;
  }[];
}

export type {
  BuyerToSellerCategoryRatings,
  ReviewDirection,
  ReviewRecord,
  ReviewReportReason,
  ReviewReportRecord,
  ReviewReportStatus,
  SellerToBuyerCategoryRatings,
};
