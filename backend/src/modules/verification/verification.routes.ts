import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { verificationController } from "./verification.controller.js";
import { verificationDocumentController } from "../verification-documents/verification-documents.controller.js";
import {
  adminDecisionSchema,
  adminQueueQuerySchema,
  verificationTargetParamSchema,
} from "./verification.schemas.js";

export const verificationRouter = Router();

verificationRouter.get(
  "/status",
  ...requireAuth,
  asyncHandler(verificationController.getStatus),
);

verificationRouter.post(
  "/submit",
  ...requireAuth,
  asyncHandler(verificationController.submit),
);

export const adminVerificationRouter = Router();
adminVerificationRouter.use(...requireAdminPermission("verification_review"));

adminVerificationRouter.get(
  "/buyers",
  validate(adminQueueQuerySchema, "query"),
  asyncHandler(verificationController.getBuyerQueue),
);

adminVerificationRouter.get(
  "/sellers",
  validate(adminQueueQuerySchema, "query"),
  asyncHandler(verificationController.getSellerQueue),
);

adminVerificationRouter.get(
  "/:type/:id/documents",
  validate(verificationTargetParamSchema, "params"),
  asyncHandler(verificationDocumentController.listForUser),
);

adminVerificationRouter.get(
  "/:type/:id/profile",
  validate(verificationTargetParamSchema, "params"),
  asyncHandler(verificationController.getAdminProfile),
);

adminVerificationRouter.post(
  "/:type/:id/approve",
  validate(verificationTargetParamSchema, "params"),
  asyncHandler(verificationController.approve),
);

adminVerificationRouter.post(
  "/:type/:id/reject",
  validate(verificationTargetParamSchema, "params"),
  validate(adminDecisionSchema),
  asyncHandler(verificationController.reject),
);

adminVerificationRouter.post(
  "/:type/:id/request-changes",
  validate(verificationTargetParamSchema, "params"),
  validate(adminDecisionSchema),
  asyncHandler(verificationController.requestChanges),
);

adminVerificationRouter.post(
  "/:type/:id/suspend",
  validate(verificationTargetParamSchema, "params"),
  validate(adminDecisionSchema),
  asyncHandler(verificationController.suspend),
);
