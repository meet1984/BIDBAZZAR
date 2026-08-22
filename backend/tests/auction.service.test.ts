import { describe, expect, it, vi } from "vitest";
import { AuctionService } from "../src/modules/auctions/auction.service.js";
import type { AuctionRecord, AuctionRepository } from "../src/modules/auctions/auction.repository.js";

function sampleAuction(overrides: Partial<AuctionRecord> = {}): AuctionRecord {
  return {
    id: 10,
    sellerId: 5,
    slug: "sample-auction-123456",
    lotNumber: "BB-123456",
    title: "Sample Auction",
    category: "Electronics",
    description: "Sample description text for auction listing.",
    condition: "new",
    location: "Mumbai",
    imageUrl: null,
    imageUrls: [],
    startingPrice: 1000,
    currentBid: null,
    minimumIncrement: 100,
    bidCount: 0,
    startsAt: new Date(Date.now() + 100_000_000),
    endsAt: new Date(Date.now() + 200_000_000),
    workflowStatus: "draft",
    publicStatus: "upcoming",
    reviewNotes: null,
    sellerName: "Test Seller",
    isWatched: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("AuctionService confirmSeller", () => {
  it("rejects confirming a draft auction with 409 AUCTION_NOT_CONFIRMABLE and does not change status", async () => {
    const draftAuction = sampleAuction({ workflowStatus: "draft" });
    const findOwnedMock = vi.fn().mockResolvedValue(draftAuction);
    const confirmChangesMock = vi.fn().mockResolvedValue(true);

    const repository = {
      findOwned: findOwnedMock,
      confirmChanges: confirmChangesMock,
    } as unknown as AuctionRepository;

    const service = new AuctionService(repository);

    await expect(service.confirmSeller(5, 10)).rejects.toMatchObject({
      statusCode: 409,
      code: "AUCTION_NOT_CONFIRMABLE",
      message: "Only auctions awaiting your confirmation of admin changes can be confirmed.",
    });

    expect(findOwnedMock).toHaveBeenCalledWith(10, 5);
    expect(confirmChangesMock).not.toHaveBeenCalled();
    expect(draftAuction.workflowStatus).toBe("draft");
  });

  it("rejects confirming an already-approved auction with 409 AUCTION_NOT_CONFIRMABLE and does not change status", async () => {
    const approvedAuction = sampleAuction({ workflowStatus: "approved" });
    const findOwnedMock = vi.fn().mockResolvedValue(approvedAuction);
    const confirmChangesMock = vi.fn().mockResolvedValue(true);

    const repository = {
      findOwned: findOwnedMock,
      confirmChanges: confirmChangesMock,
    } as unknown as AuctionRepository;

    const service = new AuctionService(repository);

    await expect(service.confirmSeller(5, 10)).rejects.toMatchObject({
      statusCode: 409,
      code: "AUCTION_NOT_CONFIRMABLE",
      message: "Only auctions awaiting your confirmation of admin changes can be confirmed.",
    });

    expect(findOwnedMock).toHaveBeenCalledWith(10, 5);
    expect(confirmChangesMock).not.toHaveBeenCalled();
    expect(approvedAuction.workflowStatus).toBe("approved");
  });

  it("successfully confirms an auction in changes_requested status", async () => {
    const changesReqAuction = sampleAuction({ workflowStatus: "changes_requested", reviewNotes: "Admin requested changes" });
    const confirmedAuction = sampleAuction({ workflowStatus: "approved", reviewNotes: null });

    const findOwnedMock = vi.fn()
      .mockResolvedValueOnce(changesReqAuction)
      .mockResolvedValueOnce(confirmedAuction);
    const confirmChangesMock = vi.fn().mockResolvedValue(true);

    const repository = {
      findOwned: findOwnedMock,
      confirmChanges: confirmChangesMock,
    } as unknown as AuctionRepository;

    const service = new AuctionService(repository);

    const result = await service.confirmSeller(5, 10);

    expect(findOwnedMock).toHaveBeenCalledWith(10, 5);
    expect(confirmChangesMock).toHaveBeenCalledWith(10);
    expect(result.workflowStatus).toBe("approved");
  });

  it("throws 409 AUCTION_NOT_CONFIRMABLE if database row update affected 0 rows (race condition)", async () => {
    const changesReqAuction = sampleAuction({ workflowStatus: "changes_requested" });
    const findOwnedMock = vi.fn().mockResolvedValue(changesReqAuction);
    const confirmChangesMock = vi.fn().mockResolvedValue(false);

    const repository = {
      findOwned: findOwnedMock,
      confirmChanges: confirmChangesMock,
    } as unknown as AuctionRepository;

    const service = new AuctionService(repository);

    await expect(service.confirmSeller(5, 10)).rejects.toMatchObject({
      statusCode: 409,
      code: "AUCTION_NOT_CONFIRMABLE",
      message: "Only auctions awaiting your confirmation of admin changes can be confirmed.",
    });

    expect(confirmChangesMock).toHaveBeenCalledWith(10);
  });
});

describe("AuctionService reviewAdmin", () => {
  it("rejects reviewing a non-pending auction (e.g. approved/live) with 409 REVIEW_STATE_CHANGED", async () => {
    const liveAuction = sampleAuction({ workflowStatus: "approved" });
    const findByIdMock = vi.fn().mockResolvedValue(liveAuction);
    const reviewMock = vi.fn().mockResolvedValue(true);

    const repository = {
      findById: findByIdMock,
      review: reviewMock,
    } as unknown as AuctionRepository;

    const service = new AuctionService(repository);

    await expect(service.reviewAdmin(1, 10, { decision: "approve", notes: "" })).rejects.toMatchObject({
      statusCode: 409,
      code: "REVIEW_STATE_CHANGED",
      message: "This auction is no longer awaiting review.",
    });

    expect(findByIdMock).toHaveBeenCalledWith(10);
    expect(reviewMock).not.toHaveBeenCalled();
    expect(liveAuction.workflowStatus).toBe("approved");
  });

  it("successfully reviews a pending auction", async () => {
    const pendingAuction = sampleAuction({ workflowStatus: "pending" });
    const approvedAuction = sampleAuction({ workflowStatus: "approved" });

    const findByIdMock = vi.fn()
      .mockResolvedValueOnce(pendingAuction)
      .mockResolvedValueOnce(approvedAuction);
    const reviewMock = vi.fn().mockResolvedValue(true);

    const repository = {
      findById: findByIdMock,
      review: reviewMock,
    } as unknown as AuctionRepository;

    const service = new AuctionService(repository);

    const result = await service.reviewAdmin(1, 10, { decision: "approve", notes: "" });

    expect(findByIdMock).toHaveBeenCalledWith(10);
    expect(reviewMock).toHaveBeenCalledWith(10, 1, { decision: "approve", notes: "" });
    expect(result.workflowStatus).toBe("approved");
  });

  it("throws 409 REVIEW_STATE_CHANGED if database row update affected 0 rows (race condition)", async () => {
    const pendingAuction = sampleAuction({ workflowStatus: "pending" });
    const findByIdMock = vi.fn().mockResolvedValue(pendingAuction);
    const reviewMock = vi.fn().mockResolvedValue(false);

    const repository = {
      findById: findByIdMock,
      review: reviewMock,
    } as unknown as AuctionRepository;

    const service = new AuctionService(repository);

    await expect(service.reviewAdmin(1, 10, { decision: "approve", notes: "" })).rejects.toMatchObject({
      statusCode: 409,
      code: "REVIEW_STATE_CHANGED",
      message: "This auction is no longer awaiting review.",
    });

    expect(reviewMock).toHaveBeenCalledWith(10, 1, { decision: "approve", notes: "" });
  });
});
