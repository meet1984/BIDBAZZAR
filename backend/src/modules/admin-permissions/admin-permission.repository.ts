import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { AdminPermission } from "../../types/database.types.js";

export class AdminPermissionRepository {
  async grantPermission(
    accountId: number,
    permission: AdminPermission,
    grantedByAccountId: number,
  ): Promise<void> {
    await pool.execute(
      `INSERT INTO admin_permissions (account_id, permission, granted_by_account_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE granted_by_account_id = VALUES(granted_by_account_id), created_at = CURRENT_TIMESTAMP`,
      [accountId, permission, grantedByAccountId],
    );
  }

  async revokePermission(accountId: number, permission: AdminPermission): Promise<boolean> {
    const [result] = await pool.execute(
      "DELETE FROM admin_permissions WHERE account_id = ? AND permission = ?",
      [accountId, permission],
    );
    // @ts-expect-error mysql2 affectedRows
    return result.affectedRows > 0;
  }

  async listPermissionsByAccountId(accountId: number): Promise<AdminPermission[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT permission FROM admin_permissions WHERE account_id = ?",
      [accountId],
    );
    return rows.map((r) => r.permission as AdminPermission);
  }

  async hasPermission(accountId: number, permission: AdminPermission): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM admin_permissions WHERE account_id = ? AND permission = ? LIMIT 1",
      [accountId, permission],
    );
    return rows.length > 0;
  }

  async listEmployeesWithPermissions(): Promise<
    Array<{
      accountId: number;
      fullName: string;
      email: string;
      status: string;
      permissions: AdminPermission[];
    }>
  > {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.full_name, a.email, a.status, ap.permission
       FROM accounts a
       LEFT JOIN admin_permissions ap ON a.id = ap.account_id
       WHERE a.account_type = 'admin_employee'
       ORDER BY a.id ASC`,
    );

    const employeeMap = new Map<
      number,
      {
        accountId: number;
        fullName: string;
        email: string;
        status: string;
        permissions: AdminPermission[];
      }
    >();

    for (const row of rows) {
      const id = Number(row.id);
      if (!employeeMap.has(id)) {
        employeeMap.set(id, {
          accountId: id,
          fullName: String(row.full_name),
          email: String(row.email),
          status: String(row.status),
          permissions: [],
        });
      }
      if (row.permission) {
        employeeMap.get(id)!.permissions.push(row.permission as AdminPermission);
      }
    }

    return Array.from(employeeMap.values());
  }
}

export const adminPermissionRepository = new AdminPermissionRepository();
