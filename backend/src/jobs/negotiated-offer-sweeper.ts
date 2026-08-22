import type { RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../database/pool.js";

/** Expires timed-out negotiated offers and reopens seller selection safely. */
export async function sweepNegotiatedOfferExpiries(): Promise<number> {
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, listing_id
       FROM offers
       WHERE status IN ('submitted', 'revised', 'shortlisted', 'countered', 'contact_requested', 'accepted_pending_buyer')
         AND offer_expiry IS NOT NULL
         AND offer_expiry <= UTC_TIMESTAMP()
       FOR UPDATE`,
    );
    if (rows.length === 0) return 0;

    const offerIds = rows.map((row) => Number(row.id));
    const listingIds = [...new Set(rows.map((row) => Number(row.listing_id)))];
    await connection.execute(
      `UPDATE offers SET status = 'expired', version = version + 1
       WHERE id IN (${offerIds.map(() => "?").join(",")})`,
      offerIds,
    );

    for (const listingId of listingIds) {
      const [activeSelection] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM offers
         WHERE listing_id = ? AND status IN ('accepted_pending_buyer', 'buyer_confirmed')
         LIMIT 1 FOR UPDATE`,
        [listingId],
      );
      if (activeSelection.length === 0) {
        await connection.execute(
          `UPDATE listings SET review_status = 'open', version = version + 1
           WHERE id = ? AND review_status = 'offer_selection'`,
          [listingId],
        );
      }
    }
    return offerIds.length;
  });
}
