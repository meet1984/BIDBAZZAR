import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/database/pool.js";
import { signAccessToken } from "../src/shared/tokens.js";
import { sweepMultiUnitExpiries } from "../src/jobs/multi-unit-sweeper.js";

describe("Phase 7 — Multi-Unit Offer Comprehensive E2E Workflow Test Suite", () => {
  let sellerId: number;
  let sellerToken: string;
  let buyer1Token: string;
  let buyer2Token: string;
  let buyer3Token: string;
  let categoryId: number;
  let listingId: number;

  let buyer1OfferId: number;
  let buyer1AllocationId: number;
  const e2eBuyerIds: number[] = [];

  beforeAll(async () => {
    // 1. Create seller account in DB with verified profile
    const [sRes] = await pool.execute<any>(
      `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
       VALUES (?, 'hash', 'E2E Seller', 'seller', 'active', NOW())`,
      [`e2e_seller_${Date.now()}@test.com`],
    );
    sellerId = Number(sRes.insertId);

    await pool.execute(
      `INSERT INTO seller_profiles (account_id, seller_name, legal_name, business_name, seller_type, verification_status)
       VALUES (?, 'E2E Seller Store', 'E2E Seller Legal', 'E2E Seller Store', 'business', 'verified')
       ON DUPLICATE KEY UPDATE verification_status = 'verified'`,
      [sellerId],
    );

    sellerToken = signAccessToken({
      id: sellerId,
      email: `e2e_seller_${sellerId}@test.com`,
      fullName: "E2E Seller",
      accountType: "seller",
      role: "seller",
      isBuyer: false,
      isSeller: true,
      isAdmin: false,
    });

    const createBuyer = async (index: number) => {
      const [bRes] = await pool.execute<any>(
        `INSERT INTO accounts (email, password_hash, full_name, account_type, status, accepted_terms_at)
         VALUES (?, 'hash', 'E2E Buyer ${index}', 'buyer', 'active', NOW())`,
        [`e2e_buyer${index}_${Date.now()}@test.com`],
      );
      const bId = Number(bRes.insertId);
      e2eBuyerIds.push(bId);

      await pool.execute(
        `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
         VALUES (?, 'E2E Buyer Legal', 'individual', 'verified')
         ON DUPLICATE KEY UPDATE verification_status = 'verified'`,
        [bId],
      );

      const token = signAccessToken({
        id: bId,
        email: `e2e_buyer${index}_${bId}@test.com`,
        fullName: `E2E Buyer ${index}`,
        accountType: "buyer",
        role: "buyer",
        isBuyer: true,
        isSeller: false,
        isAdmin: false,
      });

      return token;
    };

    buyer1Token = await createBuyer(1);
    buyer2Token = await createBuyer(2);
    buyer3Token = await createBuyer(3);

    const [catRows] = await pool.query<any[]>("SELECT id FROM categories LIMIT 1");
    categoryId = catRows[0].id;
  });

  afterAll(async () => {
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    if (listingId) {
      await pool.execute("DELETE FROM multi_unit_allocations WHERE listing_id = ?", [listingId]);
      await pool.execute("DELETE FROM multi_unit_offers WHERE listing_id = ?", [listingId]);
      await pool.execute("DELETE FROM listings WHERE id = ?", [listingId]);
    }
    if (sellerId) {
      await pool.execute("DELETE FROM seller_profiles WHERE account_id = ?", [sellerId]);
      await pool.execute("DELETE FROM accounts WHERE id = ?", [sellerId]);
    }
    if (e2eBuyerIds.length > 0) {
      const placeholders = e2eBuyerIds.map(() => "?").join(",");
      await pool.execute(`DELETE FROM buyer_profiles WHERE account_id IN (${placeholders})`, e2eBuyerIds);
      await pool.execute(`DELETE FROM accounts WHERE id IN (${placeholders})`, e2eBuyerIds);
    }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  });

  it("1. Seller creates a Multi-unit Offer listing with full inventory & private floor price config", async () => {
    const startTime = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    const endTime = new Date(Date.now() + 10 * 86400 * 1000).toISOString();

    const res = await request(app)
      .post("/api/seller/listings")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        title: "E2E Multi-unit Wholesale Electronics",
        description: "100 boxes of high quality components lot sale.",
        categoryId,
        saleMode: "multi_unit_offer",
        condition: "new",
        location: "Mumbai Port Warehouse",
        askingPrice: 150000,
        currency: "INR",
        askingPricePerUnit: 1500,
        totalQuantity: 100,
        unitName: "box",
        minOrderQuantity: 10,
        maxOrderQuantity: 50,
        quantityIncrement: 5,
        allowPartialAllocation: true,
        minAcceptableUnitPrice: 1200,
        buyerConfirmationDeadlineHours: 48,
        startTime,
        endTime,
      });

    expect(res.status).toBe(201);
    expect(res.body.listing).toBeDefined();
    listingId = res.body.listing.id;
    expect(listingId).toBeGreaterThan(0);

    // Auto-approve and make active for testing
    await pool.execute(
      "UPDATE listings SET review_status = 'approved', start_time = UTC_TIMESTAMP() - INTERVAL 1 HOUR WHERE id = ?",
      [listingId],
    );
  });

  it("2. Privacy boundary test: minAcceptableUnitPrice present in seller DTO, but NEVER in public/buyer DTO", async () => {
    // Seller fetch (seller offers dashboard summary)
    const sellerRes = await request(app)
      .get(`/api/multi-unit-offers/seller/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(sellerRes.status).toBe(200);
    expect(sellerRes.body.minAcceptableUnitPrice).toBe(1200);

    // Unauthenticated public fetch
    const publicRes = await request(app).get(`/api/listings/${listingId}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.listing.minAcceptableUnitPrice).toBeUndefined();

    // Buyer fetch
    const buyerRes = await request(app)
      .get(`/api/listings/${listingId}`)
      .set("Authorization", `Bearer ${buyer1Token}`);
    expect(buyerRes.status).toBe(200);
    expect(buyerRes.body.listing.minAcceptableUnitPrice).toBeUndefined();
  });

  it("3. Multiple buyers submit multi-unit offers with server-side total value invariant calculation", async () => {
    // Buyer 1: 40 boxes @ ₹1400/unit
    const res1 = await request(app)
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .send({
        quantityRequested: 40,
        offeredPricePerUnit: 1400,
        preferredFulfilment: "shipping",
        buyerMessage: "Need fast dispatch",
      });

    expect(res1.status).toBe(201);
    expect(res1.body.offer.totalOfferValue).toBe(56000); // 40 * 1400
    buyer1OfferId = res1.body.offer.id;

    // Buyer 2: 30 boxes @ ₹1300/unit
    const res2 = await request(app)
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer2Token}`)
      .send({
        quantityRequested: 30,
        offeredPricePerUnit: 1300,
        preferredFulfilment: "collection",
      });

    expect(res2.status).toBe(201);
    expect(res2.body.offer.totalOfferValue).toBe(39000); // 30 * 1300

    // Buyer 3: 50 boxes @ ₹1100/unit (below private floor of 1200)
    const res3 = await request(app)
      .post(`/api/multi-unit-offers/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${buyer3Token}`)
      .send({
        quantityRequested: 50,
        offeredPricePerUnit: 1100,
        buyerMessage: "Low budget offer",
      });

    expect(res3.status).toBe(201);
    expect(res3.body.offer.totalOfferValue).toBe(55000); // 50 * 1100
  });

  it("4. Seller views received offers with complete inventory summary", async () => {
    const res = await request(app)
      .get(`/api/multi-unit-offers/seller/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalQuantity).toBe(100);
    expect(res.body.remainingInventory).toBe(100);
    expect(res.body.minAcceptableUnitPrice).toBe(1200);
    expect(res.body.offers).toHaveLength(3);
  });

  it("5. Seller partially allocates 30 boxes to Buyer 1 (out of 40 requested)", async () => {
    const res = await request(app)
      .post(`/api/multi-unit-offers/offers/${buyer1OfferId}/accept-partial`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ partialQuantity: 30 });

    expect(res.status).toBe(200);
    expect(res.body.allocation.allocatedQuantity).toBe(30);
    expect(res.body.allocation.status).toBe("reserved");
    buyer1AllocationId = res.body.allocation.allocationId;

    // Verify remaining inventory dropped from 100 to 70
    const sellerDashboard = await request(app)
      .get(`/api/multi-unit-offers/seller/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(sellerDashboard.body.remainingInventory).toBe(70);
  });

  it("6. Buyer 1 confirms allocated reservation", async () => {
    const res = await request(app)
      .post(`/api/multi-unit-offers/allocations/${buyer1AllocationId}/confirm`)
      .set("Authorization", `Bearer ${buyer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.allocation.status).toBe("confirmed");

    // Check Buyer 1's dashboard offers
    const buyerDashboard = await request(app)
      .get("/api/multi-unit-offers/my-offers")
      .set("Authorization", `Bearer ${buyer1Token}`);

    expect(buyerDashboard.status).toBe(200);
    const confirmedOffer = (buyerDashboard.body.items as Array<{ id: number; status: string }>).find(
      (o) => o.id === buyer1OfferId,
    );
    expect(confirmedOffer?.status).toBe("confirmed");
  });

  it("7. Sweeper execution verifies clean state without duplicate expiries or releases", async () => {
    const result = await sweepMultiUnitExpiries();
    expect(result.expiredOffersCount).toBe(0);
    expect(result.expiredReservationsCount).toBe(0);

    // Verify stock remains locked at 70
    const sellerDashboard = await request(app)
      .get(`/api/multi-unit-offers/seller/listings/${listingId}/offers`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(sellerDashboard.body.remainingInventory).toBe(70);
  });
});
