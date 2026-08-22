import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type {
  BuyerToSellerCategoryRatings,
  CreateReportParams,
  CreateReviewParams,
  ReviewDirection,
  ReviewRecord,
  ReviewReportReason,
  ReviewReportRecord,
  ReviewReportStatus,
  SellerToBuyerCategoryRatings,
  UpdateReviewParams,
} from "./review.types.js";

function mapReviewRow(row: RowDataPacket): ReviewRecord {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    reviewerId: Number(row.reviewer_id),
    revieweeId: Number(row.reviewee_id),
    direction: row.direction as ReviewDirection,
    ratingScore: Number(row.rating_score),
    categoryRatings:
      typeof row.category_ratings === "string"
        ? (JSON.parse(row.category_ratings) as
            | BuyerToSellerCategoryRatings
            | SellerToBuyerCategoryRatings
            | Record<string, number>)
        : (row.category_ratings as
            | BuyerToSellerCategoryRatings
            | SellerToBuyerCategoryRatings
            | Record<string, number>),
    comment: String(row.comment),
    isPublished: Boolean(row.is_published),
    hiddenReason: row.hidden_reason ? String(row.hidden_reason) : null,
    hiddenByAccountId: row.hidden_by_account_id ? Number(row.hidden_by_account_id) : null,
    hiddenAt: row.hidden_at ? new Date(row.hidden_at as string | Date) : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

function mapReportRow(row: RowDataPacket): ReviewReportRecord {
  return {
    id: Number(row.id),
    reviewId: Number(row.review_id),
    reporterId: Number(row.reporter_id || row.reported_by_account_id),
    reason: row.reason as ReviewReportReason,
    details: row.details ? String(row.details) : null,
    status: row.status as ReviewReportStatus,
    reviewedByAccountId: row.reviewed_by_account_id ? Number(row.reviewed_by_account_id) : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string | Date) : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class ReviewRepository {
  async create(params: CreateReviewParams, connection: { execute: typeof pool.execute } = pool): Promise<ReviewRecord> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO reviews (
        order_id, reviewer_id, reviewee_id, direction,
        rating_score, category_ratings, comment, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.orderId,
        params.reviewerId,
        params.revieweeId,
        params.direction,
        params.ratingScore,
        JSON.stringify(params.categoryRatings),
        params.comment,
        params.isPublished !== false ? 1 : 0,
      ],
    );

    const created = await this.findById(Number(result.insertId), connection);
    return created!;
  }

  async updateReview(
    id: number,
    params: UpdateReviewParams,
    connection: { execute: typeof pool.execute } = pool,
  ): Promise<ReviewRecord> {
    await connection.execute(
      `UPDATE reviews SET
        rating_score = ?,
        category_ratings = ?,
        comment = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [params.ratingScore, JSON.stringify(params.categoryRatings), params.comment, id],
    );
    const updated = await this.findById(id, connection);
    return updated!;
  }

  async findById(id: number, connection: { execute: typeof pool.execute } = pool): Promise<ReviewRecord | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM reviews WHERE id = ?",
      [id],
    );
    if (!rows[0]) return null;
    return mapReviewRow(rows[0]);
  }

  async findByOrderAndDirection(
    orderId: number,
    direction: ReviewDirection,
    connection: { execute: typeof pool.execute } = pool,
  ): Promise<ReviewRecord | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM reviews WHERE order_id = ? AND direction = ? LIMIT 1",
      [orderId, direction],
    );
    if (!rows[0]) return null;
    return mapReviewRow(rows[0]);
  }

  async listByReviewee(revieweeId: number, onlyPublished: boolean = true): Promise<ReviewRecord[]> {
    const condition = onlyPublished
      ? "WHERE reviewee_id = ? AND is_published = 1"
      : "WHERE reviewee_id = ?";
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM reviews ${condition} ORDER BY created_at DESC`,
      [revieweeId],
    );
    return rows.map(mapReviewRow);
  }

  async updatePublishedStatus(
    id: number,
    isPublished: boolean,
    hiddenReason?: string | null,
    hiddenByAccountId?: number | null,
  ): Promise<void> {
    await pool.execute(
      `UPDATE reviews SET
        is_published = ?,
        hidden_reason = ?,
        hidden_by_account_id = ?,
        hidden_at = ${isPublished ? "NULL" : "CURRENT_TIMESTAMP"}
      WHERE id = ?`,
      [isPublished ? 1 : 0, hiddenReason || null, hiddenByAccountId || null, id],
    );
  }

  async createReport(params: CreateReportParams): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO review_reports (
        review_id, reporter_id, reason, details, status
      ) VALUES (?, ?, ?, ?, 'pending')`,
      [params.reviewId, params.reporterId, params.reason, params.details],
    );
    return Number(result.insertId);
  }

  async findReportByReviewAndReporter(reviewId: number, reporterId: number): Promise<ReviewReportRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM review_reports WHERE review_id = ? AND reporter_id = ? LIMIT 1",
      [reviewId, reporterId],
    );
    return rows[0] ? mapReportRow(rows[0]) : null;
  }

  async findReportById(id: number): Promise<ReviewReportRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM review_reports WHERE id = ?",
      [id],
    );
    if (!rows[0]) return null;
    return mapReportRow(rows[0]);
  }

  async listReports(status?: ReviewReportStatus): Promise<ReviewReportRecord[]> {
    const query = status
      ? "SELECT * FROM review_reports WHERE status = ? ORDER BY created_at DESC"
      : "SELECT * FROM review_reports ORDER BY created_at DESC";
    const params = status ? [status] : [];
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return rows.map(mapReportRow);
  }

  async resolveReport(
    reportId: number,
    adminAccountId: number,
    status: ReviewReportStatus,
  ): Promise<void> {
    await pool.execute(
      `UPDATE review_reports SET
        status = ?,
        reviewed_by_account_id = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [status, adminAccountId, reportId],
    );
  }

  async countCompletedOrders(accountId: number, role: "buyer" | "seller"): Promise<number> {
    const column = role === "buyer" ? "buyer_id" : "seller_id";
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM orders WHERE ${column} = ? AND order_status = 'completed'`,
      [accountId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countUnresolvedDisputes(accountId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM disputes d
       JOIN orders o ON d.order_id = o.id
       WHERE o.seller_id = ? AND d.status IN ('opened', 'under_review')`,
      [accountId],
    );
    return Number(rows[0]?.total ?? 0);
  }
}

export const reviewRepository = new ReviewRepository();
