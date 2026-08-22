import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

// Mock DB operations for unit/integration testing
vi.mock("../src/modules/auth/auth.repository.js", () => {
  const accountsStore: Record<number, any> = {
    10: { id: 10, accountType: "buyer", fullName: "Buyer User", email: "buyer@test.com", status: "active" },
    20: { id: 20, accountType: "seller", fullName: "Seller User", email: "seller@test.com", status: "active" },
    30: { id: 30, accountType: "admin", fullName: "Admin User", email: "admin@test.com", status: "active" },
    40: { id: 40, accountType: "admin_employee", fullName: "Employee User", email: "emp@test.com", status: "active" },
  };

  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => accountsStore[id] || null),
      findUserById: vi.fn(async (id: number) => accountsStore[id] || null),
      createBuyerAccount: vi.fn(async (input: any) => {
        const id = 100;
        accountsStore[id] = { id, accountType: "buyer", fullName: input.fullName, email: input.email, status: "active" };
        return id;
      }),
      createSellerAccount: vi.fn(async (input: any) => {
        const id = 200;
        accountsStore[id] = { id, accountType: "seller", fullName: input.fullName, email: input.email, status: "active" };
        return id;
      }),
      storeRefreshToken: vi.fn(async () => { }),
      invalidateUserOtpChallenges: vi.fn(async () => { }),
      createOtpChallenge: vi.fn(async () => { }),
    },
    __accountsStore: accountsStore,
  };
});

describe("Phase 2 Account Type Isolation & Protection", () => {
  it("rejects buyer token on seller dashboard routes and vice versa", async () => {
    const buyerToken = signAccessToken({
      id: 10,
      accountType: "buyer",
      email: "buyer@test.com",
      fullName: "Buyer User",
    });

    const sellerRouteRes = await request(app)
      .get("/api/dashboard/seller")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(sellerRouteRes.status).toBe(403);
    expect(sellerRouteRes.body.code).toBe("ROLE_FORBIDDEN");

    const sellerToken = signAccessToken({
      id: 20,
      accountType: "seller",
      email: "seller@test.com",
      fullName: "Seller User",
    });

    const buyerRouteRes = await request(app)
      .get("/api/dashboard/buyer")
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(buyerRouteRes.status).toBe(403);
    expect(buyerRouteRes.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("ensures public registration cannot yield admin or admin_employee accounts", async () => {
    const resAdminAttempt = await request(app)
      .post("/api/auth/register")
      .send({
        role: "admin",
        accountType: "admin",
        fullName: "Hacker",
        email: "hacker@test.com",
        password: "Password123",
        acceptedTerms: true,
      });

    // The validation schema forces public registration to buyer or seller only
    expect(resAdminAttempt.status).toBe(422);
  });

  it("blocks admin_employee from full-admin routes", async () => {
    const employeeToken = signAccessToken({
      id: 40,
      accountType: "admin_employee",
      email: "emp@test.com",
      fullName: "Employee User",
    });

    const fullAdminRouteRes = await request(app)
      .get("/api/dashboard/admin")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(fullAdminRouteRes.status).toBe(403);
    expect(fullAdminRouteRes.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("verifies legacy become-seller and become-buyer endpoints are removed", async () => {
    const buyerToken = signAccessToken({
      id: 10,
      accountType: "buyer",
      email: "buyer@test.com",
      fullName: "Buyer User",
    });

    const becomeSellerRes = await request(app)
      .post("/api/account/become-seller")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ sellerName: "New Seller", sellerType: "individual" });

    expect(becomeSellerRes.status).toBe(404);

    const becomeBuyerRes = await request(app)
      .post("/api/account/become-buyer")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(becomeBuyerRes.status).toBe(404);
  });
});
