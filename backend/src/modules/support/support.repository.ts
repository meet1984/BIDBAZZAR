import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { SupportEnquiryInput } from "./support.schemas.js";

export interface StoredAttachment {
  key: string;
  name: string;
  mime: string;
}

export interface DownloadableAttachment {
  path: string;
  name: string;
  mime: string;
}

function mapEnquiryRow(row: RowDataPacket) {
  return {
    id: Number(row.id),
    reference: String(row.reference),
    fullName: String(row.full_name),
    email: String(row.email),
    role: String(row.contact_role),
    reason: String(row.reason),
    subject: String(row.subject),
    auctionReference: row.auction_reference == null ? null : String(row.auction_reference),
    message: row.message ? String(row.message) : "",
    status: String(row.status),
    attachment: row.attachment_path
      ? {
          name: String(row.attachment_name),
          mime: String(row.attachment_mime),
        }
      : null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}

export class SupportRepository {
  async create(
    reference: string,
    input: SupportEnquiryInput,
    userId: number | undefined,
    attachment: StoredAttachment | null,
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO support_enquiries
        (reference, account_id, full_name, email, phone, contact_role, reason,
         subject, auction_reference, message, attachment_path, attachment_name, attachment_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        userId ?? null,
        input.fullName,
        input.email,
        input.phone || null,
        input.role,
        input.reason,
        input.subject,
        input.reference || null,
        input.message,
        attachment?.key ?? null,
        attachment?.name ?? null,
        attachment?.mime ?? null,
      ],
    );
    return Number(result.insertId);
  }

  async list(limit = 100) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, reference, full_name, email, contact_role, reason, subject,
              auction_reference, message, status, attachment_path, attachment_name,
              attachment_mime, created_at
       FROM support_enquiries
       ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(mapEnquiryRow);
  }

  async listByUser(userId: number, _email?: string, role?: string) {
    let sql = `SELECT id, reference, full_name, email, contact_role, reason, subject,
                      auction_reference, message, status, attachment_path, attachment_name,
                      attachment_mime, created_at
               FROM support_enquiries
               WHERE account_id = ?`;
    const params: (string | number)[] = [userId];

    if (role) {
      sql += ` AND contact_role = ?`;
      params.push(role);
    }

    sql += ` ORDER BY created_at DESC LIMIT 50`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows.map(mapEnquiryRow);
  }

  async getById(id: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, reference, full_name, email, contact_role, reason, subject,
              auction_reference, message, status, attachment_path, attachment_name,
              attachment_mime, created_at
       FROM support_enquiries
       WHERE id = ?`,
      [id],
    );
    const row = rows[0];
    return row ? mapEnquiryRow(row) : null;
  }

  async getAttachmentById(id: number): Promise<StoredAttachment | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT attachment_path, attachment_name, attachment_mime
       FROM support_enquiries WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0];
    if (!row?.attachment_path) return null;
    return {
      key: String(row.attachment_path),
      name: String(row.attachment_name),
      mime: String(row.attachment_mime),
    };
  }

  async updateStatus(id: number, status: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE support_enquiries
       SET status = ?
       WHERE id = ?`,
      [status, id],
    );
    return result.affectedRows > 0;
  }
}

export const supportRepository = new SupportRepository();
