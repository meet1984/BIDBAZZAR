import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { CategoryRecord, SubcategoryRecord } from "../../types/database.types.js";
import type {
  CreateCategoryInput,
  CreateSubcategoryInput,
  UpdateCategoryInput,
  UpdateSubcategoryInput,
} from "./category.schemas.js";

type DatabaseValue = string | number | boolean | Date | null;

export interface CategoryWithStats extends CategoryRecord {
  listingCount: number;
  subcategories?: SubcategoryWithStats[];
}

export interface SubcategoryWithStats extends SubcategoryRecord {
  listingCount: number;
}

function categoryFromRow(row: RowDataPacket): CategoryWithStats {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
    imageUrl: row.image_url == null ? null : String(row.image_url),
    displayOrder: Number(row.display_order),
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
    listingCount: Number(row.listing_count ?? 0),
  };
}

function subcategoryFromRow(row: RowDataPacket): SubcategoryWithStats {
  return {
    id: Number(row.id),
    categoryId: Number(row.category_id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
    displayOrder: Number(row.display_order),
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
    listingCount: Number(row.listing_count ?? 0),
  };
}

export class CategoryRepository {
  async findAllCategories(includeInactive = false): Promise<CategoryWithStats[]> {
    const activeClause = includeInactive ? "" : "WHERE c.is_active = TRUE";
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*,
              (
                SELECT COUNT(*) FROM listings l
                WHERE l.category_id = c.id AND l.deleted_at IS NULL
              ) AS listing_count
       FROM categories c
       ${activeClause}
       ORDER BY c.display_order ASC, c.name ASC`,
    );
    return rows.map(categoryFromRow);
  }

  async findCategoryById(id: number): Promise<CategoryWithStats | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*,
              (
                SELECT COUNT(*) FROM listings l
                WHERE l.category_id = c.id AND l.deleted_at IS NULL
              ) AS listing_count
       FROM categories c
       WHERE c.id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? categoryFromRow(rows[0]) : null;
  }

  async findCategoryBySlug(slug: string): Promise<CategoryWithStats | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*,
              (
                SELECT COUNT(*) FROM listings l
                WHERE l.category_id = c.id AND l.deleted_at IS NULL
              ) AS listing_count
       FROM categories c
       WHERE c.slug = ? LIMIT 1`,
      [slug],
    );
    return rows[0] ? categoryFromRow(rows[0]) : null;
  }

  async findAllSubcategories(categoryId?: number, includeInactive = false): Promise<SubcategoryWithStats[]> {
    const conditions: string[] = [];
    const values: DatabaseValue[] = [];

    if (categoryId !== undefined) {
      conditions.push("sc.category_id = ?");
      values.push(categoryId);
    }
    if (!includeInactive) {
      conditions.push("sc.is_active = TRUE");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT sc.*,
              (
                SELECT COUNT(*) FROM listings l
                WHERE l.subcategory_id = sc.id AND l.deleted_at IS NULL
              ) AS listing_count
       FROM subcategories sc
       ${whereClause}
       ORDER BY sc.display_order ASC, sc.name ASC`,
      values,
    );
    return rows.map(subcategoryFromRow);
  }

  async findSubcategoryById(id: number): Promise<SubcategoryWithStats | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT sc.*,
              (
                SELECT COUNT(*) FROM listings l
                WHERE l.subcategory_id = sc.id AND l.deleted_at IS NULL
              ) AS listing_count
       FROM subcategories sc
       WHERE sc.id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? subcategoryFromRow(rows[0]) : null;
  }

  async findSubcategoryBySlug(slug: string): Promise<SubcategoryWithStats | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT sc.*,
              (
                SELECT COUNT(*) FROM listings l
                WHERE l.subcategory_id = sc.id AND l.deleted_at IS NULL
              ) AS listing_count
       FROM subcategories sc
       WHERE sc.slug = ? LIMIT 1`,
      [slug],
    );
    return rows[0] ? subcategoryFromRow(rows[0]) : null;
  }

  async countCategoryListings(categoryId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM listings WHERE category_id = ?",
      [categoryId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countSubcategoryListings(subcategoryId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM listings WHERE subcategory_id = ?",
      [subcategoryId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async createCategory(input: CreateCategoryInput & { slug: string }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO categories (name, slug, description, image_url, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.slug,
        input.description ?? null,
        input.imageUrl ?? null,
        input.displayOrder,
        input.isActive,
      ],
    );
    return Number(result.insertId);
  }

  async updateCategory(id: number, input: UpdateCategoryInput & { slug?: string }): Promise<void> {
    const columns: string[] = [];
    const values: DatabaseValue[] = [];

    if (input.name !== undefined) {
      columns.push("name = ?");
      values.push(input.name);
    }
    if (input.slug !== undefined) {
      columns.push("slug = ?");
      values.push(input.slug);
    }
    if (input.description !== undefined) {
      columns.push("description = ?");
      values.push(input.description ?? null);
    }
    if (input.imageUrl !== undefined) {
      columns.push("image_url = ?");
      values.push(input.imageUrl ?? null);
    }
    if (input.displayOrder !== undefined) {
      columns.push("display_order = ?");
      values.push(input.displayOrder);
    }
    if (input.isActive !== undefined) {
      columns.push("is_active = ?");
      values.push(input.isActive);
    }

    if (!columns.length) return;
    await pool.execute(`UPDATE categories SET ${columns.join(", ")} WHERE id = ?`, [...values, id]);
  }

  async setCategoryActive(id: number, isActive: boolean): Promise<void> {
    await pool.execute("UPDATE categories SET is_active = ? WHERE id = ?", [isActive, id]);
  }

  async reorderCategories(items: { id: number; displayOrder: number }[]): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of items) {
        await connection.execute("UPDATE categories SET display_order = ? WHERE id = ?", [
          item.displayOrder,
          item.id,
        ]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteCategory(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM categories WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }

  async createSubcategory(input: CreateSubcategoryInput & { slug: string }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.categoryId,
        input.name,
        input.slug,
        input.description ?? null,
        input.displayOrder,
        input.isActive,
      ],
    );
    return Number(result.insertId);
  }

  async updateSubcategory(id: number, input: UpdateSubcategoryInput & { slug?: string }): Promise<void> {
    const columns: string[] = [];
    const values: DatabaseValue[] = [];

    if (input.name !== undefined) {
      columns.push("name = ?");
      values.push(input.name);
    }
    if (input.slug !== undefined) {
      columns.push("slug = ?");
      values.push(input.slug);
    }
    if (input.description !== undefined) {
      columns.push("description = ?");
      values.push(input.description ?? null);
    }
    if (input.displayOrder !== undefined) {
      columns.push("display_order = ?");
      values.push(input.displayOrder);
    }
    if (input.isActive !== undefined) {
      columns.push("is_active = ?");
      values.push(input.isActive);
    }

    if (!columns.length) return;
    await pool.execute(`UPDATE subcategories SET ${columns.join(", ")} WHERE id = ?`, [...values, id]);
  }

  async setSubcategoryActive(id: number, isActive: boolean): Promise<void> {
    await pool.execute("UPDATE subcategories SET is_active = ? WHERE id = ?", [isActive, id]);
  }

  async moveSubcategory(id: number, newCategoryId: number): Promise<void> {
    await pool.execute("UPDATE subcategories SET category_id = ? WHERE id = ?", [newCategoryId, id]);
  }

  async reorderSubcategories(items: { id: number; displayOrder: number }[]): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of items) {
        await connection.execute("UPDATE subcategories SET display_order = ? WHERE id = ?", [
          item.displayOrder,
          item.id,
        ]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteSubcategory(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM subcategories WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
}

export const categoryRepository = new CategoryRepository();
