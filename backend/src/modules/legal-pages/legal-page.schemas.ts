import { z } from "zod";

export const legalPageSlugParamSchema = z.object({
  slug: z.enum(["terms", "privacy"]),
});

export const updateLegalPageSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        title: obj.title,
        contentHtml: obj.contentHtml !== undefined ? obj.contentHtml : obj.content_html,
      };
    }
    return val;
  },
  z.object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty.")
      .max(200, "Title cannot exceed 200 characters."),
    contentHtml: z
      .string()
      .trim()
      .min(1, "Content HTML cannot be empty.")
      .max(200 * 1024, "Content HTML exceeds maximum length of 200KB (204,800 characters)."),
  }),
);

export type LegalPageSlugParam = z.infer<typeof legalPageSlugParamSchema>;
export type UpdateLegalPageInput = z.infer<typeof updateLegalPageSchema>;
