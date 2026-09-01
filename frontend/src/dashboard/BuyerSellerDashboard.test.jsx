import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BuyerDashboardPage from "./BuyerDashboardPage";
import SellerDashboardPage from "./SellerDashboardPage";

// Mock AuthContext
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 2, accountType: "seller", email: "user@test.com", fullName: "Test User" },
    logout: vi.fn(),
  }),
}));

// Mock API
vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(async (url) => {
      if (url === "/buyer/offers") return { data: { items: [] } };
      if (url === "/multi-unit-offers/my-offers") return { data: { items: [] } };
      if (url === "/watchlist") return { data: { items: [] } };
      if (url === "/support/my-enquiries") return { data: { items: [] } };
      if (url === "/verification/status") return { data: { verificationStatus: "verified" } };
      if (url === "/seller/listings") return { data: { items: [] } };
      return { data: {} };
    }),
    post: vi.fn(async () => ({ data: { success: true } })),
    put: vi.fn(async () => ({ data: { success: true } })),
    delete: vi.fn(async () => ({ data: { success: true } })),
  },
}));

describe("BuyerDashboardPage & SellerDashboardPage", () => {
  it("renders BuyerDashboardPage and toggles to Support tab", async () => {
    render(<BuyerDashboardPage />);
    expect(screen.getByText(/My Offers & Activity/i)).toBeDefined();

    const supportButtons = screen.getAllByRole("button", { name: /Support & Complaints/i });
    expect(supportButtons.length).toBeGreaterThan(0);
    fireEvent.click(supportButtons[0]);

    expect(screen.getByText(/Buyer Support & Complaints/i)).toBeDefined();
    expect(screen.getByText(/Support & Complaints Portal/i)).toBeDefined();
  });

  it("renders SellerDashboardPage and toggles to Support tab", async () => {
    render(<SellerDashboardPage />);
    expect(screen.getByText(/Seller Workspace/i)).toBeDefined();

    const supportTabButton = screen.getByRole("button", { name: /Support Tickets/i });
    fireEvent.click(supportTabButton);

    expect(screen.getAllByText(/Support Tickets/i).length).toBeGreaterThan(0);
  });
});
