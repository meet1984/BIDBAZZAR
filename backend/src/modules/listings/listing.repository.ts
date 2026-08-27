import { randomInt } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { pagination } from "../../shared/pagination.js";
import type { ListingRecord, SaleMode, ItemCondition, ListingReviewStatus, ListingImageRecord } from "../../types/database.types.js";
import type { CreateListingInput, PublicListingQuery, UpdateListingInput } from "./listing.schemas.js";

export interface FullListingRecord extends ListingRecord {
  categoryName: string;
  categorySlug: string;
  subcategoryName: string | null;
  subcategorySlug: string | null;
  sellerName: string | null;
  sellerRating: number;
  sellerReviewCount: number;
  publicDisplayStatus: "upcoming" | "live" | "ending-soon" | "closed";
  isWatched: boolean;
  primaryImageUrl?: string | null;
  images?: ListingImageRecord[];
  allocatedQuantity?: number;
  remainingInventory?: number | null;
}

type DatabaseValue = string | number | Date | boolean | null;

function publicStatusExpression(alias = "l"): string {
  return `CASE
    WHEN ${alias}.review_status IN ('sold', 'partially_sold', 'unsold', 'completed', 'cancelled', 'expired') OR ${alias}.end_time <= UTC_TIMESTAMP() THEN 'closed'
    WHEN ${alias}.review_status IN ('approved', 'scheduled', 'open') AND ${alias}.start_time > UTC_TIMESTAMP() THEN 'upcoming'
    WHEN ${alias}.review_status IN ('approved', 'scheduled', 'open') AND TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), ${alias}.end_time) <= 180 THEN 'ending-soon'
    WHEN ${alias}.review_status IN ('approved', 'scheduled', 'open') THEN 'live'
    ELSE 'closed'
  END`;
}

function listingFromRow(row: RowDataPacket): FullListingRecord {
  const totalQty = row.total_quantity == null ? null : Number(row.total_quantity);
  const totalAllocated = row.total_allocated == null ? 0 : Number(row.total_allocated);
  const remainingInventory = totalQty == null ? null : Math.max(0, totalQty - totalAllocated);

  return {
    id: Number(row.id),
    sellerId: Number(row.seller_id),
    categoryId: Number(row.category_id),
    subcategoryId: row.subcategory_id == null ? null : Number(row.subcategory_id),
    saleMode: row.sale_mode as SaleMode,
    title: String(row.title),
    description: String(row.description),
    condition: row.condition as ItemCondition,
    location: String(row.location),
    askingPrice: Number(row.asking_price),
    currency: String(row.currency ?? "INR"),
    startTime: new Date(row.start_time as string | Date),
    endTime: new Date(row.end_time as string | Date),
    offerSelectionDeadline: row.offer_selection_deadline == null ? null : new Date(row.offer_selection_deadline as string | Date),
    publicSlug: String(row.public_slug),
    listingReference: String(row.listing_reference),
    reviewStatus: row.review_status as ListingReviewStatus,
    reviewNotes: row.review_notes == null ? null : String(row.review_notes),
    version: Number(row.version),

    totalQuantity: totalQty,
    allocatedQuantity: totalAllocated,
    remainingInventory,
    unitName: row.unit_name == null ? null : String(row.unit_name),
    askingPricePerUnit: row.asking_price_per_unit == null ? null : Number(row.asking_price_per_unit),
    minOrderQuantity: row.min_order_quantity == null ? null : Number(row.min_order_quantity),
    maxOrderQuantity: row.max_order_quantity == null ? null : Number(row.max_order_quantity),
    quantityIncrement: row.quantity_increment == null ? null : Number(row.quantity_increment),
    allowPartialAllocation: Boolean(row.allow_partial_allocation),
    minAcceptableUnitPrice: row.min_acceptable_unit_price == null ? null : Number(row.min_acceptable_unit_price),
    offerStartTime: row.offer_start_time == null ? null : new Date(row.offer_start_time as string | Date),
    offerEndTime: row.offer_end_time == null ? null : new Date(row.offer_end_time as string | Date),
    buyerConfirmationDeadlineHours: row.buyer_confirmation_deadline_hours == null ? 48 : Number(row.buyer_confirmation_deadline_hours),

    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
    deletedAt: row.deleted_at == null ? null : new Date(row.deleted_at as string | Date),

    categoryName: String(row.category_name ?? ""),
    categorySlug: String(row.category_slug ?? ""),
    subcategoryName: row.subcategory_name == null ? null : String(row.subcategory_name),
    subcategorySlug: row.subcategory_slug == null ? null : String(row.subcategory_slug),
    sellerName: row.seller_name == null ? null : String(row.seller_name),
    sellerRating: row.seller_rating == null ? 0 : Number(row.seller_rating),
    sellerReviewCount: row.seller_review_count == null ? 0 : Number(row.seller_review_count),
    publicDisplayStatus: String(row.public_display_status ?? "closed") as FullListingRecord["publicDisplayStatus"],
    isWatched: Boolean(row.is_watched),
    primaryImageUrl: row.primary_image_url ? String(row.primary_image_url) : null,
    images: [],
  };
}

