import { randomInt } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { pagination } from "../../shared/pagination.js";
import { formatBidderName } from "../../shared/bidder.js";
import { fromPaise, toPaise } from "../../shared/currency.js";
import type {
  AdminReviewInput,
  CreateAuctionInput,
  PublicAuctionQuery,
  UpdateAuctionInput,
} from "./auction.schemas.js";

export interface AuctionRecord {
  id: number;
  sellerId: number;
  slug: string;
  lotNumber: string;
  title: string;
  category: string;
  description: string;
  condition: "new" | "like-new" | "used" | "refurbished";
  location: string;
  imageUrl: string | null;
  imageUrls: string[];
  startingPrice: number;
  currentBid: number | null;
  minimumIncrement: number;
  bidCount: number;
  startsAt: Date;
  endsAt: Date;
  workflowStatus: "draft" | "pending" | "approved" | "rejected" | "closed" | "changes_requested";
  publicStatus: "upcoming" | "live" | "ending-soon" | "closed";
  reviewNotes: string | null;
  sellerName: string | null;
  isWatched: boolean;
  createdAt: Date;
}

type DatabaseValue = string | number | Date | null;

function publicStatusExpression(alias = "a"): string {
  return `CASE
    WHEN ${alias}.status = 'closed' OR ${alias}.ends_at <= UTC_TIMESTAMP() THEN 'closed'
    WHEN ${alias}.starts_at > UTC_TIMESTAMP() THEN 'upcoming'
    WHEN TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), ${alias}.ends_at) <= 180 THEN 'ending-soon'
    ELSE 'live'
  END`;
}

function auctionFromRow(row: RowDataPacket): AuctionRecord {
  return {
    id: Number(row.id),
    sellerId: Number(row.seller_id),
    slug: String(row.slug),
    lotNumber: String(row.lot_number),
    title: String(row.title),
    category: String(row.category),
    description: String(row.description),
    condition: row.item_condition as AuctionRecord["condition"],
    location: String(row.location),
    imageUrl: (() => {
      const raw = row.image_url == null ? null : String(row.image_url);
      if (!raw) return null;
      if (raw.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          return Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string" ? parsed[0] : raw;
        } catch {
          return raw;
        }
      }
      return raw;
    })(),
    imageUrls: (() => {
      const raw = row.image_url == null ? null : String(row.image_url);
      if (!raw) return [];
      if (raw.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            return parsed.filter((item): item is string => typeof item === "string");
          }
        } catch {
          // ignore parsing error
        }
      }
      return [raw];
    })(),
    startingPrice: Number(row.starting_price),
    currentBid: row.current_bid == null ? null : Number(row.current_bid),
    minimumIncrement: Number(row.minimum_increment),
    bidCount: Number(row.bid_count),
    startsAt: new Date(row.starts_at as string | Date),
    endsAt: new Date(row.ends_at as string | Date),
    workflowStatus: String(row.workflow_status ?? row.status) as AuctionRecord["workflowStatus"],
    publicStatus: String(row.public_status ?? "closed") as AuctionRecord["publicStatus"],
    reviewNotes: row.review_notes == null ? null : String(row.review_notes),
    sellerName: row.seller_name == null ? null : String(row.seller_name),
    isWatched: Boolean(row.is_watched),
    createdAt: new Date(row.created_at as string | Date),
  };
}

function conditionLabel(condition: AuctionRecord["condition"]): string {
  return {
    new: "New",
    "like-new": "Like New",
    used: "Used",
    refurbished: "Refurbished",
  }[condition];
}

export function publicAuction(record: AuctionRecord) {
  const minimumNextBid =
    record.currentBid == null
      ? record.startingPrice
      : fromPaise(toPaise(record.currentBid) + toPaise(record.minimumIncrement));
  return {
    id: record.id,
    slug: record.slug,
    lotNumber: record.lotNumber,
    title: record.title,
    category: record.category,
    description: record.description,
    condition: conditionLabel(record.condition),
    location: record.location,
    image: record.imageUrl || (record.imageUrls && record.imageUrls[0]) || "/hero-auction-marketplace.png",
    imageUrls: record.imageUrls && record.imageUrls.length > 0 ? record.imageUrls : [record.imageUrl || "/hero-auction-marketplace.png"],
    imagePosition: "center",
    startingPrice: record.startingPrice,
    currentBid: record.currentBid,
    minimumIncrement: record.minimumIncrement,
    minimumNextBid,
    bidCount: record.bidCount,
    bids: record.bidCount,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    status: record.publicStatus,
    isAdminReviewed: true,
    isWatched: record.isWatched,
    seller: record.sellerName ? { name: record.sellerName } : null,
  };
}

