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

vi.mock("../src/modules/seller-profile/seller-profile.repository.js", () => {
  const profiles: Record<number, any> = {
    20: {
      accountId: 20,
      legalName: "Acme Legal Corp",
      businessName: "Acme Store",
      sellerType: "business",
      verifiedEmail: "acme@test.com",
      verifiedPhone: "+9876543210",
      registeredAddressLine1: "456 Commerce Boulevard",
      registeredAddressLine2: "Suite 100",
      city: "San Francisco",
      state: "CA",
      pinCode: "94105",
      country: "USA",
      panGstRef: "XXXX-XXXX-9999",
      businessRegistrationInfo: "REG-9988-CA",
      productCategories: ["Electronics", "Automotive"],
      publicBusinessDescription: "Premier lot auction seller.",
      profileLogo: "https://example.com/logo.png",
      deliveryReturnInfo: "30 day hassle free return",
      payoutProviderRef: "acct_stripe_123456789",
      verificationStatus: "verified",
      verificationSubmittedAt: new Date("2026-01-02"),
      verificationReviewedAt: new Date("2026-01-03"),
      rejectionReason: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-03"),
    },
  };

  return {
    sellerProfileRepository: {
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

describe("Seller Profile Module & Redaction Tests", () => {
  it("allows seller to read own profile", async () => {
    const token = signAccessToken({ id: 20, accountType: "seller", email: "seller1@test.com", fullName: "Seller One" });

    const res = await request(app)
      .get("/api/seller/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.businessName).toBe("Acme Store");
    expect(res.body.data.payoutProviderRef).toBe("acct_stripe_123456789");
    // Ensure raw unencrypted bank accounts are NEVER returned or stored
    expect(res.body.data.bankAccountNumber).toBeUndefined();
    expect(res.body.data.bankRoutingNumber).toBeUndefined();
  });

  it("blocks buyer from updating seller profile", async () => {
    const token = signAccessToken({ id: 10, accountType: "buyer", email: "buyer1@test.com", fullName: "Buyer One" });

    const res = await request(app)
      .patch("/api/seller/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "Hacked Store" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("public safe seller profile NEVER exposes registered address, phone, email, PAN/GST, or payout secrets", async () => {
    const res = await request(app).get("/api/seller/profile/public/20");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const pub = res.body.data;

    expect(pub.accountId).toBe(20);
    expect(pub.businessName).toBe("Acme Store");
    expect(pub.sellerType).toBe("business");
    expect(pub.publicBusinessDescription).toBe("Premier lot auction seller.");
    expect(pub.deliveryReturnInfo).toBe("30 day hassle free return");

    // ABSOLUTE REDACTION ASSERTIONS
    expect(pub.legalName).toBeUndefined();
    expect(pub.verifiedEmail).toBeUndefined();
    expect(pub.verifiedPhone).toBeUndefined();
    expect(pub.registeredAddressLine1).toBeUndefined();
    expect(pub.registeredAddressLine2).toBeUndefined();
    expect(pub.city).toBeUndefined();
    expect(pub.state).toBeUndefined();
    expect(pub.pinCode).toBeUndefined();
    expect(pub.country).toBeUndefined();
    expect(pub.panGstRef).toBeUndefined();
    expect(pub.panGstNumber).toBeUndefined();
    expect(pub.businessRegistrationInfo).toBeUndefined();
    expect(pub.payoutProviderRef).toBeUndefined();
  });
});
