import { Router } from "express";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import { categoryController } from "./category.controller.js";
import {
  categoryIdParamSchema,
  categoryIdentifierSchema,
  createCategorySchema,
  createSubcategorySchema,
  moveSubcategorySchema,
  publicCategoryQuerySchema,
  reorderCategoriesSchema,
  reorderSubcategoriesSchema,
  subcategoryIdParamSchema,
  toggleActiveSchema,
  updateCategorySchema,
  updateSubcategorySchema,
} from "./category.schemas.js";

export const publicCategoryRouter = Router();
publicCategoryRouter.get(
  "/",
  validate(publicCategoryQuerySchema, "query"),
  asyncHandler(categoryController.listPublic),
);
publicCategoryRouter.get("/:identifier", validate(categoryIdentifierSchema, "params"), asyncHandler(categoryController.publicDetail));

export const adminCategoryRouter = Router();
adminCategoryRouter.use(["/categories", "/subcategories"], requireAdminPermission("category_management"));

// Category management
adminCategoryRouter.get("/categories", asyncHandler(categoryController.listAdmin));
adminCategoryRouter.post(
  "/categories",
  validate(createCategorySchema),
  asyncHandler(categoryController.createCategory),
);
adminCategoryRouter.patch(
  "/categories/reorder",
  validate(reorderCategoriesSchema),
  asyncHandler(categoryController.reorderCategories),
);
adminCategoryRouter.patch(
  "/categories/:id",
  validate(categoryIdParamSchema, "params"),
  validate(updateCategorySchema),
  asyncHandler(categoryController.updateCategory),
);
adminCategoryRouter.patch(
  "/categories/:id/active",
  validate(categoryIdParamSchema, "params"),
  validate(toggleActiveSchema),
  asyncHandler(categoryController.toggleCategoryActive),
);
adminCategoryRouter.delete(
  "/categories/:id",
  validate(categoryIdParamSchema, "params"),
  asyncHandler(categoryController.deleteCategory),
);

// Subcategory management
adminCategoryRouter.post(
  "/subcategories",
  validate(createSubcategorySchema),
  asyncHandler(categoryController.createSubcategory),
);
adminCategoryRouter.patch(
  "/subcategories/reorder",
  validate(reorderSubcategoriesSchema),
  asyncHandler(categoryController.reorderSubcategories),
);
adminCategoryRouter.patch(
  "/subcategories/:id",
  validate(subcategoryIdParamSchema, "params"),
  validate(updateSubcategorySchema),
  asyncHandler(categoryController.updateSubcategory),
);
adminCategoryRouter.patch(
  "/subcategories/:id/active",
  validate(subcategoryIdParamSchema, "params"),
  validate(toggleActiveSchema),
  asyncHandler(categoryController.toggleSubcategoryActive),
);
adminCategoryRouter.post(
  "/subcategories/:id/move",
  validate(subcategoryIdParamSchema, "params"),
  validate(moveSubcategorySchema),
  asyncHandler(categoryController.moveSubcategory),
);
adminCategoryRouter.delete(
  "/subcategories/:id",
  validate(subcategoryIdParamSchema, "params"),
  asyncHandler(categoryController.deleteSubcategory),
);
