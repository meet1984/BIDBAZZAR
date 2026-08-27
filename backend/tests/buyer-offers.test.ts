import { describe, expect, it, vi } from "vitest";
import { OfferService } from "../src/modules/offers/offer.service.js";
import type { FullListingRecord } from "../src/modules/listings/listing.repository.js";
import { listingRepository } from "../src/modules/listings/listing.repository.js";
import type { OfferRecord } from "../src/types/database.types.js";

function mockListing(overrides: Partial<FullListingRecord> = {}): FullListingRecord {
  return {
    id: 101,
    sellerId: 50,
    categoryId: 1,
    subcategoryId: 2,
    saleMode: "negotiated_offer",
    title: "Test Industrial Generator",
    description: "High capacity diesel generator",
    condition: "used",
    location: "Mumbai",
    askingPrice: 500000,
    currency: "INR",
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(Date.now() + 86400000),
    offerSelectionDeadline: null,
    publicSlug: "test-industrial-generator-101",
    listingReference: "LOT-101",
    reviewStatus: "open",
    reviewNotes: null,
    version: 1,
    totalQuantity: null,
    unitName: null,
    askingPricePerUnit: null,
    minOrderQuantity: null,
    maxOrderQuantity: null,
    quantityIncrement: 1,
    allowPartialAllocation: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    categoryName: "Industrial",
    categorySlug: "industrial",
    subcategoryName: "Machinery",
    subcategorySlug: "machinery",
    sellerName: "Test Seller",
    sellerRating: 5.0,
    sellerReviewCount: 1,
    publicDisplayStatus: "live",
    isWatched: false,
    ...overrides,
  };
}

function mockOffer(overrides: Partial<OfferRecord> = {}): OfferRecord {
  return {
    id: 1,
    listingId: 101,
    buyerId: 88,
    offeredAmount: 450000,
    counterAmount: null,
    currency: "INR",
    buyerMessage: "Interested in quick deal",
    sellerMessage: null,
    offerExpiry: new Date(Date.now() + 86400000),
    status: "submitted",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Buyer Offer API & Business Rules (Phase 2)", () => {
  it("allows a buyer to offer below, at, or above asking price without minimum-beat restrictions", async () => {
    vi.spyOn(listingRepository, "findById").mockResolvedValue(mockListing({ askingPrice: 500000 }));

    let createdOfferAmount = 0;
    const mockRepo = {
      findActiveByListingAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((_listingId, _buyerId, input) => {
        createdOfferAmount = input.offeredAmount;
        return Promise.resolve(99);
      }),
      findById: vi.fn().mockImplementation((id) => Promise.resolve(mockOffer({ id, offeredAmount: createdOfferAmount }))),
      listByBuyer: vi.fn().mockResolvedValue([]),
      updateOffer: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    const service = new OfferService(mockRepo as any);

    // Offer below asking price (400,000 vs asking 500,000)
    const belowOffer = await service.submitOffer(88, 101, { offeredAmount: 400000, currency: "INR" });
    expect(belowOffer.offeredAmount).toBe(400000);

    // Offer at asking price (500,000)
    const atOffer = await service.submitOffer(88, 101, { offeredAmount: 500000, currency: "INR" });
    expect(atOffer.offeredAmount).toBe(500000);

    // Offer above asking price (600,000)
    const aboveOffer = await service.submitOffer(88, 101, { offeredAmount: 600000, currency: "INR" });
    expect(aboveOffer.offeredAmount).toBe(600000);
  });

  it("prevents a seller from submitting an offer on their own listing", async () => {
    vi.spyOn(listingRepository, "findById").mockResolvedValue(mockListing({ sellerId: 50 }));
    const service = new OfferService({} as any);

    await expect(service.submitOffer(50, 101, { offeredAmount: 450000, currency: "INR" })).rejects.toMatchObject({
      statusCode: 403,
      code: "SELLER_SELF_OFFER",
    });
  });

  it("prevents a buyer from submitting a second active offer on the same listing", async () => {
    vi.spyOn(listingRepository, "findById").mockResolvedValue(mockListing());
    const mockRepo = {
      findActiveByListingAndBuyer: vi.fn().mockResolvedValue(mockOffer()),
    };
    const service = new OfferService(mockRepo as any);

    await expect(service.submitOffer(88, 101, { offeredAmount: 480000, currency: "INR" })).rejects.toMatchObject({
      statusCode: 409,
      code: "ACTIVE_OFFER_EXISTS",
    });
  });

  it("blocks revision on expired offers server-side", async () => {
    const expiredOffer = mockOffer({
      buyerId: 88,
      offerExpiry: new Date(Date.now() - 3600000), // Expired 1 hour ago
      status: "submitted",
    });

    const mockRepo = {
      findById: vi.fn().mockResolvedValue(expiredOffer),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OfferService(mockRepo as any);

    await expect(service.reviseOffer(88, 1, { offeredAmount: 460000 })).rejects.toMatchObject({
      statusCode: 409,
      code: "OFFER_EXPIRED",
    });

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(1, "expired");
  });

  it("prevents buyers from viewing or accessing other buyers' exact offer amounts via buyer list endpoint", async () => {
    const buyer88Offer = { ...mockOffer({ id: 1, buyerId: 88, offeredAmount: 450000 }), listingTitle: "Gen", listingReference: "LOT-1", publicSlug: "gen", askingPrice: 500000, listingStatus: "open" };

    const mockRepo = {
      listByBuyer: vi.fn().mockImplementation((buyerId) => {
        if (buyerId === 88) return Promise.resolve([buyer88Offer]);
        return Promise.resolve([]); // Buyer 99 gets empty list, zero visibility of buyer 88 offers
      }),
    };

    const service = new OfferService(mockRepo as any);

    const buyer88Result = await service.listBuyerOffers(88);
    expect(buyer88Result).toHaveLength(1);
    expect(buyer88Result[0]!.offeredAmount).toBe(450000);

    const buyer99Result = await service.listBuyerOffers(99);
    expect(buyer99Result).toHaveLength(0); // Zero cross-buyer offer data leak!
  });

  it("allows a buyer to submit a brand new offer after withdrawing a previous offer", async () => {
    vi.spyOn(listingRepository, "findById").mockResolvedValue(mockListing());

    let createdOfferAmount = 0;
    const mockRepo = {
      // Returned null because withdrawn offers are not active
      findActiveByListingAndBuyer: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((_listingId, _buyerId, input) => {
        createdOfferAmount = input.offeredAmount;
        return Promise.resolve(105);
      }),
      findById: vi.fn().mockImplementation((id) => Promise.resolve(mockOffer({ id, offeredAmount: createdOfferAmount }))),
    };

    const service = new OfferService(mockRepo as any);

    // Buyer submits a new offer after withdrawing the previous one
    const newOffer = await service.submitOffer(88, 101, { offeredAmount: 470000, currency: "INR" });
    expect(newOffer.id).toBe(105);
    expect(newOffer.offeredAmount).toBe(470000);
  });
});
