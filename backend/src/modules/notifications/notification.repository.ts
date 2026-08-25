import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { CreateNotificationParams, NotificationRecord } from "./notification.types.js";

function mapNotificationRow(row: RowDataPacket): NotificationRecord {
  return {
    id: Number(row.id),
    recipientAccountId: Number(row.recipient_account_id),
    type: String(row.type),
    title: String(row.title),
    message: String(row.message),
    payload:
      typeof row.payload === "string"
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : (row.payload as Record<string, unknown> | null),
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? new Date(row.read_at as string | Date) : null,
    createdAt: new Date(row.created_at as string | Date),
  };
}

export class NotificationRepository {
  async create(params: CreateNotificationParams): Promise<NotificationRecord> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO notifications (recipient_account_id, type, title, message, payload, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        params.recipientAccountId,
        params.type,
        params.title,
        params.message,
        params.payload ? JSON.stringify(params.payload) : null,
      ],
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM notifications WHERE id = ?",
      [result.insertId],
    );

    return mapNotificationRow(rows[0]!);
  }

  async listByAccountId(
    recipientAccountId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<NotificationRecord[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM notifications WHERE recipient_account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [recipientAccountId, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)],
    );
    return rows.map(mapNotificationRow);
  }

  async countUnread(recipientAccountId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS unread FROM notifications WHERE recipient_account_id = ? AND is_read = 0",
      [recipientAccountId],
    );
    return Number(rows[0]?.unread ?? 0);
  }

  async markAsRead(id: number, recipientAccountId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE notifications SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND recipient_account_id = ?",
      [id, recipientAccountId],
    );
    if (result.affectedRows > 0) {
      return true;
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM notifications WHERE id = ? AND recipient_account_id = ?",
      [id, recipientAccountId],
    );
    return rows.length > 0;
  }

  async markAllAsRead(recipientAccountId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE recipient_account_id = ? AND is_read = 0",
      [recipientAccountId],
    );
    return result.affectedRows;
  }
}

export const notificationRepository = new NotificationRepository();
