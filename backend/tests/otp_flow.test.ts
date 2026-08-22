import request from "supertest";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { app } from "../src/app.js";
import bcrypt from "bcryptjs";

// Mock mailer so tests don't make real SMTP calls
vi.mock("../src/shared/mailer.js", () => ({
  sendEmail: vi.fn(() => Promise.resolve(true)),
}));

interface MockChallenge {
  id: number;
  userId: number;
  challengeToken: string;
  otpHash: string;
  expiresAt: Date;
  attemptCount: number;
  consumedAt: Date | null;
  createdAt: Date;
  rememberMe?: boolean;
}

const store = {
  users: {
    10: {
      id: 10,
      accountType: "buyer" as const,
      role: "buyer" as const,
      isBuyer: true,
      isSeller: false,
      isAdmin: false,
      fullName: "OTP User",
      email: "otp@test.com",
      phone: null as string | null,
      passwordHash: "",
      status: "active" as const,
    },
  },
  challenges: {} as Record<string, MockChallenge>,
  challengeCounter: 1,
};

vi.mock("../src/modules/auth/auth.repository.js", () => {
  return {
    authRepository: {
      findAccountByEmail: vi.fn(async (email: string) => {
        return Object.values(store.users).find((u) => u.email === email) || null;
      }),
      findAccountById: vi.fn(async (id: number) => store.users[id as keyof typeof store.users] || null),
      findUserByEmail: vi.fn(async (email: string) => {
        return Object.values(store.users).find((u) => u.email === email) || null;
      }),
      findUserById: vi.fn(async (id: number) => store.users[id as keyof typeof store.users] || null),
      invalidateUserOtpChallenges: vi.fn(async (userId: number) => {
        Object.values(store.challenges).forEach((c) => {
          if (c.userId === userId && !c.consumedAt) c.consumedAt = new Date();
        });
      }),
      createOtpChallenge: vi.fn(async (params: { userId: number; challengeToken: string; otpHash: string; expiresAt: Date; rememberMe?: boolean }) => {
        const id = store.challengeCounter++;
        store.challenges[params.challengeToken] = {
          id,
          userId: params.userId,
          challengeToken: params.challengeToken,
          otpHash: params.otpHash,
          expiresAt: params.expiresAt,
          attemptCount: 0,
          consumedAt: null,
          createdAt: new Date(),
          rememberMe: params.rememberMe,
        };
      }),
      findOtpChallengeByToken: vi.fn(async (token: string) => {
        const challenge = store.challenges[token];
        if (!challenge) return null;
        const user = store.users[challenge.userId as keyof typeof store.users];
        return { ...challenge, user };
      }),
      incrementOtpAttempt: vi.fn(async (id: number) => {
        const challenge = Object.values(store.challenges).find((c) => c.id === id);
        if (challenge) challenge.attemptCount += 1;
      }),
      markOtpChallengeConsumed: vi.fn(async (id: number) => {
        const challenge = Object.values(store.challenges).find((c) => c.id === id);
        if (!challenge || challenge.consumedAt) return false;
        challenge.consumedAt = new Date();
        return true;
      }),
      storeRefreshToken: vi.fn(async () => { }),
      revokeAllUserTokens: vi.fn(async () => { }),
    },
  };
});

