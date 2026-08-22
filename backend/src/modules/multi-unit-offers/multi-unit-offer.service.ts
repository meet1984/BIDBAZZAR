import { AppError } from "../../shared/AppError.js";
import { listingRepository } from "../listings/listing.repository.js";
import { multiUnitAllocationRepository } from "./multi-unit-allocation.repository.js";
import type { MultiUnitOfferRepository } from "./multi-unit-offer.repository.js";
import { multiUnitOfferRepository } from "./multi-unit-offer.repository.js";
import type { ReviseMultiUnitOfferInput, SubmitMultiUnitOfferInput } from "./multi-unit-offer.schemas.js";

export class MultiUnitOfferService {
  constructor(private readonly repository: MultiUnitOfferRepository) {}

  async submitOffer(buyerId: number, listingId: number, input: SubmitMultiUnitOfferInput) {
    const listing = await listingRepository.findById(listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The requested listing was not found.");
    }

    if (listing.saleMode !== "multi_unit_offer") {
      throw new AppError(400, "INVALID_SALE_MODE", "This listing does not accept multi-unit offers.");
    }

    if (
      listing.reviewStatus !== "approved" &&
      listing.reviewStatus !== "scheduled" &&
      listing.reviewStatus !== "open" &&
      listing.reviewStatus !== "partially_sold"
    ) {
      throw new AppError(409, "LISTING_NOT_LIVE", "This listing is not currently open for receiving offers.");
    }

    const now = Date.now();

    // Check custom offer window or standard start/end times
    const startWindow = listing.offerStartTime ? listing.offerStartTime.getTime() : listing.startTime.getTime();
    if (now < startWindow) {
      throw new AppError(409, "OFFER_WINDOW_NOT_OPEN", "The offer submission window for this listing has not opened yet.");
    }

    const endWindow = listing.offerEndTime ? listing.offerEndTime.getTime() : listing.endTime.getTime();
    if (now > endWindow) {
      throw new AppError(409, "OFFER_WINDOW_CLOSED", "The offer submission window for this listing has closed.");
    }

    if (listing.sellerId === buyerId) {
      throw new AppError(403, "SELLER_SELF_OFFER", "Sellers cannot submit an offer on their own listing.");
    }

    // Check for existing active offer
    const existingActive = await this.repository.findActiveByListingAndBuyer(listingId, buyerId);
    if (existingActive) {
      throw new AppError(
        409,
        "ACTIVE_OFFER_EXISTS",
        "You already have an active multi-unit offer on this listing. Please revise your existing offer instead.",
      );
    }

    // Server-side quantity validations
    const totalQty = listing.totalQuantity || 1;
    const minQty = listing.minOrderQuantity || 1;
    const maxQty = listing.maxOrderQuantity || totalQty;
    const increment = listing.quantityIncrement || 1;

    if (input.quantityRequested < minQty) {
      throw new AppError(
        422,
        "QUANTITY_BELOW_MINIMUM",
        `Requested quantity (${input.quantityRequested}) is below the listing minimum order quantity of ${minQty}.`,
      );
    }

    if (input.quantityRequested > maxQty) {
      throw new AppError(
        422,
        "QUANTITY_EXCEEDS_MAXIMUM",
        `Requested quantity (${input.quantityRequested}) exceeds the maximum order quantity of ${maxQty}.`,
      );
    }

    if (input.quantityRequested > totalQty) {
      throw new AppError(
        422,
        "QUANTITY_EXCEEDS_TOTAL",
        `Requested quantity (${input.quantityRequested}) exceeds total stock of ${totalQty}.`,
      );
    }

    // Increment validation
    if (increment > 1) {
      const offset = input.quantityRequested - minQty;
      if (offset % increment !== 0 && input.quantityRequested % increment !== 0) {
        throw new AppError(
          422,
          "INVALID_QUANTITY_INCREMENT",
          `Requested quantity (${input.quantityRequested}) must follow the required increment of ${increment}.`,
        );
      }
    }

    // Price decimal validation (max 2 decimal places)
    const priceStr = input.offeredPricePerUnit.toString();
    if (priceStr.includes(".")) {
      const decimals = priceStr.split(".")[1]?.length || 0;
      if (decimals > 2) {
        throw new AppError(422, "INVALID_PRICE_DECIMALS", "Offered price per unit cannot have more than two decimal places.");
      }
    }

    // Offer expiry validation
    if (input.offerExpiry) {
      const expiryDate = new Date(input.offerExpiry);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() <= now || expiryDate.getTime() > endWindow) {
        throw new AppError(400, "INVALID_EXPIRY", "Offer expiry date must be a valid future timestamp.");
      }
    }

    // Create offer — total_offer_value is ALWAYS calculated server-side inside repository.create
    const offerId = await this.repository.create(buyerId, listingId, input);
    const offer = (await this.repository.findById(offerId))!;


