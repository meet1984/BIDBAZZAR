import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import {
  getDisputeHandler,
  listAdminDisputesHandler,
  listOrderDisputesHandler,
  openDisputeHandler,
  resolveDisputeHandler,
} from "./dispute.controller.js";
import {
  disputeQuerySchema,
  disputeIdSchema,
  openDisputeSchema,
  resolveDisputeSchema,
} from "./dispute.schemas.js";

export const disputeRouter = Router();

// Open dispute on an order (Buyer or Seller)
disputeRouter.post("/orders/:id/dispute", requireAuth, validate(disputeIdSchema, "params"), validate(openDisputeSchema), openDisputeHandler);

// View disputes for an order (Buyer, Seller, or Admin)
disputeRouter.get("/orders/:id/disputes", requireAuth, validate(disputeIdSchema, "params"), listOrderDisputesHandler);

// Admin dispute listing (Requires dispute_management permission)
disputeRouter.get("/admin", requireAdminPermission("dispute_management"), validate(disputeQuerySchema, "query"), listAdminDisputesHandler);

// Single dispute lookup
disputeRouter.get("/:id", requireAuth, validate(disputeIdSchema, "params"), getDisputeHandler);

// Admin dispute resolution (Requires dispute_management permission)
disputeRouter.post("/:id/resolve", requireAdminPermission("dispute_management"), validate(disputeIdSchema, "params"), validate(resolveDisputeSchema), resolveDisputeHandler);
