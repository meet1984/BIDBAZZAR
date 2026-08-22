import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

vi.mock("../src/modules/auth/auth.repository.js", () => {
  const store: Record<number, any> = {
    10: { id: 10, accountType: "buyer", fullName: "Buyer One", email: "buyer1@test.com", status: "active" },
    20: { id: 20, accountType: "seller", fullName: "Seller One", email: "seller1@test.com", status: "active" },
  };
  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => store[id] || null),
    },
  };
});

vi.mock("../src/modules/buyer-profile/buyer-profile.repository.js", () => {
  const profiles: Record<number, any> = {
    10: {
      accountId: 10,
      legalFullName: "Jane Doe",
      dateOfBirth: "1990-01-01",
      buyerType: "individual",
      verifiedEmail: "jane@test.com",
      verifiedPhone: "+1234567890",
      addressLine1: "123 Private Street",
      addressLine2: "Apt 4B",
      city: "Metropolis",
      state: "NY",
      pinCode: "10001",
      country: "USA",
      governmentIdType: "passport",
      maskedGovernmentIdRef: "XXXX-XXXX-1234",
      businessName: null,
      gstNumber: null,
      profileImage: "https://example.com/avatar.jpg",
      verificationStatus: "draft",
      verificationSubmittedAt: null,
      verificationReviewedAt: null,
      rejectionReason: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  };

  return {
    buyerProfileRepository: {
      findByAccountId: vi.fn(async (id: number) => profiles[id] || null),
      createDefault: vi.fn(async (id: number) => profiles[id]),
      update: vi.fn(async (id: number, input: any) => {
        profiles[id] = { ...profiles[id], ...input };
        return profiles[id];
      }),
      updateVerificationStatus: vi.fn(async () => {}),
    },
  };
});

describe("Buyer Profile Module & Redaction Tests", () => {
  it("allows buyer to read own profile", async () => {
    const token = signAccessToken({ id: 10, accountType: "buyer", email: "buyer1@test.com", fullName: "Buyer One" });

    const res = await request(app)
      .get("/api/buyer/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.legalFullName).toBe("Jane Doe");
    expect(res.body.data.maskedGovernmentIdRef).toBe("XXXX-XXXX-1234");
    // Ensure raw unmasked ID is NEVER present
    expect(res.body.data.governmentIdNumber).toBeUndefined();
  });

  it("blocks seller from reading buyer profile route", async () => {
    const token = signAccessToken({ id: 20, accountType: "seller", email: "seller1@test.com", fullName: "Seller One" });

    const res = await request(app)
      .get("/api/buyer/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("public safe lookup NEVER exposes private address, phone, email, or govt ID number", async () => {
    const res = await request(app).get("/api/buyer/profile/public/10");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const pub = res.body.data;

    expect(pub.accountId).toBe(10);
    expect(pub.displayName).toBe("Jane Doe");
    expect(pub.buyerType).toBe("individual");

    // ABSOLUTE REDACTION ASSERTIONS
    expect(pub.addressLine1).toBeUndefined();
    expect(pub.addressLine2).toBeUndefined();
    expect(pub.city).toBeUndefined();
    expect(pub.state).toBeUndefined();
    expect(pub.pinCode).toBeUndefined();
    expect(pub.country).toBeUndefined();
    expect(pub.verifiedEmail).toBeUndefined();
    expect(pub.verifiedPhone).toBeUndefined();
    expect(pub.governmentIdType).toBeUndefined();
    expect(pub.maskedGovernmentIdRef).toBeUndefined();
    expect(pub.governmentIdNumber).toBeUndefined();
  });
});
