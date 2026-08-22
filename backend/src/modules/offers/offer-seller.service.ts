import type { RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../../database/pool.js";
import { AppError } from "../../shared/AppError.js";
import { listingRepository } from "../listings/listing.repository.js";
import { orderRepository } from "../orders/order.repository.js";
import { auditLogService } from "../audit-log/audit-log.service.js";
import { notificationService } from "../notifications/notification.service.js";
import type { OfferRepository } from "./offer.repository.js";
import { offerRepository } from "./offer.repository.js";
import type { AcceptOfferInput, CounterOfferInput } from "./offer.schemas.js";

export class OfferSellerService {
  constructor(private readonly repository: OfferRepository) {}

  async listSellerOffers(sellerId: number, listingId: number) {
    const listing = await listingRepository.findById(listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The requested listing was not found.");
    }

    if (listing.sellerId !== sellerId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to manage offers for this listing.");
    }

    const allOffers = await this.repository.listByListing(listingId, listing.askingPrice);

    const aboveAsking = allOffers.filter((o) => o.offeredAmount > listing.askingPrice);
    const atAsking = allOffers.filter((o) => o.offeredAmount === listing.askingPrice);
    const belowAsking = allOffers.filter((o) => o.offeredAmount < listing.askingPrice);

    return {
      listingId,
      askingPrice: listing.askingPrice,
      currency: listing.currency,
      aboveAsking,
      atAsking,
      belowAsking,
      totalOffers: allOffers.length,
    };
  }

  async shortlistOffer(sellerId: number, offerId: number) {
    const offer = await this.repository.findById(offerId);
    if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Offer not found.");
    await this.verifySellerOwnership(sellerId, offer.listingId);
    await this.assertActionable(offer, ["submitted", "revised", "countered", "contact_requested"]);

    const changed = await this.repository.transitionStatus(offerId, "shortlisted", offer.version, ["submitted", "revised", "countered", "contact_requested"]);
    if (!changed) throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    const updated = (await this.repository.findById(offerId))!;


    return updated;
  }

  async rejectOffer(sellerId: number, offerId: number) {
    const offer = await this.repository.findById(offerId);
    if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Offer not found.");
    await this.verifySellerOwnership(sellerId, offer.listingId);
    await this.assertActionable(offer, ["submitted", "revised", "shortlisted", "countered", "contact_requested"]);

    const changed = await this.repository.transitionStatus(offerId, "rejected", offer.version, ["submitted", "revised", "shortlisted", "countered", "contact_requested"]);
    if (!changed) throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    const updated = (await this.repository.findById(offerId))!;


    return updated;
  }

  async counterOffer(sellerId: number, offerId: number, input: CounterOfferInput) {
    const offer = await this.repository.findById(offerId);
    if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Offer not found.");
    await this.verifySellerOwnership(sellerId, offer.listingId);
    await this.assertActionable(offer, ["submitted", "revised", "shortlisted", "contact_requested"]);

    const changed = await this.repository.updateCounter(offerId, input.counterAmount, input.sellerMessage, offer.version);
    if (!changed) throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    const updated = (await this.repository.findById(offerId))!;


    return updated;
  }

  async requestContact(sellerId: number, offerId: number) {
    const offer = await this.repository.findById(offerId);
    if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Offer not found.");
    await this.verifySellerOwnership(sellerId, offer.listingId);
    await this.assertActionable(offer, ["submitted", "revised", "shortlisted", "countered"]);

    const changed = await this.repository.transitionStatus(offerId, "contact_requested", offer.version, ["submitted", "revised", "shortlisted", "countered"]);
    if (!changed) throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    const updated = (await this.repository.findById(offerId))!;


    return updated;
  }

  async acceptOffer(sellerId: number, offerId: number, input: AcceptOfferInput = { confirmDeadlineHours: 48 }) {
    const deadlineHours = input.confirmDeadlineHours ?? 48;

    const outcome = await withTransaction(async (connection) => {
      // Lock target offer row
      const [offerRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM offers WHERE id = ? FOR UPDATE",
        [offerId],
      );
      if (!offerRows[0]) {
        throw new AppError(404, "OFFER_NOT_FOUND", "Offer not found.");
      }
      const offer = offerRows[0];

      // Lock listing row
      const [listingRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM listings WHERE id = ? FOR UPDATE",
        [offer.listing_id],
      );
      if (!listingRows[0]) {
        throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
      }
      const listing = listingRows[0];

      if (Number(listing.seller_id) !== sellerId) {
        throw new AppError(403, "FORBIDDEN", "You do not own this listing.");
      }

      // Check for existing accepted or confirmed offers on this listing (Single-winner invariant)
      const [conflictRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM offers
         WHERE listing_id = ? AND id != ? AND status IN ('accepted_pending_buyer', 'buyer_confirmed')
         FOR UPDATE`,
        [offer.listing_id, offerId],
      );

      if (conflictRows.length > 0) {
        throw new AppError(
          409,
          "ACCEPTANCE_CONFLICT",
          "Another offer has already been accepted or confirmed for this listing.",
        );
      }

      const validStatuses = ["submitted", "revised", "shortlisted", "countered", "contact_requested"];
      if (!validStatuses.includes(String(offer.status))) {
        throw new AppError(
          409,
          "INVALID_OFFER_STATUS",
          `Offers in '${offer.status}' status cannot be accepted.`,
        );
      }

      if (offer.offer_expiry && new Date(offer.offer_expiry as string | Date).getTime() <= Date.now()) {
        await connection.execute("UPDATE offers SET status = 'expired' WHERE id = ?", [offerId]);
        return { expired: true as const };
      }

      const expiryDate = new Date(Date.now() + deadlineHours * 3600 * 1000);

      await connection.execute(
        `UPDATE offers
         SET status = 'accepted_pending_buyer', offer_expiry = ?, version = version + 1
         WHERE id = ?`,
        [expiryDate, offerId],
      );

      await connection.execute(
        `UPDATE listings
         SET review_status = 'offer_selection', version = version + 1
         WHERE id = ?`,
        [offer.listing_id],
      );

      const [updated] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM offers WHERE id = ?",
        [offerId],
      );
      const result = updated[0];

      // Fetch other competing buyer account IDs on this listing to notify them
      const [competingRows] = await connection.execute<RowDataPacket[]>(
        `SELECT DISTINCT buyer_id FROM offers
         WHERE listing_id = ? AND id != ? AND status IN ('submitted', 'revised', 'shortlisted', 'countered', 'contact_requested')`,
        [offer.listing_id, offerId],
      );
      const competingBuyerIds = (Array.isArray(competingRows) ? competingRows : [])
        .map((r) => Number(r.buyer_id))
        .filter((id) => Boolean(id) && id !== Number(offer.buyer_id));

      const [buyerRows] = await connection.execute<(RowDataPacket & { full_name: string | null; email: string })[]>(
        "SELECT full_name, email FROM accounts WHERE id = ?",
        [offer.buyer_id],
      );
      const buyerName = buyerRows[0]?.full_name ? String(buyerRows[0].full_name) : "Buyer";

      const agreedAmount = Number(offer.counter_amount ?? offer.offered_amount);
      const listingTitle = String(listing.title || "Marketplace Listing");
      const lotReference = String(listing.listing_reference || `LOT-${offer.listing_id}`);
      const currency = String(offer.currency || listing.currency || "INR");
      const listingSlug = String(listing.public_slug || "");

      return {
        expired: false as const,
        result,
        notificationMeta: {
          buyerId: Number(offer.buyer_id),
          sellerId,
          buyerName,
          listingTitle,
          lotReference,
          amount: agreedAmount,
          currency,
          deadlineHours,
          listingSlug,
          competingBuyerIds,
        },
      };
    });

    if (outcome.expired) {
      throw new AppError(409, "OFFER_EXPIRED", "This offer has expired and cannot be accepted.");
    }

    if (outcome.notificationMeta) {
      const meta = outcome.notificationMeta;
      // 1. Notify selected buyer and send confirmation to seller
      await notificationService
        .notifyOfferAccepted({
          buyerId: meta.buyerId,
          sellerId: meta.sellerId,
          buyerName: meta.buyerName,
          listingTitle: meta.listingTitle,
          lotReference: meta.lotReference,
          amount: meta.amount,
          currency: meta.currency,
          deadlineHours: meta.deadlineHours,
          listingSlug: meta.listingSlug,
        })
        .catch((err) => console.warn("[Notification Warning] Offer accepted notification error:", err));

      // 2. Notify other competing buyers whose offers were not selected
      if (meta.competingBuyerIds.length > 0) {
        await notificationService
          .notifyOffersUnsuccessful(
            meta.competingBuyerIds,
            meta.listingTitle,
            meta.lotReference,
          )
          .catch((err) => console.warn("[Notification Warning] Competing offers notification error:", err));
      }
    }

    return outcome.result;
  }

  async buyerConfirmOffer(buyerId: number, offerId: number) {
    const outcome = await withTransaction(async (connection) => {
      // Lock offer row
      const [offerRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM offers WHERE id = ? FOR UPDATE",
        [offerId],
      );
      if (!offerRows[0]) {
        throw new AppError(404, "OFFER_NOT_FOUND", "Offer not found.");
      }
      const offer = offerRows[0];

      // Lock listing row
      const [listingRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM listings WHERE id = ? FOR UPDATE",
        [offer.listing_id],
      );
      if (!listingRows[0]) {
        throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
      }

      if (Number(offer.buyer_id) !== buyerId) {
        throw new AppError(403, "FORBIDDEN", "Only the selected buyer can confirm this offer.");
      }

      if (offer.status !== "accepted_pending_buyer") {
        throw new AppError(
          409,
          "OFFER_NOT_ACCEPTED_PENDING",
          `Offer is in '${offer.status}' status, not accepted_pending_buyer.`,
        );
      }

      // Expiry / Timeout check
      if (offer.offer_expiry && new Date(offer.offer_expiry as string | Date).getTime() <= Date.now()) {
        await connection.execute("UPDATE offers SET status = 'expired' WHERE id = ?", [offerId]);
        await connection.execute("UPDATE listings SET review_status = 'open' WHERE id = ?", [offer.listing_id]);
        return { expired: true as const };
      }

      // Check for competing confirmed offers
      const [confirmedConflict] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM offers
         WHERE listing_id = ? AND id != ? AND status = 'buyer_confirmed'
         FOR UPDATE`,
        [offer.listing_id, offerId],
      );
      if (confirmedConflict.length > 0) {
        throw new AppError(
          409,
          "CONFIRMATION_CONFLICT",
          "This listing has already been confirmed by another buyer.",
        );
      }

      // Confirm selected offer
      await connection.execute(
        "UPDATE offers SET status = 'buyer_confirmed', version = version + 1 WHERE id = ?",
        [offerId],
      );

      // Update listing to 'sold'
      await connection.execute(
        "UPDATE listings SET review_status = 'sold', version = version + 1 WHERE id = ?",
        [offer.listing_id],
      );

      // Get competing active offer buyers before cancelling
      const [competingRows] = await connection.execute<RowDataPacket[]>(
        `SELECT DISTINCT buyer_id FROM offers
         WHERE listing_id = ? AND id != ? AND status IN ('submitted', 'revised', 'shortlisted', 'countered', 'contact_requested', 'accepted_pending_buyer')`,
        [offer.listing_id, offerId],
      );
      const competingBuyerIds = competingRows
        .map((r) => Number(r.buyer_id))
        .filter((id) => Boolean(id) && id !== buyerId);

      // Close all competing active offers upon buyer confirmation inside the transaction
      await connection.execute(
        `UPDATE offers
         SET status = 'cancelled', version = version + 1
         WHERE listing_id = ? AND id != ? AND status IN ('submitted', 'revised', 'shortlisted', 'countered', 'contact_requested', 'accepted_pending_buyer')`,
        [offer.listing_id, offerId],
      );

      const [updated] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM offers WHERE id = ?",
        [offerId],
      );
      const result = updated[0];
      const sourceReference = `offer:${offerId}`;
      let order = await orderRepository.findBySourceReference(sourceReference, connection);
      if (!order) {
        const agreedPrice = Number(offer.counter_amount ?? offer.offered_amount);
        order = await orderRepository.create(
          {
            buyerId,
            sellerId: Number(listingRows[0].seller_id),
            listingId: Number(offer.listing_id),
            sourceType: "negotiated_offer",
            sourceOfferId: offerId,
            sourceAllocationId: null,
            sourceReference,
            quantity: 1,
            unitPrice: agreedPrice,
            totalAmount: agreedPrice,
            currency: String(offer.currency || listingRows[0].currency || "INR"),
          },
          connection,
        );
        await auditLogService.record(
          {
            actorAccountId: buyerId,
            action: "order:created",
            targetEntity: "order",
            targetId: order.id,
            reason: `Order created atomically from confirmed offer #${offerId}`,
            metadata: { offerId, orderReference: order.orderReference },
          },
          connection,
        );
      }

      return {
        expired: false as const,
        result: { ...result, order },
        competingBuyerIds,
        listingTitle: String(listingRows[0]?.title || "Marketplace Listing"),
        lotReference: String(listingRows[0]?.listing_reference || `LOT-${offer.listing_id}`),
      };
    });

    if (outcome.expired) {
      throw new AppError(409, "ACCEPTANCE_TIMEOUT", "The confirmation deadline timed out. The seller may select another offer.");
    }
    await notificationService.notifyOrderCreated(outcome.result.order).catch(() => undefined);
    if (outcome.competingBuyerIds && outcome.competingBuyerIds.length > 0) {
      await notificationService
        .notifyOffersUnsuccessful(
          outcome.competingBuyerIds,
          outcome.listingTitle,
          outcome.lotReference,
        )
        .catch(() => undefined);
    }
    return outcome.result;
  }

  async buyerDeclineOffer(buyerId: number, offerId: number) {
    return withTransaction(async (connection) => {
      const [offerRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM offers WHERE id = ? FOR UPDATE",
        [offerId],
      );
      if (!offerRows[0]) throw new AppError(404, "OFFER_NOT_FOUND", "Offer not found.");
      const offer = offerRows[0];

      if (Number(offer.buyer_id) !== buyerId) {
        throw new AppError(403, "FORBIDDEN", "Only the selected buyer can decline this offer.");
      }

      if (offer.status !== "accepted_pending_buyer") {
        throw new AppError(409, "OFFER_NOT_ACCEPTED_PENDING", "Offer is not pending buyer confirmation.");
      }

      await connection.execute(
        "UPDATE offers SET status = 'buyer_declined', version = version + 1 WHERE id = ?",
        [offerId],
      );

      // Reopen selection for seller
      await connection.execute(
        "UPDATE listings SET review_status = 'open', version = version + 1 WHERE id = ?",
        [offer.listing_id],
      );

      const [updated] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM offers WHERE id = ?",
        [offerId],
      );
      const result = updated[0];



      return result;
    });
  }

  private async verifySellerOwnership(sellerId: number, listingId: number): Promise<void> {
    const listing = await listingRepository.findById(listingId);
    if (!listing) throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
    if (listing.sellerId !== sellerId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to manage this listing's offers.");
    }
  }

  private async assertActionable(offer: { id: number; status: string; offerExpiry: Date | null }, allowed: string[]): Promise<void> {
    if (offer.offerExpiry && offer.offerExpiry.getTime() <= Date.now()) {
      await this.repository.updateStatus(offer.id, "expired");
      throw new AppError(409, "OFFER_EXPIRED", "This offer has expired.");
    }
    if (!allowed.includes(offer.status)) {
      throw new AppError(409, "INVALID_OFFER_STATUS", `Offers in '${offer.status}' status cannot perform this action.`);
    }
  }
}

export const offerSellerService = new OfferSellerService(offerRepository);
