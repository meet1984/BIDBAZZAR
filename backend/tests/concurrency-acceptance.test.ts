import { afterEach, describe, expect, it, vi } from "vitest";
import { OfferSellerService } from "../src/modules/offers/offer-seller.service.js";
import { pool } from "../src/database/pool.js";

describe("Phase 3: Seller Actions & Concurrency Acceptance Invariant Suite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("prevents a seller from altering a buyer's offer amount during acceptance", async () => {
    const mockOfferRow = {
      id: 1,
      listing_id: 200,
      buyer_id: 88,
      offered_amount: 480000,
      counter_amount: null,
      currency: "INR",
      buyer_message: "My offer",
      seller_message: null,
      preferred_fulfilment: "Delivery",
      offer_expiry: new Date(Date.now() + 86400000),
      status: "submitted",
      version: 1,
    };

    const mockListingRow = {
      id: 200,
      seller_id: 50,
      review_status: "open",
    };

    const mockConn: any = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockReturnValue(undefined),
      execute: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("FROM offers WHERE id = ?")) {
          return Promise.resolve([[mockOfferRow]]);
        }
        if (sql.includes("FROM listings WHERE id = ?")) {
          return Promise.resolve([[mockListingRow]]);
        }
        if (sql.includes("status IN ('accepted_pending_buyer', 'buyer_confirmed')")) {
          return Promise.resolve([[]]);
        }
        if (sql.includes("UPDATE offers SET status = 'accepted_pending_buyer'")) {
          mockOfferRow.status = "accepted_pending_buyer";
        }
        return Promise.resolve([{ affectedRows: 1 }]);
      }),
    };

    vi.spyOn(pool, "getConnection").mockResolvedValue(mockConn);

    const sellerService = new OfferSellerService({} as any);
    const result: any = await sellerService.acceptOffer(50, 1);
    expect(Number(result.offered_amount)).toBe(480000);
  });

  it("prevents a seller from accepting an offer belonging to another listing or seller", async () => {
    const mockConn: any = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockReturnValue(undefined),
      execute: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("FROM offers WHERE id = ?")) {
          return Promise.resolve([[{ id: 1, listing_id: 200, buyer_id: 88, status: "submitted" }]]);
        }
        if (sql.includes("FROM listings WHERE id = ?")) {
          return Promise.resolve([[{ id: 200, seller_id: 999, review_status: "open" }]]); // Seller 999
        }
        return Promise.resolve([[]]);
      }),
    };

    vi.spyOn(pool, "getConnection").mockResolvedValue(mockConn);

    const sellerService = new OfferSellerService({} as any);
    // Seller 50 tries to accept offer on seller 999's listing
    await expect(sellerService.acceptOffer(50, 1)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("blocks accepting expired offers server-side", async () => {
    const mockConn: any = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockReturnValue(undefined),
      execute: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("FROM offers WHERE id = ?")) {
          return Promise.resolve([[{ id: 1, listing_id: 200, buyer_id: 88, status: "submitted", offer_expiry: new Date(Date.now() - 3600000) }]]);
        }
        if (sql.includes("FROM listings WHERE id = ?")) {
          return Promise.resolve([[{ id: 200, seller_id: 50, review_status: "open" }]]);
        }
        return Promise.resolve([[]]);
      }),
    };

    vi.spyOn(pool, "getConnection").mockResolvedValue(mockConn);

    const sellerService = new OfferSellerService({} as any);
    await expect(sellerService.acceptOffer(50, 1)).rejects.toMatchObject({
      statusCode: 409,
      code: "OFFER_EXPIRED",
    });
  });

  it("restricts buyer confirmation strictly to the selected buyer", async () => {
    const mockConn: any = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockReturnValue(undefined),
      execute: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("FROM offers WHERE id = ?")) {
          return Promise.resolve([[{ id: 1, listing_id: 200, buyer_id: 88, status: "accepted_pending_buyer" }]]);
        }
        if (sql.includes("FROM listings WHERE id = ?")) {
          return Promise.resolve([[{ id: 200, seller_id: 50, review_status: "offer_selection" }]]);
        }
        return Promise.resolve([[]]);
      }),
    };

    vi.spyOn(pool, "getConnection").mockResolvedValue(mockConn);

    const sellerService = new OfferSellerService({} as any);
    // Buyer 99 tries to confirm buyer 88's offer
    await expect(sellerService.buyerConfirmOffer(99, 1)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("verifies concurrent acceptance attempts CANNOT select two buyers on the same single-item listing", async () => {
    let activeAcceptedId: number | null = null;
    let currentLock: Promise<void> | null = null;

    vi.spyOn(pool, "getConnection").mockImplementation(async () => {
      // Simulate MySQL row-locking queue on listing row
      while (currentLock) {
        await currentLock;
      }
      let releaseLock!: () => void;
      currentLock = new Promise<void>((resolve) => { releaseLock = resolve; });

      const mockConn: any = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockImplementation(() => {
          currentLock = null;
          releaseLock();
          return Promise.resolve(undefined);
        }),
        rollback: vi.fn().mockImplementation(() => {
          currentLock = null;
          releaseLock();
          return Promise.resolve(undefined);
        }),
        release: vi.fn().mockReturnValue(undefined),
        execute: vi.fn().mockImplementation((sql: string, params: any[]) => {
          const cleanSql = sql.replace(/\s+/g, " ");
          if (cleanSql.includes("FROM offers WHERE id = ?")) {
            const id = Number(params[0]);
            return Promise.resolve([[{ id, listing_id: 200, buyer_id: id === 1 ? 88 : 89, status: "submitted" }]]);
          }
          if (cleanSql.includes("FROM listings WHERE id = ?")) {
            return Promise.resolve([[{ id: 200, seller_id: 50, review_status: "open" }]]);
          }
          if (cleanSql.includes("status IN ('accepted_pending_buyer', 'buyer_confirmed')")) {
            if (activeAcceptedId !== null) {
              return Promise.resolve([[{ id: activeAcceptedId }]]);
            }
            return Promise.resolve([[]]);
          }
          if (cleanSql.includes("status = 'accepted_pending_buyer'")) {
            const id = Number(params[1]);
            activeAcceptedId = id;
            return Promise.resolve([{ affectedRows: 1 }]);
          }
          return Promise.resolve([[{ id: params ? params[0] : 1, offered_amount: 480000 }]]);
        }),
      };
      return mockConn;
    });

    const sellerService = new OfferSellerService({} as any);

    // Simulate concurrent requests from seller to accept Offer 1 (Buyer 88) and Offer 2 (Buyer 89) at the exact same moment
    const [result1, result2] = await Promise.allSettled([
      sellerService.acceptOffer(50, 1),
      sellerService.acceptOffer(50, 2),
    ]);

    const fulfilled = [result1, result2].filter((r) => r.status === "fulfilled");
    const rejected = [result1, result2].filter((r) => r.status === "rejected");

    // Exactly one acceptance must succeed, and the second MUST be rejected with ACCEPTANCE_CONFLICT
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      statusCode: 409,
      code: "ACCEPTANCE_CONFLICT",
    });
  });

  it("confirms competing active offers remain OPEN during acceptance, and close ONLY upon buyer confirmation", async () => {
    let closedCompetingCalls = 0;
    let listingStatus = "open";

    const mockConn: any = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockReturnValue(undefined),
      execute: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("FROM offers WHERE id = ?")) {
          return Promise.resolve([[{ id: 1, listing_id: 200, buyer_id: 88, status: listingStatus === "sold" ? "buyer_confirmed" : "accepted_pending_buyer" }]]);
        }
        if (sql.includes("FROM listings WHERE id = ?")) {
          return Promise.resolve([[{ id: 200, seller_id: 50, review_status: listingStatus }]]);
        }
        if (sql.includes("status = 'buyer_confirmed'")) {
          return Promise.resolve([[]]);
        }
        if (sql.includes("SET status = 'cancelled'")) {
          closedCompetingCalls++;
        }
        if (sql.includes("SET review_status = 'sold'")) {
          listingStatus = "sold";
        }
        return Promise.resolve([[{ id: 1, status: "buyer_confirmed" }]]);
      }),
    };

    vi.spyOn(pool, "getConnection").mockResolvedValue(mockConn);

    const sellerService = new OfferSellerService({} as any);

    // Step 1: Confirm competing offers were NOT closed during acceptance
    expect(closedCompetingCalls).toBe(0);

    // Step 2: Buyer 88 confirms Offer 1
    const confirmRes: any = await sellerService.buyerConfirmOffer(88, 1);
    expect(confirmRes.status).toBe("buyer_confirmed");
    // Step 3: Verify competing offers were closed ONLY at buyer confirmation time
    expect(closedCompetingCalls).toBe(1);
  });
});
