import type { Request, Response } from "express";
import { AppError } from "../../shared/AppError.js";

export const biddingController = {
  place(_request: Request, _response: Response): Promise<never> {
    return Promise.reject(
      new AppError(
        410,
        "LEGACY_AUCTION_BID_RETIRED",
        "Highest-bid auctions are retired. Please submit a private offer using /api/listings/:id/offers.",
      ),
    );
  },

  history(_request: Request, response: Response) {
    response.json({ items: [] });
  },
};
