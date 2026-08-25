import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool, withTransaction } from "../../database/pool.js";
import { pagination } from "../../shared/pagination.js";
import type { VerificationAccountType, VerificationDecisionAction, VerificationStatus } from "../../types/database.types.js";
import type { AdminQueueQuery } from "./verification.schemas.js";

export interface VerificationQueueItem {
  accountId: number;
  accountType: VerificationAccountType;
  fullName: string;
  email: string;
  verificationStatus: VerificationStatus;
  verificationSubmittedAt: string | null;
  verificationReviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export class VerificationRepository {
  async recordDecision(
    accountId: number,
    accountType: VerificationAccountType,
    reviewerAccountId: number,
    action: VerificationDecisionAction,
    reason?: string | null,
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO verification_decisions (account_id, account_type, reviewer_account_id, action, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [accountId, accountType, reviewerAccountId, action, reason || null],
    );
    return Number(result.insertId);
  }

  async recordAuditLog(
    actorAccountId: number,
    targetAccountId: number,
    accountType: VerificationAccountType,
    action: string,
    metadata?: Record<string, unknown> | null,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<void> {
    await pool.execute(
      `INSERT INTO verification_audit_log
        (actor_account_id, target_account_id, account_type, action, metadata, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actorAccountId,
        targetAccountId,
        accountType,
        action,
        metadata ? JSON.stringify(metadata) : null,
        ipAddress || null,
        userAgent || null,
      ],
    );
  }

  async listBuyerQueue(query: AdminQueueQuery) {
    const page = pagination(query.page, query.pageSize);
    const where = ["a.account_type = 'buyer'"];
    const values: (string | number)[] = [];

    if (query.status) {
      where.push("bp.verification_status = ?");
      values.push(query.status);
    }
    if (query.q) {
      where.push("(bp.legal_full_name LIKE ? OR a.email LIKE ?)");
      values.push(`%${query.q}%`, `%${query.q}%`);
    }

    const clause = where.join(" AND ");
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM accounts a
       INNER JOIN buyer_profiles bp ON bp.account_id = a.id
       WHERE ${clause}`,
      values,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id AS account_id, bp.legal_full_name, a.email, bp.verification_status,
              bp.verification_submitted_at, bp.verification_reviewed_at, bp.rejection_reason, bp.created_at
       FROM accounts a
       INNER JOIN buyer_profiles bp ON bp.account_id = a.id
       WHERE ${clause}
       ORDER BY bp.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...values, page.pageSize, page.offset],
    );

    const items: VerificationQueueItem[] = rows.map((r) => ({
      accountId: Number(r.account_id),
      accountType: "buyer",
      fullName: String(r.legal_full_name),
      email: String(r.email),
      verificationStatus: (r.verification_status || "profile_incomplete") as VerificationStatus,
      verificationSubmittedAt: r.verification_submitted_at ? new Date(r.verification_submitted_at as string | Date).toISOString() : null,
      verificationReviewedAt: r.verification_reviewed_at ? new Date(r.verification_reviewed_at as string | Date).toISOString() : null,
      rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
      createdAt: new Date(r.created_at as string | Date).toISOString(),
    }));

    return {
      items,
      total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: Math.max(1, Math.ceil(total / page.pageSize)),
    };
  }

  async listSellerQueue(query: AdminQueueQuery) {
    const page = pagination(query.page, query.pageSize);
    const where = ["a.account_type = 'seller'"];
    const values: (string | number)[] = [];

    if (query.status) {
      where.push("sp.verification_status = ?");
      values.push(query.status);
    }
    if (query.q) {
      where.push("(sp.business_name LIKE ? OR sp.legal_name LIKE ? OR a.email LIKE ?)");
      values.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`);
    }

    const clause = where.join(" AND ");
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM accounts a
       INNER JOIN seller_profiles sp ON sp.account_id = a.id
       WHERE ${clause}`,
      values,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id AS account_id, sp.business_name, sp.legal_name, a.email, sp.verification_status,
              sp.verification_submitted_at, sp.verification_reviewed_at, sp.rejection_reason, sp.created_at
       FROM accounts a
       INNER JOIN seller_profiles sp ON sp.account_id = a.id
       WHERE ${clause}
       ORDER BY sp.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...values, page.pageSize, page.offset],
    );

    const items: VerificationQueueItem[] = rows.map((r) => ({
      accountId: Number(r.account_id),
      accountType: "seller",
      fullName: String(r.business_name || r.legal_name),
      email: String(r.email),
      verificationStatus: (r.verification_status || "profile_incomplete") as VerificationStatus,
      verificationSubmittedAt: r.verification_submitted_at ? new Date(r.verification_submitted_at as string | Date).toISOString() : null,
      verificationReviewedAt: r.verification_reviewed_at ? new Date(r.verification_reviewed_at as string | Date).toISOString() : null,
      rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
      createdAt: new Date(r.created_at as string | Date).toISOString(),
    }));

    return {
      items,
      total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: Math.max(1, Math.ceil(total / page.pageSize)),
    };
  }

  async setVerificationStatusTransaction(
    targetAccountId: number,
    accountType: VerificationAccountType,
    newStatus: VerificationStatus,
    reviewerAccountId: number,
    decisionAction: VerificationDecisionAction,
    reason?: string | null,
  ): Promise<void> {
    await withTransaction(async (connection) => {
      const now = new Date();
      const table = accountType === "buyer" ? "buyer_profiles" : "seller_profiles";

      await connection.execute(
        `UPDATE ${table}
         SET verification_status = ?,
             rejection_reason = ?,
             verification_submitted_at = IF(? = 'submitted', ?, verification_submitted_at),
             verification_reviewed_at = IF(? IN ('verified', 'rejected', 'changes_requested', 'suspended'), ?, verification_reviewed_at)
         WHERE account_id = ?`,
        [newStatus, reason || null, newStatus, now, newStatus, now, targetAccountId],
      );

      if (newStatus === "suspended") {
        await connection.execute(
          "UPDATE accounts SET status = 'suspended' WHERE id = ?",
          [targetAccountId],
        );
        await connection.execute(
          "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE account_id = ? AND revoked_at IS NULL",
          [targetAccountId],
        );
      } else if (newStatus === "verified" || newStatus === "changes_requested") {
        await connection.execute(
          "UPDATE accounts SET status = 'active' WHERE id = ?",
          [targetAccountId],
        );
      }

      await connection.execute(
        `INSERT INTO verification_decisions (account_id, account_type, reviewer_account_id, action, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [targetAccountId, accountType, reviewerAccountId, decisionAction, reason || null],
      );

      await connection.execute(
        `INSERT INTO verification_audit_log (actor_account_id, target_account_id, account_type, action, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [
          reviewerAccountId,
          targetAccountId,
          accountType,
          `verification_${decisionAction}`,
          JSON.stringify({ newStatus, reason: reason || null }),
        ],
      );
    });
  }
}

export const verificationRepository = new VerificationRepository();
