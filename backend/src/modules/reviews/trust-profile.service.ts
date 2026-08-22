import { AppError } from "../../shared/AppError.js";
import { authRepository } from "../auth/auth.repository.js";
import { buyerProfileRepository } from "../buyer-profile/buyer-profile.repository.js";
import { sellerProfileRepository } from "../seller-profile/seller-profile.repository.js";
import { reviewRepository, type ReviewRepository } from "./review.repository.js";
import type {
  PublicTrustProfile,
  RatingsSummary,
  ReviewRecord,
  TrustBadge,
} from "./review.types.js";

export class TrustProfileService {
  constructor(private readonly repository: ReviewRepository) {}

  /**
   * Computes ratings summary aggregate from published reviews only.
   */
  calculateRatingsSummary(reviews: ReviewRecord[]): RatingsSummary {
    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        starDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryBreakdown: {},
      };
    }

    const starDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    const categoryTotals: Record<string, { sum: number; count: number }> = {};

    for (const r of reviews) {
      const score = Math.min(Math.max(Math.round(r.ratingScore), 1), 5) as 1 | 2 | 3 | 4 | 5;
      starDistribution[score] = (starDistribution[score] || 0) + 1;
      totalScore += r.ratingScore;

      if (r.categoryRatings && typeof r.categoryRatings === "object") {
        for (const [key, val] of Object.entries(r.categoryRatings)) {
          if (typeof val === "number") {
            if (!categoryTotals[key]) {
              categoryTotals[key] = { sum: 0, count: 0 };
            }
            categoryTotals[key].sum += val;
            categoryTotals[key].count += 1;
          }
        }
      }
    }

    const categoryBreakdown: Record<string, number> = {};
    for (const [key, agg] of Object.entries(categoryTotals)) {
      categoryBreakdown[key] = Number((agg.sum / agg.count).toFixed(2));
    }

    return {
      averageRating: Number((totalScore / reviews.length).toFixed(2)),
      totalReviews: reviews.length,
      starDistribution,
      categoryBreakdown,
    };
  }

  /**
   * Generates public trust profile with badges and rating summaries.
   * Completely redacts all private KYC, documents, emails, and phones.
   */
  async getPublicTrustProfile(accountId: number): Promise<PublicTrustProfile> {
    const account = await authRepository.findAccountById(accountId);
    if (!account) {
      throw new AppError(404, "USER_NOT_FOUND", "User account not found.");
    }

    const isSeller = account.accountType === "seller";
    const completedTransactions = await this.repository.countCompletedOrders(
      accountId,
      isSeller ? "seller" : "buyer",
    );

    // Fetch published reviews only (excluding hidden/moderated reviews)
    const reviews = await this.repository.listByReviewee(accountId, true);
    const ratingsSummary = this.calculateRatingsSummary(reviews);

    // Badge evaluations
    const badges: TrustBadge[] = [];

    if (isSeller) {
      const sellerProfile = await sellerProfileRepository.findByAccountId(accountId);
      const isVerified = sellerProfile?.verificationStatus === "verified";
      const unresolvedDisputes = await this.repository.countUnresolvedDisputes(accountId);

      if (isVerified) {
        badges.push({
          id: "verified_identity",
          label: "Verified Identity",
          description: "Government ID and business credentials verified by BidMyLot compliance.",
        });
      }

      if (completedTransactions >= 10 && ratingsSummary.averageRating >= 4.5 && unresolvedDisputes === 0) {
        badges.push({
          id: "trusted_seller",
          label: "Trusted Seller",
          description: "Completed 10+ transactions with >= 4.5 rating and zero unresolved disputes.",
        });
      }

      if (completedTransactions >= 25 && ratingsSummary.averageRating >= 4.8) {
        badges.push({
          id: "top_rated",
          label: "Top Rated Seller",
          description: "Top-tier marketplace seller with 25+ completed sales and >= 4.8 rating.",
        });
      }
    } else {
      const buyerProfile = await buyerProfileRepository.findByAccountId(accountId);
      const isVerified = buyerProfile?.verificationStatus === "verified";

      if (isVerified) {
        badges.push({
          id: "verified_identity",
          label: "Verified Buyer",
          description: "Identity verified by BidMyLot compliance team.",
        });
      }

      if (completedTransactions >= 5 && ratingsSummary.averageRating >= 4.5) {
        badges.push({
          id: "trusted_buyer",
          label: "Trusted Buyer",
          description: "Reliable buyer with 5+ completed deals and a strong cooperation history.",
        });
      }
    }

    // Format reviews for public view with safe reviewer details
    const formattedReviews = await Promise.all(
      reviews.map(async (r) => {
        const reviewer = await authRepository.findAccountById(r.reviewerId);
        return {
          id: r.id,
          reviewerName: reviewer?.fullName || "Verified Member",
          ratingScore: r.ratingScore,
          categoryRatings: (r.categoryRatings as Record<string, number>) || {},
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    );

    return {
      id: account.id,
      fullName: account.fullName,
      accountType: (account.accountType === "seller" ? "seller" : account.accountType === "admin" ? "admin" : "buyer"),
      completedTransactionsCount: completedTransactions,
      badges,
      ratingsSummary,
      reviews: formattedReviews,
    };
  }
}

export const trustProfileService = new TrustProfileService(reviewRepository);
