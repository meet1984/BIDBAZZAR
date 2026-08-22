import { Router } from "express";
import { requireAccountType } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { buyerProfileController } from "./buyer-profile.controller.js";
import { buyerProfileIdParamSchema, updateBuyerProfileSchema } from "./buyer-profile.schemas.js";

export const buyerProfileRouter = Router();

// Public safe lookup
buyerProfileRouter.get(
  "/public/:id",
  validate(buyerProfileIdParamSchema, "params"),
  asyncHandler(buyerProfileController.getPublicProfile),
);

// Authenticated buyer endpoints
buyerProfileRouter.get(
  "/",
  ...requireAccountType("buyer"),
  asyncHandler(buyerProfileController.getOwnProfile),
);

buyerProfileRouter.patch(
  "/",
  ...requireAccountType("buyer"),
  validate(updateBuyerProfileSchema),
  asyncHandler(buyerProfileController.updateOwnProfile),
);
