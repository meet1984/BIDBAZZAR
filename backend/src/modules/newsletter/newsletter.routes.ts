import { Router } from "express";
import { publicFormRateLimit } from "../../middleware/rateLimit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { newsletterController } from "./newsletter.controller.js";
import { newsletterSchema } from "./newsletter.schemas.js";

export const newsletterRouter = Router();
newsletterRouter.post(
  "/subscriptions",
  publicFormRateLimit,
  validate(newsletterSchema),
  asyncHandler(newsletterController.subscribe),
);
