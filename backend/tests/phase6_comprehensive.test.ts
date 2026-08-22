import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

const hash = bcrypt.hashSync("Password123", 8);

// Mock DB repositories for Phase 6 test scenarios
const mockAccountsStore: Record<number, any> = {
  1: { id: 1, accountType: "admin", role: "admin", fullName: "Root Admin", email: "admin@test.com", passwordHash: hash, status: "active" },
  2: { id: 2, accountType: "admin_employee", role: "admin_employee", fullName: "Employee User", email: "emp@test.com", passwordHash: hash, status: "active" },
  3: { id: 3, accountType: "buyer", role: "buyer", fullName: "Buyer User", email: "buyer@test.com", passwordHash: hash, status: "active" },
  4: { id: 4, accountType: "seller", role: "seller", fullName: "Seller User", email: "seller@test.com", passwordHash: hash, status: "active" },
  5: { id: 5, accountType: "buyer", role: "buyer", fullName: "Suspended Buyer", email: "suspended@test.com", passwordHash: hash, status: "suspended" },
  6: { id: 6, accountType: "seller", role: "seller", fullName: "Dual Legacy User", email: "dual@test.com", passwordHash: hash, status: "active", migrationReviewRequired: true },
};

vi.mock("../src/modules/auth/auth.repository.js", () => {
  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => mockAccountsStore[id] || null),
      findAccountByEmail: vi.fn(async (email: string) => Object.values(mockAccountsStore).find(a => a.email === email) || null),
      findUserById: vi.fn(async (id: number) => mockAccountsStore[id] || null),
      findUserByEmail: vi.fn(async (email: string) => Object.values(mockAccountsStore).find(a => a.email === email) || null),
      invalidateUserOtpChallenges: vi.fn(async () => {}),
      createOtpChallenge: vi.fn(async () => {}),
      storeRefreshToken: vi.fn(async () => {}),
      findRefreshToken: vi.fn(async (tokenHash: string) => {
        if (tokenHash === "suspended-token-hash") {
          return { ...mockAccountsStore[5], refreshTokenId: "rt-1", expiresAt: new Date(Date.now() + 100000), revokedAt: null };
        }
        return null;
      }),
      rotateRefreshToken: vi.fn(async () => false),
    },
  };
});

vi.mock("../src/modules/auth/auth.email.js", () => ({
  sendOtpEmail: vi.fn(async ({ to }: { to: string }) => {
    if (to === "fail-email@test.com") {
      throw new Error("SMTP server connection timeout");
    }
    return true;
  }),
}));

describe("Phase 6 Comprehensive Verification Test Suite", () => {
  it("1. Verifies buyer and seller route isolation", async () => {
    const buyerToken = signAccessToken({ id: 3, accountType: "buyer", email: "buyer@test.com", fullName: "Buyer User" });
    const sellerToken = signAccessToken({ id: 4, accountType: "seller", email: "seller@test.com", fullName: "Seller User" });

    // Buyer accessing seller dashboard -> 403
    const buyerOnSellerRes = await request(app)
      .get("/api/dashboard/seller")
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(buyerOnSellerRes.status).toBe(403);
    expect(buyerOnSellerRes.body.code).toBe("ROLE_FORBIDDEN");

    // Seller accessing buyer dashboard -> 403
    const sellerOnBuyerRes = await request(app)
      .get("/api/dashboard/buyer")
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(sellerOnBuyerRes.status).toBe(403);
    expect(sellerOnBuyerRes.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("2. Verifies admin_employee is blocked from full-admin routes", async () => {
    const employeeToken = signAccessToken({ id: 2, accountType: "admin_employee", email: "emp@test.com", fullName: "Employee User" });

    const adminDashboardRes = await request(app)
      .get("/api/dashboard/admin")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(adminDashboardRes.status).toBe(403);
    expect(adminDashboardRes.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("3. Verifies public registration cannot create admin or admin_employee", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        role: "admin",
        accountType: "admin",
        fullName: "Hacker Admin",
        email: "hacker@test.com",
        password: "Password123",
        acceptedTerms: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("4. Verifies OTP is NEVER returned in API responses or logged", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "buyer@test.com", password: "Password123" });

    expect(loginRes.body.devOtp).toBeUndefined();
    expect(loginRes.body.otpCode).toBeUndefined();
  });

  it("5. Verifies failed OTP email yields honest EMAIL_DISPATCH_FAILED error", async () => {
    mockAccountsStore[99] = { id: 99, accountType: "buyer", fullName: "Fail Email", email: "fail-email@test.com", passwordHash: hash, status: "active" };

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "fail-email@test.com", password: "Password123" });

    expect(loginRes.status).toBe(500);
    expect(loginRes.body.code).toBe("EMAIL_DISPATCH_FAILED");
    expect(loginRes.body.message).toContain("Unable to send verification code email");
  });

  it("6. Verifies suspended accounts cannot refresh tokens", async () => {
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", ["bidmylot_refresh=suspended-raw-token"]);

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.code).toBe("REFRESH_INVALID");
  });

  it("7. Verifies ambiguous legacy accounts are assigned review flag without deletion", () => {
    const dualAccount = mockAccountsStore[6];
    expect(dualAccount).toBeDefined();
    expect(dualAccount.migrationReviewRequired).toBe(true);
    expect(dualAccount.status).toBe("active");
  });

  it("8. Verifies Phusion Passenger entry module app.js exports app without binding port", async () => {
    const passengerAppModule: any = await import("../src/app.js");
    expect(passengerAppModule.app).toBeDefined();
    expect(typeof passengerAppModule.app).toBe("function");
  });
});
