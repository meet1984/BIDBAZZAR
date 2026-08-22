import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";

// Mock DB repositories for admin user creation test
vi.mock("../src/modules/auth/auth.repository.js", () => {
  const usersStore: Record<number, any> = {
    1: { id: 1, accountType: "admin", role: "admin", isBuyer: false, isSeller: false, isAdmin: true, fullName: "Admin User", email: "admin@test.com", status: "active" },
  };

  return {
    authRepository: {
      findAccountById: vi.fn(async (id: number) => usersStore[id] || null),
      findAccountByEmail: vi.fn(async (email: string) => {
        return Object.values(usersStore).find((u) => u.email === email) || null;
      }),
      findUserById: vi.fn(async (id: number) => usersStore[id] || null),
      findUserByEmail: vi.fn(async (email: string) => {
        return Object.values(usersStore).find((u) => u.email === email) || null;
      }),
      storeRefreshToken: vi.fn(async () => {}),
      revokeAllUserTokens: vi.fn(async () => {}),
      __usersStore: usersStore,
    },
  };
});

vi.mock("../src/modules/users/user.repository.ts", () => ({
  userRepository: {
    createUser: vi.fn(async (input: any, _hash: string) => {
      const { authRepository } = await import("../src/modules/auth/auth.repository.js");
      const store = (authRepository as any).__usersStore;
      const id = 101;
      const targetType = input.accountType || input.role || "buyer";
      store[id] = {
        id,
        accountType: targetType,
        role: targetType,
        isBuyer: targetType === "buyer",
        isSeller: targetType === "seller",
        isAdmin: targetType === "admin",
        fullName: input.fullName,
        email: input.email,
        status: "active",
      };
      return id;
    }),
    find: vi.fn(async (id: number) => {
      const { authRepository } = await import("../src/modules/auth/auth.repository.js");
      const store = (authRepository as any).__usersStore;
      return store[id] || null;
    }),
  },
}));

describe("Admin Create User API", () => {
  const adminToken = signAccessToken({
    id: 1,
    accountType: "admin",
    role: "admin",
    isBuyer: false,
    isSeller: false,
    isAdmin: true,
    email: "admin@test.com",
    fullName: "Admin User",
  });

  it("creates a new buyer user as admin", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "buyer",
        fullName: "New Buyer",
        email: "newbuyer@test.com",
        password: "password123",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User created successfully.");
  });

  it("creates a new seller user as admin", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "seller",
        fullName: "New Seller",
        email: "newseller@test.com",
        password: "password123",
        sellerName: "Best Store",
        sellerType: "business",
      });

    expect(res.status).toBe(201);
  });

  it("creates a new admin user as admin", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "admin",
        fullName: "Second Admin",
        email: "admin2@test.com",
        password: "password123",
      });

    expect(res.status).toBe(201);
  });

  it("rejects non-admin requests", async () => {
    const buyerToken = signAccessToken({
      id: 2,
      accountType: "buyer",
      role: "buyer",
      isBuyer: true,
      isSeller: false,
      isAdmin: false,
      email: "buyer@test.com",
      fullName: "Buyer",
    });

    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        role: "buyer",
        fullName: "Test User",
        email: "test@test.com",
        password: "password123",
      });

    expect(res.status).toBe(403);
  });
});
