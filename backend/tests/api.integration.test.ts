import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

// Mock the DB repositories so the integration test doesn't fail on missing tables
vi.mock("../src/modules/auth/auth.repository.js", () => ({
  authRepository: {
    findAccountById: vi.fn(async (id) => {
      if (id === 1) return { id: 1, accountType: "admin", status: "active" };
      if (id === 2) return { id: 2, accountType: "buyer", status: "active" };
      return null;
    }),
    findUserById: vi.fn(async (id) => {
      if (id === 1) return { id: 1, accountType: "admin", status: "active" };
      if (id === 2) return { id: 2, accountType: "buyer", status: "active" };
      return null;
    }),
  },
}));
vi.mock("../src/modules/support/support.repository.js", () => ({
  supportRepository: {
    getById: vi.fn(async (id) => {
      if (id === 999) return null; // So it returns 404 ENQUIRY_NOT_FOUND
      return null;
    }),
    getAttachmentById: vi.fn(async () => null),
  },
}));

describe("HTTP API validation", () => {
  it("does not allow public registration of an admin", async () => {
    const response = await request(app).post("/api/auth/register").send({
      role: "admin",
      fullName: "Attempted Admin",
      email: "admin@example.test",
      password: "Secret123",
      acceptedTerms: true,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("validates support enquiries before persistence", async () => {
    const response = await request(app).post("/api/support/enquiries").field("name", "A");

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns the standard error envelope for unknown API routes", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "ROUTE_NOT_FOUND",
      message: "No API route matches GET /api/does-not-exist.",
    });
  });
});

describe("Support Attachment Access Control", () => {
  it("rejects public access to the /uploads static directory", async () => {
    const response = await request(app).get("/uploads/test-file.pdf");
    // Since the static route is removed, this should return a standard 404
    expect(response.status).toBe(404);
  });

  it("handles /api/uploads/listings static route without hitting ROUTE_NOT_FOUND error envelope", async () => {
    const response = await request(app).get("/api/uploads/listings/non-existent.png");
    expect(response.status).toBe(404);
    // express.static returns standard 404 not JSON API error envelope
    expect(response.body).not.toHaveProperty("code", "ROUTE_NOT_FOUND");
  });

  it("requires an admin token to download an attachment", async () => {
    // 1. Without token, it should be 401 Unauthorized
    const noTokenResponse = await request(app).get("/api/admin/support/enquiries/999/attachment");
    expect(noTokenResponse.status).toBe(401);

    // 2. With non-admin token (buyer), it should be 403 Forbidden
    const buyerToken = signAccessToken({ id: 2, accountType: "buyer", role: "buyer", email: "buyer@example.test", fullName: "Buyer" });
    const buyerResponse = await request(app)
      .get("/api/admin/support/enquiries/999/attachment")
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(buyerResponse.status).toBe(403);

    // 3. With admin token, it passes auth and hits the controller (which returns 404 because enquiry 999 doesn't exist)
    const adminToken = signAccessToken({ id: 1, accountType: "admin", role: "admin", email: "admin@example.test", fullName: "Admin" });
    const adminResponse = await request(app)
      .get("/api/admin/support/enquiries/999/attachment")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminResponse.status).toBe(404);
    expect(adminResponse.body.code).toBe("ENQUIRY_NOT_FOUND");
  });
});

describe("Auth Rate Limiting", () => {
  it("enforces the 10 requests / 15 min limit on /api/auth/login", async () => {
    // Make 10 requests that are not rate limited.
    // We send an empty body, which will trigger a 422 VALIDATION_ERROR,
    // but crucially NOT a 429 RATE_LIMITED.
    for (let i = 0; i < 10; i++) {
      const response = await request(app).post("/api/auth/login").send({});
      expect(response.status).not.toBe(429);
      expect(response.status).toBe(422); // Reached validation
    }

    // The 11th request should be rate-limited
    const rateLimitedResponse = await request(app).post("/api/auth/login").send({});
    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.body.code).toBe("RATE_LIMITED");
  });
});
