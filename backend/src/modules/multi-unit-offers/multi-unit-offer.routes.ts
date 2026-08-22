import { Router } from "express";
import { requireRole } from "../../middleware/auth.middleware.js";
import { offerRateLimit } from "../../middleware/rateLimit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireVerifiedBuyer, requireVerifiedSeller } from "../../middleware/verification.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { multiUnitOfferController } from "./multi-unit-offer.controller.js";
import {
  acceptPartialSchema,
  counterMultiUnitOfferSchema,
  multiUnitListingIdParamSchema,
  multiUnitOfferIdParamSchema,
  reviseMultiUnitOfferSchema,
  submitMultiUnitOfferSchema,
} from "./multi-unit-offer.schemas.js";

const router = Router();

// Buyer Offer Routes
router.post(
  "/listings/:listingId/offers",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(multiUnitListingIdParamSchema, "params"),
  validate(submitMultiUnitOfferSchema),
  asyncHandler(multiUnitOfferController.submitOffer),
);

router.put(
  "/:id",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  validate(reviseMultiUnitOfferSchema),
  asyncHandler(multiUnitOfferController.reviseOffer),
);

router.post(
  "/:id/withdraw",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  asyncHandler(multiUnitOfferController.withdrawOffer),
);

router.get(
  "/my-offers",
  requireRole("buyer"),
  asyncHandler(multiUnitOfferController.listBuyerOffers),
);

// Buyer Allocation Confirmation Routes
router.post(
  "/allocations/:id/confirm",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  asyncHandler(multiUnitOfferController.buyerConfirmAllocation),
);

router.post(
  "/allocations/:id/decline",
  requireVerifiedBuyer,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  asyncHandler(multiUnitOfferController.buyerDeclineAllocation),
);

// Seller Allocation Routes
router.get(
  "/seller/listings/:listingId/offers",
  requireVerifiedSeller,
  validate(multiUnitListingIdParamSchema, "params"),
  asyncHandler(multiUnitOfferController.listSellerOffers),
);

router.post(
  "/offers/:id/accept-full",
  requireVerifiedSeller,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  asyncHandler(multiUnitOfferController.acceptFullOffer),
);

router.post(
  "/offers/:id/accept-partial",
  requireVerifiedSeller,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  validate(acceptPartialSchema),
  asyncHandler(multiUnitOfferController.acceptPartialOffer),
);

router.post(
  "/offers/:id/counter",
  requireVerifiedSeller,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  validate(counterMultiUnitOfferSchema),
  asyncHandler(multiUnitOfferController.counterOffer),
);

router.post(
  "/offers/:id/shortlist",
  requireVerifiedSeller,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  asyncHandler(multiUnitOfferController.shortlistOffer),
);

router.post(
  "/offers/:id/reject",
  requireVerifiedSeller,
  offerRateLimit,
  validate(multiUnitOfferIdParamSchema, "params"),
  asyncHandler(multiUnitOfferController.rejectOffer),
);

export default router;
