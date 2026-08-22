import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "../../database/pool.js";
import { pagination } from "../../shared/pagination.js";
import type { AccountType } from "../../shared/tokens.js";
import type { AdminCreateUserInput, UserListQuery } from "./user.schemas.js";

type DatabaseValue = string | number;

export interface ManagedUser {
  id: number;
  fullName: string;
  email: string;
  accountType: AccountType;
  role: AccountType;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  status: "active" | "suspended";
  migrationReviewRequired: boolean;
  createdAt: string;
}

function mapAccountUser(row: RowDataPacket): ManagedUser {
  const accountType = (row.account_type || row.role || "buyer") as AccountType;
  return {
    id: Number(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    accountType,
    role: accountType,
    isBuyer: accountType === "buyer",
    isSeller: accountType === "seller",
    isAdmin: accountType === "admin",
    status: row.status as ManagedUser["status"],
    migrationReviewRequired: Boolean(row.migration_review_required),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}

export class UserRepository {
  async createUser(input: AdminCreateUserInput, passwordHash: string): Promise<number> {
    const targetType: AccountType = input.accountType || input.role || "buyer";

    return withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO accounts
          (account_type, full_name, email, phone, password_hash, accepted_terms_at, marketing_consent, status)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, 'active')`,
        [
          targetType,
          input.fullName,
          input.email,
          input.phone || null,
          passwordHash,
          true,
        ],
      );
      const userId = Number(result.insertId);

      if (targetType === "seller") {
        await connection.execute(
          `INSERT INTO seller_profiles (account_id, seller_name, seller_type)
           VALUES (?, ?, ?)`,
          [userId, input.sellerName || input.fullName, input.sellerType || "individual"],
        );
      }
      if (targetType === "buyer") {
        await connection.execute(
          `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
           VALUES (?, ?, 'individual', 'profile_incomplete')`,
          [userId, input.fullName],
        );
      }

      return userId;
    });
  }

  async list(query: UserListQuery) {
    const page = pagination(query.page, query.pageSize);
    const where = ["1 = 1"];
    const values: DatabaseValue[] = [];
    if (query.q) {
      where.push("(full_name LIKE ? OR email LIKE ?)");
      values.push(`%${query.q}%`, `%${query.q}%`);
    }
    const filterType = query.accountType || query.role;
    if (filterType) {
      where.push("account_type = ?");
      values.push(filterType);
    }
    if (query.status) {
      where.push("status = ?");
      values.push(query.status);
    }
    const clause = where.join(" AND ");
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM accounts WHERE ${clause}`,
      values,
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, full_name, email, account_type, status, migration_review_required, created_at
       FROM accounts WHERE ${clause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, page.pageSize, page.offset],
    );
    const total = Number(countRows[0]?.total ?? 0);
    return {
      items: rows.map(mapAccountUser),
      total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: Math.max(1, Math.ceil(total / page.pageSize)),
    };
  }

  async find(id: number): Promise<ManagedUser | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, full_name, email, account_type, status, migration_review_required, created_at
       FROM accounts WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? mapAccountUser(rows[0]) : null;
  }

  async setStatus(id: number, status: ManagedUser["status"]): Promise<void> {
    await withTransaction(async (connection) => {
      await connection.execute("UPDATE accounts SET status = ? WHERE id = ?", [status, id]);
      if (status === "suspended") {
        await connection.execute(
          "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE account_id = ? AND revoked_at IS NULL",
          [id],
        );
      }
    });
  }

  async updateRole(id: number, newType: AccountType): Promise<void> {
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE accounts SET account_type = ?, migration_review_required = FALSE WHERE id = ?`,
        [newType, id],
      );

      if (newType === "seller") {
        const [rows] = await connection.execute<RowDataPacket[]>(
          "SELECT full_name FROM accounts WHERE id = ? LIMIT 1",
          [id],
        );
        const userRow = rows[0] as { full_name?: string } | undefined;
        const name = userRow?.full_name || "Seller Account";
        await connection.execute(
          `INSERT INTO seller_profiles (account_id, seller_name, seller_type)
           VALUES (?, ?, 'individual')
           ON DUPLICATE KEY UPDATE account_id = account_id`,
          [id, name],
        );
      }

      if (newType === "buyer") {
        const [rows] = await connection.execute<RowDataPacket[]>("SELECT full_name FROM accounts WHERE id = ? LIMIT 1", [id]);
        await connection.execute(
          `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
           VALUES (?, ?, 'individual', 'profile_incomplete')
           ON DUPLICATE KEY UPDATE account_id = account_id`,
          [id, String(rows[0]?.full_name || "Buyer Account")],
        );
      }

      if (newType !== "admin_employee") {
        await connection.execute("DELETE FROM admin_permissions WHERE account_id = ?", [id]);
      }

      // Immediately revoke all active tokens on account type change
      await connection.execute(
        "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE account_id = ? AND revoked_at IS NULL",
        [id],
      );
    });
  }

  async hasMarketplaceHistory(id: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT (
        (SELECT COUNT(*) FROM listings WHERE seller_id = ?) +
        (SELECT COUNT(*) FROM offers WHERE buyer_id = ?) +
        (SELECT COUNT(*) FROM multi_unit_offers WHERE buyer_id = ?) +
        (SELECT COUNT(*) FROM orders WHERE buyer_id = ? OR seller_id = ?)
      ) AS total`,
      [id, id, id, id, id],
    );
    return Number(rows[0]?.total ?? 0) > 0;
  }
}

export const userRepository = new UserRepository();
