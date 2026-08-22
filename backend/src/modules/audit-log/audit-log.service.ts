import type { Request } from "express";
import type { PoolConnection } from "mysql2/promise";
import type { AuditLogRecord, ListAuditLogsFilter, RecordAuditLogParams } from "./audit-log.types.js";
import { auditLogRepository, type AuditLogRepository } from "./audit-log.repository.js";

export class AuditLogService {
  constructor(private readonly repository: AuditLogRepository) {}

  /**
   * Record a single immutable audit entry.
   * Every sensitive administrative or state-altering moderation action must call this function.
   */
  async record(params: RecordAuditLogParams, connection?: PoolConnection): Promise<number> {
    return this.repository.create(params, connection);
  }

  /**
   * Helper to record an audit log entry directly from an Express Request context,
   * automatically populating actor ID, IP address, and User-Agent headers.
   */
  async recordFromRequest(
    req: Request,
    params: Omit<RecordAuditLogParams, "actorAccountId" | "ipAddress" | "userAgent">,
  ): Promise<number> {
    const actorAccountId = req.auth?.id ?? null;
    const ipAddress = req.ip ?? null;
    const userAgent = req.get("user-agent") ?? null;

    return this.repository.create({
      actorAccountId,
      action: params.action,
      targetEntity: params.targetEntity,
      targetId: params.targetId,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
      ipAddress,
      userAgent,
    });
  }

  async list(filter: ListAuditLogsFilter = {}): Promise<{
    items: AuditLogRecord[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      this.repository.list({ ...filter, limit, offset }),
      this.repository.count(filter),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }
}

export const auditLogService = new AuditLogService(auditLogRepository);