describe("Two-Factor Login OTP Flow", () => {
  beforeAll(async () => {
    store.users[10].passwordHash = await bcrypt.hash("Password123", 10);
  });

  it("returns otpRequired on Step 1 with valid password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "otp@test.com", password: "Password123" });

    const body = res.body as { otpRequired?: boolean; challengeId?: string; expiresInSeconds?: number };
    expect(res.status).toBe(200);
    expect(body.otpRequired).toBe(true);
    expect(body.challengeId).toBeDefined();
    expect(body.expiresInSeconds).toBe(600);
  });

  it("completes Step 2 and issues access token + cookie with correct OTP", async () => {
    // Step 1: Login
    const step1 = await request(app)
      .post("/api/auth/login")
      .send({ email: "otp@test.com", password: "Password123" });

    const step1Body = step1.body as { challengeId: string };
    const challengeId = step1Body.challengeId;
    const challenge = store.challenges[challengeId]!;

    // Find the plain OTP that matches the hash by overriding hash with known bcrypt
    const testOtp = "123456";
    challenge.otpHash = await bcrypt.hash(testOtp, 8);

    // Step 2: Verify OTP
    const step2 = await request(app)
      .post("/api/auth/login/verify-otp")
      .send({ challengeId, otp: testOtp });

    const step2Body = step2.body as { accessToken?: string; user?: { email: string } };
    expect(step2.status).toBe(200);
    expect(step2Body.accessToken).toBeDefined();
    expect(step2Body.user?.email).toBe("otp@test.com");
    expect(step2.headers["set-cookie"]).toBeDefined();
    expect(challenge.consumedAt).not.toBeNull();
  });

  it("rejects wrong OTP without issuing tokens and increments attempt count", async () => {
    const step1 = await request(app)
      .post("/api/auth/login")
      .send({ email: "otp@test.com", password: "Password123" });

    const step1Body = step1.body as { challengeId: string };
    const challengeId = step1Body.challengeId;
    const challenge = store.challenges[challengeId]!;
    challenge.otpHash = await bcrypt.hash("123456", 8);

    const step2 = await request(app)
      .post("/api/auth/login/verify-otp")
      .send({ challengeId, otp: "999999" });

    const step2Body = step2.body as { code?: string; accessToken?: string };
    expect(step2.status).toBe(400);
    expect(step2Body.code).toBe("OTP_INVALID");
    expect(step2Body.accessToken).toBeUndefined();
    expect(challenge.attemptCount).toBe(1);
  });

  it("rejects expired OTP", async () => {
    const step1 = await request(app)
      .post("/api/auth/login")
      .send({ email: "otp@test.com", password: "Password123" });

    const step1Body = step1.body as { challengeId: string };
    const challengeId = step1Body.challengeId;
    const challenge = store.challenges[challengeId]!;
    challenge.otpHash = await bcrypt.hash("123456", 8);
    challenge.expiresAt = new Date(Date.now() - 1000); // Set to past

    const step2 = await request(app)
      .post("/api/auth/login/verify-otp")
      .send({ challengeId, otp: "123456" });

    const step2Body = step2.body as { code?: string };
    expect(step2.status).toBe(400);
    expect(step2Body.code).toBe("OTP_EXPIRED");
  });

  it("rejects OTP after 5 failed attempts", async () => {
    const step1 = await request(app)
      .post("/api/auth/login")
      .send({ email: "otp@test.com", password: "Password123" });

    const step1Body = step1.body as { challengeId: string };
    const challengeId = step1Body.challengeId;
    const challenge = store.challenges[challengeId]!;
    challenge.otpHash = await bcrypt.hash("123456", 8);
    challenge.attemptCount = 5;

    const step2 = await request(app)
      .post("/api/auth/login/verify-otp")
      .send({ challengeId, otp: "123456" });

    const step2Body = step2.body as { code?: string };
    expect(step2.status).toBe(400);
    expect(step2Body.code).toBe("OTP_ATTEMPTS_EXCEEDED");
  });

  it("invalidates previous OTP challenge when resending", async () => {
    const step1 = await request(app)
      .post("/api/auth/login")
      .send({ email: "otp@test.com", password: "Password123" });

    const step1Body = step1.body as { challengeId: string };
    const oldChallengeId = step1Body.challengeId;

    const resend = await request(app)
      .post("/api/auth/login/resend-otp")
      .send({ challengeId: oldChallengeId });

    const resendBody = resend.body as { challengeId: string };
    expect(resend.status).toBe(200);
    expect(resendBody.challengeId).toBeDefined();
    expect(resendBody.challengeId).not.toBe(oldChallengeId);
    expect(store.challenges[oldChallengeId]!.consumedAt).not.toBeNull();
  });
});
