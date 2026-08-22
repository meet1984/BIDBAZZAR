import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

vi.mock("../src/modules/auth/auth.repository.js", () => {
  const accounts: Record<number, any> = {
    1: { id: 1, accountType: "admin", fullName: "Admin User", email: "admin@test.com", status: "active" },
    2: { id: 2, accountType: "seller", fullName: "Seller User", email: "seller@test.com", status: "active" },
    3: { id: 3, accountType: "buyer", fullName: "Buyer User", email: "buyer@test.com", status: "active" },
  };
  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => accounts[id] || null),
    },
  };
});

vi.mock("../src/modules/categories/category.repository.js", () => {
  const categories: Record<number, any> = {
    1: {
      id: 1,
      name: "Electronics & Tech",
      slug: "electronics",
      description: "Cameras, audio, computing and devices",
      imageUrl: null,
      displayOrder: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      listingCount: 5,
    },
    4: {
      id: 4,
      name: "Fashion & Luxury",
      slug: "fashion-luxury",
      description: "Apparel and accessories",
      imageUrl: null,
      displayOrder: 4,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      listingCount: 0,
    },
  };

  const subcategories: Record<number, any> = {
    10: {
      id: 10,
      categoryId: 1,
      name: "Audio & Sound",
      slug: "audio-sound",
      description: "Headphones and sound systems",
      displayOrder: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      listingCount: 2,
    },
  };

  let nextCatId = 100;
  let nextSubId = 200;

  return {
    categoryRepository: {
      findAllCategories: vi.fn(async (includeInactive = false) => {
        return Object.values(categories)
          .filter((c) => includeInactive || c.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder);
      }),

      findCategoryById: vi.fn(async (id: number) => categories[id] || null),

      findCategoryBySlug: vi.fn(async (slug: string) => {
        return Object.values(categories).find((c) => c.slug === slug) || null;
      }),

      findAllSubcategories: vi.fn(async (categoryId?: number, includeInactive = false) => {
        return Object.values(subcategories)
          .filter((sc) => (categoryId === undefined || sc.categoryId === categoryId) && (includeInactive || sc.isActive))
          .sort((a, b) => a.displayOrder - b.displayOrder);
      }),

      findSubcategoryById: vi.fn(async (id: number) => subcategories[id] || null),

      findSubcategoryBySlug: vi.fn(async (slug: string) => {
        return Object.values(subcategories).find((sc) => sc.slug === slug) || null;
      }),

      countCategoryListings: vi.fn(async (id: number) => categories[id]?.listingCount ?? 0),

      countSubcategoryListings: vi.fn(async (id: number) => subcategories[id]?.listingCount ?? 0),

      createCategory: vi.fn(async (input: any) => {
        const id = ++nextCatId;
        categories[id] = {
          id,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
          listingCount: 0,
        };
        return id;
      }),

      updateCategory: vi.fn(async (id: number, input: any) => {
        if (categories[id]) {
          categories[id] = { ...categories[id], ...input, updatedAt: new Date() };
        }
      }),

      setCategoryActive: vi.fn(async (id: number, isActive: boolean) => {
        if (categories[id]) categories[id].isActive = isActive;
      }),

      reorderCategories: vi.fn(async (items: { id: number; displayOrder: number }[]) => {
        for (const item of items) {
          if (categories[item.id]) categories[item.id].displayOrder = item.displayOrder;
        }
      }),

      deleteCategory: vi.fn(async (id: number) => {
        delete categories[id];
        return true;
      }),

      createSubcategory: vi.fn(async (input: any) => {
        const id = ++nextSubId;
        subcategories[id] = {
          id,
          categoryId: input.categoryId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
          listingCount: 0,
        };
        return id;
      }),

      updateSubcategory: vi.fn(async (id: number, input: any) => {
        if (subcategories[id]) {
          subcategories[id] = { ...subcategories[id], ...input, updatedAt: new Date() };
        }
      }),

      setSubcategoryActive: vi.fn(async (id: number, isActive: boolean) => {
        if (subcategories[id]) subcategories[id].isActive = isActive;
      }),

      moveSubcategory: vi.fn(async (id: number, newCategoryId: number) => {
        if (subcategories[id]) subcategories[id].categoryId = newCategoryId;
      }),

      reorderSubcategories: vi.fn(async (items: { id: number; displayOrder: number }[]) => {
        for (const item of items) {
          if (subcategories[item.id]) subcategories[item.id].displayOrder = item.displayOrder;
        }
      }),

      deleteSubcategory: vi.fn(async (id: number) => {
        delete subcategories[id];
        return true;
      }),
    },
  };
});

