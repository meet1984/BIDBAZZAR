import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

vi.mock("../src/modules/auth/auth.repository.js", () => {
  const accounts: Record<number, any> = {
    10: { id: 10, accountType: "admin", fullName: "Admin User", email: "admin@test.com", status: "active" },
    20: { id: 20, accountType: "seller", fullName: "Verified Seller", email: "v_seller@test.com", status: "active" },
    21: { id: 21, accountType: "seller", fullName: "Unverified Seller", email: "u_seller@test.com", status: "active" },
    30: { id: 30, accountType: "buyer", fullName: "Buyer User", email: "buyer@test.com", status: "active" },
  };
  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => accounts[id] || null),
    },
  };
});

vi.mock("../src/modules/seller-profile/seller-profile.repository.js", () => {
  const sellerProfiles: Record<number, any> = {
    20: { accountId: 20, businessName: "Verified Tech Store", verificationStatus: "verified" },
    21: { accountId: 21, businessName: "Unverified Store", verificationStatus: "draft" },
  };
  return {
    sellerProfileRepository: {
      findByAccountId: vi.fn(async (id: number) => sellerProfiles[id] || null),
    },
  };
});

vi.mock("../src/modules/categories/category.repository.js", () => {
  return {
    categoryRepository: {
      findCategoryById: vi.fn(async (id: number) => ({ id, name: "Electronics", slug: "electronics", isActive: true })),
      findSubcategoryById: vi.fn(async (id: number) => ({ id, categoryId: 1, name: "Audio", slug: "audio", isActive: true })),
    },
  };
});

