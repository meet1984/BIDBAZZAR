import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

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

let currentBannerSetting = "/hero-auction-marketplace.png";

vi.mock("../src/modules/settings/settings.repository.js", () => ({
  settingsRepository: {
    getSetting: vi.fn(async (_key: string, fallback: string) => currentBannerSetting || fallback),
    setSetting: vi.fn(async (_key: string, value: string) => {
      currentBannerSetting = value;
    }),
  },
}));

vi.mock("../src/shared/storage/localStorage.service.js", () => ({
  localStorageService: {
    saveImage: vi.fn(async () => ({
      url: "/uploads/listings/mock-banner-uuid.jpg",
      fileKey: "listings/mock-banner-uuid.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      thumbnailUrl: "/uploads/listings/mock-banner-uuid.jpg",
    })),
    deleteImage: vi.fn(async () => {}),
  },
}));

describe("Settings & How It Works Banner API", () => {
  const adminToken = signAccessToken({ id: 1, accountType: "admin", email: "admin@test.com", fullName: "Super Admin" });
  const employeeToken = signAccessToken({ id: 2, accountType: "admin_employee", email: "emp@test.com", fullName: "Admin Employee" });
  const sellerToken = signAccessToken({ id: 3, accountType: "seller", email: "seller@test.com", fullName: "Seller User" });
  const buyerToken = signAccessToken({ id: 4, accountType: "buyer", email: "buyer@test.com", fullName: "Buyer User" });

  it("allows public access to GET /api/settings/how-it-works-banner without token", async () => {
    const res = await request(app).get("/api/settings/how-it-works-banner");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("bannerUrl");
  });

  it("allows full admin to update how it works banner via PUT", async () => {
    const res = await request(app)
      .put("/api/admin/settings/how-it-works-banner")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ bannerUrl: "https://images.unsplash.com/photo-banner.jpg" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bannerUrl).toBe("https://images.unsplash.com/photo-banner.jpg");
  });

  it("allows admin_employee to update how it works banner via PUT", async () => {
    const res = await request(app)
      .put("/api/admin/settings/how-it-works-banner")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ bannerUrl: "/hero-auction-marketplace.png" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bannerUrl).toBe("/hero-auction-marketplace.png");
  });

  it("blocks buyers and sellers from PUT /api/admin/settings/how-it-works-banner with 403", async () => {
    const buyerRes = await request(app)
      .put("/api/admin/settings/how-it-works-banner")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ bannerUrl: "https://evil.com/banner.jpg" });

    expect(buyerRes.status).toBe(403);
    expect(buyerRes.body.code).toBe("ROLE_FORBIDDEN");

    const sellerRes = await request(app)
      .put("/api/admin/settings/how-it-works-banner")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ bannerUrl: "https://evil.com/banner.jpg" });

    expect(sellerRes.status).toBe(403);
    expect(sellerRes.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("handles base64 data URIs on PUT by saving to storage and returning static URL", async () => {
    const validBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const res = await request(app)
      .put("/api/admin/settings/how-it-works-banner")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ bannerUrl: validBase64 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bannerUrl).toBe("/uploads/listings/mock-banner-uuid.jpg");
  });

  it("allows uploading an image file via POST /api/admin/settings/how-it-works-banner/upload", async () => {
    const fakeImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const res = await request(app)
      .post("/api/admin/settings/how-it-works-banner/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", fakeImageBuffer, { filename: "test-banner.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bannerUrl).toBe("/uploads/listings/mock-banner-uuid.jpg");
  });
});
