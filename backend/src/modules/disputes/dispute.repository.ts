import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { createReference } from "../../shared/reference.js";
import type {
  DisputeReason,
  DisputeRecord,
  DisputeStatus,
} from "../../types/database.types.js";
import type { DisputeQueryInput, OpenDisputeInput, ResolveDisputeInput } from "./dispute.schemas.js";

function mapDisputeRow(row: RowDataPacket): DisputeRecord {
  return {
    id: Number(row.id),
    disputeReference: String(row.dispute_reference),
    orderId: Number(row.order_id),
    openedByAccountId: Number(row.opened_by_account_id),
    reason: row.reason as DisputeReason,
    details: String(row.details),
    status: row.status as DisputeStatus,
    resolutionNotes: row.resolution_notes ? String(row.resolution_notes) : null,
    resolvedByAccountId: row.resolved_by_account_id ? Number(row.resolved_by_account_id) : null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at as string | Date) : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class DisputeRepository {
  async create(
    orderId: number,
    openedByAccountId: number,
    data: OpenDisputeInput,
    connection?: PoolConnection,
  ): Promise<DisputeRecord> {
    const executor = connection ?? pool;
    const disputeReference = createReference("DSP");

    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO disputes (
        dispute_reference, order_id, opened_by_account_id,
        reason, details, status
      ) VALUES (?, ?, ?, ?, ?, 'opened')`,
      [
        disputeReference,
        orderId,
        openedByAccountId,
        data.reason,
        data.details,
      ],
    );

    const dispute = await this.findById(Number(result.insertId), connection);
    return dispute!;
  }

  async findById(id: number, connection?: PoolConnection): Promise<DisputeRecord | null> {
    const executor = connection ?? pool;
    const [rows] = await executor.execute<RowDataPacket[]>(
      "SELECT * FROM disputes WHERE id = ?",
      [id],
    );
    if (!rows[0]) return null;
    return mapDisputeRow(rows[0]);
  }

  async findByIdForUpdate(id: number, connection: PoolConnection): Promise<DisputeRecord | null> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT * FROM disputes WHERE id = ? FOR UPDATE", [id]);
    return rows[0] ? mapDisputeRow(rows[0]) : null;
  }

  async findActiveByOrderId(orderId: number, connection?: PoolConnection): Promise<DisputeRecord | null> {
    const executor = connection ?? pool;
    const [rows] = await executor.execute<RowDataPacket[]>(
      `SELECT * FROM disputes WHERE order_id = ? AND status IN ('opened', 'under_review') LIMIT 1${connection ? " FOR UPDATE" : ""}`,
      [orderId],
    );
    if (!rows[0]) return null;
    return mapDisputeRow(rows[0]);
  }

  async listByOrderId(orderId: number): Promise<DisputeRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM disputes WHERE order_id = ? ORDER BY created_at DESC",
      [orderId],
    );
    return rows.map(mapDisputeRow);
  }

  async resolve(
    id: number,
    adminAccountId: number,
    data: ResolveDisputeInput,
    connection?: PoolConnection,
  ): Promise<void> {
    const executor = connection ?? pool;
    await executor.execute(
      `UPDATE disputes SET
        status = ?,
        resolution_notes = ?,
        resolved_by_account_id = ?,
        resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        data.resolutionOutcome,
        data.resolutionNotes,
        adminAccountId,
        id,
      ],
    );
  }

  async list(filter: DisputeQueryInput): Promise<DisputeRecord[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter.orderId) {
      conditions.push("order_id = ?");
      params.push(filter.orderId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM disputes ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return rows.map(mapDisputeRow);
  }

  async count(filter: DisputeQueryInput): Promise<number> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter.orderId) {
      conditions.push("order_id = ?");
      params.push(filter.orderId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM disputes ${whereClause}`,
      params,
    );

    return Number(rows[0]?.total ?? 0);
  }
}

export const disputeRepository = new DisputeRepository();
