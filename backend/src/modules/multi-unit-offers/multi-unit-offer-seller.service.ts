import type { RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../../database/pool.js";
import { AppError } from "../../shared/AppError.js";
import { listingRepository } from "../listings/listing.repository.js";
import { orderRepository } from "../orders/order.repository.js";
import { auditLogService } from "../audit-log/audit-log.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { multiUnitAllocationRepository } from "./multi-unit-allocation.repository.js";
import { multiUnitOfferRepository } from "./multi-unit-offer.repository.js";
import type { AcceptPartialInput, CounterMultiUnitOfferInput } from "./multi-unit-offer.schemas.js";

export class MultiUnitOfferSellerService {
  async listSellerOffers(sellerId: number, listingId: number) {
    const listing = await listingRepository.findById(listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The requested listing was not found.");
    }

    if (listing.sellerId !== sellerId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to manage offers for this listing.");
    }

    const offers = await multiUnitOfferRepository.listByListing(listingId);
    const allocations = await multiUnitAllocationRepository.listByListing(listingId);
    const totalAllocated = await multiUnitAllocationRepository.calculateAllocatedStock(listingId);
    const totalQuantity = listing.totalQuantity || 0;
    const remainingInventory = Math.max(0, totalQuantity - totalAllocated);

    const formattedOffers = offers.map((offer) => {
      const activeAlloc = allocations.find(
        (a) => a.offerId === offer.id && (a.status === "reserved" || a.status === "confirmed"),
      );
      const askingPrice = listing.askingPricePerUnit || 0;
      const diffFromAsking = offer.offeredPricePerUnit - askingPrice;

      return {
        id: offer.id,
        listingId: offer.listingId,
        buyerId: offer.buyerId,
        quantityRequested: offer.quantityRequested,
        offeredPricePerUnit: offer.offeredPricePerUnit,
        totalOfferValue: offer.totalOfferValue,
        buyerMessage: offer.buyerMessage,
        offerExpiry: offer.offerExpiry ? offer.offerExpiry.toISOString() : null,
        counterQuantity: offer.counterQuantity,
        counterUnitPrice: offer.counterUnitPrice,
        sellerMessage: offer.sellerMessage,
        status: offer.status,
        version: offer.version,
        diffFromAsking,
        allocation: activeAlloc
          ? {
              id: activeAlloc.id,
              allocatedQuantity: activeAlloc.allocatedQuantity,
              unitPrice: activeAlloc.unitPrice,
              totalAllocationValue: activeAlloc.totalAllocationValue,
              status: activeAlloc.status,
              reservedUntil: activeAlloc.reservedUntil ? activeAlloc.reservedUntil.toISOString() : null,
            }
          : null,
        createdAt: offer.createdAt.toISOString(),
        updatedAt: offer.updatedAt.toISOString(),
      };
    });

    return {
      listingId,
      totalQuantity,
      remainingInventory,
      unitName: listing.unitName ?? "unit",
      askingPricePerUnit: listing.askingPricePerUnit,
      // Authenticated seller set this floor price — returned ONLY in seller-owner dashboard handler
      minAcceptableUnitPrice: listing.minAcceptableUnitPrice ?? null,
      totalOffers: offers.length,
      offers: formattedOffers,
    };
  }

  async acceptFullOffer(sellerId: number, offerId: number) {
    const outcome = await withTransaction(async (connection) => {
      // 1. Lock offer row FIRST
      const [offerRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM multi_unit_offers WHERE id = ? FOR UPDATE",
        [offerId],
      );
      if (!offerRows[0]) {
        throw new AppError(404, "OFFER_NOT_FOUND", "Multi-unit offer not found.");
      }
      const offer = offerRows[0];

      // 2. Lock listing row
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

      const validStatuses = ["submitted", "revised", "shortlisted", "countered"];
      if (!validStatuses.includes(String(offer.status))) {
        throw new AppError(
          409,
          "INVALID_OFFER_STATUS",
          `Offers in '${offer.status}' status cannot be accepted.`,
        );
      }

      // Check if offer expired
      if (offer.offer_expiry && new Date(offer.offer_expiry as string | Date).getTime() <= Date.now()) {
        await connection.execute("UPDATE multi_unit_offers SET status = 'expired' WHERE id = ?", [offerId]);
        return { expired: true as const };
      }

      // 3. Transactional Inventory Calculation & Lock
      const totalAllocated = await multiUnitAllocationRepository.calculateAllocatedStockInTransaction(
        connection,
        Number(offer.listing_id),
      );

      const totalQuantity = Number(listing.total_quantity || 0);
      const remainingInventory = totalQuantity - totalAllocated;
      const requestedQty = Number(offer.status === "countered" ? offer.counter_quantity : offer.quantity_requested);
      const agreedUnitPrice = Number(offer.status === "countered" ? offer.counter_unit_price : offer.offered_price_per_unit);

      if (requestedQty > remainingInventory) {
        throw new AppError(
          409,
          "INSUFFICIENT_INVENTORY",
          `Cannot allocate ${requestedQty} units. Only ${remainingInventory} units remain available.`,
        );
      }

      // 4. Reserve stock for buyer
      const deadlineHours = Number(listing.buyer_confirmation_deadline_hours || 48);
      const reservedUntil = new Date(Date.now() + deadlineHours * 3600 * 1000);

      const allocationId = await multiUnitAllocationRepository.createInTransaction(connection, {
        offerId,
        listingId: Number(offer.listing_id),
        buyerId: Number(offer.buyer_id),
        allocatedQuantity: requestedQty,
        unitPrice: agreedUnitPrice,
        status: "reserved",
        reservedUntil,
      });

      // Update offer status
      await connection.execute(
        "UPDATE multi_unit_offers SET status = 'allocation_reserved', version = version + 1 WHERE id = ?",
        [offerId],
      );

      // Check if remaining inventory reaches zero -> close listing to new offers
      const newRemaining = remainingInventory - requestedQty;
      const newListingStatus = newRemaining <= 0 ? "sold" : "partially_sold";

      await connection.execute(
        "UPDATE listings SET review_status = ?, version = version + 1 WHERE id = ?",
        [newListingStatus, offer.listing_id],
      );

      const [buyerRows] = await connection.execute<(RowDataPacket & { full_name: string | null; email: string })[]>(
        "SELECT full_name, email FROM accounts WHERE id = ?",
        [offer.buyer_id],
      );
      const buyerName = buyerRows[0]?.full_name ? String(buyerRows[0].full_name) : "Buyer";

      return {
        expired: false as const,
        result: {
          allocationId,
          offerId,
          listingId: Number(offer.listing_id),
          allocatedQuantity: requestedQty,
          remainingInventory: newRemaining,
          reservedUntil,
          status: "reserved",
        },
        notificationMeta: {
          buyerId: Number(offer.buyer_id),
          sellerId,
          buyerName,
          listingTitle: String(listing.title || "Marketplace Listing"),
          lotReference: String(listing.listing_reference || `LOT-${offer.listing_id}`),
          quantity: requestedQty,
          unitPrice: agreedUnitPrice,
          currency: String(listing.currency || "INR"),
        },
      };
    });

    if (outcome.expired) {
      throw new AppError(409, "OFFER_EXPIRED", "This offer has expired and cannot be accepted.");
    }

    if (outcome.notificationMeta) {
      await notificationService
        .notifyAllocationAccepted(outcome.notificationMeta)
        .catch((err) => console.warn("[Notification Warning] Multi-unit full allocation notification error:", err));
    }

    return outcome.result;
  }

  async acceptPartialOffer(sellerId: number, offerId: number, input: AcceptPartialInput) {
    const outcome = await withTransaction(async (connection) => {
      // 1. Lock offer row
      const [offerRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM multi_unit_offers WHERE id = ? FOR UPDATE",
        [offerId],
      );
      if (!offerRows[0]) {
        throw new AppError(404, "OFFER_NOT_FOUND", "Multi-unit offer not found.");
      }
      const offer = offerRows[0];

      // 2. Lock listing row
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

      if (offer.offer_expiry && new Date(offer.offer_expiry as string | Date).getTime() <= Date.now()) {
        await connection.execute("UPDATE multi_unit_offers SET status = 'expired' WHERE id = ?", [offerId]);
        return { expired: true as const };
      }

      if (!listing.allow_partial_allocation) {
        throw new AppError(
          422,
          "PARTIAL_ALLOCATION_NOT_ALLOWED",
          "This listing does not allow partial allocation.",
        );
      }

      const validStatuses = ["submitted", "revised", "shortlisted", "countered"];
      if (!validStatuses.includes(String(offer.status))) {
        throw new AppError(
          409,
          "INVALID_OFFER_STATUS",
          `Offers in '${offer.status}' status cannot be partially accepted.`,
        );
      }

      const requestedQty = Number(offer.status === "countered" ? offer.counter_quantity : offer.quantity_requested);
      if (input.partialQuantity > requestedQty) {
        throw new AppError(
          422,
          "PARTIAL_EXCEEDS_REQUESTED",
          `Partial allocation quantity (${input.partialQuantity}) cannot exceed requested quantity (${requestedQty}).`,
        );
      }

      // 3. Transactional Inventory Calculation & Lock
      const totalAllocated = await multiUnitAllocationRepository.calculateAllocatedStockInTransaction(
        connection,
        Number(offer.listing_id),
      );

      const totalQuantity = Number(listing.total_quantity || 0);
      const remainingInventory = totalQuantity - totalAllocated;

      if (input.partialQuantity > remainingInventory) {
        throw new AppError(
          409,
          "INSUFFICIENT_INVENTORY",
          `Cannot allocate ${input.partialQuantity} units. Only ${remainingInventory} units remain available.`,
        );
      }

      const deadlineHours = Number(listing.buyer_confirmation_deadline_hours || 48);
      const reservedUntil = new Date(Date.now() + deadlineHours * 3600 * 1000);

      const allocationId = await multiUnitAllocationRepository.createInTransaction(connection, {
        offerId,
        listingId: Number(offer.listing_id),
        buyerId: Number(offer.buyer_id),
        allocatedQuantity: input.partialQuantity,
        unitPrice: Number(offer.status === "countered" ? offer.counter_unit_price : offer.offered_price_per_unit),
        status: "reserved",
        reservedUntil,
      });

      await connection.execute(
        "UPDATE multi_unit_offers SET status = 'allocation_reserved', version = version + 1 WHERE id = ?",
        [offerId],
      );

      const newRemaining = remainingInventory - input.partialQuantity;
      const newListingStatus = newRemaining <= 0 ? "sold" : "partially_sold";
      await connection.execute(
        "UPDATE listings SET review_status = ?, version = version + 1 WHERE id = ?",
        [newListingStatus, offer.listing_id],
      );

      const [buyerRows] = await connection.execute<(RowDataPacket & { full_name: string | null; email: string })[]>(
        "SELECT full_name, email FROM accounts WHERE id = ?",
        [offer.buyer_id],
      );
      const buyerName = buyerRows[0]?.full_name ? String(buyerRows[0].full_name) : "Buyer";
      const unitPrice = Number(offer.status === "countered" ? offer.counter_unit_price : offer.offered_price_per_unit);

      return {
        expired: false as const,
        result: {
          allocationId,
          offerId,
          listingId: Number(offer.listing_id),
          allocatedQuantity: input.partialQuantity,
          remainingInventory: newRemaining,
          reservedUntil,
          status: "reserved",
        },
        notificationMeta: {
          buyerId: Number(offer.buyer_id),
          sellerId,
          buyerName,
          listingTitle: String(listing.title || "Marketplace Listing"),
          lotReference: String(listing.listing_reference || `LOT-${offer.listing_id}`),
          quantity: input.partialQuantity,
          unitPrice,
          currency: String(listing.currency || "INR"),
        },
      };
    });

    if (outcome.expired) {
      throw new AppError(409, "OFFER_EXPIRED", "This offer has expired and cannot be accepted.");
    }

    if (outcome.notificationMeta) {
      await notificationService
        .notifyAllocationAccepted(outcome.notificationMeta)
        .catch((err) => console.warn("[Notification Warning] Multi-unit partial allocation notification error:", err));
    }

    return outcome.result;
  }

  async counterOffer(sellerId: number, offerId: number, input: CounterMultiUnitOfferInput) {
    const offer = await multiUnitOfferRepository.findById(offerId);
    if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Multi-unit offer not found.");

    const listing = await listingRepository.findById(offer.listingId);
    if (!listing || listing.sellerId !== sellerId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to counter this offer.");
    }

    const revisableStatuses = ["submitted", "revised", "shortlisted"];
    if (!revisableStatuses.includes(offer.status)) {
      throw new AppError(409, "INVALID_OFFER_STATUS", `Offers in '${offer.status}' status cannot be countered.`);
    }

    if (input.counterQuantity) {
      const totalQty = listing.totalQuantity || 0;
      if (input.counterQuantity > totalQty) {
        throw new AppError(422, "INVALID_COUNTER_QUANTITY", `Counter quantity cannot exceed total stock (${totalQty}).`);
      }
    }

    const changed = await multiUnitOfferRepository.updateCounter(
      offerId,
      offer.version,
      input.counterQuantity ?? offer.counterQuantity ?? offer.quantityRequested,
      input.counterUnitPrice ?? offer.counterUnitPrice ?? offer.offeredPricePerUnit,
      input.sellerMessage,
    );
    if (!changed) throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");

    const updated = (await multiUnitOfferRepository.findById(offerId))!;

    return updated;
  }

  async shortlistOffer(sellerId: number, offerId: number) {
    const offer = await multiUnitOfferRepository.findById(offerId);
    if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Multi-unit offer not found.");

    const listing = await listingRepository.findById(offer.listingId);
    if (!listing || listing.sellerId !== sellerId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to shortlist this offer.");
    }

    if (!["submitted", "revised", "countered"].includes(offer.status)) {
      throw new AppError(409, "INVALID_OFFER_STATUS", `Offers in '${offer.status}' status cannot be shortlisted.`);
    }

    const changed = await multiUnitOfferRepository.transitionStatus(offerId, "shortlisted", offer.version, ["submitted", "revised", "countered"]);
    if (!changed) throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    const updated = (await multiUnitOfferRepository.findById(offerId))!;

    return updated;
  }

  async rejectOffer(sellerId: number, offerId: number) {
    const offer = await multiUnitOfferRepository.findById(offerId);
    if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Multi-unit offer not found.");

    const listing = await listingRepository.findById(offer.listingId);
    if (!listing || listing.sellerId !== sellerId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to reject this offer.");
    }

    if (!["submitted", "revised", "shortlisted", "countered"].includes(offer.status)) {
      throw new AppError(409, "INVALID_OFFER_STATUS", `Offers in '${offer.status}' status cannot be rejected.`);
    }

    const changed = await multiUnitOfferRepository.transitionStatus(offerId, "rejected", offer.version, ["submitted", "revised", "shortlisted", "countered"]);
    if (!changed) throw new AppError(409, "OFFER_STATE_CHANGED", "The offer changed. Refresh and try again.");
    const updated = (await multiUnitOfferRepository.findById(offerId))!;

    return updated;
  }

  // --- BUYER CONFIRMATION & DECLINE ACTIONS ---

  async buyerConfirmAllocation(buyerId: number, allocationId: number) {
    const outcome = await withTransaction(async (connection) => {
      // Lock target allocation row
      const [allocRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM multi_unit_allocations WHERE id = ? FOR UPDATE",
        [allocationId],
      );
      if (!allocRows[0]) {
        throw new AppError(404, "ALLOCATION_NOT_FOUND", "Allocation not found.");
      }
      const alloc = allocRows[0];

      if (Number(alloc.buyer_id) !== buyerId) {
        throw new AppError(403, "FORBIDDEN", "Only the allocated buyer can confirm this reservation.");
      }

      if (alloc.status !== "reserved" && alloc.status !== "proposed") {
        throw new AppError(
          409,
          "INVALID_ALLOCATION_STATUS",
          `Allocations in '${alloc.status}' status cannot be confirmed.`,
        );
      }

      // Expiry check on read
      if (alloc.reserved_until && new Date(alloc.reserved_until as string | Date).getTime() <= Date.now()) {
        await connection.execute("UPDATE multi_unit_allocations SET status = 'expired' WHERE id = ?", [allocationId]);
        await connection.execute("UPDATE multi_unit_offers SET status = 'expired' WHERE id = ?", [alloc.offer_id]);
        await connection.execute(
          "UPDATE listings SET review_status = 'partially_sold', version = version + 1 WHERE id = ? AND review_status = 'sold'",
          [alloc.listing_id],
        );
        return { expired: true as const };
      }

      // Confirm allocation
      await multiUnitAllocationRepository.updateStatusInTransaction(connection, allocationId, "confirmed", {
        confirmedAt: new Date(),
      });

      // Update offer status
      await connection.execute(
        "UPDATE multi_unit_offers SET status = 'confirmed', version = version + 1 WHERE id = ?",
        [alloc.offer_id],
      );

      const [updated] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM multi_unit_allocations WHERE id = ?",
        [allocationId],
      );

      const sourceReference = `allocation:${allocationId}`;
      let order = await orderRepository.findBySourceReference(sourceReference, connection);
      if (!order) {
        const [listingRows] = await connection.execute<RowDataPacket[]>(
          `SELECT l.seller_id, l.currency
           FROM listings l
           JOIN multi_unit_offers o ON o.id = ?
           WHERE l.id = ?
           FOR UPDATE`,
          [alloc.offer_id, alloc.listing_id],
        );
        if (!listingRows[0]) throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
        const quantity = Number(alloc.allocated_quantity);
        const unitPrice = Number(alloc.unit_price);
        order = await orderRepository.create(
          {
            buyerId,
            sellerId: Number(listingRows[0].seller_id),
            listingId: Number(alloc.listing_id),
            sourceType: "multi_unit_allocation",
            sourceOfferId: null,
            sourceAllocationId: allocationId,
            sourceReference,
            quantity,
            unitPrice,
            totalAmount: Number((quantity * unitPrice).toFixed(2)),
            currency: String(listingRows[0].currency || "INR"),
          },
          connection,
        );
        await auditLogService.record(
          {
            actorAccountId: buyerId,
            action: "order:created",
            targetEntity: "order",
            targetId: order.id,
            reason: `Order created atomically from confirmed allocation #${allocationId}`,
            metadata: { allocationId, orderReference: order.orderReference },
          },
          connection,
        );
      }

      return { expired: false as const, result: { ...updated[0], order } };
    });

    if (outcome.expired) {
      throw new AppError(409, "RESERVATION_EXPIRED", "The reservation deadline expired and the stock was released.");
    }
    await notificationService.notifyOrderCreated(outcome.result.order).catch(() => undefined);
    return outcome.result;
  }

  async buyerDeclineAllocation(buyerId: number, allocationId: number) {
    return withTransaction(async (connection) => {
      const [allocRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM multi_unit_allocations WHERE id = ? FOR UPDATE",
        [allocationId],
      );
      if (!allocRows[0]) {
        throw new AppError(404, "ALLOCATION_NOT_FOUND", "Allocation not found.");
      }
      const alloc = allocRows[0];

      if (Number(alloc.buyer_id) !== buyerId) {
        throw new AppError(403, "FORBIDDEN", "Only the allocated buyer can decline this reservation.");
      }

      if (alloc.status !== "reserved" && alloc.status !== "proposed") {
        throw new AppError(
          409,
          "INVALID_ALLOCATION_STATUS",
          `Allocations in '${alloc.status}' status cannot be declined.`,
        );
      }

      // Release stock back to available pool
      await multiUnitAllocationRepository.updateStatusInTransaction(connection, allocationId, "released", {
        releasedAt: new Date(),
      });

      await connection.execute(
        "UPDATE multi_unit_offers SET status = 'declined', version = version + 1 WHERE id = ?",
        [alloc.offer_id],
      );

      // Re-evaluate listing status if it was 'sold'
      const [listingRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM listings WHERE id = ? FOR UPDATE",
        [alloc.listing_id],
      );
      if (listingRows[0] && listingRows[0].review_status === "sold") {
        await connection.execute(
          "UPDATE listings SET review_status = 'partially_sold', version = version + 1 WHERE id = ?",
          [alloc.listing_id],
        );
      }

      const [updated] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM multi_unit_allocations WHERE id = ?",
        [allocationId],
      );

      return updated[0];
    });
  }
}

export const multiUnitOfferSellerService = new MultiUnitOfferSellerService();
