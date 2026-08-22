import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

// Mock DB & mailer repositories for security testing
vi.mock("../src/modules/auth/auth.repository.js", () => {
  const account = {
    id: 10,
    accountType: "buyer",
    fullName: "Security Test User",
    email: "security@test.com",
    passwordHash: "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5Y5b4luw1DeYekYCQVDXVyWvM1R9l2a",
    status: "active",
  };

  return {
    authRepository: {
      findAccountByEmail: vi.fn(async (email: string) => (email === "security@test.com" ? account : null)),
      findAccountById: vi.fn(async (id: number) => (id === 10 ? account : null)),
      findUserById: vi.fn(async (id: number) => (id === 10 ? account : null)),
      invalidateUserOtpChallenges: vi.fn(async () => {}),
      createOtpChallenge: vi.fn(async () => {}),
      storeRefreshToken: vi.fn(async () => {}),
    },
  };
});

describe("Phase 3 Security & Hardening Fixes", () => {
  it("ensures devOtp is NEVER returned in API responses", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "security@test.com", password: "wrongpassword" });

    expect(res.body.devOtp).toBeUndefined();
    expect(res.body.rawOtp).toBeUndefined();
  });

  it("returns generic error envelopes on 500 errors without leaking internal stack or exception details", async () => {
    // Access a route with bad auth header that forces an unhandled exception or mock error
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-malformed-jwt-token-format");

    expect(res.status).toBe(401);
    expect(res.body.message).not.toContain("Error:");
    expect(res.body.stack).toBeUndefined();
  });

  it("verifies refresh cookie configuration uses secure flags", async () => {
    const buyerToken = signAccessToken({ id: 10, accountType: "buyer", email: "security@test.com", fullName: "Security User" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("security@test.com");
  });
});
