import { Router } from "express";
import { requireRole } from "../../middleware/auth.middleware.js";
import { offerRateLimit } from "../../middleware/rateLimit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireVerifiedBuyer, requireVerifiedSeller } from "../../middleware/verification.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { offerController } from "./offer.controller.js";
import { acceptOfferSchema, counterOfferSchema, offerIdParamSchema, offerListingIdParamSchema, reviseOfferSchema, submitOfferSchema } from "./offer.schemas.js";

export const buyerOfferRouter = Router();

// Buyer Routes
buyerOfferRouter.get("/buyer/offers", requireRole("buyer"), asyncHandler(offerController.listBuyerOffers));
buyerOfferRouter.post(
  "/listings/:listingId/offers",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(offerListingIdParamSchema, "params"),
  validate(submitOfferSchema),
  asyncHandler(offerController.submitOffer),
);
buyerOfferRouter.patch(
  "/offers/:id",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  validate(reviseOfferSchema),
  asyncHandler(offerController.reviseOffer),
);
buyerOfferRouter.post(
  "/offers/:id/withdraw",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  asyncHandler(offerController.withdrawOffer),
);

// Buyer Confirmation / Decline Routes
buyerOfferRouter.post(
  "/offers/:id/buyer-confirm",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  asyncHandler(offerController.buyerConfirmOffer),
);
buyerOfferRouter.post(
  "/offers/:id/buyer-decline",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  asyncHandler(offerController.buyerDeclineOffer),
);

// Seller Routes
buyerOfferRouter.get(
  "/seller/listings/:listingId/offers",
  requireVerifiedSeller,
  validate(offerListingIdParamSchema, "params"),
  asyncHandler(offerController.listSellerOffers),
);
buyerOfferRouter.post(
  "/offers/:id/shortlist",
  requireVerifiedSeller,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  asyncHandler(offerController.shortlistOffer),
);
buyerOfferRouter.post(
  "/offers/:id/reject",
  requireVerifiedSeller,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  asyncHandler(offerController.rejectOffer),
);
buyerOfferRouter.post(
  "/offers/:id/counter",
  requireVerifiedSeller,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  validate(counterOfferSchema),
  asyncHandler(offerController.counterOffer),
);
buyerOfferRouter.post(
  "/offers/:id/request-contact",
  requireVerifiedSeller,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  asyncHandler(offerController.requestContact),
);
buyerOfferRouter.post(
  "/offers/:id/accept",
  requireVerifiedSeller,
  offerRateLimit,
  validate(offerIdParamSchema, "params"),
  validate(acceptOfferSchema),
  asyncHandler(offerController.acceptOffer),
);
