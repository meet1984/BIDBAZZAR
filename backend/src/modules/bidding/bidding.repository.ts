import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../../database/pool.js";
import { formatBidderName } from "../../shared/bidder.js";
import { fromPaise, toPaise } from "../../shared/currency.js";

export interface LockedAuction {
  id: number;
  sellerId: number;
  status: "draft" | "pending" | "approved" | "rejected" | "closed";
  startingPrice: number;
  currentBid: number | null;
  minimumIncrement: number;
  bidCount: number;
  startsAt: Date;
  endsAt: Date;
  deletedAt: Date | null;
}

export interface AcceptedBid {
  id: number;
  auctionId: number;
  bidderId: number;
  bidder: string;
  amount: number;
  createdAt: string;
  currentBid: number;
  bidCount: number;
  minimumNextBid: number;
}

export type BidValidator = (auction: LockedAuction) => void;

function lockedAuction(row: RowDataPacket): LockedAuction {
  return {
    id: Number(row.id),
    sellerId: Number(row.seller_id),
    status: row.status as LockedAuction["status"],
    startingPrice: Number(row.starting_price),
    currentBid: row.current_bid == null ? null : Number(row.current_bid),
    minimumIncrement: Number(row.minimum_increment),
    bidCount: Number(row.bid_count),
    startsAt: new Date(row.starts_at as string | Date),
    endsAt: new Date(row.ends_at as string | Date),
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string | Date) : null,
  };
}

async function selectForUpdate(
  connection: PoolConnection,
  auctionId: number,
): Promise<LockedAuction | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id, seller_id, status, starting_price, current_bid, minimum_increment,
            bid_count, starts_at, ends_at, deleted_at
     FROM auctions WHERE id = ? LIMIT 1 FOR UPDATE`,
    [auctionId],
  );
  return rows[0] ? lockedAuction(rows[0]) : null;
}

/**
 * NOTE FOR FUTURE EDITORS:
 * Any new early return or error inside this transaction block MUST call
 * await connection.rollback() first so that the transaction is explicitly closed
 * and FOR UPDATE row locks are released before the connection is returned to the pool.
 */
export class BiddingRepository {
  async acceptBid(
    auctionId: number,
    bidderId: number,
    amount: number,
    validate: BidValidator,
  ): Promise<AcceptedBid | null> {
    return withTransaction(async (connection) => {
      const auction = await selectForUpdate(connection, auctionId);
      if (!auction) return null;

      validate(auction);

      const [insert] = await connection.execute<ResultSetHeader>(
        "INSERT INTO bids (auction_id, bidder_id, amount) VALUES (?, ?, ?)",
        [auctionId, bidderId, amount],
      );
      await connection.execute(
        `UPDATE auctions
         SET current_bid = ?, bid_count = bid_count + 1, winner_id = ?, version = version + 1
         WHERE id = ?`,
        [amount, bidderId, auctionId],
      );
      const createdAt = new Date().toISOString();
      return {
        id: Number(insert.insertId),
        auctionId,
        bidderId,
        bidder: formatBidderName(bidderId),
        amount,
        createdAt,
        currentBid: amount,
        bidCount: auction.bidCount + 1,
        minimumNextBid: fromPaise(toPaise(amount) + toPaise(auction.minimumIncrement)),
      };
    });
  }
}

export const biddingRepository = new BiddingRepository();