    return offer;
  }

  async reviseOffer(buyerId: number, offerId: number, input: ReviseMultiUnitOfferInput) {
    const offer = await this.repository.findById(offerId);
    if (!offer) {
      throw new AppError(404, "OFFER_NOT_FOUND", "The requested multi-unit offer was not found.");
    }

    if (offer.buyerId !== buyerId) {
      throw new AppError(403, "FORBIDDEN", "You can only revise your own offer.");
    }

    if (offer.offerExpiry && offer.offerExpiry.getTime() <= Date.now()) {
      await this.repository.updateStatus(offerId, "expired");
      throw new AppError(409, "OFFER_EXPIRED", "This offer has expired and cannot be revised.");
    }

    const revisableStatuses = ["submitted", "revised", "shortlisted", "countered"];
    if (!revisableStatuses.includes(offer.status)) {
      throw new AppError(
        409,
        "OFFER_NOT_REVISABLE",
        `Multi-unit offers in '${offer.status}' status cannot be revised.`,
      );
    }

    const listing = await listingRepository.findById(offer.listingId);
    if (!listing) throw new AppError(404, "LISTING_NOT_FOUND", "Associated listing not found.");
    const offerEnd = (listing.offerEndTime || listing.endTime).getTime();
    if (Date.now() >= offerEnd) {
      await this.repository.updateStatus(offerId, "expired");
      throw new AppError(409, "OFFER_WINDOW_CLOSED", "The offer window has closed.");
    }

    const newQty = input.quantityRequested ?? offer.quantityRequested;
    const newPrice = input.offeredPricePerUnit ?? offer.offeredPricePerUnit;

    const totalQty = listing.totalQuantity || 1;
    const minQty = listing.minOrderQuantity || 1;
    const maxQty = listing.maxOrderQuantity || totalQty;
    const increment = listing.quantityIncrement || 1;

    if (newQty < minQty || newQty > maxQty || newQty > totalQty) {
      throw new AppError(422, "INVALID_QUANTITY", "Revised quantity violates listing bounds.");
    }

    if (increment > 1) {
      const offset = newQty - minQty;
      if (offset % increment !== 0 && newQty % increment !== 0) {
        throw new AppError(
          422,
          "INVALID_QUANTITY_INCREMENT",
          `Requested quantity (${newQty}) must follow the required increment of ${increment}.`,
        );
      }
    }

    const priceStr = newPrice.toString();
    if (priceStr.includes(".")) {
      const decimals = priceStr.split(".")[1]?.length || 0;
      if (decimals > 2) {
        throw new AppError(422, "INVALID_PRICE_DECIMALS", "Offered price per unit cannot have more than two decimal places.");
      }
    }

    if (input.offerExpiry) {
      const expiry = new Date(input.offerExpiry).getTime();
      if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > offerEnd) {
        throw new AppError(400, "INVALID_EXPIRY", "Offer expiry must be in the future and within the listing window.");
      }
    }

    const revised = await this.repository.updateOffer(offerId, offer, input);
    if (!revised) {
      throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed while you were editing it. Refresh and try again.");
    }
    const updated = (await this.repository.findById(offerId))!;


    return updated;
  }

  async withdrawOffer(buyerId: number, offerId: number) {
    const offer = await this.repository.findById(offerId);
    if (!offer) {
      throw new AppError(404, "OFFER_NOT_FOUND", "The requested offer was not found.");
    }

    if (offer.buyerId !== buyerId) {
      throw new AppError(403, "FORBIDDEN", "You can only withdraw your own offer.");
    }

    const withdrawableStatuses = ["submitted", "revised", "shortlisted", "countered"];
    if (!withdrawableStatuses.includes(offer.status)) {
      throw new AppError(
        409,
        "OFFER_NOT_WITHDRAWABLE",
        `Multi-unit offers in '${offer.status}' status cannot be withdrawn.`,
      );
    }

    const cancelled = await this.repository.transitionStatus(offerId, "cancelled", offer.version, withdrawableStatuses);
    if (!cancelled) {
      throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    }
    const withdrawn = (await this.repository.findById(offerId))!;


    return withdrawn;
  }

  async listBuyerOffers(buyerId: number) {
    const offers = await this.repository.listByBuyer(buyerId);
    const now = Date.now();

    for (const offer of offers) {
      if (
        offer.offerExpiry &&
        offer.offerExpiry.getTime() <= now &&
        (offer.status === "submitted" || offer.status === "revised" || offer.status === "shortlisted")
      ) {
        await this.repository.updateStatus(offer.id, "expired");
        offer.status = "expired";
      }
    }
    return Promise.all(
      offers.map(async (offer) => ({
        ...offer,
        allocation: await multiUnitAllocationRepository.findActiveByOfferId(offer.id),
      })),
    );
  }
}

export const multiUnitOfferService = new MultiUnitOfferService(multiUnitOfferRepository);
