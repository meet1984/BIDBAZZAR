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

const settingsStore: Record<string, string> = {
  how_it_works_banner_url: "/hero-auction-marketplace.png",
  about_hero_image_1: "/hero-auction-marketplace.png",
  about_hero_image_2: "/hero-auction-marketplace.png",
  about_hero_image_3: "/hero-auction-marketplace.png",
};

vi.mock("../src/modules/settings/settings.repository.js", () => ({
  settingsRepository: {
    getSetting: vi.fn(async (key: string, fallback: string) => settingsStore[key] || fallback),
    setSetting: vi.fn(async (key: string, value: string) => {
      settingsStore[key] = value;
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

  describe("About Page Photos API", () => {
    it("allows public access to GET /api/settings/about-photos without token", async () => {
      const res = await request(app).get("/api/settings/about-photos");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("photos");
      expect(res.body.photos).toHaveProperty("heroImage1");
      expect(res.body.photos).toHaveProperty("heroImage2");
      expect(res.body.photos).toHaveProperty("heroImage3");
    });

    it("allows admin to update about photos via PUT", async () => {
      const res = await request(app)
        .put("/api/admin/settings/about-photos")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          heroImage1: "https://images.unsplash.com/about-1.jpg",
          heroImage2: "https://images.unsplash.com/about-2.jpg",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.photos.heroImage1).toBe("https://images.unsplash.com/about-1.jpg");
      expect(res.body.photos.heroImage2).toBe("https://images.unsplash.com/about-2.jpg");
    });

    it("allows uploading a photo for a specific slot via POST /api/admin/settings/about-photos/upload", async () => {
      const fakeImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const res = await request(app)
        .post("/api/admin/settings/about-photos/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("slot", "2")
        .attach("image", fakeImageBuffer, { filename: "about-slot-2.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.photos.heroImage2).toBe("/uploads/listings/mock-banner-uuid.jpg");
    });

    it("blocks buyers and sellers from modifying about photos with 403", async () => {
      const buyerRes = await request(app)
        .put("/api/admin/settings/about-photos")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ heroImage1: "https://evil.com/photo.jpg" });

      expect(buyerRes.status).toBe(403);
      expect(buyerRes.body.code).toBe("ROLE_FORBIDDEN");
    });

    it("auto-normalizes relative paths without leading slash", async () => {
      const res = await request(app)
        .put("/api/admin/settings/about-photos")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ heroImage3: "uploads/listings/sample-photo.png" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.photos.heroImage3).toBe("/uploads/listings/sample-photo.png");
    });

    it("handles multiline base64 data URIs in about photos PUT", async () => {
      const multiLineBase64 =
        "data:image/jpeg;base64,\n/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////\nwgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
      const res = await request(app)
        .put("/api/admin/settings/about-photos")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ heroImage1: multiLineBase64 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.photos.heroImage1).toBe("/uploads/listings/mock-banner-uuid.jpg");
    });
  });

  describe("About Page Categories API", () => {
    it("allows public access to GET /api/settings/about-categories without token", async () => {
      const res = await request(app).get("/api/settings/about-categories");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("categories");
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body.categories.length).toBeGreaterThan(0);
      expect(res.body.categories[0]).toHaveProperty("name");
      expect(res.body.categories[0]).toHaveProperty("imageUrl");
    });

    it("allows admin to update about categories via PUT", async () => {
      const updatedList = [
        { name: "Vintage & Antiquities", slug: "vintage", imageUrl: "https://images.unsplash.com/vintage.jpg", displayOrder: 1, isDisplayed: true },
        { name: "Supercars", slug: "supercars", imageUrl: "/hero-auction-marketplace.png", displayOrder: 2, isDisplayed: true },
      ];

      const res = await request(app)
        .put("/api/admin/settings/about-categories")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ categories: updatedList });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.categories.length).toBe(2);
      expect(res.body.categories[0].name).toBe("Vintage & Antiquities");
      expect(res.body.categories[0].imageUrl).toBe("https://images.unsplash.com/vintage.jpg");

      // Verify public GET returns the updated list
      const getRes = await request(app).get("/api/settings/about-categories");
      expect(getRes.status).toBe(200);
      expect(getRes.body.categories.length).toBe(2);
      expect(getRes.body.categories[0].name).toBe("Vintage & Antiquities");
    });

    it("allows uploading a category photo via POST /api/admin/settings/about-categories/upload", async () => {
      const fakeImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const res = await request(app)
        .post("/api/admin/settings/about-categories/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", fakeImageBuffer, { filename: "category-photo.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.imageUrl).toBe("/uploads/listings/mock-banner-uuid.jpg");
    });

    it("blocks buyers and sellers from updating about categories with 403", async () => {
      const res = await request(app)
        .put("/api/admin/settings/about-categories")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ categories: [] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_FORBIDDEN");
    });
  });
});