function createIdentifiers(title: string): { slug: string; reference: string } {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130) || "listing";
  const suffix = randomInt(100000, 1000000);
  return { slug: `${base}-${suffix}`, reference: `LOT-${suffix}` };
}

export class ListingRepository {
  async listPublic(query: PublicListingQuery, userId?: number) {
    const pageData = pagination(query.page, query.pageSize, 50);
    const parameters: unknown[] = [userId ?? 0];
    const where = [
      "x.deleted_at IS NULL",
      "x.review_status IN ('approved', 'scheduled', 'open', 'completed', 'sold', 'partially_sold', 'unsold')",
    ];

    if (query.q) {
      const cleanTerm = query.q.trim().replace(/^#/, "");
      const search = `%${cleanTerm}%`;
      const numId = Number(cleanTerm.replace(/^(lot|bb)-?/i, "")) || 0;
      where.push(
        "(x.title LIKE ? OR x.category_name LIKE ? OR x.location LIKE ? OR x.listing_reference LIKE ? OR x.public_slug LIKE ? OR x.id = ?)",
      );
      parameters.push(search, search, search, search, search, numId);
    }

    if (query.saleMode) {
      where.push("x.sale_mode = ?");
      parameters.push(query.saleMode);
    }

    if (query.category.length) {
      const categoryConditions: string[] = [];
      for (const cat of query.category) {
        const numId = Number(cat) || 0;
        categoryConditions.push("(x.category_name = ? OR x.category_slug = ? OR x.category_id = ?)");
        parameters.push(cat, cat, numId);
      }
      where.push(`(${categoryConditions.join(" OR ")})`);
    }

    if (query.subcategory.length) {
      const subConditions: string[] = [];
      for (const sub of query.subcategory) {
        const numId = Number(sub) || 0;
        subConditions.push("(x.subcategory_name = ? OR x.subcategory_slug = ? OR x.subcategory_id = ?)");
        parameters.push(sub, sub, numId);
      }
      where.push(`(${subConditions.join(" OR ")})`);
    }

    if (query.location) {
      where.push("x.location LIKE ?");
      parameters.push(`%${query.location}%`);
    }

    if (query.condition.length) {
      const normalized = query.condition.map((v) => v.toLowerCase().replaceAll(" ", "-"));
      where.push("x.condition IN (" + normalized.map(() => "?").join(", ") + ")");
      parameters.push(...normalized);
    }

    if (query.minPrice !== undefined) {
      where.push("x.asking_price >= ?");
      parameters.push(query.minPrice);
    }

    if (query.maxPrice !== undefined) {
      where.push("x.asking_price <= ?");
      parameters.push(query.maxPrice);
    }

    if (query.status && query.status !== "all") {
      if (query.status === "active") {
        where.push("x.public_display_status IN ('live', 'ending-soon', 'upcoming')");
      } else if (query.status === "upcoming" || query.status === "opening-soon") {
        where.push("x.public_display_status = 'upcoming'");
      } else {
        where.push("x.public_display_status = ?");
        parameters.push(query.status);
      }
    }

    const orderBy = {
      recommended: "x.start_time ASC, x.id DESC",
      "starting-soon": "x.start_time ASC, x.id DESC",
      "ending-soon": "x.end_time ASC",
      "newly-listed": "x.created_at DESC",
      "price-low": "x.asking_price ASC",
      "price-high": "x.asking_price DESC",
    }[query.sort];

    const baseQuery = `
      FROM (
        SELECT l.*,
               c.name AS category_name, c.slug AS category_slug,
               sc.name AS subcategory_name, sc.slug AS subcategory_slug,
               sp.business_name AS seller_name,
               (
                 SELECT COALESCE(ROUND(AVG(r.rating_score), 1), 0)
                 FROM reviews r
                 WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
               ) AS seller_rating,
               (
                 SELECT COUNT(*)
                 FROM reviews r
                 WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
               ) AS seller_review_count,
               (SELECT li.image_url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC LIMIT 1) AS primary_image_url,
               ${publicStatusExpression("l")} AS public_display_status,
               EXISTS(
                 SELECT 1 FROM listing_watchlists w WHERE w.listing_id = l.id AND w.account_id = ?
               ) AS is_watched,
               (
                 SELECT COALESCE(SUM(a.allocated_quantity), 0)
                 FROM multi_unit_allocations a
                 WHERE a.listing_id = l.id
                   AND a.status IN ('reserved', 'confirmed')
                   AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
               ) AS total_allocated
        FROM listings l
        LEFT JOIN categories c ON c.id = l.category_id
        LEFT JOIN subcategories sc ON sc.id = l.subcategory_id
        LEFT JOIN seller_profiles sp ON sp.account_id = l.seller_id
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

    const items = await this.attachImagesToListings(rows.map(listingFromRow));

    return {
      items,
      total,
      page: pageData.page,
      pageSize: pageData.pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageData.pageSize)),
    };
  }

  async attachImagesToListings(records: FullListingRecord[]): Promise<FullListingRecord[]> {
    if (!records.length) return records;
    const listingIds = records.map((r) => r.id);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM listing_images WHERE listing_id IN (?) ORDER BY is_primary DESC, display_order ASC, id ASC`,
      [listingIds],
    );
    const map = new Map<number, ListingImageRecord[]>();
    for (const row of rows) {
      const img: ListingImageRecord = {
        id: Number(row.id),
        listingId: Number(row.listing_id),
        imageUrl: String(row.image_url),
        displayOrder: Number(row.display_order),
        isPrimary: Boolean(row.is_primary),
        createdAt: new Date(row.created_at as string | Date),
        updatedAt: new Date(row.updated_at as string | Date),
      };
      if (!map.has(img.listingId)) map.set(img.listingId, []);
      map.get(img.listingId)!.push(img);
    }
    for (const record of records) {
      record.images = map.get(record.id) || [];
      if (!record.primaryImageUrl && record.images.length > 0) {
        record.primaryImageUrl = record.images.find((i) => i.isPrimary)?.imageUrl || record.images[0]?.imageUrl || null;
      }
    }
    return records;
  }

