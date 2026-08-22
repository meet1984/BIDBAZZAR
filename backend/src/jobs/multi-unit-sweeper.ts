import type { RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "../database/pool.js";
import { logger } from "../shared/logger.js";

export interface MultiUnitSweeperResult {
  expiredOffersCount: number;
  expiredReservationsCount: number;
  closedListingsCount: number;
}

/**
 * Idempotent background processing sweeper for multi-unit offer listings.
 * - Expires active offers past offer_expiry.
 * - Expires reserved allocations past reserved_until and releases inventory back to available pool.
 * - Closes sold-out listings (review_status = 'sold' / 'partially_sold').
 * - Moves ended listings into offer_selection or unsold.
 */
export async function sweepMultiUnitExpiries(): Promise<MultiUnitSweeperResult> {
  let expiredOffersCount = 0;
  let expiredReservationsCount = 0;
  let closedListingsCount = 0;

  try {
    // 1. Expire offers past offer_expiry
    expiredOffersCount = await withTransaction(async (connection) => {
      const [expiredOfferRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM multi_unit_offers
         WHERE status IN ('submitted', 'revised', 'shortlisted', 'countered')
           AND offer_expiry IS NOT NULL
           AND offer_expiry <= UTC_TIMESTAMP()
         FOR UPDATE`,
      );
      if (expiredOfferRows.length === 0) return 0;
      const ids = expiredOfferRows.map((r) => Number(r.id));
      await connection.execute(
        `UPDATE multi_unit_offers
         SET status = 'expired', version = version + 1
         WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids,
      );
      return expiredOfferRows.length;
    });


    // 2. Expire reserved allocations past reserved_until
    await withTransaction(async (connection) => {
      const [expiredAllocRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, offer_id, listing_id, buyer_id FROM multi_unit_allocations
         WHERE status = 'reserved'
           AND reserved_until IS NOT NULL
           AND reserved_until <= UTC_TIMESTAMP()
         FOR UPDATE`,
      );

      if (expiredAllocRows.length > 0) {
        const allocIds = expiredAllocRows.map((r) => Number(r.id));
        const offerIds = expiredAllocRows.map((r) => Number(r.offer_id));

        await connection.execute(
          `UPDATE multi_unit_allocations
           SET status = 'expired', version = version + 1
           WHERE id IN (${allocIds.map(() => "?").join(",")})`,
          allocIds,
        );

        await connection.execute(
          `UPDATE multi_unit_offers
           SET status = 'expired', version = version + 1
           WHERE id IN (${offerIds.map(() => "?").join(",")})`,
          offerIds,
        );

        expiredReservationsCount = expiredAllocRows.length;

      }
    });

    // 3. Update status of sold-out and ended multi-unit listings
    const [openMultiListings] = await pool.query<RowDataPacket[]>(
      `SELECT l.id, l.total_quantity, l.end_time, l.offer_end_time, l.review_status,
              COALESCE((
                SELECT SUM(a.allocated_quantity)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status IN ('reserved', 'confirmed')
                  AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
              ), 0) AS total_allocated,
              COALESCE((
                SELECT SUM(a.allocated_quantity)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status = 'confirmed'
              ), 0) AS total_confirmed
       FROM listings l
       WHERE l.sale_mode = 'multi_unit_offer'
         AND l.review_status IN ('approved', 'scheduled', 'open', 'partially_sold', 'offer_selection')
         AND l.deleted_at IS NULL`,
    );

    for (const listing of openMultiListings) {
      const listingId = Number(listing.id);
      const totalQty = Number(listing.total_quantity || 0);
      const totalAllocated = Number(listing.total_allocated || 0);
      const totalConfirmed = Number(listing.total_confirmed || 0);
      const remainingStock = Math.max(0, totalQty - totalAllocated);

      const now = Date.now();
      const endTime = listing.offer_end_time
        ? new Date(listing.offer_end_time as string | Date).getTime()
        : new Date(listing.end_time as string | Date).getTime();
      const hasEnded = now >= endTime;

      let newStatus: string | null = null;

      if (remainingStock <= 0) {
        newStatus = totalConfirmed >= totalQty ? "sold" : "partially_sold";
      } else if (hasEnded) {
        if (totalConfirmed > 0) {
          newStatus = "partially_sold";
        } else if (totalAllocated > 0) {
          newStatus = "offer_selection";
        } else {
          newStatus = "unsold";
        }
      }

      if (newStatus && newStatus !== listing.review_status) {
        await pool.execute(
          "UPDATE listings SET review_status = ?, version = version + 1 WHERE id = ?",
          [newStatus, listingId],
        );
        closedListingsCount++;
      }
    }
  } catch (error) {
    logger.error("Failed to run multi-unit sweeper job:", error);
    throw error;
  }

  return {
    expiredOffersCount,
    expiredReservationsCount,
    closedListingsCount,
  };
}