function createIdentifiers(title: string): { slug: string; lotNumber: string } {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130) || "auction-lot";
  const suffix = randomInt(100000, 1000000);
  return { slug: `${base}-${suffix}`, lotNumber: `BB-${suffix}` };
}

export class AuctionRepository {
  async listPublic(query: PublicAuctionQuery, userId?: number) {
    const pageData = pagination(query.page, query.pageSize, 50);
    const parameters: unknown[] = [userId ?? 0];
    const where = ["x.deleted_at IS NULL", "x.workflow_status IN ('approved', 'closed')"];

    if (query.q) {
      const cleanTerm = query.q.trim().replace(/^#/, "");
      const search = `%${cleanTerm}%`;
      const numId = Number(cleanTerm.replace(/^(bb|lot)-?/i, "")) || 0;
      where.push(
        "(x.title LIKE ? OR x.category LIKE ? OR x.location LIKE ? OR x.lot_number LIKE ? OR x.slug LIKE ? OR x.id = ?)",
      );
      parameters.push(search, search, search, search, search, numId);
    }
    if (query.status.length) {
      where.push(`x.public_status IN (${query.status.map(() => "?").join(", ")})`);
      parameters.push(...query.status);
    }
    if (query.category.length) {
      const categoryConditions: string[] = [];
      for (const cat of query.category) {
        categoryConditions.push("(x.category = ? OR x.category LIKE ?)");
        parameters.push(cat, `%${cat}%`);
      }
      where.push(`(${categoryConditions.join(" OR ")})`);
    }
    if (query.location) {
      where.push("x.location LIKE ?");
      parameters.push(`%${query.location}%`);
    }
    if (query.condition.length) {
      const normalized = query.condition.map((value) => value.toLowerCase().replaceAll(" ", "-"));
      where.push(`x.item_condition IN (${normalized.map(() => "?").join(", ")})`);
      parameters.push(...normalized);
    }
    if (query.minPrice !== undefined) {
      where.push("COALESCE(x.current_bid, x.starting_price) >= ?");
      parameters.push(query.minPrice);
    }
    if (query.maxPrice !== undefined) {
      where.push("COALESCE(x.current_bid, x.starting_price) <= ?");
      parameters.push(query.maxPrice);
    }
    if (query.featured) where.push("x.public_status IN ('live', 'ending-soon', 'upcoming')");

    const orderBy = {
      recommended: "x.starts_at ASC, x.id DESC",
      "ending-soon": "x.ends_at ASC",
      "newly-listed": "x.created_at DESC",
      "price-low": "COALESCE(x.current_bid, x.starting_price) ASC",
      "price-high": "COALESCE(x.current_bid, x.starting_price) DESC",
      "most-bids": "x.bid_count DESC, x.id DESC",
    }[query.sort];

    const baseQuery = `
      FROM (
        SELECT a.*, a.status AS workflow_status,
               ${publicStatusExpression("a")} AS public_status,
               EXISTS(
                 SELECT 1 FROM watchlists w WHERE w.auction_id = a.id AND w.user_id = ?
               ) AS is_watched,
               sp.seller_name
        FROM auctions a
        LEFT JOIN seller_profiles sp ON sp.account_id = a.seller_id
      ) x
      WHERE ${where.join(" AND ")}`;

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      parameters,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT x.* ${baseQuery} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...parameters, pageData.pageSize, pageData.offset],
    );
    return {
      items: rows.map(auctionFromRow).map(publicAuction),
      total,
      page: pageData.page,
      pageSize: pageData.pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageData.pageSize)),
    };
  }

  async findPublic(identifier: string, userId?: number): Promise<AuctionRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, a.status AS workflow_status,
              ${publicStatusExpression("a")} AS public_status,
              EXISTS(
                SELECT 1 FROM watchlists w WHERE w.auction_id = a.id AND w.user_id = ?
              ) AS is_watched,
              sp.seller_name
       FROM auctions a
       LEFT JOIN seller_profiles sp ON sp.account_id = a.seller_id
       WHERE (a.slug = ? OR a.lot_number = ? OR a.id = ?)
         AND a.status IN ('approved', 'closed')
         AND a.deleted_at IS NULL
       LIMIT 1`,
      [userId ?? 0, identifier, identifier, Number(identifier) || 0],
    );
    return rows[0] ? auctionFromRow(rows[0]) : null;
  }

  async findManyPublic(ids: number[], userId?: number): Promise<AuctionRecord[]> {
    if (ids.length === 0) return [];
    
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, a.status AS workflow_status,
              ${publicStatusExpression("a")} AS public_status,
              EXISTS(
                SELECT 1 FROM watchlists w WHERE w.auction_id = a.id AND w.user_id = ?
              ) AS is_watched,
              sp.seller_name
       FROM auctions a
       LEFT JOIN seller_profiles sp ON sp.account_id = a.seller_id
       WHERE a.id IN (${placeholders})
         AND a.status IN ('approved', 'closed')
         AND a.deleted_at IS NULL`,
      [userId ?? 0, ...ids],
    );
    return rows.map(auctionFromRow);
  }

  async bidHistory(auctionId: number, limit = 50) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.id, b.bidder_id, b.amount, b.created_at
       FROM bids b
       WHERE b.auction_id = ?
       ORDER BY b.amount DESC, b.id DESC
       LIMIT ?`,
      [auctionId, limit],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      bidder: formatBidderName(Number(row.bidder_id)),
      amount: Number(row.amount),
      createdAt: new Date(row.created_at as string | Date).toISOString(),
      verified: true,
    }));
  }

  async listSeller(sellerId: number): Promise<AuctionRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, a.status AS workflow_status,
              ${publicStatusExpression("a")} AS public_status,
              0 AS is_watched, sp.seller_name
       FROM auctions a
       LEFT JOIN seller_profiles sp ON sp.account_id = a.seller_id
       WHERE a.seller_id = ? AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC`,
      [sellerId],
    );
    return rows.map(auctionFromRow);
  }

  async findOwned(id: number, sellerId: number): Promise<AuctionRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, a.status AS workflow_status,
              ${publicStatusExpression("a")} AS public_status,
              0 AS is_watched, sp.seller_name
       FROM auctions a
       LEFT JOIN seller_profiles sp ON sp.account_id = a.seller_id
       WHERE a.id = ? AND a.seller_id = ? AND a.deleted_at IS NULL LIMIT 1`,
      [id, sellerId],
    );
    return rows[0] ? auctionFromRow(rows[0]) : null;
  }

  async findById(id: number): Promise<AuctionRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, a.status AS workflow_status,
              ${publicStatusExpression("a")} AS public_status,
              0 AS is_watched, sp.seller_name
       FROM auctions a
       LEFT JOIN seller_profiles sp ON sp.account_id = a.seller_id
       WHERE a.id = ? AND a.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return rows[0] ? auctionFromRow(rows[0]) : null;
  }

  async create(sellerId: number, input: CreateAuctionInput): Promise<number> {
    const identifiers = createIdentifiers(input.title);
    const finalImageString = input.imageUrls && input.imageUrls.length > 0
      ? JSON.stringify(input.imageUrls)
      : input.imageUrl || null;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO auctions
        (seller_id, slug, lot_number, title, category, description, item_condition,
         location, image_url, starting_price, minimum_increment, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sellerId,
        identifiers.slug,
        identifiers.lotNumber,
        input.title,
        input.category,
        input.description,
        input.condition,
        input.location,
        finalImageString,
        input.startingPrice,
        input.minimumIncrement,
        input.startsAt,
        input.endsAt,
      ],
    );
    return Number(result.insertId);
  }

  async update(id: number, input: UpdateAuctionInput, resetReview = false): Promise<void> {
    const columns: string[] = [];
    const values: DatabaseValue[] = [];
    const extendedInput = input as UpdateAuctionInput & { imageUrls?: string[] };
    const processedInput: Record<string, unknown> = { ...input };

    if (extendedInput.imageUrls !== undefined) {
      processedInput.imageUrl = JSON.stringify(extendedInput.imageUrls);
    }

    const mapping: Partial<Record<keyof UpdateAuctionInput, string>> = {
      title: "title",
      category: "category",
      description: "description",
      condition: "item_condition",
      location: "location",
      imageUrl: "image_url",
      startingPrice: "starting_price",
      minimumIncrement: "minimum_increment",
      startsAt: "starts_at",
      endsAt: "ends_at",
    };

    for (const [key, column] of Object.entries(mapping) as [keyof UpdateAuctionInput, string][]) {
      const val = processedInput[key];
      if (val !== undefined && key !== "imageUrls") {
        columns.push(`${column} = ?`);
        values.push((val as DatabaseValue) ?? null);
      }
    }
    if (resetReview) {
      columns.push("status = 'draft'", "review_notes = NULL", "reviewed_by = NULL", "reviewed_at = NULL");
    }
    if (!columns.length) return;
    columns.push("version = version + 1");
    await pool.execute(`UPDATE auctions SET ${columns.join(", ")} WHERE id = ?`, [...values, id]);
  }

  async submit(id: number): Promise<void> {
    await pool.execute(
      `UPDATE auctions SET status = 'pending', version = version + 1
       WHERE id = ?`,
      [id],
    );
  }

  async confirmChanges(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE auctions SET status = 'approved', review_notes = NULL, version = version + 1
       WHERE id = ? AND status = 'changes_requested'`,
      [id],
    );
    return result.affectedRows > 0;
  }

  async updateAdminWithStatus(id: number, input: UpdateAuctionInput, newStatus?: string, reviewNotes?: string): Promise<void> {
    const columns: string[] = [];
    const values: DatabaseValue[] = [];
    const extendedInput = input as UpdateAuctionInput & { imageUrls?: string[] };
    const processedInput: Record<string, unknown> = { ...input };

    if (extendedInput.imageUrls !== undefined) {
      processedInput.imageUrl = JSON.stringify(extendedInput.imageUrls);
    }

    const mapping: Partial<Record<keyof UpdateAuctionInput, string>> = {
      title: "title",
      category: "category",
      description: "description",
      condition: "item_condition",
      location: "location",
      imageUrl: "image_url",
      startingPrice: "starting_price",
      minimumIncrement: "minimum_increment",
      startsAt: "starts_at",
      endsAt: "ends_at",
    };

    for (const [key, column] of Object.entries(mapping) as [keyof UpdateAuctionInput, string][]) {
      const val = processedInput[key];
      if (val !== undefined && key !== "imageUrls") {
        columns.push(`${column} = ?`);
        values.push((val as DatabaseValue) ?? null);
      }
    }
    if (newStatus) {
      columns.push("status = ?");
      values.push(newStatus);
    }
    if (reviewNotes !== undefined) {
      columns.push("review_notes = ?");
      values.push(reviewNotes);
    }
    if (!columns.length) return;
    columns.push("version = version + 1");
    await pool.execute(`UPDATE auctions SET ${columns.join(", ")} WHERE id = ?`, [...values, id]);
  }

  async softDelete(id: number): Promise<void> {
    await pool.execute(
      "UPDATE auctions SET deleted_at = UTC_TIMESTAMP(), version = version + 1 WHERE id = ?",
      [id],
    );
  }

  async listAdmin(status?: string): Promise<AuctionRecord[]> {
    const values: DatabaseValue[] = [];
    const statusClause = status ? "AND a.status = ?" : "";
    if (status) values.push(status);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, a.status AS workflow_status,
              ${publicStatusExpression("a")} AS public_status,
              0 AS is_watched, sp.seller_name
       FROM auctions a
       LEFT JOIN seller_profiles sp ON sp.account_id = a.seller_id
       WHERE a.deleted_at IS NULL ${statusClause}
       ORDER BY FIELD(a.status, 'pending', 'rejected', 'draft', 'approved', 'closed'), a.created_at DESC`,
      values,
    );
    return rows.map(auctionFromRow);
  }

  async review(id: number, adminId: number, input: AdminReviewInput): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE auctions
       SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(),
           version = version + 1
       WHERE id = ? AND status = 'pending'`,
      [input.decision === "approve" ? "approved" : "rejected", input.notes || null, adminId, id],
    );
    return result.affectedRows > 0;
  }
}

export const auctionRepository = new AuctionRepository();
