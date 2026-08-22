import { describe, expect, it } from "vitest";
import { BiddingService } from "../src/modules/bidding/bidding.service.js";

describe("BiddingService", () => {
  it("rejects legacy placeBid calls with 410 LEGACY_AUCTION_BID_RETIRED error", async () => {
    const service = new BiddingService();
    await expect(service.placeBid(8, 99, 1_300)).rejects.toMatchObject({
      statusCode: 410,
      code: "LEGACY_AUCTION_BID_RETIRED",
    });
  });
});
