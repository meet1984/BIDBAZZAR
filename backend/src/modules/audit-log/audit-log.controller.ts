import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { auditLogService } from "./audit-log.service.js";

export const listAuditLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const actorAccountId =
    typeof req.query.actorAccountId === "string" && req.query.actorAccountId.trim()
      ? Number(req.query.actorAccountId)
      : undefined;
  const targetEntity = typeof req.query.targetEntity === "string" ? req.query.targetEntity : undefined;
  const targetId = typeof req.query.targetId === "string" ? req.query.targetId : undefined;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
  const offset = typeof req.query.offset === "string" ? Number(req.query.offset) : 0;

  const result = await auditLogService.list({
    actorAccountId,
    targetEntity,
    targetId,
    action,
    limit,
    offset,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    },
  });
});
