import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { ListingImageRecord } from "../../types/database.types.js";

function imageFromRow(row: RowDataPacket): ListingImageRecord {
  return {
    id: Number(row.id),
    listingId: Number(row.listing_id),
    imageUrl: String(row.image_url),
    displayOrder: Number(row.display_order),
    isPrimary: Boolean(row.is_primary),
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class ListingImageRepository {
  async findByListingId(listingId: number): Promise<ListingImageRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM listing_images
       WHERE listing_id = ?
       ORDER BY is_primary DESC, display_order ASC, id ASC`,
      [listingId],
    );
    return rows.map(imageFromRow);
  }

  async findById(imageId: number): Promise<ListingImageRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM listing_images WHERE id = ? LIMIT 1",
      [imageId],
    );
    return rows[0] ? imageFromRow(rows[0]) : null;
  }

  async countByListingId(listingId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM listing_images WHERE listing_id = ?",
      [listingId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async createImage(
    listingId: number,
    imageUrl: string,
    displayOrder: number,
    isPrimary: boolean,
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO listing_images (listing_id, image_url, display_order, is_primary)
       VALUES (?, ?, ?, ?)`,
      [listingId, imageUrl, displayOrder, isPrimary],
    );
    return Number(result.insertId);
  }

  async clearPrimaryForListing(listingId: number): Promise<void> {
    await pool.execute(
      "UPDATE listing_images SET is_primary = FALSE WHERE listing_id = ?",
      [listingId],
    );
  }

  async setPrimary(imageId: number): Promise<void> {
    await pool.execute(
      "UPDATE listing_images SET is_primary = TRUE WHERE id = ?",
      [imageId],
    );
  }

  async updateOrderAndPrimary(
    listingId: number,
    items: { id: number; displayOrder: number; isPrimary: boolean }[],
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of items) {
        await connection.execute(
          `UPDATE listing_images
           SET display_order = ?, is_primary = ?
           WHERE id = ? AND listing_id = ?`,
          [item.displayOrder, item.isPrimary, item.id, listingId],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async delete(imageId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM listing_images WHERE id = ?",
      [imageId],
    );
    return result.affectedRows > 0;
  }
}

export const listingImageRepository = new ListingImageRepository();
