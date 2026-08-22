import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { isAllowedOrigin } from "../src/config/env.js";

describe("CORS & Origin Validation Tests", () => {
  it("validates allowed origins correctly in dev/test environment", () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(isAllowedOrigin("http://192.168.1.50:5173")).toBe(true);
    expect(isAllowedOrigin("http://10.0.0.5:3000")).toBe(true);
  });

  it("handles valid CORS request headers properly", async () => {
    const testApp = createApp();
    const res = await request(testApp)
      .get("/api/settings/public")
      .set("Origin", "http://127.0.0.1:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("handles disallowed CORS request gracefully without throwing a 500 server error", async () => {
    const testApp = createApp();
    const res = await request(testApp)
      .get("/api/settings/public")
      .set("Origin", "http://unauthorized-domain.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.status).not.toBe(500);
  });
});
