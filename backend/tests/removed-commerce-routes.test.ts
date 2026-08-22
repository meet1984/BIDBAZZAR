import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("removed platform commerce routes", () => {
  const app = createApp();

  it.each([
    ["get", "/api/payments/1"],
    ["post", "/api/payments/webhook"],
    ["get", "/api/delivery/orders/1"],
    ["post", "/api/orders/1/await-payment"],
  ] as const)("returns 404 for %s %s", async (method, route) => {
    const response = method === "get"
      ? await request(app).get(route)
      : await request(app).post(route);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("ROUTE_NOT_FOUND");
  });
});
