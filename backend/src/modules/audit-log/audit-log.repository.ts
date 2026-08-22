import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { AuditLogRecord, ListAuditLogsFilter, RecordAuditLogParams } from "./audit-log.types.js";

function mapAuditLogRow(row: RowDataPacket): AuditLogRecord {
  return {
    id: Number(row.id),
    actorAccountId: row.actor_account_id == null ? null : Number(row.actor_account_id),
    action: String(row.action),
    targetEntity: String(row.target_entity),
    targetId: String(row.target_id),
    reason: row.reason ? String(row.reason) : null,
    metadata: row.metadata
      ? typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata as Record<string, unknown>)
      : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: new Date(row.created_at as string | Date),
  };
}

export class AuditLogRepository {
  /**
   * Append a new immutable audit log entry.
   * This table has no update or delete pathways by design.
   */
  async create(params: RecordAuditLogParams, connection?: PoolConnection): Promise<number> {
    const executor = connection ?? pool;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO audit_log
        (actor_account_id, action, target_entity, target_id, reason, metadata, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.actorAccountId,
        params.action,
        params.targetEntity,
        String(params.targetId),
        params.reason ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.ipAddress ?? null,
        params.userAgent ?? null,
      ],
    );
    return Number(result.insertId);
  }

  async list(filter: ListAuditLogsFilter = {}): Promise<AuditLogRecord[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.actorAccountId) {
      conditions.push("actor_account_id = ?");
      params.push(filter.actorAccountId);
    }
    if (filter.targetEntity) {
      conditions.push("target_entity = ?");
      params.push(filter.targetEntity);
    }
    if (filter.targetId) {
      conditions.push("target_id = ?");
      params.push(filter.targetId);
    }
    if (filter.action) {
      conditions.push("action = ?");
      params.push(filter.action);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, actor_account_id, action, target_entity, target_id, reason, metadata, ip_address, user_agent, created_at
       FROM audit_log
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return rows.map(mapAuditLogRow);
  }

  async count(filter: ListAuditLogsFilter = {}): Promise<number> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.actorAccountId) {
      conditions.push("actor_account_id = ?");
      params.push(filter.actorAccountId);
    }
    if (filter.targetEntity) {
      conditions.push("target_entity = ?");
      params.push(filter.targetEntity);
    }
    if (filter.targetId) {
      conditions.push("target_id = ?");
      params.push(filter.targetId);
    }
    if (filter.action) {
      conditions.push("action = ?");
      params.push(filter.action);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM audit_log ${whereClause}`,
      params,
    );

    return Number(rows[0]?.total ?? 0);
  }
}

export const auditLogRepository = new AuditLogRepository();
