import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";

export interface ListingAuditEntry {
  id: number;
  actorAccountId: number;
  listingId: number;
  action: "approve" | "reject" | "request_changes" | "admin_update" | "cancel" | "suspend";
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export class ListingAuditRepository {
  async record(
    actorAccountId: number,
    listingId: number,
    action: ListingAuditEntry["action"],
    reason?: string | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO listing_audit_log (actor_account_id, listing_id, action, reason, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [actorAccountId, listingId, action, reason ?? null, metadata ? JSON.stringify(metadata) : null],
    );
    return Number(result.insertId);
  }

  async findByListingId(listingId: number): Promise<ListingAuditEntry[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, actor_account_id, listing_id, action, reason, metadata, created_at
       FROM listing_audit_log
       WHERE listing_id = ?
       ORDER BY created_at DESC`,
      [listingId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      actorAccountId: Number(row.actor_account_id),
      listingId: Number(row.listing_id),
      action: row.action as ListingAuditEntry["action"],
      reason: row.reason == null ? null : String(row.reason),
      metadata: row.metadata ? (typeof row.metadata === "string" ? (JSON.parse(row.metadata) as Record<string, unknown>) : (row.metadata as Record<string, unknown>)) : null,
      createdAt: new Date(row.created_at as string | Date),
    }));
  }
}

export const listingAuditRepository = new ListingAuditRepository();
