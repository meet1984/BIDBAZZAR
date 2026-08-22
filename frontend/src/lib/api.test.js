import { describe, expect, it } from "vitest";
import api, { setAccessToken } from "./api";

describe("Frontend API Client Configuration", () => {
  it("has a configured request timeout to prevent hanging connections", () => {
    expect(api.defaults.timeout).toBe(15000);
  });

  it("has withCredentials enabled for cookie-based refresh tokens", () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("sets and injects access token into outgoing request headers", async () => {
    setAccessToken("test_mock_jwt_token_12345");

    // Test the request interceptor directly
    const interceptor = api.interceptors.request.handlers[0];
    const config = await interceptor.fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer test_mock_jwt_token_12345");
  });
});
