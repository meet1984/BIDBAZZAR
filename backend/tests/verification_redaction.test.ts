import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

vi.mock("../src/modules/auth/auth.repository.js", () => {
  const store: Record<number, any> = {
    10: { id: 10, accountType: "buyer", fullName: "Buyer One", email: "buyer1@test.com", status: "active" },
    20: { id: 20, accountType: "seller", fullName: "Seller One", email: "seller1@test.com", status: "active" },
    30: { id: 30, accountType: "admin", fullName: "Admin One", email: "admin1@test.com", status: "active" },
  };
  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => store[id] || null),
    },
  };
});

vi.mock("../src/modules/buyer-profile/buyer-profile.repository.js", () => ({
  buyerProfileRepository: {
    findByAccountId: vi.fn(async (id: number) => ({
      accountId: id,
      legalFullName: "Buyer Ten",
      verificationStatus: "submitted",
      verificationSubmittedAt: "2026-01-01T00:00:00.000Z",
      verificationReviewedAt: null,
      rejectionReason: null,
    })),
    updateVerificationStatus: vi.fn(async () => {}),
  },
}));

vi.mock("../src/modules/seller-profile/seller-profile.repository.js", () => ({
  sellerProfileRepository: {
    findByAccountId: vi.fn(async (id: number) => ({
      accountId: id,
      businessName: "Seller Twenty",
      legalName: "Seller Twenty",
      verificationStatus: "draft",
      verificationSubmittedAt: null,
      verificationReviewedAt: null,
      rejectionReason: null,
    })),
    updateVerificationStatus: vi.fn(async () => {}),
  },
}));

vi.mock("../src/modules/verification/verification.repository.js", () => ({
  verificationRepository: {
    recordDecision: vi.fn(async () => 1),
    recordAuditLog: vi.fn(async () => {}),
    listBuyerQueue: vi.fn(async () => ({
      items: [
        {
          accountId: 10,
          accountType: "buyer",
          fullName: "Buyer Ten",
          email: "buyer10@test.com",
          verificationStatus: "submitted",
          verificationSubmittedAt: "2026-01-01T00:00:00.000Z",
          verificationReviewedAt: null,
          rejectionReason: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })),
    listSellerQueue: vi.fn(async () => ({
      items: [
        {
          accountId: 20,
          accountType: "seller",
          fullName: "Seller Twenty",
          email: "seller20@test.com",
          verificationStatus: "submitted",
          verificationSubmittedAt: "2026-01-01T00:00:00.000Z",
          verificationReviewedAt: null,
          rejectionReason: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })),
    setVerificationStatusTransaction: vi.fn(async () => {}),
  },
}));

vi.mock("../src/modules/verification-documents/verification-documents.repository.js", () => ({
  verificationDocumentRepository: {
    findByAccount: vi.fn(async (accountId: number, accountType: string) => [
      {
        id: 101,
        accountId,
        accountType,
        documentType: "government_id",
        fileKey: "secret_uuid_key_99.pdf",
        originalName: "passport.pdf",
        fileMime: "application/pdf",
        fileSize: 1048576,
        createdAt: new Date("2026-01-01"),
      },
    ]),
    create: vi.fn(async (accountId: number, accountType: string, fileKey: string, input: any) => ({
      id: 102,
      accountId,
      accountType,
      documentType: input.documentType,
      fileKey,
      originalName: input.originalName,
      fileMime: input.fileMime,
      fileSize: input.fileSize,
      createdAt: new Date(),
    })),
    findById: vi.fn(async (id: number) => ({
      id,
      accountId: 10,
      accountType: "buyer",
      documentType: "government_id",
      fileKey: "secret_uuid_key_99.pdf",
      originalName: "passport.pdf",
      fileMime: "application/pdf",
      fileSize: 1048576,
      createdAt: new Date(),
    })),
    delete: vi.fn(async () => true),
  },
}));

describe("Verification & Document API Redaction & Authorization Tests", () => {
  it("allows authenticated user to view verification status", async () => {
    const token = signAccessToken({ id: 10, accountType: "buyer", email: "buyer1@test.com", fullName: "Buyer One" });

    const res = await request(app)
      .get("/api/verification/status")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verificationStatus).toBe("submitted");
  });

  it("document listing NEVER leaks raw file system paths or internal file keys", async () => {
    const token = signAccessToken({ id: 10, accountType: "buyer", email: "buyer1@test.com", fullName: "Buyer One" });

    const res = await request(app)
      .get("/api/verification/documents")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const doc = res.body.data[0];

    expect(doc.id).toBe(101);
    expect(doc.originalName).toBe("passport.pdf");
    expect(doc.fileMime).toBe("application/pdf");

    // ABSOLUTE REDACTION ASSERTIONS
    expect(doc.fileKey).toBeUndefined();
    expect(doc.filePath).toBeUndefined();
    expect(doc.absolutePath).toBeUndefined();
  });

  it("blocks non-admin users from accessing admin verification queues", async () => {
    const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "buyer1@test.com", fullName: "Buyer One" });

    const res = await request(app)
      .get("/api/admin/verification/buyers")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("allows admin to view buyer verification queue", async () => {
    const adminToken = signAccessToken({ id: 30, accountType: "admin", email: "admin1@test.com", fullName: "Admin One" });

    const res = await request(app)
      .get("/api/admin/verification/buyers")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].accountType).toBe("buyer");
  });

  it("requires rejection reason when admin rejects a verification", async () => {
    const adminToken = signAccessToken({ id: 30, accountType: "admin", email: "admin1@test.com", fullName: "Admin One" });

    const resEmpty = await request(app)
      .post("/api/admin/verification/buyer/10/reject")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "" });

    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.code).toBe("REASON_REQUIRED");

    const resValid = await request(app)
      .post("/api/admin/verification/buyer/10/reject")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Illegible document copy" });

    expect(resValid.status).toBe(200);
    expect(resValid.body.success).toBe(true);
  });

  it("accepts a valid multipart PDF and derives metadata from the uploaded file", async () => {
    const token = signAccessToken({ id: 10, accountType: "buyer", email: "buyer1@test.com", fullName: "Buyer One" });

    const res = await request(app)
      .post("/api/verification/documents")
      .set("Authorization", `Bearer ${token}`)
      .field("documentType", "government_id")
      .attach("document", Buffer.from("%PDF-1.4\nBidMyLot test document\n"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(102);
  });

  it("does not expose an undocumented singular upload alias", async () => {
    const token = signAccessToken({ id: 10, accountType: "buyer", email: "buyer1@test.com", fullName: "Buyer One" });

    const res = await request(app)
      .post("/api/verification/document")
      .set("Authorization", `Bearer ${token}`)
      .field("documentType", "address_proof")
      .attach("document", Buffer.from("%PDF-1.4\nBidMyLot test document\n"), {
        filename: "address.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ROUTE_NOT_FOUND");
  });

  it("allows admin to fetch documents for a target user via /api/admin/verification/:type/:id/documents", async () => {
    const adminToken = signAccessToken({ id: 30, accountType: "admin", email: "admin1@test.com", fullName: "Admin One" });

    const res = await request(app)
      .get("/api/admin/verification/buyer/10/documents")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(101);
  });
});

