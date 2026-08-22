import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// Unit test for the Trust Score & Rating summary presentation component logic
function BuyerTrustSummaryCard({ trustData }) {
  if (!trustData) return null;

  const avgRating = trustData.ratingsSummary?.averageRating || trustData.ratings?.averageScore;
  const totalReviews = trustData.ratingsSummary?.totalReviews ?? trustData.ratings?.totalReviews ?? 0;
  const completedDeals = trustData.completedTransactionsCount ?? trustData.metrics?.completedTransactionsCount ?? 0;
  const categories = trustData.ratingsSummary?.categoryBreakdown || trustData.ratings?.categoryAverages || {};
  const reviews = trustData.reviews || trustData.recentReviews || [];

  return (
    <div>
      <div data-testid="score-card">
        <span>{avgRating ? avgRating.toFixed(1) : "New"}</span>
        <span>{totalReviews} Reviews</span>
        <span>{completedDeals} Completed Deals</span>
      </div>

      <div data-testid="categories">
        {Object.entries(categories).map(([cat, score]) => (
          <div key={cat} data-testid={`cat-${cat}`}>
            <span>{cat}</span>
            <span>{Number(score).toFixed(1)}★</span>
          </div>
        ))}
      </div>

      <div data-testid="reviews-list">
        {reviews.length === 0 ? (
          <p>No written reviews yet for this buyer.</p>
        ) : (
          reviews.map((rev) => (
            <div key={rev.id} data-testid={`rev-${rev.id}`}>
              <span>{rev.ratingScore}/5</span>
              {rev.comment && <p>{rev.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

describe("Buyer Trust & Rating Presentation Logic", () => {
  it("renders verified buyer trust summary with ratings, completed deals, and categories", () => {
    const mockTrustProfile = {
      id: 42,
      fullName: "Acme Industrial Buyers",
      accountType: "buyer",
      completedTransactionsCount: 18,
      ratingsSummary: {
        averageRating: 4.8,
        totalReviews: 12,
        starDistribution: { 5: 10, 4: 2, 3: 0, 2: 0, 1: 0 },
        categoryBreakdown: {
          agreementReliability: 5.0,
          communication: 4.8,
          transactionCooperation: 4.6,
        },
      },
      reviews: [
        {
          id: 101,
          ratingScore: 5,
          comment: "Punctual communication and smooth coordination.",
          createdAt: "2026-08-01T10:00:00Z",
        },
      ],
    };

    render(<BuyerTrustSummaryCard trustData={mockTrustProfile} />);

    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("12 Reviews")).toBeInTheDocument();
    expect(screen.getByText("18 Completed Deals")).toBeInTheDocument();
    expect(screen.getByText("agreementReliability")).toBeInTheDocument();
    expect(screen.getByText("5.0★")).toBeInTheDocument();
    expect(screen.getByText("Punctual communication and smooth coordination.")).toBeInTheDocument();
  });

  it("handles new buyers without reviews gracefully with fallback state", () => {
    const emptyTrustProfile = {
      id: 99,
      fullName: "New Buyer",
      accountType: "buyer",
      completedTransactionsCount: 0,
      ratingsSummary: {
        averageRating: 0,
        totalReviews: 0,
        starDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        categoryBreakdown: {},
      },
      reviews: [],
    };

    render(<BuyerTrustSummaryCard trustData={emptyTrustProfile} />);

    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("0 Reviews")).toBeInTheDocument();
    expect(screen.getByText("0 Completed Deals")).toBeInTheDocument();
    expect(screen.getByText("No written reviews yet for this buyer.")).toBeInTheDocument();
  });
});
