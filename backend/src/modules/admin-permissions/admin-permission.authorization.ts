import type { AdminPermission } from "../../types/database.types.js";
import { adminPermissionRepository } from "./admin-permission.repository.js";

export async function hasAdminCapability(
  accountId: number,
  accountType: string | undefined,
  permission: AdminPermission,
): Promise<boolean> {
  if (accountType === "admin") return true;
  if (accountType !== "admin_employee") return false;
  return adminPermissionRepository.hasPermission(accountId, permission);
}
