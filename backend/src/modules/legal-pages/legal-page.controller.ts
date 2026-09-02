import type { Request, Response } from "express";
import { legalPageService } from "./legal-page.service.js";
import type { LegalPageSlug } from "./legal-page.types.js";
import type { UpdateLegalPageInput } from "./legal-page.schemas.js";
import { AppError } from "../../shared/AppError.js";

export const legalPageController = {
  async getPublicPage(request: Request, response: Response) {
    const slug = request.params.slug as LegalPageSlug;
    const page = await legalPageService.getPublicPage(slug);
    response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    response.json({
      page,
      title: page.title,
      contentHtml: page.contentHtml,
      content_html: page.content_html,
      updatedAt: page.updatedAt,
    });
  },

  async getAdminPage(request: Request, response: Response) {
    const slug = request.params.slug as LegalPageSlug;
    const page = await legalPageService.getAdminPage(slug);
    response.json({ page });
  },

  async updateAdminPage(request: Request, response: Response) {
    const slug = request.params.slug as LegalPageSlug;
    const adminId = request.auth?.id;
    if (!adminId) {
      throw new AppError(401, "AUTH_REQUIRED", "Sign in as an administrator to update legal pages.");
    }

    const input = request.body as UpdateLegalPageInput;
    const page = await legalPageService.updatePage(slug, input, adminId);
    response.json({ success: true, page });
  },
};
