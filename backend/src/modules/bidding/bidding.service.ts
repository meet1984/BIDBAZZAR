import { AppError } from "../../shared/AppError.js";

export class BiddingService {
  placeBid(_auctionId: number, _bidderId: number, _amount: number): Promise<never> {
    return Promise.reject(
      new AppError(
        410,
        "LEGACY_AUCTION_BID_RETIRED",
        "Highest-bid auctions are retired. Please submit a private offer using /api/listings/:id/offers.",
      ),
    );
  }

  history(_auctionId: number): Promise<never[]> {
    return Promise.resolve([]);
  }
}

export const biddingService = new BiddingService();