vi.mock("../src/modules/listings/listing.repository.js", () => {
  const listings: Record<number, any> = {
    100: {
      id: 100,
      sellerId: 20,
      categoryId: 1,
      subcategoryId: 1,
      saleMode: "negotiated_offer",
      title: "Vintage Camera Lot",
      description: "A wonderful collection of vintage 1980s film cameras",
      condition: "used",
      location: "Mumbai, MH",
      askingPrice: 15000,
      currency: "INR",
      startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 144 * 60 * 60 * 1000),
      offerSelectionDeadline: null,
      publicSlug: "vintage-camera-lot-100",
      listingReference: "LOT-100",
      reviewStatus: "draft",
      reviewNotes: "Internal note for seller: check lens condition.",
      version: 1,
      totalQuantity: null,
      unitName: null,
      askingPricePerUnit: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      quantityIncrement: 1,
      allowPartialAllocation: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      categoryName: "Electronics",
      categorySlug: "electronics",
      subcategoryName: "Audio",
      subcategorySlug: "audio",
      sellerName: "Verified Tech Store",
      publicDisplayStatus: "upcoming",
      isWatched: false,
    },
    200: {
      id: 200,
      sellerId: 20,
      categoryId: 1,
      subcategoryId: null,
      saleMode: "multi_unit_offer",
      title: "Bulk Wireless Headsets",
      description: "Brand new wireless headsets for wholesale",
      condition: "new",
      location: "Bengaluru, KA",
      askingPrice: 50000,
      currency: "INR",
      startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 144 * 60 * 60 * 1000),
      offerSelectionDeadline: null,
      publicSlug: "bulk-headsets-200",
      listingReference: "LOT-200",
      reviewStatus: "submitted",
      reviewNotes: null,
      version: 1,
      totalQuantity: 100,
      unitName: "box",
      askingPricePerUnit: 500,
      minOrderQuantity: 5,
      maxOrderQuantity: 50,
      quantityIncrement: 1,
      allowPartialAllocation: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      categoryName: "Electronics",
      categorySlug: "electronics",
      subcategoryName: null,
      subcategorySlug: null,
      sellerName: "Verified Tech Store",
      publicDisplayStatus: "upcoming",
      isWatched: false,
    },
    300: {
      id: 300,
      sellerId: 20,
      categoryId: 1,
      subcategoryId: null,
      saleMode: "negotiated_offer",
      title: "Live Running Listing",
      description: "This item is live right now for negotiated offers",
      condition: "like-new",
      location: "Delhi, DL",
      askingPrice: 20000,
      currency: "INR",
      startTime: new Date(Date.now() - 3600 * 1000),
      endTime: new Date(Date.now() + 86400 * 1000),
      offerSelectionDeadline: null,
      publicSlug: "live-running-listing-300",
      listingReference: "LOT-300",
      reviewStatus: "approved",
      reviewNotes: null,
      version: 1,
      totalQuantity: null,
      unitName: null,
      askingPricePerUnit: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      quantityIncrement: 1,
      allowPartialAllocation: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      categoryName: "Electronics",
      categorySlug: "electronics",
      subcategoryName: null,
      subcategorySlug: null,
      sellerName: "Verified Tech Store",
      publicDisplayStatus: "live",
      isWatched: false,
    },
    400: {
      id: 400,
      sellerId: 20,
      categoryId: 1,
      subcategoryId: null,
      saleMode: "negotiated_offer",
      title: "Completed Closed Listing",
      description: "This item is closed and completed",
      condition: "like-new",
      location: "Delhi, DL",
      askingPrice: 20000,
      currency: "INR",
      startTime: new Date(Date.now() - 360000 * 1000),
      endTime: new Date(Date.now() - 86400 * 1000),
      offerSelectionDeadline: null,
      publicSlug: "completed-listing-400",
      listingReference: "LOT-400",
      reviewStatus: "completed",
      reviewNotes: null,
      version: 1,
      totalQuantity: null,
      unitName: null,
      askingPricePerUnit: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      quantityIncrement: 1,
      allowPartialAllocation: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      categoryName: "Electronics",
      categorySlug: "electronics",
      subcategoryName: null,
      subcategorySlug: null,
      sellerName: "Verified Tech Store",
      publicDisplayStatus: "closed",
      isWatched: false,
    },
  };

  let nextId = 500;

  return {
    listingRepository: {
      listPublic: vi.fn(async () => ({
        items: Object.values(listings).filter((l) => ["approved", "scheduled", "open"].includes(l.reviewStatus)),
        total: 1,
        page: 1,
        pageSize: 12,
        totalPages: 1,
      })),

      findPublic: vi.fn(async (identifier: string) => {
        return Object.values(listings).find((l) => l.publicSlug === identifier || String(l.id) === identifier) || null;
      }),

      listSeller: vi.fn(async (sellerId: number) => {
        return Object.values(listings).filter((l) => l.sellerId === sellerId && !l.deletedAt);
      }),

      findOwned: vi.fn(async (id: number, sellerId: number) => {
        const item = listings[id];
        return item && item.sellerId === sellerId && !item.deletedAt ? item : null;
      }),

      findById: vi.fn(async (id: number) => {
        const item = listings[id];
        return item && !item.deletedAt ? item : null;
      }),

      create: vi.fn(async (sellerId: number, input: any) => {
        const id = ++nextId;
        listings[id] = {
          id,
          sellerId,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId || null,
          saleMode: input.saleMode || "negotiated_offer",
          title: input.title,
          description: input.description,
          condition: input.condition,
          location: input.location,
          askingPrice: input.askingPrice,
          currency: input.currency || "INR",
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          offerSelectionDeadline: null,
          publicSlug: `listing-slug-${id}`,
          listingReference: `LOT-${id}`,
          reviewStatus: "draft",
          reviewNotes: null,
          version: 1,
          totalQuantity: input.totalQuantity || null,
          unitName: input.unitName || null,
          askingPricePerUnit: input.askingPricePerUnit || null,
          minOrderQuantity: input.minOrderQuantity || null,
          maxOrderQuantity: input.maxOrderQuantity || null,
          quantityIncrement: input.quantityIncrement || 1,
          allowPartialAllocation: input.allowPartialAllocation ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          categoryName: "Electronics",
          categorySlug: "electronics",
          subcategoryName: null,
          subcategorySlug: null,
          sellerName: "Verified Tech Store",
          publicDisplayStatus: "upcoming",
          isWatched: false,
        };
        return id;
      }),

      update: vi.fn(async (id: number, input: any, resetReview = false) => {
        if (listings[id]) {
          listings[id] = { ...listings[id], ...input, updatedAt: new Date() };
          if (resetReview) listings[id].reviewStatus = "draft";
        }
      }),

      submit: vi.fn(async (id: number) => {
        if (listings[id]) listings[id].reviewStatus = "submitted";
      }),

      confirmChanges: vi.fn(async (id: number) => {
        if (listings[id] && listings[id].reviewStatus === "changes_requested") {
          listings[id].reviewStatus = "approved";
          return true;
        }
        return false;
      }),

      listAdmin: vi.fn(async () => Object.values(listings)),

      review: vi.fn(async (id: number, status: string, notes?: string) => {
        if (listings[id]) {
          listings[id].reviewStatus = status;
          listings[id].reviewNotes = notes || null;
          return true;
        }
        return false;
      }),

      updateAdminWithStatus: vi.fn(async (id: number, input: any, newStatus?: string, reviewNotes?: string) => {
        if (listings[id]) {
          listings[id] = { ...listings[id], ...input, updatedAt: new Date() };
          if (newStatus) listings[id].reviewStatus = newStatus;
          if (reviewNotes !== undefined) listings[id].reviewNotes = reviewNotes;
        }
      }),

      softDelete: vi.fn(async (id: number) => {
        if (listings[id]) listings[id].deletedAt = new Date();
      }),
    },
  };
});

vi.mock("../src/modules/listings/listing-audit.repository.js", () => {
  return {
    listingAuditRepository: {
      record: vi.fn(async () => 1),
      findByListingId: vi.fn(async () => []),
    },
  };
});

