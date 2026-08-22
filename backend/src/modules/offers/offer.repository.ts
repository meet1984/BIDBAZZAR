import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { OfferRecord, OfferStatus } from "../../types/database.types.js";
import type { ReviseOfferInput, SubmitOfferInput } from "./offer.schemas.js";

export interface BuyerOfferItem extends OfferRecord {
  listingTitle: string;
  listingReference: string;
  publicSlug: string;
  askingPrice: number;
  listingStatus: string;
}

export interface SellerOfferItem extends OfferRecord {
  buyer: {
    fullName: string;
    businessName: string | null;
    verificationStatus: string;
    averageRating: number;
    completedTransactionsCount: number;
  };
  buyerPublicProfile: {
    accountId: number;
    displayName: string;
    verificationStatus: string;
    profileImage: string | null;
    completedTransactionsCount: number;
    averageRating: number;
  };
  differenceFromAsking: number;
}

function offerFromRow(row: RowDataPacket): OfferRecord {
  return {
    id: Number(row.id),
    listingId: Number(row.listing_id),
    buyerId: Number(row.buyer_id),
    offeredAmount: Number(row.offered_amount),
    counterAmount: row.counter_amount == null ? null : Number(row.counter_amount),
    currency: String(row.currency ?? "INR"),
    buyerMessage: row.buyer_message == null ? null : String(row.buyer_message),
    sellerMessage: row.seller_message == null ? null : String(row.seller_message),
    offerExpiry: row.offer_expiry == null ? null : new Date(row.offer_expiry as string | Date),
    status: row.status as OfferStatus,
    version: Number(row.version),
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class OfferRepository {
  async create(listingId: number, buyerId: number, input: SubmitOfferInput): Promise<number> {
    const expiryDate = input.offerExpiry ? new Date(input.offerExpiry) : null;
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO offers (
        listing_id, buyer_id, offered_amount, currency, buyer_message, offer_expiry, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        listingId,
        buyerId,
        input.offeredAmount,
        input.currency || "INR",
        input.buyerMessage || null,
        expiryDate,
      ],
    );
    return Number(result.insertId);
  }

  async findById(id: number): Promise<OfferRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM offers WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] ? offerFromRow(rows[0]) : null;
  }

  async findActiveByListingAndBuyer(listingId: number, buyerId: number): Promise<OfferRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM offers
       WHERE listing_id = ? AND buyer_id = ?
         AND status IN ('submitted', 'revised', 'shortlisted', 'countered', 'contact_requested', 'accepted_pending_buyer')
       ORDER BY id DESC LIMIT 1`,
      [listingId, buyerId],
    );
    return rows[0] ? offerFromRow(rows[0]) : null;
  }

  async listByBuyer(buyerId: number): Promise<BuyerOfferItem[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.*,
              l.title AS listing_title,
              l.listing_reference,
              l.public_slug,
              l.asking_price,
              l.review_status AS listing_status
       FROM offers o
       INNER JOIN listings l ON l.id = o.listing_id
       WHERE o.buyer_id = ?
       ORDER BY o.created_at DESC`,
      [buyerId],
    );
    return rows.map((row) => ({
      ...offerFromRow(row),
      listingTitle: String(row.listing_title),
      listingReference: String(row.listing_reference),
      publicSlug: String(row.public_slug),
      askingPrice: Number(row.asking_price),
      listingStatus: String(row.listing_status),
    }));
  }

  async listByListing(listingId: number, askingPrice: number): Promise<SellerOfferItem[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.*,
              bp.legal_full_name,
              bp.business_name,
              bp.profile_image,
              bp.verification_status,
              a.full_name AS account_full_name,
              COALESCE(rr.completed_transactions_count, 0) AS completed_transactions_count,
              COALESCE(rr.average_rating, 0) AS average_rating
       FROM offers o
       LEFT JOIN accounts a ON a.id = o.buyer_id
       LEFT JOIN buyer_profiles bp ON bp.account_id = o.buyer_id
       LEFT JOIN (
         SELECT reviewee_id, COUNT(*) AS completed_transactions_count, AVG(rating_score) AS average_rating
         FROM reviews WHERE direction = 'seller_to_buyer' AND is_published = TRUE
         GROUP BY reviewee_id
       ) rr ON rr.reviewee_id = o.buyer_id
       WHERE o.listing_id = ?
       ORDER BY o.offered_amount DESC, o.created_at ASC`,
      [listingId],
    );

    return rows.map((row) => {
      const offer = offerFromRow(row);
      const displayName = String(row.business_name || row.legal_full_name || row.account_full_name || `Buyer #${offer.buyerId}`);
      const buyerPublicProfile = {
        accountId: offer.buyerId,
        displayName,
        verificationStatus: String(row.verification_status || "verified"),
        profileImage: row.profile_image ? String(row.profile_image) : null,
        completedTransactionsCount: Number(row.completed_transactions_count),
        averageRating: Number(Number(row.average_rating).toFixed(1)),
      };
      return {
        ...offer,
        buyer: {
          fullName: displayName,
          businessName: row.business_name ? String(row.business_name) : null,
          verificationStatus: buyerPublicProfile.verificationStatus,
          averageRating: buyerPublicProfile.averageRating,
          completedTransactionsCount: buyerPublicProfile.completedTransactionsCount,
        },
        buyerPublicProfile,
        differenceFromAsking: offer.offeredAmount - askingPrice,
      };
    });
  }

  async updateCounter(id: number, counterAmount: number, sellerMessage: string | null | undefined, expectedVersion: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE offers
       SET status = 'countered', counter_amount = ?, seller_message = ?, version = version + 1
       WHERE id = ? AND version = ?
         AND status IN ('submitted', 'revised', 'shortlisted', 'contact_requested')`,
      [counterAmount, sellerMessage || null, id, expectedVersion],
    );
    return result.affectedRows === 1;
  }

  async updateOffer(id: number, input: ReviseOfferInput, expectedVersion: number): Promise<boolean> {
    const columns: string[] = [];
    const values: unknown[] = [];

    if (input.offeredAmount !== undefined) {
      columns.push("offered_amount = ?");
      values.push(input.offeredAmount);
    }
    if (input.buyerMessage !== undefined) {
      columns.push("buyer_message = ?");
      values.push(input.buyerMessage);
    }
    if (input.offerExpiry !== undefined) {
      columns.push("offer_expiry = ?");
      values.push(input.offerExpiry ? new Date(input.offerExpiry) : null);
    }
    // A buyer revision supersedes any previous seller counter terms.
    columns.push("counter_amount = NULL", "seller_message = NULL", "status = 'revised'", "version = version + 1");

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE offers SET ${columns.join(", ")}
       WHERE id = ? AND version = ?
         AND status IN ('submitted', 'revised', 'shortlisted', 'countered', 'contact_requested')`,
      [...values, id, expectedVersion] as (string | number | Date | null)[],
    );
    return result.affectedRows === 1;
  }

  async updateStatus(id: number, status: OfferStatus): Promise<void> {
    await pool.execute(
      "UPDATE offers SET status = ?, version = version + 1 WHERE id = ?",
      [status, id],
    );
  }

  async transitionStatus(id: number, status: OfferStatus, expectedVersion: number, allowedStatuses: string[]): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE offers SET status = ?, version = version + 1
       WHERE id = ? AND version = ? AND status IN (${allowedStatuses.map(() => "?").join(",")})`,
      [status, id, expectedVersion, ...allowedStatuses],
    );
    return result.affectedRows === 1;
  }
}

export const offerRepository = new OfferRepository();
