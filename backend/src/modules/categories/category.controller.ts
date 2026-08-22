import type { Request, Response } from "express";
import type {
  CreateCategoryInput,
  CreateSubcategoryInput,
  MoveSubcategoryInput,
  PublicCategoryQuery,
  ReorderCategoriesInput,
  ReorderSubcategoriesInput,
  UpdateCategoryInput,
  UpdateSubcategoryInput,
} from "./category.schemas.js";
import { categoryService } from "./category.service.js";

export const categoryController = {
  async listPublic(request: Request, response: Response) {
    const query = request.query as unknown as PublicCategoryQuery;
    const items = await categoryService.listPublic(query.withSubcategories);
    response.json({ items });
  },

  async publicDetail(request: Request, response: Response) {
    const category = await categoryService.publicDetail(String(request.params.identifier));
    response.json({ category });
  },

  async listAdmin(_request: Request, response: Response) {
    const items = await categoryService.listAdmin();
    response.json({ items });
  },

  async createCategory(request: Request, response: Response) {
    const category = await categoryService.createCategory(request.body as CreateCategoryInput);
    response.status(201).json({ category });
  },

  async updateCategory(request: Request, response: Response) {
    const category = await categoryService.updateCategory(
      Number(request.params.id),
      request.body as UpdateCategoryInput,
    );
    response.json({ category });
  },

  async toggleCategoryActive(request: Request, response: Response) {
    const isActive = Boolean((request.body as { isActive?: boolean }).isActive);
    const category = await categoryService.toggleCategoryActive(
      Number(request.params.id),
      isActive,
    );
    response.json({ category });
  },

  async reorderCategories(request: Request, response: Response) {
    const items = await categoryService.reorderCategories(request.body as ReorderCategoriesInput);
    response.json({ items });
  },

  async deleteCategory(request: Request, response: Response) {
    await categoryService.deleteCategory(Number(request.params.id));
    response.status(204).send();
  },

  // --- SUBCATEGORIES ---

  async createSubcategory(request: Request, response: Response) {
    const subcategory = await categoryService.createSubcategory(
      request.body as CreateSubcategoryInput,
    );
    response.status(201).json({ subcategory });
  },

  async updateSubcategory(request: Request, response: Response) {
    const subcategory = await categoryService.updateSubcategory(
      Number(request.params.id),
      request.body as UpdateSubcategoryInput,
    );
    response.json({ subcategory });
  },

  async toggleSubcategoryActive(request: Request, response: Response) {
    const isActive = Boolean((request.body as { isActive?: boolean }).isActive);
    const subcategory = await categoryService.toggleSubcategoryActive(
      Number(request.params.id),
      isActive,
    );
    response.json({ subcategory });
  },

  async moveSubcategory(request: Request, response: Response) {
    const subcategory = await categoryService.moveSubcategory(
      Number(request.params.id),
      request.body as MoveSubcategoryInput,
    );
    response.json({ subcategory });
  },

  async reorderSubcategories(request: Request, response: Response) {
    const items = await categoryService.reorderSubcategories(
      request.body as ReorderSubcategoriesInput,
    );
    response.json({ items });
  },

  async deleteSubcategory(request: Request, response: Response) {
    await categoryService.deleteSubcategory(Number(request.params.id));
    response.status(204).send();
  },
};
