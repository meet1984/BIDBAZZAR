import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/database/pool.js";
import { signAccessToken } from "../src/shared/tokens.js";

const request = supertest(app);

describe("Phase 3 — Multi-Unit Seller Allocation & Real Concurrency Test Suite", () => {
  let seller1Token: string;
  let seller2Token: string;
  let buyer1Token: string;
  let buyer2Token: string;
  let seller1Id: number;
  let seller2Id: number;
  let buyer1Id: number;
  let buyer2Id: number;
  let categoryId: number;

  beforeAll(async () => {
    // 1. Create Seller 1
    const [s1Res] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Seller One', 'seller', 'active', NOW())`,
      [`seller1_${Date.now()}@test.com`],
    );
    seller1Id = Number(s1Res.insertId);
    await pool.execute(
      `INSERT INTO seller_profiles (account_id, seller_name, legal_name, business_name, seller_type, verification_status)
       VALUES (?, 'Seller 1 Store', 'Seller 1 Legal', 'Seller 1 Store', 'business', 'verified')`,
      [seller1Id],
    );
    seller1Token = signAccessToken({
      id: seller1Id,
      email: `seller1_${seller1Id}@test.com`,
      fullName: "Seller One",
      accountType: "seller",
      role: "seller",
      isBuyer: false,
      isSeller: true,
      isAdmin: false,
    });

    // 2. Create Seller 2 (Unauthorized attacker for seller 1's listing)
    const [s2Res] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Seller Two', 'seller', 'active', NOW())`,
      [`seller2_${Date.now()}@test.com`],
    );
    seller2Id = Number(s2Res.insertId);
    await pool.execute(
      `INSERT INTO seller_profiles (account_id, seller_name, legal_name, business_name, seller_type, verification_status)
       VALUES (?, 'Seller 2 Store', 'Seller 2 Legal', 'Seller 2 Store', 'business', 'verified')`,
      [seller2Id],
    );
    seller2Token = signAccessToken({
      id: seller2Id,
      email: `seller2_${seller2Id}@test.com`,
      fullName: "Seller Two",
      accountType: "seller",
      role: "seller",
      isBuyer: false,
      isSeller: true,
      isAdmin: false,
    });

    // 3. Create Buyer 1
    const [b1Res] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Buyer One', 'buyer', 'active', NOW())`,
      [`buyer1_${Date.now()}@test.com`],
    );
    buyer1Id = Number(b1Res.insertId);
    await pool.execute(
      `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
       VALUES (?, 'Buyer 1 Legal', 'individual', 'verified')`,
      [buyer1Id],
    );
    buyer1Token = signAccessToken({
      id: buyer1Id,
      email: `buyer1_${buyer1Id}@test.com`,
      fullName: "Buyer One",
      accountType: "buyer",
      role: "buyer",
      isBuyer: true,
      isSeller: false,
      isAdmin: false,
    });

    // 4. Create Buyer 2
    const [b2Res] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Buyer Two', 'buyer', 'active', NOW())`,
      [`buyer2_${Date.now()}@test.com`],
    );
    buyer2Id = Number(b2Res.insertId);
    await pool.execute(
      `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
       VALUES (?, 'Buyer 2 Legal', 'individual', 'verified')`,
      [buyer2Id],
    );
    buyer2Token = signAccessToken({
      id: buyer2Id,
      email: `buyer2_${buyer2Id}@test.com`,
      fullName: "Buyer Two",
      accountType: "buyer",
      role: "buyer",
      isBuyer: true,
      isSeller: false,
      isAdmin: false,
    });

    const [catRows] = await pool.query<any[]>("SELECT id FROM categories LIMIT 1");
    categoryId = catRows[0].id;
  });

  it("1. REAL CONCURRENT ALLOCATION TEST: Two parallel allocation attempts cannot oversell total stock", async () => {
    // Create listing with total_quantity = 10
    const [listingRes] = await pool.execute<any>(
      `INSERT INTO listings
        (seller_id, category_id, sale_mode, title, description, \`condition\`, location, asking_price,
         currency, start_time, end_time, offer_selection_deadline, public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity, quantity_increment, allow_partial_allocation)
       VALUES (?, ?, 'multi_unit_offer', 'Concurrent Stock Test Lot', 'Testing concurrent race conditions', 'new', 'Delhi',
               1000, 'INR', UTC_TIMESTAMP() - INTERVAL 1 HOUR, UTC_TIMESTAMP() + INTERVAL 5 DAY, NULL,
               ?, ?, 'approved', 10, 'box', 100, 1, 10, 1, TRUE)`,
      [seller1Id, categoryId, `slug-conc-${Date.now()}`, `LOT-CONC-${Date.now()}`],

    );
    const listingId = Number(listingRes.insertId);

    // Buyer 1 submits offer for 7 units
    const offer1Res = await request
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({ quantityRequested: 7, offeredPricePerUnit: 95 });
    expect(offer1Res.status).toBe(201);
    const offer1Id = offer1Res.body.offer.id;

    // Buyer 2 submits offer for 7 units
    const offer2Res = await request
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer2Token}`)
      .send({ quantityRequested: 7, offeredPricePerUnit: 90 });
    expect(offer2Res.status).toBe(201);
    const offer2Id = offer2Res.body.offer.id;

    // SIMULTANEOUS ALLOCATION RACES (7 + 7 = 14 > 10 stock)
    const [res1, res2] = await Promise.all([
      request
        .post(`/api/multi-unit-offers/offers/${offer1Id}/accept-full`)
        .set("Authorization", `Bearer ${seller1Token}`),
      request
        .post(`/api/multi-unit-offers/offers/${offer2Id}/accept-full`)
        .set("Authorization", `Bearer ${seller1Token}`),
    ]);

    const statuses = [res1.status, res2.status];
    // CRITICAL CONCURRENCY INVARIANT CHECK: Exactly one 200, exactly one 409
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const failedRes = res1.status === 409 ? res1 : res2;
    expect(failedRes.body.code).toBe("INSUFFICIENT_INVENTORY");

    // Verify DB state: Total allocated stock must NEVER exceed 10
    const [allocRows] = await pool.query<any[]>(
      `SELECT SUM(allocated_quantity) AS total FROM multi_unit_allocations WHERE listing_id = ? AND status IN ('reserved', 'confirmed')`,
      [listingId],
    );
    expect(Number(allocRows[0].total)).toBe(7);
  });

  it("2. Partial allocation enforces listing allowPartialAllocation policy", async () => {
    // Create listing with allow_partial_allocation = false
    const [noPartialListing] = await pool.execute<any>(
      `INSERT INTO listings
        (seller_id, category_id, sale_mode, title, description, \`condition\`, location, asking_price,
         currency, start_time, end_time, offer_selection_deadline, public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity, quantity_increment, allow_partial_allocation)
       VALUES (?, ?, 'multi_unit_offer', 'Strict Lot No Partial', 'No partial allowed', 'new', 'Delhi',
               1000, 'INR', UTC_TIMESTAMP() - INTERVAL 1 HOUR, UTC_TIMESTAMP() + INTERVAL 5 DAY, NULL,
               ?, ?, 'approved', 10, 'box', 100, 1, 10, 1, FALSE)`,
      [seller1Id, categoryId, `slug-nopartial-${Date.now()}`, `LOT-NOPARTIAL-${Date.now()}`],
    );
    const noPartialId = Number(noPartialListing.insertId);

    const offerRes = await request
      .post(`/api/multi-unit-offers/listings/${noPartialId}/offers`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({ quantityRequested: 8, offeredPricePerUnit: 100 });
    const offerId = offerRes.body.offer.id;

    const res = await request
      .post(`/api/multi-unit-offers/offers/${offerId}/accept-partial`)
      .set("Authorization", `Bearer ${seller1Token}`)
      .send({ partialQuantity: 4 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("PARTIAL_ALLOCATION_NOT_ALLOWED");
  });

  it("3. Unauthorized seller cannot allocate another seller's listing", async () => {
    const [listingRes] = await pool.execute<any>(
      `INSERT INTO listings
        (seller_id, category_id, sale_mode, title, description, \`condition\`, location, asking_price,
         currency, start_time, end_time, offer_selection_deadline, public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity, quantity_increment, allow_partial_allocation)
       VALUES (?, ?, 'multi_unit_offer', 'Seller One Lot', 'Seller one description', 'new', 'Delhi',
               1000, 'INR', UTC_TIMESTAMP() - INTERVAL 1 HOUR, UTC_TIMESTAMP() + INTERVAL 5 DAY, NULL,
               ?, ?, 'approved', 10, 'box', 100, 1, 10, 1, TRUE)`,
      [seller1Id, categoryId, `slug-s1-${Date.now()}`, `LOT-S1-${Date.now()}`],
    );
    const listingId = Number(listingRes.insertId);

    const offerRes = await request
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({ quantityRequested: 5, offeredPricePerUnit: 100 });
    const offerId = offerRes.body.offer.id;

    // Seller 2 attempts to allocate Seller 1's listing -> FORBIDDEN
    const res = await request
      .post(`/api/multi-unit-offers/offers/${offerId}/accept-full`)
      .set("Authorization", `Bearer ${seller2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("4. Buyer cannot confirm another buyer's allocation", async () => {
    const [listingRes] = await pool.execute<any>(
      `INSERT INTO listings
        (seller_id, category_id, sale_mode, title, description, \`condition\`, location, asking_price,
         currency, start_time, end_time, offer_selection_deadline, public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity, quantity_increment, allow_partial_allocation)
       VALUES (?, ?, 'multi_unit_offer', 'Buyer Auth Test Lot', 'Testing buyer auth', 'new', 'Delhi',
               1000, 'INR', UTC_TIMESTAMP() - INTERVAL 1 HOUR, UTC_TIMESTAMP() + INTERVAL 5 DAY, NULL,
               ?, ?, 'approved', 10, 'box', 100, 1, 10, 1, TRUE)`,
      [seller1Id, categoryId, `slug-bauth-${Date.now()}`, `LOT-BAUTH-${Date.now()}`],
    );
    const listingId = Number(listingRes.insertId);

    const offerRes = await request
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({ quantityRequested: 5, offeredPricePerUnit: 100 });
    const offerId = offerRes.body.offer.id;

    const allocRes = await request
      .post(`/api/multi-unit-offers/offers/${offerId}/accept-full`)
      .set("Authorization", `Bearer ${seller1Token}`);

    const allocationId = allocRes.body.allocation.allocationId;

    // Buyer 2 attempts to confirm Buyer 1's allocation -> FORBIDDEN
    const confirmRes = await request
      .post(`/api/multi-unit-offers/allocations/${allocationId}/confirm`)
      .set("Authorization", `Bearer ${buyer2Token}`);

    expect(confirmRes.status).toBe(403);
    expect(confirmRes.body.code).toBe("FORBIDDEN");

    // Buyer 1 confirms own allocation -> SUCCESS
    const validConfirm = await request
      .post(`/api/multi-unit-offers/allocations/${allocationId}/confirm`)
      .set("Authorization", `Bearer ${buyer1Token}`);

    expect(validConfirm.status).toBe(200);
    expect(validConfirm.body.allocation.status).toBe("confirmed");
  });

  it("5. Sold-out listing (0 remaining stock) rejects new buyer offers", async () => {
    const [listingRes] = await pool.execute<any>(
      `INSERT INTO listings
        (seller_id, category_id, sale_mode, title, description, \`condition\`, location, asking_price,
         currency, start_time, end_time, offer_selection_deadline, public_slug, listing_reference, review_status,
         total_quantity, unit_name, asking_price_per_unit, min_order_quantity, max_order_quantity, quantity_increment, allow_partial_allocation)
       VALUES (?, ?, 'multi_unit_offer', 'Small Inventory Lot', 'Only 3 units', 'new', 'Delhi',
               1000, 'INR', UTC_TIMESTAMP() - INTERVAL 1 HOUR, UTC_TIMESTAMP() + INTERVAL 5 DAY, NULL,
               ?, ?, 'approved', 3, 'box', 100, 1, 3, 1, TRUE)`,
      [seller1Id, categoryId, `slug-soldout-${Date.now()}`, `LOT-SOLDOUT-${Date.now()}`],
    );

    const listingId = Number(listingRes.insertId);

    const offerRes = await request
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({ quantityRequested: 3, offeredPricePerUnit: 100 });
    const offerId = offerRes.body.offer.id;

    // Seller allocates all 3 units (100% of stock)
    await request
      .post(`/api/multi-unit-offers/offers/${offerId}/accept-full`)
      .set("Authorization", `Bearer ${seller1Token}`);

    // Verify listing reviewStatus is updated to 'sold'
    const [rows] = await pool.query<any[]>("SELECT review_status FROM listings WHERE id = ?", [listingId]);
    expect(rows[0].review_status).toBe("sold");

    // Buyer 2 attempts to submit new offer on sold-out listing -> 409 LISTING_NOT_LIVE
    const newOfferRes = await request
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer2Token}`)
      .send({ quantityRequested: 1, offeredPricePerUnit: 100 });

    expect(newOfferRes.status).toBe(409);
    expect(newOfferRes.body.code).toBe("LISTING_NOT_LIVE");
  });

  afterAll(async () => {
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    const accountIds = [seller1Id, seller2Id, buyer1Id, buyer2Id].filter(Boolean);
    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => "?").join(",");
      await pool.execute(
        `DELETE FROM multi_unit_allocations WHERE listing_id IN (SELECT id FROM listings WHERE seller_id IN (${placeholders})) OR buyer_id IN (${placeholders})`,
        [...accountIds, ...accountIds],
      );
      await pool.execute(
        `DELETE FROM multi_unit_offers WHERE listing_id IN (SELECT id FROM listings WHERE seller_id IN (${placeholders})) OR buyer_id IN (${placeholders})`,
        [...accountIds, ...accountIds],
      );
      await pool.execute(`DELETE FROM listings WHERE seller_id IN (${placeholders})`, accountIds);
      await pool.execute(`DELETE FROM buyer_profiles WHERE account_id IN (${placeholders})`, accountIds);
      await pool.execute(`DELETE FROM seller_profiles WHERE account_id IN (${placeholders})`, accountIds);
      await pool.execute(`DELETE FROM accounts WHERE id IN (${placeholders})`, accountIds);
    }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  });
});
