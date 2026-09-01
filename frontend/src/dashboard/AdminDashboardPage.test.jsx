import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminDashboardPage from "./AdminDashboardPage";

// Mock AuthContext
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, accountType: "admin", email: "admin@test.com", fullName: "Admin User" },
    logout: vi.fn(),
  }),
}));

// Mock API
vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(async (url) => {
      if (url === "/dashboard/admin") {
        return { data: { pendingAuctions: [], users: [], enquiries: [] } };
      }
      if (url === "/settings/about-photos") {
        return {
          data: {
            photos: {
              heroImage1: "/hero-auction-marketplace.png",
              heroImage2: "/hero-auction-marketplace.png",
              heroImage3: "/hero-auction-marketplace.png",
            },
          },
        };
      }
      if (url === "/settings/about-categories") {
        return {
          data: {
            categories: [
              { id: 1, name: "Electronics & Tech", slug: "electronics", imageUrl: "/hero-auction-marketplace.png", displayOrder: 1, isDisplayed: true },
              { id: 2, name: "Automotive & Vehicles", slug: "vehicles", imageUrl: "/hero-auction-marketplace.png", displayOrder: 2, isDisplayed: true },
            ],
          },
        };
      }
      if (url === "/admin/categories") {
        return {
          data: {
            categories: [
              { id: 1, name: "Electronics & Tech", slug: "electronics", isActive: true },
              { id: 2, name: "Automotive & Vehicles", slug: "vehicles", isActive: true },
              { id: 3, name: "Jewelry & Watches", slug: "jewelry-watches", isActive: true },
            ],
          },
        };
      }
      if (url === "/settings/how-it-works-banner") {
        return { data: { bannerUrl: "/hero-auction-marketplace.png" } };
      }
      if (url === "/admin/listings") {
        return { data: { items: [] } };
      }
      if (url === "/admin/users") {
        return { data: { items: [] } };
      }
      if (url === "/admin/support/enquiries") {
        return { data: { items: [] } };
      }
      return { data: {} };
    }),
    put: vi.fn(async (_url, body) => ({ data: { success: true, photos: body, categories: body?.categories } })),
    post: vi.fn(async () => ({ data: { success: true, imageUrl: "/hero-auction-marketplace.png" } })),
    patch: vi.fn(async () => ({ data: { success: true } })),
    delete: vi.fn(async () => ({ data: { success: true } })),
  },
}));

describe("AdminDashboardPage Component", () => {
  it("renders Admin Dashboard without throwing reference errors", async () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText(/Platform Administration Command Center/i)).toBeDefined();
  });

  it("switches to About Page Photos tab without errors and renders categories showcase", async () => {
    render(<AdminDashboardPage />);
    const aboutTabButtons = screen.getAllByRole("button", { name: /About Page Photos/i });
    expect(aboutTabButtons.length).toBeGreaterThan(0);
    fireEvent.click(aboutTabButtons[0]);

    expect(screen.getByText(/About Page Hero Catalogue Photos/i)).toBeDefined();
    expect(screen.getAllByText(/Slot 1: Collectibles/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Slot 2: Electronics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Slot 3: Lifestyle/i).length).toBeGreaterThan(0);

    // Verify Category Showcase controls
    expect(screen.getByText(/About Page Category Tiles & Photos/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Save Category Showcase/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Add to Showcase/i })).toBeDefined();
  });
});
