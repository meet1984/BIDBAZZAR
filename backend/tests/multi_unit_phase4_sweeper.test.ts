import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../src/database/pool.js";
import { sweepMultiUnitExpiries } from "../src/jobs/multi-unit-sweeper.js";

describe("Phase 4 — Multi-Unit Idempotent Scheduled Background Sweeper Test Suite", () => {
  let sellerId: number;
  let buyer1Id: number;
  let buyer2Id: number;
  let categoryId: number;
  let expiredOfferListingId: number;
  let expiredAllocListingId: number;

  beforeAll(async () => {
    // Seed test seller & buyers
    const [sRes] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Sweeper Seller', 'seller', 'active', NOW())`,
      [`sweep_seller_${Date.now()}@test.com`],
    );
    sellerId = Number(sRes.insertId);

    const [b1Res] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Sweeper Buyer 1', 'buyer', 'active', NOW())`,
      [`sweep_buyer1_${Date.now()}@test.com`],
    );
    buyer1Id = Number(b1Res.insertId);

    const [b2Res] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Sweeper Buyer 2', 'buyer', 'active', NOW())`,
      [`sweep_buyer2_${Date.now()}@test.com`],
    );
    buyer2Id = Number(b2Res.insertId);

    const [catRows] = await pool.query<any[]>("SELECT id FROM categories LIMIT 1");
    categoryId = catRows[0].id;
  });

  it("1. Idempotently expires overdue offers and reserved allocations", async () => {
    // 1. Setup listing for expired offer test
    const [l1Res] = await pool.execute<any>(
      `INSERT INTO listings
        (seller_id, category_id, sale_mode, title, description, \`condition\`, location, asking_price,
         currency, start_time, end_time, public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity, quantity_increment, allow_partial_allocation)
       VALUES (?, ?, 'multi_unit_offer', 'Expired Offer Test Lot', 'Test expiry', 'new', 'Mumbai',
               1000, 'INR', UTC_TIMESTAMP() - INTERVAL 2 DAY, UTC_TIMESTAMP() + INTERVAL 5 DAY,
               ?, ?, 'approved', 10, 'box', 100, 1, 10, 1, TRUE)`,
      [sellerId, categoryId, `slug-exp1-${Date.now()}`, `LOT-EXP1-${Date.now()}`],

    );
    expiredOfferListingId = Number(l1Res.insertId);

    // Insert an offer that has expired (offer_expiry in the past)
    const [off1Res] = await pool.execute<any>(
      `INSERT INTO multi_unit_offers
        (listing_id, buyer_id, quantity_requested, offered_price_per_unit, total_offer_value, offer_expiry, status)
       VALUES (?, ?, 5, 90, 450, UTC_TIMESTAMP() - INTERVAL 1 HOUR, 'submitted')`,
      [expiredOfferListingId, buyer1Id],
    );
    const expiredOfferId = Number(off1Res.insertId);

    // 2. Setup listing for expired reservation test
    const [l2Res] = await pool.execute<any>(
      `INSERT INTO listings
        (seller_id, category_id, sale_mode, title, description, \`condition\`, location, asking_price,
         currency, start_time, end_time, public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity, quantity_increment, allow_partial_allocation)
       VALUES (?, ?, 'multi_unit_offer', 'Expired Reservation Test Lot', 'Test reservation expiry', 'new', 'Mumbai',
               1000, 'INR', UTC_TIMESTAMP() - INTERVAL 2 DAY, UTC_TIMESTAMP() + INTERVAL 5 DAY,
               ?, ?, 'approved', 10, 'box', 100, 1, 10, 1, TRUE)`,
      [sellerId, categoryId, `slug-exp2-${Date.now()}`, `LOT-EXP2-${Date.now()}`],
    );
    expiredAllocListingId = Number(l2Res.insertId);

    const [off2Res] = await pool.execute<any>(
      `INSERT INTO multi_unit_offers
        (listing_id, buyer_id, quantity_requested, offered_price_per_unit, total_offer_value, status)
       VALUES (?, ?, 6, 95, 570, 'allocation_reserved')`,
      [expiredAllocListingId, buyer2Id],
    );
    const offer2Id = Number(off2Res.insertId);

    // Insert allocation with reserved_until in the past
    const [allocRes] = await pool.execute<any>(
      `INSERT INTO multi_unit_allocations
        (offer_id, listing_id, buyer_id, allocated_quantity, unit_price, total_allocation_value, status, reserved_until)
       VALUES (?, ?, ?, 6, 95, 570, 'reserved', UTC_TIMESTAMP() - INTERVAL 30 MINUTE)`,
      [offer2Id, expiredAllocListingId, buyer2Id],
    );
    const expiredAllocId = Number(allocRes.insertId);

    // --- EXECUTE SWEEPER RUN #1 ---
    const run1 = await sweepMultiUnitExpiries();

    expect(run1.expiredOffersCount).toBeGreaterThanOrEqual(1);
    expect(run1.expiredReservationsCount).toBeGreaterThanOrEqual(1);

    // Verify DB state after Run 1
    const [off1Rows] = await pool.query<any[]>("SELECT status FROM multi_unit_offers WHERE id = ?", [expiredOfferId]);
    expect(off1Rows[0].status).toBe("expired");

    const [allocRows] = await pool.query<any[]>("SELECT status FROM multi_unit_allocations WHERE id = ?", [expiredAllocId]);
    expect(allocRows[0].status).toBe("expired");

    const [off2Rows] = await pool.query<any[]>("SELECT status FROM multi_unit_offers WHERE id = ?", [offer2Id]);
    expect(off2Rows[0].status).toBe("expired");

    // --- IDEMPOTENCY EXECUTION RUN #2 ---
    // Running the job a second time on the same dataset MUST produce no new state changes!
    const run2 = await sweepMultiUnitExpiries();

    expect(run2.expiredOffersCount).toBe(0);
    expect(run2.expiredReservationsCount).toBe(0);
    expect(run2.closedListingsCount).toBe(0);

    // Verify DB state remains identical
    const [off1RowsR2] = await pool.query<any[]>("SELECT status FROM multi_unit_offers WHERE id = ?", [expiredOfferId]);
    expect(off1RowsR2[0].status).toBe("expired");

    const [allocRowsR2] = await pool.query<any[]>("SELECT status FROM multi_unit_allocations WHERE id = ?", [expiredAllocId]);
    expect(allocRowsR2[0].status).toBe("expired");
  });

  afterAll(async () => {
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    const listingIds = [expiredOfferListingId, expiredAllocListingId].filter(Boolean);
    if (listingIds.length > 0) {
      const lHolders = listingIds.map(() => "?").join(",");
      await pool.execute(`DELETE FROM multi_unit_allocations WHERE listing_id IN (${lHolders})`, listingIds);
      await pool.execute(`DELETE FROM multi_unit_offers WHERE listing_id IN (${lHolders})`, listingIds);
      await pool.execute(`DELETE FROM listings WHERE id IN (${lHolders})`, listingIds);
    }
    const accountIds = [sellerId, buyer1Id, buyer2Id].filter(Boolean);
    if (accountIds.length > 0) {
      const aHolders = accountIds.map(() => "?").join(",");
      await pool.execute(`DELETE FROM buyer_profiles WHERE account_id IN (${aHolders})`, accountIds);
      await pool.execute(`DELETE FROM seller_profiles WHERE account_id IN (${aHolders})`, accountIds);
      await pool.execute(`DELETE FROM accounts WHERE id IN (${aHolders})`, accountIds);
    }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  });
});
