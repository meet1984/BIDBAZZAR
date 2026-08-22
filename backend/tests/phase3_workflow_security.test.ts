import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";
import { hasExpectedSignature } from "../src/modules/verification-documents/verification-documents.service.js";

vi.mock("../src/modules/auth/auth.repository.js", () => {
  const accounts: Record<number, any> = {
    100: { id: 100, accountType: "buyer", fullName: "Unverified Buyer", email: "unver_buyer@test.com", status: "active" },
    101: { id: 101, accountType: "buyer", fullName: "Verified Buyer", email: "ver_buyer@test.com", status: "active" },
    102: { id: 102, accountType: "buyer", fullName: "Suspended Buyer", email: "susp_buyer@test.com", status: "active" },
    200: { id: 200, accountType: "seller", fullName: "Unverified Seller", email: "unver_seller@test.com", status: "active" },
    201: { id: 201, accountType: "seller", fullName: "Verified Seller", email: "ver_seller@test.com", status: "active" },
    202: { id: 202, accountType: "seller", fullName: "Suspended Seller", email: "susp_seller@test.com", status: "active" },
    300: { id: 300, accountType: "admin", fullName: "Admin Staff", email: "admin@test.com", status: "active" },
  };
  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => accounts[id] || null),
    },
  };
});

vi.mock("../src/modules/buyer-profile/buyer-profile.repository.js", () => {
  const buyerProfiles: Record<number, any> = {
    100: { accountId: 100, legalFullName: "Unverified Buyer", verificationStatus: "draft" },
    101: { accountId: 101, legalFullName: "Verified Buyer", verificationStatus: "verified" },
    102: { accountId: 102, legalFullName: "Suspended Buyer", verificationStatus: "suspended" },
  };
  return {
    buyerProfileRepository: {
      findByAccountId: vi.fn(async (id: number) => buyerProfiles[id] || null),
      updateVerificationStatus: vi.fn(async () => {}),
    },
  };
});

vi.mock("../src/modules/seller-profile/seller-profile.repository.js", () => {
  const sellerProfiles: Record<number, any> = {
    200: { accountId: 200, businessName: "Unverified Store", legalName: "Unverified Store", verificationStatus: "draft" },
    201: { accountId: 201, businessName: "Verified Store", legalName: "Verified Store", verificationStatus: "verified" },
    202: { accountId: 202, businessName: "Suspended Store", legalName: "Suspended Store", verificationStatus: "suspended" },
  };
  return {
    sellerProfileRepository: {
      findByAccountId: vi.fn(async (id: number) => sellerProfiles[id] || null),
      updateVerificationStatus: vi.fn(async () => {}),
    },
  };
});

vi.mock("../src/modules/verification-documents/verification-documents.repository.js", () => {
  const docs: Record<number, any> = {
    500: {
      id: 500,
      accountId: 101, // Owned by Verified Buyer #101
      accountType: "buyer",
      documentType: "government_id",
      fileKey: "secret_file_key_500.pdf",
      originalName: "passport.pdf",
      fileMime: "application/pdf",
      fileSize: 10240,
      createdAt: new Date(),
    },
  };
  return {
    verificationDocumentRepository: {
      findById: vi.fn(async (id: number) => docs[id] || null),
      findByAccount: vi.fn(async (accountId: number, accountType: string) =>
        Object.values(docs).filter((d) => d.accountId === accountId && d.accountType === accountType),
      ),
      create: vi.fn(async () => docs[500]),
      delete: vi.fn(async () => true),
    },
  };
});

describe("Phase 3 Verification Workflow & Document Security Test Suite", () => {
  it("1. Unverified buyer CANNOT submit offers/bids", async () => {
    const token = signAccessToken({ id: 100, accountType: "buyer", email: "unver_buyer@test.com", fullName: "Unverified Buyer" });

    const res = await request(app)
      .post("/api/listings/1/offers")
      .set("Authorization", `Bearer ${token}`)
      .send({ offeredAmount: 1500 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("VERIFICATION_REQUIRED");
  });

  it("2. Unverified seller CANNOT create or submit listings", async () => {
    const token = signAccessToken({ id: 200, accountType: "seller", email: "unver_seller@test.com", fullName: "Unverified Seller" });

    const createRes = await request(app)
      .post("/api/seller/auctions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test Lot Item",
        category: "Electronics",
        description: "Lot description",
        itemCondition: "new",
        location: "Warehouse A",
        startingPrice: 100,
        minimumIncrement: 10,
        startsAt: "2026-09-01T00:00:00Z",
        endsAt: "2026-09-10T00:00:00Z",
      });

    expect(createRes.status).toBe(403);
    expect(createRes.body.code).toBe("VERIFICATION_REQUIRED");

    const submitRes = await request(app)
      .post("/api/seller/auctions/1/submit")
      .set("Authorization", `Bearer ${token}`);

    expect(submitRes.status).toBe(403);
    expect(submitRes.body.code).toBe("VERIFICATION_REQUIRED");
  });

  it("3. Suspension IMMEDIATELY blocks marketplace participation for buyers and sellers", async () => {
    const suspendedBuyerToken = signAccessToken({ id: 102, accountType: "buyer", email: "susp_buyer@test.com", fullName: "Suspended Buyer" });

    const bidRes = await request(app)
      .post("/api/listings/1/offers")
      .set("Authorization", `Bearer ${suspendedBuyerToken}`)
      .send({ offeredAmount: 2000 });

    expect(bidRes.status).toBe(403);
    expect(bidRes.body.code).toBe("ACCOUNT_SUSPENDED");

    const suspendedSellerToken = signAccessToken({ id: 202, accountType: "seller", email: "susp_seller@test.com", fullName: "Suspended Seller" });

    const listRes = await request(app)
      .post("/api/seller/auctions")
      .set("Authorization", `Bearer ${suspendedSellerToken}`)
      .send({ title: "Suspended Item" });

    expect(listRes.status).toBe(403);
    expect(listRes.body.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("4. File content magic bytes check validates actual content against declared MIME type", () => {
    // Valid PDF signature %PDF-
    const validPdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
    const validPdfFile = { mimetype: "application/pdf", buffer: validPdfBuffer } as Express.Multer.File;
    expect(hasExpectedSignature(validPdfFile)).toBe(true);

    // Spoofed PDF file with executable JS header
    const spoofedFile = { mimetype: "application/pdf", buffer: Buffer.from("console.log('malicious script')") } as Express.Multer.File;
    expect(hasExpectedSignature(spoofedFile)).toBe(false);

    // Valid PNG signature
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPngFile = { mimetype: "image/png", buffer: validPngBuffer } as Express.Multer.File;
    expect(hasExpectedSignature(validPngFile)).toBe(true);

    // Spoofed PNG file with fake content
    const spoofedPng = { mimetype: "image/png", buffer: Buffer.from([0x00, 0x00, 0x00, 0x00]) } as Express.Multer.File;
    expect(hasExpectedSignature(spoofedPng)).toBe(false);
  });

  it("5. Unauthorized users CANNOT download documents owned by others", async () => {
    // Document #500 belongs to Buyer #101. Buyer #100 tries to download it.
    const unauthorizedToken = signAccessToken({ id: 100, accountType: "buyer", email: "unver_buyer@test.com", fullName: "Unverified Buyer" });

    const res = await request(app)
      .get("/api/verification/documents/500/download")
      .set("Authorization", `Bearer ${unauthorizedToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ACCESS_DENIED");
  });
});
