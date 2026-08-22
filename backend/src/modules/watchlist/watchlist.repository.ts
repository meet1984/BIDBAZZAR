import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";

export class WatchlistRepository {
  async listingIds(accountId: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT w.listing_id
       FROM listing_watchlists w
       INNER JOIN listings l ON l.id = w.listing_id
       WHERE w.account_id = ? AND l.deleted_at IS NULL
       ORDER BY w.created_at DESC`,
      [accountId],
    );
    return rows.map((row) => Number(row.listing_id));
  }

  async add(accountId: number, listingId: number): Promise<void> {
    await pool.execute(
      "INSERT IGNORE INTO listing_watchlists (account_id, listing_id) VALUES (?, ?)",
      [accountId, listingId],
    );
  }

  async remove(accountId: number, listingId: number): Promise<void> {
    await pool.execute(
      "DELETE FROM listing_watchlists WHERE account_id = ? AND listing_id = ?",
      [accountId, listingId],
    );
  }
}

export const watchlistRepository = new WatchlistRepository();
