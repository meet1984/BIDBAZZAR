import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";
import { legalPageRepository } from "../src/modules/legal-pages/legal-page.repository.js";

// Mock authRepository so token validation works for admin, admin_employee, buyer, and seller
vi.mock("../src/modules/auth/auth.repository.js", () => ({
  authRepository: {
    findAccountById: vi.fn(async (id: number) => {
      if (id === 1) return { id: 1, accountType: "admin", status: "active" };
      if (id === 2) return { id: 2, accountType: "admin_employee", status: "active" };
      if (id === 3) return { id: 3, accountType: "seller", status: "active" };
      if (id === 4) return { id: 4, accountType: "buyer", status: "active" };
      return null;
    }),
  },
}));

describe("Legal Pages Public & Admin API", () => {
  const adminToken = signAccessToken({
    id: 1,
    accountType: "admin",
    email: "admin@test.com",
    fullName: "Super Admin",
  });
  const employeeToken = signAccessToken({
    id: 2,
    accountType: "admin_employee",
    email: "emp@test.com",
    fullName: "Admin Employee",
  });
  const sellerToken = signAccessToken({
    id: 3,
    accountType: "seller",
    email: "seller@test.com",
    fullName: "Seller User",
  });
  const buyerToken = signAccessToken({
    id: 4,
    accountType: "buyer",
    email: "buyer@test.com",
    fullName: "Buyer User",
  });

  describe("Public API", () => {
    it("fetches terms page without authentication", async () => {
      const res = await request(app).get("/api/legal-pages/terms");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("title");
      expect(res.body).toHaveProperty("content_html");
      expect(res.body).toHaveProperty("contentHtml");
      expect(res.body).toHaveProperty("updatedAt");
      expect(res.headers["cache-control"]).toContain("public");
    });

    it("fetches privacy page without authentication via /api/legal alias", async () => {
      const res = await request(app).get("/api/legal/privacy");
      expect(res.status).toBe(200);
      expect(res.body.title).toContain("Privacy");
      expect(res.body.content_html).toContain("<h2>1. Information We Collect</h2>");
    });

    it("rejects invalid slug with 422 validation error", async () => {
      const res = await request(app).get("/api/legal-pages/invalid-slug");
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Admin API - Authentication & Role Protection", () => {
    it("rejects unauthorized requests to GET /api/admin/legal-pages/terms", async () => {
      const res = await request(app).get("/api/admin/legal-pages/terms");
      expect(res.status).toBe(401);
    });

    it("rejects buyer token with 403 on admin endpoint", async () => {
      const res = await request(app)
        .get("/api/admin/legal-pages/terms")
        .set("Authorization", `Bearer ${buyerToken}`);
      expect(res.status).toBe(403);
    });

    it("rejects seller token with 403 on admin endpoint", async () => {
      const res = await request(app)
        .get("/api/admin/legal-pages/privacy")
        .set("Authorization", `Bearer ${sellerToken}`);
      expect(res.status).toBe(403);
    });

    it("allows admin to fetch page for editing", async () => {
      const res = await request(app)
        .get("/api/admin/legal-pages/terms")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.page).toBeDefined();
      expect(res.body.page.slug).toBe("terms");
    });

    it("allows admin_employee to fetch page for editing", async () => {
      const res = await request(app)
        .get("/api/admin/legal-pages/privacy")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.page).toBeDefined();
      expect(res.body.page.slug).toBe("privacy");
    });
  });

  describe("Admin API - Updating & Validation", () => {
    it("rejects empty title or empty content_html", async () => {
      const res = await request(app)
        .put("/api/admin/legal-pages/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "", content_html: "" });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects content exceeding 200KB limit", async () => {
      const oversizeContent = "a".repeat(200 * 1024 + 100);
      const res = await request(app)
        .put("/api/admin/legal-pages/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Valid Title", contentHtml: oversizeContent });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("successfully updates page and records admin ID", async () => {
      const upsertSpy = vi.spyOn(legalPageRepository, "upsertPage").mockResolvedValueOnce({
        id: 1,
        slug: "terms",
        title: "Updated Terms 2026",
        contentHtml: "<h3>New Section</h3><p>Updated content</p>",
        updatedBy: 1,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-09-02T10:00:00Z"),
      });

      const res = await request(app)
        .put("/api/admin/legal-pages/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Updated Terms 2026",
          contentHtml: "<h3>New Section</h3><p>Updated content</p>",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.page.title).toBe("Updated Terms 2026");
      expect(res.body.page.contentHtml).toBe("<h3>New Section</h3><p>Updated content</p>");

      expect(upsertSpy).toHaveBeenCalledWith(
        "terms",
        expect.objectContaining({
          title: "Updated Terms 2026",
          contentHtml: "<h3>New Section</h3><p>Updated content</p>",
          updatedBy: 1,
        }),
      );

      upsertSpy.mockRestore();
    });

    it("supports snake_case content_html payload", async () => {
      const upsertSpy = vi.spyOn(legalPageRepository, "upsertPage").mockResolvedValueOnce({
        id: 2,
        slug: "privacy",
        title: "Updated Privacy Policy",
        contentHtml: "<p>Privacy notice update</p>",
        updatedBy: 2,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-09-02T10:00:00Z"),
      });

      const res = await request(app)
        .put("/api/admin/legal-pages/privacy")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          title: "Updated Privacy Policy",
          content_html: "<p>Privacy notice update</p>",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.page.title).toBe("Updated Privacy Policy");

      expect(upsertSpy).toHaveBeenCalledWith(
        "privacy",
        expect.objectContaining({
          title: "Updated Privacy Policy",
          contentHtml: "<p>Privacy notice update</p>",
          updatedBy: 2,
        }),
      );

      upsertSpy.mockRestore();
    });
  });
});
