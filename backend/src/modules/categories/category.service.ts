import { AppError } from "../../shared/AppError.js";
import type { CategoryRepository } from "./category.repository.js";
import { categoryRepository } from "./category.repository.js";
import type {
  CreateCategoryInput,
  CreateSubcategoryInput,
  MoveSubcategoryInput,
  ReorderCategoriesInput,
  ReorderSubcategoriesInput,
  UpdateCategoryInput,
  UpdateSubcategoryInput,
} from "./category.schemas.js";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export class CategoryService {
  constructor(private readonly repository: CategoryRepository) { }

  async listPublic(withSubcategories = true) {
    const categories = await this.repository.findAllCategories(false);
    if (!withSubcategories) return categories;

    const allSubcategories = await this.repository.findAllSubcategories(undefined, false);
    const subMap = new Map<number, typeof allSubcategories>();

    for (const sub of allSubcategories) {
      const list = subMap.get(sub.categoryId) || [];
      list.push(sub);
      subMap.set(sub.categoryId, list);
    }

    return categories.map((cat) => ({
      ...cat,
      subcategories: subMap.get(cat.id) || [],
    }));
  }

  async publicDetail(slugOrId: string) {
    const numericId = Number(slugOrId);
    const category = !Number.isNaN(numericId)
      ? await this.repository.findCategoryById(numericId)
      : await this.repository.findCategoryBySlug(slugOrId);

    if (!category || (!category.isActive)) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Category was not found.");
    }

    const subcategories = await this.repository.findAllSubcategories(category.id, false);
    return { ...category, subcategories };
  }

  async listAdmin() {
    const categories = await this.repository.findAllCategories(true);
    const allSubcategories = await this.repository.findAllSubcategories(undefined, true);
    const subMap = new Map<number, typeof allSubcategories>();

    for (const sub of allSubcategories) {
      const list = subMap.get(sub.categoryId) || [];
      list.push(sub);
      subMap.set(sub.categoryId, list);
    }

    return categories.map((cat) => ({
      ...cat,
      subcategories: subMap.get(cat.id) || [],
    }));
  }

  async createCategory(input: CreateCategoryInput) {
    const slug = input.slug || generateSlug(input.name);
    const existing = await this.repository.findCategoryBySlug(slug);
    if (existing) {
      throw new AppError(409, "SLUG_EXISTS", `A category with slug '${slug}' already exists.`);
    }

    const id = await this.repository.createCategory({ ...input, slug });
    return this.repository.findCategoryById(id);
  }

  async updateCategory(id: number, input: UpdateCategoryInput) {
    const category = await this.repository.findCategoryById(id);
    if (!category) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Category was not found.");
    }

    let slug = input.slug;
    if (input.name && !slug) {
      slug = generateSlug(input.name);
    }

    if (slug && slug !== category.slug) {
      const existing = await this.repository.findCategoryBySlug(slug);
      if (existing && existing.id !== id) {
        throw new AppError(409, "SLUG_EXISTS", `A category with slug '${slug}' already exists.`);
      }
    }

    await this.repository.updateCategory(id, { ...input, ...(slug ? { slug } : {}) });
    return this.repository.findCategoryById(id);
  }

  async toggleCategoryActive(id: number, isActive: boolean) {
    const category = await this.repository.findCategoryById(id);
    if (!category) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Category was not found.");
    }

    await this.repository.setCategoryActive(id, isActive);
    return this.repository.findCategoryById(id);
  }

  async reorderCategories(input: ReorderCategoriesInput) {
    await this.repository.reorderCategories(input.items);
    return this.listAdmin();
  }

  async deleteCategory(id: number): Promise<void> {
    const category = await this.repository.findCategoryById(id);
    if (!category) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Category was not found.");
    }

    const listingCount = await this.repository.countCategoryListings(id);
    if (listingCount > 0) {
      throw new AppError(
        409,
        "CATEGORY_IN_USE",
        `Category '${category.name}' is referenced by ${listingCount} listing(s) and cannot be deleted. Deactivate it instead.`,
      );
    }

    const subcategories = await this.repository.findAllSubcategories(id, true);
    if (subcategories.length > 0) {
      throw new AppError(
        409,
        "CATEGORY_HAS_SUBCATEGORIES",
        `Category '${category.name}' contains ${subcategories.length} subcategory/subcategories. Move or delete them first.`,
      );
    }

    await this.repository.deleteCategory(id);
  }

  // --- SUBCATEGORY METHODS ---

  async createSubcategory(input: CreateSubcategoryInput) {
    const parentCategory = await this.repository.findCategoryById(input.categoryId);
    if (!parentCategory) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Parent category was not found.");
    }

    const slug = input.slug || generateSlug(input.name);
    const existing = await this.repository.findSubcategoryBySlug(slug);
    if (existing) {
      throw new AppError(409, "SLUG_EXISTS", `A subcategory with slug '${slug}' already exists.`);
    }

    const id = await this.repository.createSubcategory({ ...input, slug });
    return this.repository.findSubcategoryById(id);
  }

  async updateSubcategory(id: number, input: UpdateSubcategoryInput) {
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new AppError(404, "SUBCATEGORY_NOT_FOUND", "Subcategory was not found.");
    }

    let slug = input.slug;
    if (input.name && !slug) {
      slug = generateSlug(input.name);
    }

    if (slug && slug !== subcategory.slug) {
      const existing = await this.repository.findSubcategoryBySlug(slug);
      if (existing && existing.id !== id) {
        throw new AppError(409, "SLUG_EXISTS", `A subcategory with slug '${slug}' already exists.`);
      }
    }

    await this.repository.updateSubcategory(id, { ...input, ...(slug ? { slug } : {}) });
    return this.repository.findSubcategoryById(id);
  }

  async toggleSubcategoryActive(id: number, isActive: boolean) {
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new AppError(404, "SUBCATEGORY_NOT_FOUND", "Subcategory was not found.");
    }

    await this.repository.setSubcategoryActive(id, isActive);
    return this.repository.findSubcategoryById(id);
  }

  async moveSubcategory(id: number, input: MoveSubcategoryInput) {
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new AppError(404, "SUBCATEGORY_NOT_FOUND", "Subcategory was not found.");
    }

    const newCategory = await this.repository.findCategoryById(input.newCategoryId);
    if (!newCategory) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Destination category was not found.");
    }

    await this.repository.moveSubcategory(id, input.newCategoryId);
    return this.repository.findSubcategoryById(id);
  }

  async reorderSubcategories(input: ReorderSubcategoriesInput) {
    await this.repository.reorderSubcategories(input.items);
    return this.repository.findAllSubcategories(undefined, true);
  }

  async deleteSubcategory(id: number): Promise<void> {
    const subcategory = await this.repository.findSubcategoryById(id);
    if (!subcategory) {
      throw new AppError(404, "SUBCATEGORY_NOT_FOUND", "Subcategory was not found.");
    }

    const listingCount = await this.repository.countSubcategoryListings(id);
    if (listingCount > 0) {
      throw new AppError(
        409,
        "SUBCATEGORY_IN_USE",
        `Subcategory '${subcategory.name}' is referenced by ${listingCount} listing(s) and cannot be deleted. Deactivate it instead.`,
      );
    }

    await this.repository.deleteSubcategory(id);
  }
}

export const categoryService = new CategoryService(categoryRepository);
