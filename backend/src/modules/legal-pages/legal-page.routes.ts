import { Router } from "express";
import { requireAccountType } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { legalPageController } from "./legal-page.controller.js";
import { legalPageSlugParamSchema, updateLegalPageSchema } from "./legal-page.schemas.js";

export const publicLegalPageRouter = Router();

publicLegalPageRouter.get(
  "/:slug",
  validate(legalPageSlugParamSchema, "params"),
  asyncHandler(legalPageController.getPublicPage),
);

export const adminLegalPageRouter = Router();

adminLegalPageRouter.use(requireAccountType("admin", "admin_employee"));

adminLegalPageRouter.get(
  "/:slug",
  validate(legalPageSlugParamSchema, "params"),
  asyncHandler(legalPageController.getAdminPage),
);

adminLegalPageRouter.put(
  "/:slug",
  validate(legalPageSlugParamSchema, "params"),
  validate(updateLegalPageSchema, "body"),
  asyncHandler(legalPageController.updateAdminPage),
);
