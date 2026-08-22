import { Router } from "express";
import { requireRole } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { watchlistController } from "./watchlist.controller.js";
import { watchlistListingSchema } from "./watchlist.schemas.js";

export const watchlistRouter = Router();
watchlistRouter.use(requireRole("buyer"));
watchlistRouter.get("/", asyncHandler(watchlistController.list));
watchlistRouter.post(
  "/:listingId",
  validate(watchlistListingSchema, "params"),
  asyncHandler(watchlistController.add),
);
watchlistRouter.delete(
  "/:listingId",
  validate(watchlistListingSchema, "params"),
  asyncHandler(watchlistController.remove),
);
