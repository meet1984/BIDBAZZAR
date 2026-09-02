import { describe, expect, it, vi } from "vitest";
import { LegalPageRepository } from "../src/modules/legal-pages/legal-page.repository.js";
import { pool } from "../src/database/pool.js";

describe("LegalPage Repository & Data Layer", () => {
  it("returns fallback default data when table is unpopulated or query fails", async () => {
    const repo = new LegalPageRepository();
    const terms = await repo.findBySlug("terms");
    expect(terms).not.toBeNull();
    expect(terms?.slug).toBe("terms");
    expect(terms?.title).toContain("Terms");
    expect(terms?.contentHtml).toContain("<h2>1. Marketplace Overview & Account Accuracy</h2>");

    const privacy = await repo.findBySlug("privacy");
    expect(privacy).not.toBeNull();
    expect(privacy?.slug).toBe("privacy");
    expect(privacy?.title).toContain("Privacy");
    expect(privacy?.contentHtml).toContain("<h2>1. Information We Collect</h2>");
  });

  it("handles upsert and queries database row correctly", async () => {
    const mockExecute = vi.spyOn(pool, "execute").mockImplementation(async (sql: unknown, params?: unknown) => {
      const sqlString = typeof sql === "string" ? sql : "";
      if (sqlString.includes("SELECT * FROM legal_pages")) {
        const slug = Array.isArray(params) ? params[0] : "terms";
        return [
          [
            {
              id: 1,
              slug,
              title: "Updated Terms of Service",
              content_html: "<p>Custom Admin HTML</p>",
              updated_by: 42,
              created_at: new Date("2026-01-01T00:00:00Z"),
              updated_at: new Date("2026-01-02T00:00:00Z"),
            },
          ],
          [],
        ] as never;
      }
      return [{ affectedRows: 1 }] as never;
    });

    const repo = new LegalPageRepository();
    const result = await repo.upsertPage("terms", {
      title: "Updated Terms of Service",
      contentHtml: "<p>Custom Admin HTML</p>",
      updatedBy: 42,
    });

    expect(result.id).toBe(1);
    expect(result.slug).toBe("terms");
    expect(result.title).toBe("Updated Terms of Service");
    expect(result.contentHtml).toBe("<p>Custom Admin HTML</p>");
    expect(result.updatedBy).toBe(42);

    mockExecute.mockRestore();
  });
});
