import { pool } from "../database/pool.js";

/**
 * Lightweight sync function that updates approved auctions in the database
 * whose end time has passed to 'closed'.
 */
export async function syncAuctionStatus(): Promise<void> {
  try {
    // 1. Maintain active listings review status
    await pool.query(
      `UPDATE listings
       SET review_status = 'unsold', version = version + 1
       WHERE review_status IN ('approved', 'scheduled', 'open')
         AND end_time <= UTC_TIMESTAMP()
         AND deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM offers WHERE offers.listing_id = listings.id AND offers.status IN ('submitted', 'revised', 'shortlisted', 'countered', 'contact_requested', 'accepted_pending_buyer', 'buyer_confirmed')
         )
         AND NOT EXISTS (
           SELECT 1 FROM multi_unit_offers WHERE multi_unit_offers.listing_id = listings.id AND multi_unit_offers.status IN ('submitted', 'revised', 'shortlisted', 'countered', 'allocation_reserved', 'confirmed')
         )`,
    );

    // 2. Legacy auctions table support
    await pool.query(
      `UPDATE auctions
       SET status = 'closed'
       WHERE status = 'approved'
         AND ends_at <= UTC_TIMESTAMP()
         AND deleted_at IS NULL`,
    ).catch(() => undefined);
  } catch (error) {
    console.error("Failed to sync auction status:", error);
  }
}
