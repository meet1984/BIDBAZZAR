import type { AuditLogRecord } from "../../types/database.types.js";

export interface RecordAuditLogParams {
  actorAccountId: number | null;
  action: string;
  targetEntity: string;
  targetId: string | number;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ListAuditLogsFilter {
  actorAccountId?: number;
  targetEntity?: string;
  targetId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export type { AuditLogRecord };
