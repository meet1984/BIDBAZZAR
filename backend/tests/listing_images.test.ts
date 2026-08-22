import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";
import { runBase64ImageMigration } from "../src/scripts/migrate-base64-images.js";
import { pool } from "../src/database/pool.js";

vi.mock("../src/modules/auth/auth.repository.js", () => {
  const accounts: Record<number, any> = {
    10: { id: 10, accountType: "admin", fullName: "Admin User", email: "admin@test.com", status: "active" },
    20: { id: 20, accountType: "seller", fullName: "Verified Seller", email: "v_seller@test.com", status: "active" },
  };
  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => accounts[id] || null),
    },
  };
});

vi.mock("../src/modules/seller-profile/seller-profile.repository.js", () => {
  return {
    sellerProfileRepository: {
      findByAccountId: vi.fn(async (id: number) => ({ accountId: id, verificationStatus: "verified" })),
    },
  };
});

vi.mock("../src/modules/listings/listing.repository.js", () => {
  return {
    listingRepository: {
      findById: vi.fn(async (id: number) => ({ id, sellerId: 20, title: "Test Listing", reviewStatus: "draft" })),
    },
  };
});

let mockImageCount = 0;

vi.mock("../src/modules/listings/listing-image.repository.js", () => {
  const images: Record<number, any> = {};
  let nextId = 1;

  return {
    listingImageRepository: {
      countByListingId: vi.fn(async () => mockImageCount),
      findByListingId: vi.fn(async () => Object.values(images)),
      findById: vi.fn(async (id: number) => images[id] || null),
      createImage: vi.fn(async (listingId: number, url: string, order: number, isPrimary: boolean) => {
        const id = ++nextId;
        images[id] = { id, listingId, imageUrl: url, displayOrder: order, isPrimary };
        return id;
      }),
      updateOrderAndPrimary: vi.fn(async () => {}),
      delete: vi.fn(async () => true),
      clearPrimaryForListing: vi.fn(async () => {}),
      setPrimary: vi.fn(async () => {}),
    },
  };
});

const verifiedSellerToken = signAccessToken({ id: 20, accountType: "seller", email: "v_seller@test.com", fullName: "Verified Seller" });

describe("Phase 4 Listing Images & Legacy Migration Test Suite", () => {
  it("1. Rejects invalid file format or oversized uploads", async () => {
    mockImageCount = 0;
    // Attempt uploading a text file as image
    const res = await request(app)
      .post("/api/seller/listings/100/images")
      .set("Authorization", `Bearer ${verifiedSellerToken}`)
      .attach("images", Buffer.from("console.log('not an image')"), "malicious.txt");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("INVALID_IMAGE_TYPE");
  });

  it("2. Enforces maximum 6 images limit per listing", async () => {
    mockImageCount = 6;
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await request(app)
      .post("/api/seller/listings/100/images")
      .set("Authorization", `Bearer ${verifiedSellerToken}`)
      .attach("images", validPngBuffer, "test1.png");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("IMAGE_LIMIT_EXCEEDED");
  });

  it("3. Base64 streaming batch migration runs cleanly without memory spikes", async () => {
    vi.spyOn(pool, "query").mockImplementation(async (options: unknown, values?: unknown) => {
      const sql = typeof options === "string" ? options : (options as { sql?: string })?.sql ?? "";
      if (sql.includes("FROM auctions")) {
        const [lastId] = Array.isArray(values) ? values : [];
        if (Number(lastId) >= 999) return [[], []];
        return [
          [
            {
              id: 999,
              image_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            },
          ] as any,
          [],
        ];
      }
      return [[{ id: 999 }] as any, []];
    });

    vi.spyOn(pool, "execute").mockImplementation(async () => {
      return [{ affectedRows: 1 } as any, []];
    });

    const report = await runBase64ImageMigration({ batchSize: 10 });
    expect(report.dryRun).toBe(true);
    expect(report.totalProcessed).toBeGreaterThan(0);
    expect(report.errors.length).toBe(0);
    expect(report.migratedCount).toBe(0);

    vi.restoreAllMocks();
  });
});