const adminToken = signAccessToken({ id: 10, accountType: "admin", email: "admin@test.com", fullName: "Admin User" });
const verifiedSellerToken = signAccessToken({ id: 20, accountType: "seller", email: "v_seller@test.com", fullName: "Verified Seller" });
const unverifiedSellerToken = signAccessToken({ id: 21, accountType: "seller", email: "u_seller@test.com", fullName: "Unverified Seller" });

describe("Phase 3 Listing Lifecycle & Review Workflow Test Suite", () => {
  it("1. Unverified seller is BLOCKED from creating or submitting listings", async () => {
    const createRes = await request(app)
      .post("/api/seller/listings")
      .set("Authorization", `Bearer ${unverifiedSellerToken}`)
      .send({
        saleMode: "negotiated_offer",
        categoryId: 1,
        title: "Unverified Item Title",
        description: "Listing description for unverified seller attempt",
        condition: "new",
        location: "Mumbai",
        askingPrice: 5000,
        startTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 144 * 60 * 60 * 1000).toISOString(),
      });

    expect(createRes.status).toBe(403);
    expect(createRes.body.code).toBe("VERIFICATION_REQUIRED");
  });

  it("2. Verified seller CAN create negotiated and multi-unit offer listings", async () => {
    // Multi-unit creation
    const res = await request(app)
      .post("/api/seller/listings")
      .set("Authorization", `Bearer ${verifiedSellerToken}`)
      .send({
        saleMode: "multi_unit_offer",
        categoryId: 1,
        title: "Wholesale Industrial Components",
        description: "Heavy duty industrial components available for bulk purchase",
        condition: "new",
        location: "Pune, MH",
        askingPrice: 100000,
        startTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 144 * 60 * 60 * 1000).toISOString(),
        totalQuantity: 200,
        unitName: "piece",
        askingPricePerUnit: 500,
        minOrderQuantity: 10,
        maxOrderQuantity: 100,
        quantityIncrement: 5,
        allowPartialAllocation: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.listing.saleMode).toBe("multi_unit_offer");
    expect(res.body.listing.totalQuantity).toBe(200);
  });

  it("3. Validates multi-unit specific fields (rejects totalQuantity <= 0)", async () => {
    const res = await request(app)
      .post("/api/seller/listings")
      .set("Authorization", `Bearer ${verifiedSellerToken}`)
      .send({
        saleMode: "multi_unit_offer",
        categoryId: 1,
        title: "Invalid Multi Unit Listing",
        description: "Description long enough to pass validation check",
        condition: "new",
        location: "Delhi",
        askingPrice: 5000,
        startTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 144 * 60 * 60 * 1000).toISOString(),
        totalQuantity: 0, // Invalid
        askingPricePerUnit: 100,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("4. Closed and completed listings CANNOT be edited by seller", async () => {
    // Listing #400 is in 'closed' / 'completed' review status
    const editRes = await request(app)
      .patch("/api/seller/listings/400")
      .set("Authorization", `Bearer ${verifiedSellerToken}`)
      .send({
        title: "Trying to edit completed listing",
      });

    expect(editRes.status).toBe(409);
    expect(editRes.body.code).toBe("LISTING_NOT_EDITABLE");
  });

  it("5. Admin review workflow requires mandatory reason for reject and request_changes", async () => {
    // Attempt rejection without reason
    const rejectNoReason = await request(app)
      .patch("/api/admin/listings/200/review")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "reject",
        reason: "",
      });

    expect(rejectNoReason.status).toBe(422);
    expect(rejectNoReason.body.code).toBe("VALIDATION_ERROR");

    // Rejection with mandatory reason succeeds
    const rejectSuccess = await request(app)
      .patch("/api/admin/listings/200/review")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "reject",
        reason: "Item photos do not match description clearly.",
      });

    expect(rejectSuccess.status).toBe(200);
    expect(rejectSuccess.body.listing.reviewStatus).toBe("rejected");
  });

  it("6. Admin CAN update listings and modify specifications whatever the status", async () => {
    // Listing #300 has publicDisplayStatus = 'live'
    const adminEditRes = await request(app)
      .patch("/api/admin/listings/300")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        askingPrice: 99999,
        reviewStatus: "approved",
      });

    expect(adminEditRes.status).toBe(200);
    expect(adminEditRes.body.listing).toBeDefined();
    expect(adminEditRes.body.listing.askingPrice).toBe(99999);
  });

  it("7. Public API response NEVER exposes review-internal fields (reviewNotes, reviewStatus)", async () => {
    // Listing #300 is public live listing
    const publicRes = await request(app).get("/api/listings/live-running-listing-300");

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.listing).toBeDefined();

    const pub = publicRes.body.listing;
    expect(pub.title).toBe("Live Running Listing");
    expect(pub.status).toBe("live");

    // ABSOLUTE SANITIZATION ASSERTIONS
    expect(pub.reviewNotes).toBeUndefined();
    expect(pub.reviewStatus).toBeUndefined();
    expect(pub.reviewedBy).toBeUndefined();
    expect(pub.reviewedAt).toBeUndefined();
  });
});