  async findPublic(identifier: string, userId?: number): Promise<FullListingRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*,
              c.name AS category_name, c.slug AS category_slug,
              sc.name AS subcategory_name, sc.slug AS subcategory_slug,
              sp.business_name AS seller_name,
              (
                SELECT COALESCE(ROUND(AVG(r.rating_score), 1), 0)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_rating,
              (
                SELECT COUNT(*)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_review_count,
              (SELECT li.image_url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC LIMIT 1) AS primary_image_url,
              ${publicStatusExpression("l")} AS public_display_status,
              EXISTS(
                SELECT 1 FROM listing_watchlists w WHERE w.listing_id = l.id AND w.account_id = ?
              ) AS is_watched,
              (
                SELECT COALESCE(SUM(a.allocated_quantity), 0)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status IN ('reserved', 'confirmed')
                  AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
              ) AS total_allocated
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN subcategories sc ON sc.id = l.subcategory_id
       LEFT JOIN seller_profiles sp ON sp.account_id = l.seller_id
       WHERE (l.public_slug = ? OR l.listing_reference = ? OR l.id = ?)
         AND l.review_status IN ('approved', 'scheduled', 'open', 'completed', 'sold', 'partially_sold', 'unsold')
         AND l.deleted_at IS NULL
       LIMIT 1`,
      [userId ?? 0, identifier, identifier, Number(identifier) || 0],
    );
    if (!rows[0]) return null;
    const items = await this.attachImagesToListings([listingFromRow(rows[0])]);
    return items[0] || null;
  }

  async findPublicByIds(ids: number[], userId: number): Promise<FullListingRecord[]> {
    if (ids.length === 0) return [];
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.*, c.name AS category_name, c.slug AS category_slug,
              sc.name AS subcategory_name, sc.slug AS subcategory_slug,
              sp.business_name AS seller_name,
              (
                SELECT COALESCE(ROUND(AVG(r.rating_score), 1), 0)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_rating,
              (
                SELECT COUNT(*)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_review_count,
              (SELECT li.image_url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC LIMIT 1) AS primary_image_url,
              ${publicStatusExpression("l")} AS public_display_status,
              EXISTS(SELECT 1 FROM listing_watchlists w WHERE w.listing_id = l.id AND w.account_id = ?) AS is_watched,
              (
                SELECT COALESCE(SUM(a.allocated_quantity), 0)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status IN ('reserved', 'confirmed')
                  AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
              ) AS total_allocated
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN subcategories sc ON sc.id = l.subcategory_id
       LEFT JOIN seller_profiles sp ON sp.account_id = l.seller_id
       WHERE l.id IN (?)
         AND l.review_status IN ('approved', 'scheduled', 'open', 'completed', 'sold', 'partially_sold', 'unsold')
         AND l.deleted_at IS NULL`,
      [userId, ids],
    );
    const byId = new Map(rows.map((row) => [Number(row.id), listingFromRow(row)]));
    const ordered = ids.map((id) => byId.get(id)).filter((record): record is FullListingRecord => Boolean(record));
    return this.attachImagesToListings(ordered);
  }

