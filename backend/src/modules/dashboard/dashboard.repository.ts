import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";

export interface BuyerBidActivity {
  auctionId: number;
  userHighestBid: number;
  lastBidAt: string;
}

export class DashboardRepository {
  async buyerBidActivity(userId: number): Promise<BuyerBidActivity[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.auction_id, MAX(b.amount) AS user_highest_bid, MAX(b.created_at) AS last_bid_at
       FROM bids b
       INNER JOIN auctions a ON a.id = b.auction_id
       WHERE b.bidder_id = ? AND a.deleted_at IS NULL
       GROUP BY b.auction_id
       ORDER BY last_bid_at DESC`,
      [userId],
    );
    return rows.map((row) => ({
      auctionId: Number(row.auction_id),
      userHighestBid: Number(row.user_highest_bid),
      lastBidAt: new Date(row.last_bid_at as string | Date).toISOString(),
    }));
  }

  async winningAuctionIds(userId: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM auctions
       WHERE winner_id = ?
         AND (status = 'closed' OR ends_at <= UTC_TIMESTAMP())
         AND deleted_at IS NULL
       ORDER BY ends_at DESC`,
      [userId],
    );
    return rows.map((row) => Number(row.id));
  }
}

export const dashboardRepository = new DashboardRepository();
