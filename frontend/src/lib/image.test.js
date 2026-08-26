import { describe, expect, it, afterEach } from "vitest";
import { resolveImageUrl, getBackendBaseUrl, DEFAULT_FALLBACK_IMAGE } from "./image";

describe("getBackendBaseUrl", () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    import.meta.env.VITE_BACKEND_URL = originalEnv.VITE_BACKEND_URL;
    import.meta.env.VITE_API_URL = originalEnv.VITE_API_URL;
  });

  it("returns empty string when no backend url is configured", () => {
    delete import.meta.env.VITE_BACKEND_URL;
    delete import.meta.env.VITE_API_URL;
    expect(getBackendBaseUrl()).toBe("");
  });

  it("prefers VITE_BACKEND_URL over VITE_API_URL", () => {
    import.meta.env.VITE_BACKEND_URL = "https://backend.bidmylot.com/";
    import.meta.env.VITE_API_URL = "https://api.bidmylot.com/api";
    expect(getBackendBaseUrl()).toBe("https://backend.bidmylot.com");
  });
});

describe("resolveImageUrl", () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    import.meta.env.VITE_BACKEND_URL = originalEnv.VITE_BACKEND_URL;
    import.meta.env.VITE_API_URL = originalEnv.VITE_API_URL;
  });

  it("returns fallback for null, undefined, or empty string", () => {
    expect(resolveImageUrl(null)).toBe(DEFAULT_FALLBACK_IMAGE);
    expect(resolveImageUrl(undefined)).toBe(DEFAULT_FALLBACK_IMAGE);
    expect(resolveImageUrl("")).toBe(DEFAULT_FALLBACK_IMAGE);
    expect(resolveImageUrl("   ")).toBe(DEFAULT_FALLBACK_IMAGE);
    expect(resolveImageUrl(null, "/custom-fallback.png")).toBe("/custom-fallback.png");
  });

  it("returns absolute URLs unchanged", () => {
    const httpsUrl = "https://images.unsplash.com/photo-12345";
    const httpUrl = "http://example.com/image.jpg";
    expect(resolveImageUrl(httpsUrl)).toBe(httpsUrl);
    expect(resolveImageUrl(httpUrl)).toBe(httpUrl);
  });

  it("returns data URIs and blob URLs unchanged", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const blobUrl = "blob:http://localhost:5173/123e4567-e89b-12d3-a456-426614174000";
    expect(resolveImageUrl(dataUri)).toBe(dataUri);
    expect(resolveImageUrl(blobUrl)).toBe(blobUrl);
  });

  it("prepends VITE_BACKEND_URL when configured for /uploads paths", () => {
    import.meta.env.VITE_BACKEND_URL = "https://api.bidmylot.com";
    expect(resolveImageUrl("/uploads/listings/image-123.jpg")).toBe(
      "https://api.bidmylot.com/uploads/listings/image-123.jpg"
    );
    expect(resolveImageUrl("uploads/listings/image-123.jpg")).toBe(
      "https://api.bidmylot.com/uploads/listings/image-123.jpg"
    );
  });

  it("derives backend origin from full VITE_API_URL if VITE_BACKEND_URL is not set", () => {
    delete import.meta.env.VITE_BACKEND_URL;
    import.meta.env.VITE_API_URL = "https://api.bidmylot.com/api";
    expect(resolveImageUrl("/uploads/listings/sample.webp")).toBe(
      "https://api.bidmylot.com/uploads/listings/sample.webp"
    );
  });

  it("leaves standard relative static assets as relative when no backend URL is set", () => {
    delete import.meta.env.VITE_BACKEND_URL;
    import.meta.env.VITE_API_URL = "/api";
    expect(resolveImageUrl("/hero-auction-marketplace.png")).toBe(
      "/hero-auction-marketplace.png"
    );
    expect(resolveImageUrl("/uploads/listings/sample.jpg")).toBe(
      "/uploads/listings/sample.jpg"
    );
  });
});
