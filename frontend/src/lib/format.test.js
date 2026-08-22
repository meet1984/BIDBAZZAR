import { describe, expect, it } from "vitest";
import {
  errorMessage,
  formatCurrency,
  formatDateTime,
  formatINR,
} from "./format";

describe("Frontend Formatting & Parsing Utilities", () => {
  describe("formatINR", () => {
    it("formats Indian Rupee numbers with standard locale separators", () => {
      const formatted = formatINR(100000);
      expect(formatted).toContain("1,00,000");

      const formattedSmall = formatINR(500);
      expect(formattedSmall).toContain("500");
    });

    it("handles zero, null, undefined, and non-numeric inputs gracefully", () => {
      expect(formatINR(0)).toBe("₹0");
      expect(formatINR(null)).toBe("₹0");
      expect(formatINR(undefined)).toBe("₹0");
      expect(formatINR("invalid")).toBe("₹0");
    });
  });

  describe("formatCurrency", () => {
    it("formats amounts in specified currency", () => {
      const formatted = formatCurrency(5000, "INR");
      expect(formatted).toContain("5,000");
    });

    it("handles null or non-numeric amounts with a fallback dash", () => {
      expect(formatCurrency(null)).toBe("—");
      expect(formatCurrency(undefined)).toBe("—");
    });
  });

  describe("formatDateTime", () => {
    it("formats valid Date objects and ISO strings with Asia/Kolkata timezone", () => {
      const d = new Date("2026-08-21T12:00:00Z");
      const formatted = formatDateTime(d);
      expect(formatted).not.toBe("Not available");
      expect(formatted.length).toBeGreaterThan(5);
    });

    it("returns 'Not available' for null, undefined, or invalid dates", () => {
      expect(formatDateTime(null)).toBe("Not available");
      expect(formatDateTime(undefined)).toBe("Not available");
      expect(formatDateTime("not-a-valid-date")).toBe("Not available");
    });
  });

  describe("errorMessage extraction", () => {
    it("extracts custom API response error messages", () => {
      const apiErr = {
        response: {
          data: {
            message: "The requested listing does not exist.",
          },
        },
      };
      expect(errorMessage(apiErr)).toBe("The requested listing does not exist.");
    });

    it("handles specific auth OTP error codes with user-friendly messages", () => {
      expect(errorMessage({ response: { data: { code: "OTP_EXPIRED" } } })).toContain("expired");
      expect(errorMessage({ response: { data: { code: "OTP_ATTEMPTS_EXCEEDED" } } })).toContain("Maximum verification attempts");
      expect(errorMessage({ response: { data: { code: "CHALLENGE_NOT_FOUND" } } })).toContain("verification session has expired");
      expect(errorMessage({ response: { status: 429 } })).toBe("Too many attempts, retry again later.");
      expect(errorMessage({ response: { data: { code: "RATE_LIMITED" } } })).toBe("Too many attempts, retry again later.");
    });

    it("extracts fieldErrors mapping if present", () => {
      const validationErr = {
        response: {
          data: {
            message: "Validation failed",
            details: {
              fieldErrors: {
                quantity: ["must be positive"],
                price: ["is required"],
              },
            },
          },
        },
      };
      const msg = errorMessage(validationErr);
      expect(msg).toContain("Validation failed");
      expect(msg).toContain("quantity: must be positive");
      expect(msg).toContain("price: is required");
    });

    it("falls back to standard error.message or custom fallback string", () => {
      const standardErr = new Error("Network timeout");
      expect(errorMessage(standardErr, "Default fallback")).toBe("Network timeout");

      expect(errorMessage(null, "Default fallback")).toBe("Default fallback");
    });
  });
});
