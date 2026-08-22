import { Router } from "express";

export const biddingRouter = Router();

// Legacy bid endpoints retired in favor of private negotiated offers (/api/listings/:id/offers)
biddingRouter.all("/:id/bids", (_req, res) => {
  res.status(410).json({
    error: "LEGACY_AUCTION_BID_RETIRED",
    message: "Highest-bid auctions are retired. Please submit or manage private offers using /api/listings/:id/offers.",
  });
});