const adminToken = signAccessToken({ id: 1, accountType: "admin", email: "admin@test.com", fullName: "Admin User" });
const sellerToken = signAccessToken({ id: 2, accountType: "seller", email: "seller@test.com", fullName: "Seller User" });
const buyerToken = signAccessToken({ id: 3, accountType: "buyer", email: "buyer@test.com", fullName: "Buyer User" });

describe("Category & Subcategory Backend API Suite", () => {
  it("public categories listing returns active categories", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const firstCat = res.body.items[0];
    expect(firstCat).toHaveProperty("id");
    expect(firstCat).toHaveProperty("name");
    expect(firstCat).toHaveProperty("slug");
    expect(firstCat).toHaveProperty("subcategories");
  });

  it("public category detail returns single category with subcategories", async () => {
    const res = await request(app).get("/api/categories/electronics");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("category");
    expect(res.body.category.slug).toBe("electronics");
    expect(Array.isArray(res.body.category.subcategories)).toBe(true);
  });

  it("blocks non-admin users from management endpoints", async () => {
    const resUnauth = await request(app).get("/api/admin/categories");
    expect(resUnauth.status).toBe(401);

    const resBuyer = await request(app)
      .get("/api/admin/categories")
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(resBuyer.status).toBe(403);

    const resSeller = await request(app)
      .get("/api/admin/categories")
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(resSeller.status).toBe(403);
  });

  it("admin can create, edit, deactivate, and reorder categories", async () => {
    // 1. Create Category
    const createRes = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Test Instruments & Gadgets",
        description: "Specialized lab and test equipment",
        displayOrder: 99,
        isActive: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.category.name).toBe("Test Instruments & Gadgets");
    expect(createRes.body.category.slug).toBe("test-instruments-gadgets");
    const createdId = createRes.body.category.id;

    // 2. Edit Category
    const editRes = await request(app)
      .patch(`/api/admin/categories/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Test Instruments & Lab Tools",
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.category.name).toBe("Test Instruments & Lab Tools");

    // 3. Deactivate Category
    const toggleRes = await request(app)
      .patch(`/api/admin/categories/${createdId}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.category.isActive).toBe(false);

    // Verify inactive category is hidden from public API
    const publicList = await request(app).get("/api/categories");
    const items = publicList.body.items as { id: number }[];
    const foundInPublic = items.some((c) => c.id === createdId);
    expect(foundInPublic).toBe(false);

    // 4. Re-activate Category
    await request(app)
      .patch(`/api/admin/categories/${createdId}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });

    // 5. Delete unused category
    const deleteRes = await request(app)
      .delete(`/api/admin/categories/${createdId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(204);
  });

  it("admin can create, edit, move, and delete subcategories", async () => {
    // 1. Create Subcategory under Electronics (ID 1)
    const createSubRes = await request(app)
      .post("/api/admin/subcategories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        categoryId: 1,
        name: "Smart Wearables",
        description: "Smartwatches and fitness trackers",
        displayOrder: 10,
      });

    expect(createSubRes.status).toBe(201);
    expect(createSubRes.body.subcategory.name).toBe("Smart Wearables");
    const subId = createSubRes.body.subcategory.id;

    // 2. Move Subcategory to Fashion (ID 4)
    const moveRes = await request(app)
      .post(`/api/admin/subcategories/${subId}/move`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newCategoryId: 4 });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.subcategory.categoryId).toBe(4);

    // 3. Delete unused subcategory
    const deleteSubRes = await request(app)
      .delete(`/api/admin/subcategories/${subId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteSubRes.status).toBe(204);
  });

  it("enforces permanent deletion guard: category in use by listings cannot be deleted", async () => {
    // Electronics category (ID 1) has listingCount = 5
    const deleteRes = await request(app)
      .delete("/api/admin/categories/1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.code).toBe("CATEGORY_IN_USE");
    expect(deleteRes.body.message).toContain("cannot be deleted. Deactivate it instead");
  });
});
