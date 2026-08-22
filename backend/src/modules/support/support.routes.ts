import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middleware/auth.middleware.js";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import { publicFormRateLimit } from "../../middleware/rateLimit.middleware.js";
import { supportAttachment } from "../../middleware/upload.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { supportController } from "./support.controller.js";
import {
  supportEnquirySchema,
  supportEnquiryIdSchema,
  updateSupportStatusSchema,
} from "./support.schemas.js";

export const supportRouter = Router();
supportRouter.post(
  "/enquiries",
  optionalAuth,
  publicFormRateLimit,
  supportAttachment,
  validate(supportEnquirySchema),
  asyncHandler(supportController.create),
);
supportRouter.get(
  "/my-enquiries",
  ...requireAuth,
  asyncHandler(supportController.listMine),
);

export const adminSupportRouter = Router();
adminSupportRouter.use(...requireAdminPermission("support_management"));
adminSupportRouter.get("/enquiries", asyncHandler(supportController.list));
adminSupportRouter.patch(
  "/enquiries/:id/status",
  validate(supportEnquiryIdSchema, "params"),
  validate(updateSupportStatusSchema),
  asyncHandler(supportController.updateStatus),
);
adminSupportRouter.get(
  "/enquiries/:id/attachment",
  validate(supportEnquiryIdSchema, "params"),
  asyncHandler(supportController.downloadAttachment),
);