  async listSeller(sellerId: number): Promise<FullListingRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*,
              c.name AS category_name, c.slug AS category_slug,
              sc.name AS subcategory_name, sc.slug AS subcategory_slug,
              sp.business_name AS seller_name,
              (
                SELECT COALESCE(ROUND(AVG(r.rating_score), 1), 0)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_rating,
              (
                SELECT COUNT(*)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_review_count,
              (SELECT li.image_url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC LIMIT 1) AS primary_image_url,
              ${publicStatusExpression("l")} AS public_display_status,
              0 AS is_watched,
              (
                SELECT COALESCE(SUM(a.allocated_quantity), 0)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status IN ('reserved', 'confirmed')
                  AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
              ) AS total_allocated
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN subcategories sc ON sc.id = l.subcategory_id
       LEFT JOIN seller_profiles sp ON sp.account_id = l.seller_id
       WHERE l.seller_id = ? AND l.deleted_at IS NULL
       ORDER BY l.created_at DESC`,
      [sellerId],
    );
    return this.attachImagesToListings(rows.map(listingFromRow));
  }

  async findOwned(id: number, sellerId: number): Promise<FullListingRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*,
              c.name AS category_name, c.slug AS category_slug,
              sc.name AS subcategory_name, sc.slug AS subcategory_slug,
              sp.business_name AS seller_name,
              (
                SELECT COALESCE(ROUND(AVG(r.rating_score), 1), 0)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_rating,
              (
                SELECT COUNT(*)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_review_count,
              (SELECT li.image_url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC LIMIT 1) AS primary_image_url,
              ${publicStatusExpression("l")} AS public_display_status,
              0 AS is_watched,
              (
                SELECT COALESCE(SUM(a.allocated_quantity), 0)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status IN ('reserved', 'confirmed')
                  AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
              ) AS total_allocated
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN subcategories sc ON sc.id = l.subcategory_id
       LEFT JOIN seller_profiles sp ON sp.account_id = l.seller_id
       WHERE l.id = ? AND l.seller_id = ? AND l.deleted_at IS NULL LIMIT 1`,
      [id, sellerId],
    );
    if (!rows[0]) return null;
    const items = await this.attachImagesToListings([listingFromRow(rows[0])]);
    return items[0] || null;
  }

  async findById(id: number): Promise<FullListingRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*,
              c.name AS category_name, c.slug AS category_slug,
              sc.name AS subcategory_name, sc.slug AS subcategory_slug,
              sp.business_name AS seller_name,
              (
                SELECT COALESCE(ROUND(AVG(r.rating_score), 1), 0)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_rating,
              (
                SELECT COUNT(*)
                FROM reviews r
                WHERE r.reviewee_id = l.seller_id AND r.is_published = 1 AND r.direction = 'buyer_to_seller'
              ) AS seller_review_count,
              (SELECT li.image_url FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC LIMIT 1) AS primary_image_url,
              ${publicStatusExpression("l")} AS public_display_status,
              0 AS is_watched,
              (
                SELECT COALESCE(SUM(a.allocated_quantity), 0)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status IN ('reserved', 'confirmed')
                  AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
              ) AS total_allocated
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN subcategories sc ON sc.id = l.subcategory_id
       LEFT JOIN seller_profiles sp ON sp.account_id = l.seller_id
       WHERE l.id = ? AND l.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    const items = await this.attachImagesToListings([listingFromRow(rows[0])]);
    return items[0] || null;
  }

