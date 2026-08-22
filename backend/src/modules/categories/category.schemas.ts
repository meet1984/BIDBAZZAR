import { z } from "zod";

const sanitizeString = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim() : v),
    z.string().min(min).max(max),
  );

export const publicCategoryQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  withSubcategories: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
});

export const categoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const categoryIdentifierSchema = z.object({
  identifier: z.string().trim().min(1).max(120).regex(/^(?:\d+|[a-z0-9-]+)$/i),
});

export const subcategoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createCategorySchema = z.object({
  name: sanitizeString(2, 100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.")
    .max(100)
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const reorderCategoriesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        displayOrder: z.coerce.number().int().min(0),
      }),
    )
    .min(1, "At least one item must be provided for reordering."),
});

export const createSubcategorySchema = z.object({
  categoryId: z.coerce.number().int().positive("Parent category ID is required."),
  name: sanitizeString(2, 100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.")
    .max(100)
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateSubcategorySchema = createSubcategorySchema
  .omit({ categoryId: true })
  .partial();

export const reorderSubcategoriesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        displayOrder: z.coerce.number().int().min(0),
      }),
    )
    .min(1, "At least one item must be provided for reordering."),
});

export const moveSubcategorySchema = z.object({
  newCategoryId: z.coerce.number().int().positive("New parent category ID is required."),
});

export const toggleActiveSchema = z.object({ isActive: z.boolean() }).strict();

export type PublicCategoryQuery = z.infer<typeof publicCategoryQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;
export type ReorderSubcategoriesInput = z.infer<typeof reorderSubcategoriesSchema>;
export type MoveSubcategoryInput = z.infer<typeof moveSubcategorySchema>;
