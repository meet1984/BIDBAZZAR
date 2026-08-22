import { Router } from "express";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import { listAuditLogsHandler } from "./audit-log.controller.js";

export const auditLogRouter = Router();

// Viewing system-wide audit logs requires either full admin or order_oversight permission
auditLogRouter.get("/", requireAdminPermission("order_oversight"), listAuditLogsHandler);
