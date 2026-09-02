import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LegalPage from "./LegalPage";
import api from "../lib/api";

vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../components", () => ({
  Navbar: () => <nav data-testid="mock-navbar">Navbar</nav>,
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
  Link: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Public LegalPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders Terms & Conditions from API", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        title: "BidMyLot Master Terms & Conditions",
        contentHtml: "<h2>1. General Rules</h2><p>Custom API terms text.</p>",
        updatedAt: "2026-09-02T10:00:00Z",
      },
    });

    render(<LegalPage type="terms" />);

    expect(api.get).toHaveBeenCalledWith("/legal-pages/terms");

    await waitFor(() => {
      expect(screen.getAllByText("BidMyLot Master Terms & Conditions").length).toBeGreaterThan(0);
      expect(screen.getByText("1. General Rules")).toBeDefined();
      expect(screen.getByText("Custom API terms text.")).toBeDefined();
    });
  });

  it("fetches and renders Privacy Policy from API", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        title: "BidMyLot Privacy Notice",
        contentHtml: "<h2>1. Data Collection</h2><p>Custom API privacy text.</p>",
        updatedAt: "2026-09-02T10:00:00Z",
      },
    });

    render(<LegalPage type="privacy" />);

    expect(api.get).toHaveBeenCalledWith("/legal-pages/privacy");

    await waitFor(() => {
      expect(screen.getAllByText("BidMyLot Privacy Notice").length).toBeGreaterThan(0);
      expect(screen.getByText("1. Data Collection")).toBeDefined();
      expect(screen.getByText("Custom API privacy text.")).toBeDefined();
    });
  });

  it("gracefully displays fallback content when API request fails", async () => {
    api.get.mockRejectedValueOnce(new Error("Network error"));

    render(<LegalPage type="terms" />);

    await waitFor(() => {
      expect(screen.getAllByText("Marketplace Terms & Conditions").length).toBeGreaterThan(0);
      expect(screen.getByText("1. Marketplace Overview & Account Accuracy")).toBeDefined();
    });
  });
});
