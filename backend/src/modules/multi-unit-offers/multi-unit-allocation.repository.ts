import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { MultiUnitAllocationRecord, MultiUnitAllocationStatus } from "../../types/database.types.js";

export interface CreateAllocationData {
  offerId: number;
  listingId: number;
  buyerId: number;
  allocatedQuantity: number;
  unitPrice: number;
  status: MultiUnitAllocationStatus;
  reservedUntil?: Date | null;
}

function allocationFromRow(row: RowDataPacket): MultiUnitAllocationRecord {
  return {
    id: Number(row.id),
    offerId: Number(row.offer_id),
    listingId: Number(row.listing_id),
    buyerId: Number(row.buyer_id),
    allocatedQuantity: Number(row.allocated_quantity),
    unitPrice: Number(row.unit_price),
    totalAllocationValue: Number(row.total_allocation_value),
    status: row.status as MultiUnitAllocationStatus,
    reservedUntil: row.reserved_until == null ? null : new Date(row.reserved_until as string | Date),
    confirmedAt: row.confirmed_at == null ? null : new Date(row.confirmed_at as string | Date),
    releasedAt: row.released_at == null ? null : new Date(row.released_at as string | Date),
    version: Number(row.version),
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class MultiUnitAllocationRepository {
  async calculateAllocatedStockInTransaction(connection: PoolConnection, listingId: number): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(allocated_quantity), 0) AS total_allocated
       FROM multi_unit_allocations
       WHERE listing_id = ?
         AND status IN ('reserved', 'confirmed')
         AND (reserved_until IS NULL OR reserved_until > UTC_TIMESTAMP())
       FOR UPDATE`,
      [listingId],
    );
    return Number(rows[0]?.total_allocated || 0);
  }

  async calculateAllocatedStock(listingId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(allocated_quantity), 0) AS total_allocated
       FROM multi_unit_allocations
       WHERE listing_id = ?
         AND status IN ('reserved', 'confirmed')
         AND (reserved_until IS NULL OR reserved_until > UTC_TIMESTAMP())`,
      [listingId],
    );
    return Number(rows[0]?.total_allocated || 0);
  }

  async createInTransaction(connection: PoolConnection, data: CreateAllocationData): Promise<number> {
    const totalValue = Number((data.allocatedQuantity * data.unitPrice).toFixed(2));
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO multi_unit_allocations
        (offer_id, listing_id, buyer_id, allocated_quantity, unit_price, total_allocation_value, status, reserved_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.offerId,
        data.listingId,
        data.buyerId,
        data.allocatedQuantity,
        data.unitPrice,
        totalValue,
        data.status,
        data.reservedUntil ?? null,
      ],
    );
    return Number(result.insertId);
  }

  async findById(id: number): Promise<MultiUnitAllocationRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM multi_unit_allocations WHERE id = ? LIMIT 1",
      [id],
    );
    if (!rows[0]) return null;
    return allocationFromRow(rows[0]);
  }

  async findByIdInTransaction(connection: PoolConnection, id: number): Promise<MultiUnitAllocationRecord | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT * FROM multi_unit_allocations WHERE id = ? FOR UPDATE",
      [id],
    );
    if (!rows[0]) return null;
    return allocationFromRow(rows[0]);
  }

  async findActiveByOfferId(offerId: number): Promise<MultiUnitAllocationRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM multi_unit_allocations
       WHERE offer_id = ? AND status IN ('proposed', 'reserved', 'confirmed')
       ORDER BY id DESC LIMIT 1`,
      [offerId],
    );
    if (!rows[0]) return null;
    return allocationFromRow(rows[0]);
  }

  async listByListing(listingId: number): Promise<MultiUnitAllocationRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM multi_unit_allocations WHERE listing_id = ? ORDER BY created_at DESC",
      [listingId],
    );
    return rows.map(allocationFromRow);
  }

  async listByBuyer(buyerId: number): Promise<MultiUnitAllocationRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM multi_unit_allocations WHERE buyer_id = ? ORDER BY created_at DESC",
      [buyerId],
    );
    return rows.map(allocationFromRow);
  }

  async updateStatusInTransaction(
    connection: PoolConnection,
    id: number,
    status: MultiUnitAllocationStatus,
    options?: { confirmedAt?: Date; releasedAt?: Date },
  ): Promise<void> {
    const updates: string[] = ["status = ?", "version = version + 1"];
    const params: (string | number | Date | null)[] = [status];


    if (options?.confirmedAt) {
      updates.push("confirmed_at = ?");
      params.push(options.confirmedAt);
    }
    if (options?.releasedAt) {
      updates.push("released_at = ?");
      params.push(options.releasedAt);
    }

    params.push(id);
    await connection.execute(
      `UPDATE multi_unit_allocations SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );
  }
}

export const multiUnitAllocationRepository = new MultiUnitAllocationRepository();
