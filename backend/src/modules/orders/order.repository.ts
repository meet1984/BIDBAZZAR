import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { createReference } from "../../shared/reference.js";
import type { ReviewDirection, ReviewRecord } from "../../types/database.types.js";
import type {
  BuyerCounterpartyDetails,
  CreateOrderParams,
  ListOrdersFilter,
  OrderDetails,
  OrderListingDetails,
  OrderRecord,
  OrderStatus,
  OrderSourceType,
  SellerCounterpartyDetails,
} from "./order.types.js";

function mapOrder(row: RowDataPacket): OrderRecord {
  return {
    id: Number(row.id),
    orderReference: String(row.order_reference),
    buyerId: Number(row.buyer_id),
    sellerId: Number(row.seller_id),
    listingId: Number(row.listing_id),
    sourceType: row.source_type as OrderSourceType,
    sourceOfferId: row.source_offer_id == null ? null : Number(row.source_offer_id),
    sourceAllocationId: row.source_allocation_id == null ? null : Number(row.source_allocation_id),
    sourceReference: String(row.source_reference),
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    currency: String(row.currency),
    orderStatus: row.order_status as OrderStatus,
    buyerCompletedAt: row.buyer_completed_at ? new Date(row.buyer_completed_at as string | Date) : null,
    sellerCompletedAt: row.seller_completed_at ? new Date(row.seller_completed_at as string | Date) : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class OrderRepository {
  async create(params: CreateOrderParams, connection?: PoolConnection): Promise<OrderRecord> {
    const executor = connection ?? pool;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO orders (
        order_reference, buyer_id, seller_id, listing_id, source_type,
        source_offer_id, source_allocation_id, source_reference, quantity,
        unit_price, total_amount, currency, order_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [
        createReference("ORD"), params.buyerId, params.sellerId, params.listingId,
        params.sourceType, params.sourceOfferId ?? null, params.sourceAllocationId ?? null,
        params.sourceReference, params.quantity, params.unitPrice, params.totalAmount, params.currency,
      ],
    );
    return (await this.findById(Number(result.insertId), connection))!;
  }

  async findById(id: number, connection?: PoolConnection): Promise<OrderRecord | null> {
    const [rows] = await (connection ?? pool).execute<RowDataPacket[]>("SELECT * FROM orders WHERE id = ?", [id]);
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async findByIdForUpdate(id: number, connection: PoolConnection): Promise<OrderRecord | null> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? FOR UPDATE", [id]);
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async findByReference(reference: string): Promise<OrderRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM orders WHERE order_reference = ?", [reference]);
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async findBySourceReference(reference: string, connection?: PoolConnection): Promise<OrderRecord | null> {
    const [rows] = await (connection ?? pool).execute<RowDataPacket[]>("SELECT * FROM orders WHERE source_reference = ?", [reference]);
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async updateStatus(id: number, status: OrderStatus, connection?: PoolConnection): Promise<void> {
    await (connection ?? pool).execute(
      "UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, id],
    );
  }

  async confirmPartyCompletion(id: number, party: "buyer" | "seller", connection: PoolConnection): Promise<OrderRecord> {
    const column = party === "buyer" ? "buyer_completed_at" : "seller_completed_at";
    await connection.execute(
      `UPDATE orders SET ${column} = COALESCE(${column}, UTC_TIMESTAMP()), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
    await connection.execute(
      `UPDATE orders SET order_status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND buyer_completed_at IS NOT NULL AND seller_completed_at IS NOT NULL`,
      [id],
    );
    return (await this.findById(id, connection))!;
  }

  private where(filter: ListOrdersFilter): { clause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    for (const [column, value] of [
      ["buyer_id", filter.buyerId], ["seller_id", filter.sellerId], ["listing_id", filter.listingId],
      ["order_status", filter.orderStatus], ["source_type", filter.sourceType],
    ] as const) {
      if (value !== undefined) { conditions.push(`${column} = ?`); params.push(value); }
    }
    return { clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
  }

  async list(filter: ListOrdersFilter = {}): Promise<OrderDetails[]> {
    const { clause, params } = this.where(filter);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM orders ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return Promise.all(rows.map((row) => this.enrich(mapOrder(row))));
  }

  async count(filter: ListOrdersFilter = {}): Promise<number> {
    const { clause, params } = this.where(filter);
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM orders ${clause}`, params);
    return Number(rows[0]?.total ?? 0);
  }

  private async counterpartyDetails(buyerId: number, sellerId: number): Promise<{
    buyerDetails: BuyerCounterpartyDetails | null;
    sellerDetails: SellerCounterpartyDetails | null;
  }> {
    const [buyers] = await pool.execute<RowDataPacket[]>(
      `SELECT a.full_name, a.email, a.phone, bp.legal_full_name, bp.verified_email,
              bp.verified_phone, bp.buyer_type, bp.business_name
       FROM accounts a LEFT JOIN buyer_profiles bp ON bp.account_id = a.id WHERE a.id = ? LIMIT 1`,
      [buyerId],
    );
    const [sellers] = await pool.execute<RowDataPacket[]>(
      `SELECT a.full_name, a.email, a.phone, sp.legal_name, sp.business_name, sp.seller_name,
              sp.seller_type, sp.verified_email, sp.verified_phone
       FROM accounts a LEFT JOIN seller_profiles sp ON sp.account_id = a.id WHERE a.id = ? LIMIT 1`,
      [sellerId],
    );
    const b = buyers[0];
    const s = sellers[0];
    return {
      buyerDetails: b ? {
        name: String(b.legal_full_name || b.full_name || "Buyer"),
        email: b.verified_email ? String(b.verified_email) : String(b.email || "") || null,
        phone: b.verified_phone ? String(b.verified_phone) : String(b.phone || "") || null,
        buyerType: String(b.buyer_type || "individual"),
        businessName: b.business_name ? String(b.business_name) : null,
      } : null,
      sellerDetails: s ? {
        legalName: String(s.legal_name || s.full_name || "Seller"),
        businessName: String(s.business_name || s.seller_name || s.full_name || "Seller"),
        sellerType: String(s.seller_type || "individual"),
        email: s.verified_email ? String(s.verified_email) : String(s.email || "") || null,
        phone: s.verified_phone ? String(s.verified_phone) : String(s.phone || "") || null,
      } : null,
    };
  }

  private async listingDetails(listingId: number): Promise<OrderListingDetails | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT l.id, l.title, l.sale_mode, l.condition, l.location, l.public_slug, l.listing_reference,
              (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS primary_image_url
       FROM listings l WHERE l.id = ? LIMIT 1`,
      [listingId],
    );
    const l = rows[0];
    return l ? {
      id: Number(l.id), title: String(l.title), saleMode: String(l.sale_mode), condition: String(l.condition),
      location: String(l.location), publicSlug: l.public_slug ? String(l.public_slug) : null,
      listingReference: l.listing_reference ? String(l.listing_reference) : null,
      primaryImageUrl: l.primary_image_url ? String(l.primary_image_url) : null,
    } : null;
  }

  private async enrich(order: OrderRecord): Promise<OrderDetails> {
    const [counterparties, listingDetails, reviewRows] = await Promise.all([
      this.counterpartyDetails(order.buyerId, order.sellerId),
      this.listingDetails(order.listingId),
      pool.execute<RowDataPacket[]>("SELECT * FROM reviews WHERE order_id = ? AND is_published = 1", [order.id]),
    ]);
    let buyerReview: ReviewRecord | null = null;
    let sellerReview: ReviewRecord | null = null;
    for (const row of reviewRows[0]) {
      const review: ReviewRecord = {
        id: Number(row.id), orderId: Number(row.order_id), reviewerId: Number(row.reviewer_id),
        revieweeId: Number(row.reviewee_id), direction: row.direction as ReviewDirection,
        ratingScore: Number(row.rating_score),
        categoryRatings: (typeof row.category_ratings === "string" ? JSON.parse(row.category_ratings) : row.category_ratings) as Record<string, number>,
        comment: String(row.comment), isPublished: Boolean(row.is_published),
        hiddenReason: row.hidden_reason ? String(row.hidden_reason) : null,
        hiddenByAccountId: row.hidden_by_account_id ? Number(row.hidden_by_account_id) : null,
        hiddenAt: row.hidden_at ? new Date(row.hidden_at as string | Date) : null,
        createdAt: new Date(row.created_at as string | Date), updatedAt: new Date(row.updated_at as string | Date),
      };
      if (review.direction === "buyer_to_seller") buyerReview = review; else sellerReview = review;
    }
    return { ...order, ...counterparties, listingDetails, buyerReview, sellerReview };
  }

  async getDetails(id: number): Promise<OrderDetails | null> {
    const order = await this.findById(id);
    return order ? this.enrich(order) : null;
  }
}

export const orderRepository = new OrderRepository();
