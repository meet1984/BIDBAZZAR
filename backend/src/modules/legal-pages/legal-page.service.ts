import { AppError } from "../../shared/AppError.js";
import { legalPageRepository, LegalPageRepository } from "./legal-page.repository.js";
import type { LegalPageRecord, LegalPageSlug } from "./legal-page.types.js";
import type { UpdateLegalPageInput } from "./legal-page.schemas.js";

export class LegalPageService {
  constructor(private readonly repo: LegalPageRepository = legalPageRepository) {}

  async getPublicPage(slug: LegalPageSlug): Promise<{
    slug: LegalPageSlug;
    title: string;
    contentHtml: string;
    content_html: string;
    updatedAt: Date;
  }> {
    const page = await this.repo.findBySlug(slug);
    if (!page) {
      throw new AppError(404, "PAGE_NOT_FOUND", `Legal page '${slug}' was not found.`);
    }

    return {
      slug: page.slug,
      title: page.title,
      contentHtml: page.contentHtml,
      content_html: page.contentHtml,
      updatedAt: page.updatedAt,
    };
  }

  async getAdminPage(slug: LegalPageSlug): Promise<LegalPageRecord & { content_html: string }> {
    const page = await this.repo.findBySlug(slug);
    if (!page) {
      throw new AppError(404, "PAGE_NOT_FOUND", `Legal page '${slug}' was not found.`);
    }

    return {
      ...page,
      content_html: page.contentHtml,
    };
  }

  async updatePage(
    slug: LegalPageSlug,
    input: UpdateLegalPageInput,
    updatedBy: number,
  ): Promise<LegalPageRecord & { content_html: string }> {
    const updated = await this.repo.upsertPage(slug, {
      title: input.title,
      contentHtml: input.contentHtml,
      updatedBy,
    });

    return {
      ...updated,
      content_html: updated.contentHtml,
    };
  }
}

export const legalPageService = new LegalPageService();
