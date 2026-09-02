import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LegalPagesSection } from "./LegalPagesSection";
import api from "../lib/api";

vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe("LegalPagesSection Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays terms page content", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        page: {
          id: 1,
          slug: "terms",
          title: "Marketplace Terms & Conditions",
          contentHtml: "<h2>1. Marketplace Overview</h2><p>Default terms</p>",
          updatedAt: "2026-09-02T10:00:00Z",
          updatedBy: 1,
        },
      },
    });

    render(<LegalPagesSection />);

    expect(screen.getByText(/Loading legal page editor/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Marketplace Terms & Conditions")).toBeDefined();
      expect(screen.getByDisplayValue("<h2>1. Marketplace Overview</h2><p>Default terms</p>")).toBeDefined();
    });

    // Check that live preview contains the rendered heading
    expect(screen.getByText("1. Marketplace Overview")).toBeDefined();
  });

  it("switches to Privacy Policy tab and loads privacy page", async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          page: {
            id: 1,
            slug: "terms",
            title: "Marketplace Terms",
            contentHtml: "<p>Terms content</p>",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          page: {
            id: 2,
            slug: "privacy",
            title: "Privacy Policy Notice",
            contentHtml: "<h2>1. Data Collection</h2><p>Privacy content</p>",
          },
        },
      });

    render(<LegalPagesSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Marketplace Terms")).toBeDefined();
    });

    const privacyTab = screen.getByRole("button", { name: /Privacy Policy/i });
    fireEvent.click(privacyTab);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/admin/legal-pages/privacy");
      expect(screen.getByDisplayValue("Privacy Policy Notice")).toBeDefined();
      expect(screen.getByDisplayValue("<h2>1. Data Collection</h2><p>Privacy content</p>")).toBeDefined();
    });
  });

  it("saves edited HTML content successfully", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        page: {
          id: 1,
          slug: "terms",
          title: "Original Terms",
          contentHtml: "<p>Original text</p>",
          updatedAt: "2026-09-01T12:00:00Z",
        },
      },
    });

    api.put.mockResolvedValueOnce({
      data: {
        success: true,
        page: {
          id: 1,
          slug: "terms",
          title: "Updated Terms 2026",
          contentHtml: "<h2>Updated Section</h2><p>New text</p>",
          updatedAt: "2026-09-02T10:30:00Z",
          updatedBy: 1,
        },
      },
    });

    render(<LegalPagesSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original Terms")).toBeDefined();
    });

    const titleInput = screen.getByDisplayValue("Original Terms");
    fireEvent.change(titleInput, { target: { value: "Updated Terms 2026" } });

    const textarea = screen.getByDisplayValue("<p>Original text</p>");
    fireEvent.change(textarea, { target: { value: "<h2>Updated Section</h2><p>New text</p>" } });

    const saveButton = screen.getByRole("button", { name: /Save & Publish/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/admin/legal-pages/terms", {
        title: "Updated Terms 2026",
        contentHtml: "<h2>Updated Section</h2><p>New text</p>",
      });
      expect(screen.getByText(/published successfully/i)).toBeDefined();
    });
  });
});
