import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("health routes", () => {
  const app = createApp();

  it.each([
    "/health",
    "/api/health",
    "/api",
    "/api/",
  ])("returns valid health status object on %s", async (route) => {
    const response = await request(app).get(route);
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty("status");
    expect(["healthy", "unhealthy"]).toContain(response.body.status);
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("services");
    expect(response.body.services).toHaveProperty("database");
    expect(["ok", "error"]).toContain(response.body.services.database);
  });

  it("still returns 404 ROUTE_NOT_FOUND for unknown routes", async () => {
    const response = await request(app).get("/api/non-existent-endpoint");
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("ROUTE_NOT_FOUND");
  });
});
