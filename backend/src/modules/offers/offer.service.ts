import { AppError } from "../../shared/AppError.js";
import { listingRepository } from "../listings/listing.repository.js";
import type { OfferRepository } from "./offer.repository.js";
import { offerRepository } from "./offer.repository.js";
import type { ReviseOfferInput, SubmitOfferInput } from "./offer.schemas.js";

export class OfferService {
  constructor(private readonly repository: OfferRepository) {}

  async submitOffer(buyerId: number, listingId: number, input: SubmitOfferInput) {
    const listing = await listingRepository.findById(listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The requested listing was not found.");
    }

    if (listing.saleMode !== "negotiated_offer") {
      throw new AppError(400, "INVALID_SALE_MODE", "This listing does not accept negotiated offers.");
    }

    if (
      listing.reviewStatus !== "approved" &&
      listing.reviewStatus !== "scheduled" &&
      listing.reviewStatus !== "open"
    ) {
      throw new AppError(409, "LISTING_NOT_LIVE", "This listing is not currently open for receiving offers.");
    }

    if (listing.sellerId === buyerId) {
      throw new AppError(403, "SELLER_SELF_OFFER", "Sellers cannot submit an offer on their own listing.");
    }

    const now = Date.now();
    const offerStart = (listing.offerStartTime || listing.startTime).getTime();
    const offerEnd = (listing.offerEndTime || listing.endTime).getTime();
    if (now < offerStart) {
      throw new AppError(409, "OFFER_WINDOW_NOT_OPEN", "The offer window has not opened yet.");
    }
    if (now >= offerEnd) {
      throw new AppError(409, "OFFER_WINDOW_CLOSED", "The offer window has closed.");
    }

    const existingActive = await this.repository.findActiveByListingAndBuyer(listingId, buyerId);
    if (existingActive) {
      throw new AppError(
        409,
        "ACTIVE_OFFER_EXISTS",
        "You already have an active offer on this listing. Please revise your existing offer instead.",
      );
    }

    if (input.offerExpiry) {
      const expiryDate = new Date(input.offerExpiry);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() <= now || expiryDate.getTime() > offerEnd) {
        throw new AppError(400, "INVALID_EXPIRY", "Offer expiry date must be a valid future timestamp.");
      }
    }

    const offerId = await this.repository.create(listingId, buyerId, { ...input, currency: listing.currency });
    const offer = (await this.repository.findById(offerId))!;



    return offer;
  }

  async reviseOffer(buyerId: number, offerId: number, input: ReviseOfferInput) {
    const offer = await this.repository.findById(offerId);
    if (!offer) {
      throw new AppError(404, "OFFER_NOT_FOUND", "The requested offer was not found.");
    }

    if (offer.buyerId !== buyerId) {
      throw new AppError(403, "FORBIDDEN", "You can only revise your own offer.");
    }

    if (offer.offerExpiry && offer.offerExpiry.getTime() <= Date.now()) {
      await this.repository.updateStatus(offerId, "expired");
      throw new AppError(409, "OFFER_EXPIRED", "This offer has expired and cannot be revised.");
    }

    const revisableStatuses = ["submitted", "revised", "shortlisted", "countered", "contact_requested"];
    if (!revisableStatuses.includes(offer.status)) {
      throw new AppError(
        409,
        "OFFER_NOT_REVISABLE",
        `Offers in '${offer.status}' status cannot be revised.`,
      );
    }

    const listing = await listingRepository.findById(offer.listingId);
    if (!listing) throw new AppError(404, "LISTING_NOT_FOUND", "Associated listing not found.");
    const offerEnd = (listing.offerEndTime || listing.endTime).getTime();
    if (Date.now() >= offerEnd) {
      await this.repository.updateStatus(offerId, "expired");
      throw new AppError(409, "OFFER_WINDOW_CLOSED", "The offer window has closed.");
    }

    if (input.offerExpiry) {
      const expiryDate = new Date(input.offerExpiry);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() <= Date.now() || expiryDate.getTime() > offerEnd) {
        throw new AppError(400, "INVALID_EXPIRY", "Offer expiry date must be a valid future timestamp.");
      }
    }

    const revised = await this.repository.updateOffer(offerId, input, offer.version);
    if (!revised) {
      throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed while you were editing it. Refresh and try again.");
    }
    const updatedOffer = (await this.repository.findById(offerId))!;


    return updatedOffer;
  }

  async withdrawOffer(buyerId: number, offerId: number) {
    const offer = await this.repository.findById(offerId);
    if (!offer) {
      throw new AppError(404, "OFFER_NOT_FOUND", "The requested offer was not found.");
    }

    if (offer.buyerId !== buyerId) {
      throw new AppError(403, "FORBIDDEN", "You can only withdraw your own offer.");
    }

    const withdrawableStatuses = [
      "submitted",
      "revised",
      "shortlisted",
      "countered",
      "contact_requested",
      "accepted_pending_buyer",
    ];
    if (!withdrawableStatuses.includes(offer.status)) {
      throw new AppError(
        409,
        "OFFER_NOT_WITHDRAWABLE",
        `Offers in '${offer.status}' status cannot be withdrawn.`,
      );
    }

    const withdrawn = await this.repository.transitionStatus(offerId, "withdrawn", offer.version, withdrawableStatuses);
    if (!withdrawn) {
      throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    }
    const withdrawnOffer = (await this.repository.findById(offerId))!;


    return withdrawnOffer;
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
    return offers;
  }
}

export const offerService = new OfferService(offerRepository);
