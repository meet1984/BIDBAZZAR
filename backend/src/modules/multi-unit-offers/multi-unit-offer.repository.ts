import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { MultiUnitOfferRecord, MultiUnitOfferStatus } from "../../types/database.types.js";
import type { ReviseMultiUnitOfferInput, SubmitMultiUnitOfferInput } from "./multi-unit-offer.schemas.js";

export interface BuyerMultiUnitOfferDetail extends MultiUnitOfferRecord {
  listingTitle: string;
  listingSlug: string;
  unitName: string;
  askingPricePerUnit: number;
}

export interface SellerMultiUnitOfferListingItem extends MultiUnitOfferRecord {
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
}

function offerFromRow(row: RowDataPacket): MultiUnitOfferRecord {
  return {
    id: Number(row.id),
    listingId: Number(row.listing_id),
    buyerId: Number(row.buyer_id),
    quantityRequested: Number(row.quantity_requested),
    offeredPricePerUnit: Number(row.offered_price_per_unit),
    totalOfferValue: Number(row.total_offer_value),
    buyerMessage: row.buyer_message == null ? null : String(row.buyer_message),
    offerExpiry: row.offer_expiry == null ? null : new Date(row.offer_expiry as string | Date),
    counterQuantity: row.counter_quantity == null ? null : Number(row.counter_quantity),
    counterUnitPrice: row.counter_unit_price == null ? null : Number(row.counter_unit_price),
    sellerMessage: row.seller_message == null ? null : String(row.seller_message),
    status: row.status as MultiUnitOfferStatus,
    version: Number(row.version),
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class MultiUnitOfferRepository {
  async create(buyerId: number, listingId: number, input: SubmitMultiUnitOfferInput): Promise<number> {
    // SERVER-SIDE VALUE CALCULATION (SECURITY MANDATE)
    const totalOfferValue = Number((input.quantityRequested * input.offeredPricePerUnit).toFixed(2));
    const expiry = input.offerExpiry ? new Date(input.offerExpiry) : null;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO multi_unit_offers
        (listing_id, buyer_id, quantity_requested, offered_price_per_unit, total_offer_value,
         buyer_message, offer_expiry, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        listingId,
        buyerId,
        input.quantityRequested,
        input.offeredPricePerUnit,
        totalOfferValue,
        input.buyerMessage ?? null,
        expiry,
      ],
    );
    return Number(result.insertId);
  }

  async findById(id: number): Promise<MultiUnitOfferRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM multi_unit_offers WHERE id = ? LIMIT 1",
      [id],
    );
    if (!rows[0]) return null;
    return offerFromRow(rows[0]);
  }

  async findActiveByListingAndBuyer(listingId: number, buyerId: number): Promise<MultiUnitOfferRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM multi_unit_offers
       WHERE listing_id = ? AND buyer_id = ?
         AND status IN ('submitted', 'revised', 'shortlisted', 'countered', 'allocation_proposed', 'allocation_reserved')
       LIMIT 1`,
      [listingId, buyerId],
    );
    if (!rows[0]) return null;
    return offerFromRow(rows[0]);
  }

  async listByBuyer(buyerId: number): Promise<BuyerMultiUnitOfferDetail[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.*,
              l.title AS listing_title,
              l.public_slug AS listing_slug,
              COALESCE(l.unit_name, 'unit') AS unit_name,
              l.asking_price_per_unit
       FROM multi_unit_offers o
       JOIN listings l ON l.id = o.listing_id
       WHERE o.buyer_id = ?
       ORDER BY o.created_at DESC`,
      [buyerId],
    );

    return rows.map((row) => ({
      ...offerFromRow(row),
      listingTitle: String(row.listing_title),
      listingSlug: String(row.listing_slug),
      unitName: String(row.unit_name),
      askingPricePerUnit: Number(row.asking_price_per_unit || 0),
    }));
  }

  async listByListing(listingId: number): Promise<SellerMultiUnitOfferListingItem[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.*,
              bp.legal_full_name,
              bp.business_name,
              bp.profile_image,
              bp.verification_status,
              a.full_name AS account_full_name,
              COALESCE(rr.completed_transactions_count, 0) AS completed_transactions_count,
              COALESCE(rr.average_rating, 0) AS average_rating
       FROM multi_unit_offers o
       LEFT JOIN accounts a ON a.id = o.buyer_id
       LEFT JOIN buyer_profiles bp ON bp.account_id = o.buyer_id
       LEFT JOIN (
         SELECT reviewee_id, COUNT(*) AS completed_transactions_count, AVG(rating_score) AS average_rating
         FROM reviews WHERE direction = 'seller_to_buyer' AND is_published = TRUE
         GROUP BY reviewee_id
       ) rr ON rr.reviewee_id = o.buyer_id
       WHERE o.listing_id = ?
       ORDER BY o.offered_price_per_unit DESC, o.created_at ASC`,
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
      };
    });
  }

  async updateOffer(id: number, currentOffer: MultiUnitOfferRecord, input: ReviseMultiUnitOfferInput): Promise<boolean> {
    const newQty = input.quantityRequested ?? currentOffer.quantityRequested;
    const newPrice = input.offeredPricePerUnit ?? currentOffer.offeredPricePerUnit;
    const totalOfferValue = Number((newQty * newPrice).toFixed(2));
    const expiry = input.offerExpiry !== undefined ? (input.offerExpiry ? new Date(input.offerExpiry) : null) : currentOffer.offerExpiry;

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE multi_unit_offers
       SET quantity_requested = ?,
           offered_price_per_unit = ?,
           total_offer_value = ?,
           buyer_message = ?,
           offer_expiry = ?,
           counter_quantity = NULL,
           counter_unit_price = NULL,
           seller_message = NULL,
           status = 'revised',
           version = version + 1
       WHERE id = ? AND version = ?
         AND status IN ('submitted', 'revised', 'shortlisted', 'countered')`,
      [
        newQty,
        newPrice,
        totalOfferValue,
        input.buyerMessage !== undefined ? input.buyerMessage : currentOffer.buyerMessage,
        expiry,
        id,
        currentOffer.version,
      ],
    );
    return result.affectedRows === 1;
  }

  async updateStatus(id: number, status: MultiUnitOfferStatus): Promise<void> {
    await pool.execute(
      "UPDATE multi_unit_offers SET status = ?, version = version + 1 WHERE id = ?",
      [status, id],
    );
  }

  async transitionStatus(id: number, status: MultiUnitOfferStatus, expectedVersion: number, allowedStatuses: string[]): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE multi_unit_offers SET status = ?, version = version + 1
       WHERE id = ? AND version = ? AND status IN (${allowedStatuses.map(() => "?").join(",")})`,
      [status, id, expectedVersion, ...allowedStatuses],
    );
    return result.affectedRows === 1;
  }

  async updateCounter(
    id: number,
    expectedVersion: number,
    counterQuantity: number,
    counterUnitPrice: number,
    sellerMessage?: string,
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE multi_unit_offers
       SET status = 'countered', counter_quantity = ?, counter_unit_price = ?,
           seller_message = ?, version = version + 1
       WHERE id = ? AND version = ?
         AND status IN ('submitted', 'revised', 'shortlisted')`,
      [counterQuantity, counterUnitPrice, sellerMessage || null, id, expectedVersion],
    );
    return result.affectedRows === 1;
  }
}

export const multiUnitOfferRepository = new MultiUnitOfferRepository();
