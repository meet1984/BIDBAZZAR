import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/database/pool.js";
import { signAccessToken } from "../src/shared/tokens.js";

const request = supertest(app);

describe("Phase 2 — Multi-Unit Offer Seller Config & Buyer Submission", () => {
  let sellerToken: string;
  let buyerToken: string;
  let sellerAccountId: number;
  let buyerAccountId: number;
  let categoryId: number;
  let multiUnitListingId: number;
  let multiUnitPublicSlug: string;

  beforeAll(async () => {
    // 1. Create seller account in DB
    const [sellerRes] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Multi Unit Seller', 'seller', 'active', NOW())`,
      [`multi_seller_${Date.now()}@test.com`],
    );
    sellerAccountId = Number(sellerRes.insertId);

    await pool.execute(
      `INSERT INTO seller_profiles (account_id, seller_name, legal_name, business_name, seller_type, verification_status)
       VALUES (?, 'Multi Seller Store', 'Multi Seller Legal', 'Multi Seller Store', 'business', 'verified')
       ON DUPLICATE KEY UPDATE verification_status = 'verified'`,
      [sellerAccountId],
    );

    sellerToken = signAccessToken({
      id: sellerAccountId,
      email: `multi_seller_${sellerAccountId}@test.com`,
      fullName: "Multi Unit Seller",
      accountType: "seller",
      role: "seller",
      isBuyer: false,
      isSeller: true,
      isAdmin: false,
    });

    // 2. Create buyer account in DB
    const [buyerRes] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'Multi Unit Buyer', 'buyer', 'active', NOW())`,
      [`multi_buyer_${Date.now()}@test.com`],
    );
    buyerAccountId = Number(buyerRes.insertId);

    await pool.execute(
      `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
       VALUES (?, 'Multi Buyer Legal', 'individual', 'verified')
       ON DUPLICATE KEY UPDATE verification_status = 'verified'`,
      [buyerAccountId],
    );

    buyerToken = signAccessToken({
      id: buyerAccountId,
      email: `multi_buyer_${buyerAccountId}@test.com`,
      fullName: "Multi Unit Buyer",
      accountType: "buyer",
      role: "buyer",
      isBuyer: true,
      isSeller: false,
      isAdmin: false,
    });

    // 3. Get category ID
    const [catRows] = await pool.query<any[]>("SELECT id FROM categories LIMIT 1");
    categoryId = catRows[0].id;
  });

  it("1. Seller creates a valid multi-unit offer listing with private floor price", async () => {
    const startTime = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    const endTime = new Date(Date.now() + 10 * 86400 * 1000).toISOString();

    const res = await request
      .post("/api/seller/listings")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        categoryId,
        saleMode: "multi_unit_offer",
        title: "Bulk Industrial Bearings - Grade A",
        description: "High precision stainless steel ball bearings lot sale.",
        condition: "new",
        location: "Mumbai Port Warehouse",
        askingPrice: 5000,
        currency: "INR",
        startTime,
        endTime,
        totalQuantity: 100,
        unitName: "box",
        askingPricePerUnit: 50,
        minOrderQuantity: 5,
        maxOrderQuantity: 50,
        quantityIncrement: 5,
        allowPartialAllocation: true,
        minAcceptableUnitPrice: 40, // Private floor price
        buyerConfirmationDeadlineHours: 48,
      });

    expect(res.status).toBe(201);
    expect(res.body.listing).toBeDefined();
    expect(res.body.listing.saleMode).toBe("multi_unit_offer");
    expect(res.body.listing.totalQuantity).toBe(100);
    expect(res.body.listing.quantityIncrement).toBe(5);
    // Seller's own DTO shows minAcceptableUnitPrice
    expect(res.body.listing.minAcceptableUnitPrice).toBe(40);

    multiUnitListingId = res.body.listing.id;
    multiUnitPublicSlug = res.body.listing.publicSlug;

    // Approve & open listing in DB directly for testing
    await pool.execute(
      `UPDATE listings
       SET review_status = 'approved',
           start_time = UTC_TIMESTAMP() - INTERVAL 1 HOUR,
           end_time = UTC_TIMESTAMP() + INTERVAL 5 DAY,
           offer_start_time = UTC_TIMESTAMP() - INTERVAL 1 HOUR,
           offer_end_time = UTC_TIMESTAMP() + INTERVAL 5 DAY
       WHERE id = ?`,
      [multiUnitListingId],
    );


  });

  it("2. CONFIRMS private floor price (minAcceptableUnitPrice) is NEVER exposed in public API response", async () => {
    const res = await request.get(`/api/listings/${multiUnitPublicSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.listing).toBeDefined();
    expect(res.body.listing.totalQuantity).toBe(100);
    expect(res.body.listing.askingPricePerUnit).toBe(50);
    // CRITICAL SECURITY ASSERTION
    expect(res.body.listing.minAcceptableUnitPrice).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('"minAcceptableUnitPrice"');
  });

  it("3. Rejects buyer offer with invalid quantity increment", async () => {
    const res = await request
      .post(`/api/multi-unit-offers/listings/${multiUnitListingId}/offers`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        quantityRequested: 7, // Min is 5, increment is 5 -> 7 is invalid!
        offeredPricePerUnit: 45,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("INVALID_QUANTITY_INCREMENT");
  });

  it("4. Rejects buyer offer with quantity below minimum or above maximum", async () => {
    const resBelow = await request
      .post(`/api/multi-unit-offers/listings/${multiUnitListingId}/offers`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        quantityRequested: 2, // Below minOrderQuantity of 5
        offeredPricePerUnit: 45,
      });
    expect(resBelow.status).toBe(422);

    const resAbove = await request
      .post(`/api/multi-unit-offers/listings/${multiUnitListingId}/offers`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        quantityRequested: 60, // Above maxOrderQuantity of 50
        offeredPricePerUnit: 45,
      });
    expect(resAbove.status).toBe(422);
  });

  it("5. Rejects buyer offer with price having > 2 decimal places", async () => {
    const res = await request
      .post(`/api/multi-unit-offers/listings/${multiUnitListingId}/offers`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        quantityRequested: 10,
        offeredPricePerUnit: 45.999, // 3 decimal places -> invalid!
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("6. Successfully submits buyer offer and calculates total_offer_value server-side", async () => {
    const res = await request
      .post(`/api/multi-unit-offers/listings/${multiUnitListingId}/offers`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        quantityRequested: 20,
        offeredPricePerUnit: 48.5,
        buyerMessage: "Need 20 boxes for factory build.",
        preferredFulfilment: "shipping",
        // Client attempts to pass a fake total value — backend MUST ignore/override it!
        totalOfferValue: 1.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.offer).toBeDefined();
    expect(res.body.offer.quantityRequested).toBe(20);
    expect(res.body.offer.offeredPricePerUnit).toBe(48.5);
    // SERVER-SIDE CALCULATION VERIFICATION: 20 * 48.5 = 970
    expect(res.body.offer.totalOfferValue).toBe(970);
    expect(res.body.offer.status).toBe("submitted");
    // Ensure floor price is absent from offer response
    expect(res.body.offer.minAcceptableUnitPrice).toBeUndefined();
  });

  it("7. Rejects duplicate active offer submission from same buyer", async () => {
    const res = await request
      .post(`/api/multi-unit-offers/listings/${multiUnitListingId}/offers`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        quantityRequested: 10,
        offeredPricePerUnit: 45,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ACTIVE_OFFER_EXISTS");
  });

  it("8. Allows buyer to list their multi-unit offers", async () => {
    const res = await request
      .get("/api/multi-unit-offers/my-offers")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);

    const offer = res.body.items[0];
    expect(offer.listingTitle).toContain("Bulk Industrial Bearings");
    expect(offer.quantityRequested).toBe(20);
    expect(offer.totalOfferValue).toBe(970);
    expect(offer.minAcceptableUnitPrice).toBeUndefined();
  });

  afterAll(async () => {
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    if (multiUnitListingId) {
      await pool.execute("DELETE FROM multi_unit_allocations WHERE listing_id = ?", [multiUnitListingId]);
      await pool.execute("DELETE FROM multi_unit_offers WHERE listing_id = ?", [multiUnitListingId]);
      await pool.execute("DELETE FROM listing_images WHERE listing_id = ?", [multiUnitListingId]);
      await pool.execute("DELETE FROM listings WHERE id = ?", [multiUnitListingId]);
    }
    if (sellerAccountId) {
      await pool.execute("DELETE FROM seller_profiles WHERE account_id = ?", [sellerAccountId]);
      await pool.execute("DELETE FROM accounts WHERE id = ?", [sellerAccountId]);
    }
    if (buyerAccountId) {
      await pool.execute("DELETE FROM buyer_profiles WHERE account_id = ?", [buyerAccountId]);
      await pool.execute("DELETE FROM accounts WHERE id = ?", [buyerAccountId]);
    }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  });
});