  async create(sellerId: number, input: CreateListingInput): Promise<number> {
    const identifiers = createIdentifiers(input.title);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO listings
        (seller_id, category_id, subcategory_id, sale_mode, title, description, \`condition\`,
         location, asking_price, currency, start_time, end_time, offer_selection_deadline,
         public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity,
         quantity_increment, allow_partial_allocation, min_acceptable_unit_price, offer_start_time,
         offer_end_time, buyer_confirmation_deadline_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sellerId,
        input.categoryId,
        input.subcategoryId ?? null,
        input.saleMode,
        input.title,
        input.description,
        input.condition,
        input.location,
        input.askingPrice,
        input.currency ?? "INR",
        input.startTime,
        input.endTime,
        input.offerSelectionDeadline ?? null,
        identifiers.slug,
        identifiers.reference,
        input.totalQuantity ?? null,
        input.unitName ?? null,
        input.askingPricePerUnit ?? null,
        input.minOrderQuantity ?? null,
        input.maxOrderQuantity ?? null,
        input.quantityIncrement ?? 1,
        input.allowPartialAllocation ?? true,
        input.minAcceptableUnitPrice ?? null,
        input.offerStartTime ?? null,
        input.offerEndTime ?? null,
        input.buyerConfirmationDeadlineHours ?? 48,
      ],
    );
    return Number(result.insertId);
  }

  async update(id: number, input: UpdateListingInput, resetStatusToDraft = false): Promise<void> {
    const columns: string[] = [];
    const values: DatabaseValue[] = [];

    const fieldMap: Partial<Record<keyof UpdateListingInput, string>> = {
      categoryId: "category_id",
      subcategoryId: "subcategory_id",
      saleMode: "sale_mode",
      title: "title",
      description: "description",
      condition: "condition",
      location: "location",
      askingPrice: "asking_price",
      currency: "currency",
      startTime: "start_time",
      endTime: "end_time",
      offerSelectionDeadline: "offer_selection_deadline",
      totalQuantity: "total_quantity",
      unitName: "unit_name",
      askingPricePerUnit: "asking_price_per_unit",
      minOrderQuantity: "min_order_quantity",
      maxOrderQuantity: "max_order_quantity",
      quantityIncrement: "quantity_increment",
      allowPartialAllocation: "allow_partial_allocation",
      minAcceptableUnitPrice: "min_acceptable_unit_price",
      offerStartTime: "offer_start_time",
      offerEndTime: "offer_end_time",
      buyerConfirmationDeadlineHours: "buyer_confirmation_deadline_hours",
    };


    for (const [key, column] of Object.entries(fieldMap) as [keyof UpdateListingInput, string][]) {
      const val = input[key];
      if (val !== undefined) {
        columns.push(`\`${column}\` = ?`);
        values.push(val ?? null);
      }
    }

    if (resetStatusToDraft) {
      columns.push("review_status = 'draft'", "review_notes = NULL");
    }

    if (!columns.length) return;
    columns.push("version = version + 1");
    await pool.execute(`UPDATE listings SET ${columns.join(", ")} WHERE id = ?`, [...values, id]);
  }

  async publishDirect(id: number): Promise<void> {
    await pool.execute(
      `UPDATE listings SET review_status = 'submitted', review_notes = NULL, version = version + 1
       WHERE id = ? AND review_status IN ('draft', 'changes_requested', 'rejected')`,
      [id],
    );
  }

  async publishApproved(id: number): Promise<void> {
    await pool.execute(
      `UPDATE listings SET review_status = 'approved', review_notes = 'Auto-approved for verified seller', version = version + 1
       WHERE id = ? AND review_status IN ('draft', 'changes_requested', 'rejected', 'submitted')`,
      [id],
    );
  }

  async confirmChanges(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE listings SET review_status = 'submitted', review_notes = NULL, version = version + 1
       WHERE id = ? AND review_status = 'changes_requested'`,
      [id],
    );
    return result.affectedRows > 0;
  }

  async confirmApproved(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE listings SET review_status = 'approved', review_notes = 'Auto-approved for verified seller', version = version + 1
       WHERE id = ? AND review_status = 'changes_requested'`,
      [id],
    );
    return result.affectedRows > 0;
  }

  async listAdmin(reviewStatus?: string, saleMode?: string): Promise<FullListingRecord[]> {
    const conditions: string[] = ["l.deleted_at IS NULL"];
    const values: DatabaseValue[] = [];

    if (reviewStatus) {
      conditions.push("l.review_status = ?");
      values.push(reviewStatus);
    }
    if (saleMode) {
      conditions.push("l.sale_mode = ?");
      values.push(saleMode);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*,
              c.name AS category_name, c.slug AS category_slug,
              sc.name AS subcategory_name, sc.slug AS subcategory_slug,
              sp.business_name AS seller_name,
              ${publicStatusExpression("l")} AS public_display_status,
              0 AS is_watched,
              (
                SELECT COALESCE(SUM(a.allocated_quantity), 0)
                FROM multi_unit_allocations a
                WHERE a.listing_id = l.id
                  AND a.status IN ('reserved', 'confirmed')
                  AND (a.reserved_until IS NULL OR a.reserved_until > UTC_TIMESTAMP())
              ) AS total_allocated
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN subcategories sc ON sc.id = l.subcategory_id
       LEFT JOIN seller_profiles sp ON sp.account_id = l.seller_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY FIELD(l.review_status, 'submitted', 'under_review', 'changes_requested', 'draft', 'approved', 'rejected', 'completed'), l.created_at DESC`,
      values,
    );
    return rows.map(listingFromRow);
  }

  async review(id: number, status: ListingReviewStatus, notes?: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE listings
       SET review_status = ?, review_notes = ?, version = version + 1
       WHERE id = ?`,
      [status, notes || null, id],
    );
    return result.affectedRows > 0;
  }

  async updateAdminWithStatus(
    id: number,
    input: UpdateListingInput,
    newStatus?: ListingReviewStatus,
    reviewNotes?: string,
  ): Promise<void> {
    const columns: string[] = [];
    const values: DatabaseValue[] = [];

    const fieldMap: Partial<Record<keyof UpdateListingInput, string>> = {
      categoryId: "category_id",
      subcategoryId: "subcategory_id",
      saleMode: "sale_mode",
      title: "title",
      description: "description",
      condition: "condition",
      location: "location",
      askingPrice: "asking_price",
      currency: "currency",
      startTime: "start_time",
      endTime: "end_time",
      offerSelectionDeadline: "offer_selection_deadline",
      totalQuantity: "total_quantity",
      unitName: "unit_name",
      askingPricePerUnit: "asking_price_per_unit",
      minOrderQuantity: "min_order_quantity",
      maxOrderQuantity: "max_order_quantity",
      quantityIncrement: "quantity_increment",
      allowPartialAllocation: "allow_partial_allocation",
      minAcceptableUnitPrice: "min_acceptable_unit_price",
      offerStartTime: "offer_start_time",
      offerEndTime: "offer_end_time",
      buyerConfirmationDeadlineHours: "buyer_confirmation_deadline_hours",
    };


    for (const [key, column] of Object.entries(fieldMap) as [keyof UpdateListingInput, string][]) {
      const val = input[key];
      if (val !== undefined) {
        columns.push(`\`${column}\` = ?`);
        values.push(val ?? null);
      }
    }

    if (newStatus) {
      columns.push("review_status = ?");
      values.push(newStatus);
    }
    if (reviewNotes !== undefined) {
      columns.push("review_notes = ?");
      values.push(reviewNotes);
    }

    if (!columns.length) return;
    columns.push("version = version + 1");
    await pool.execute(`UPDATE listings SET ${columns.join(", ")} WHERE id = ?`, [...values, id]);
  }

  async softDelete(id: number): Promise<void> {
    await pool.execute(
      "UPDATE listings SET deleted_at = UTC_TIMESTAMP(), version = version + 1 WHERE id = ?",
      [id],
    );
  }
}

export const listingRepository = new ListingRepository();
