import { AppError } from "../../shared/AppError.js";
import type { AdminPermission } from "../../types/database.types.js";
import { authRepository } from "../auth/auth.repository.js";
import { auditLogService } from "../audit-log/audit-log.service.js";
import {
  adminPermissionRepository,
  type AdminPermissionRepository,
} from "./admin-permission.repository.js";
import { ADMIN_PERMISSIONS } from "./admin-permission.schemas.js";

export class AdminPermissionService {
  constructor(private readonly repository: AdminPermissionRepository) {}

  async grant(
    granterAccountId: number,
    targetAccountId: number,
    permission: AdminPermission,
  ) {
    if (!ADMIN_PERMISSIONS.includes(permission)) {
      throw new AppError(400, "INVALID_PERMISSION", `Unknown permission: ${permission}`);
    }

    const targetAccount = await authRepository.findAccountById(targetAccountId);
    if (!targetAccount) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Target account not found.");
    }

    if (targetAccount.accountType !== "admin_employee" && targetAccount.accountType !== "admin") {
      throw new AppError(
        400,
        "INVALID_ACCOUNT_TYPE",
        "Permissions can only be granted to admin_employee or admin accounts.",
      );
    }

    await this.repository.grantPermission(targetAccountId, permission, granterAccountId);

    await auditLogService.record({
      actorAccountId: granterAccountId,
      action: "admin_permission:grant",
      targetEntity: "account",
      targetId: targetAccountId,
      reason: `Granted permission '${permission}'`,
      metadata: { permission, targetAccountId, granterAccountId },
    });

    return this.repository.listPermissionsByAccountId(targetAccountId);
  }

  async grantBulk(
    granterAccountId: number,
    targetAccountId: number,
    permissions: AdminPermission[],
  ) {
    const targetAccount = await authRepository.findAccountById(targetAccountId);
    if (!targetAccount) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Target account not found.");
    }

    if (targetAccount.accountType !== "admin_employee" && targetAccount.accountType !== "admin") {
      throw new AppError(
        400,
        "INVALID_ACCOUNT_TYPE",
        "Permissions can only be granted to admin_employee or admin accounts.",
      );
    }

    for (const permission of permissions) {
      if (ADMIN_PERMISSIONS.includes(permission)) {
        await this.repository.grantPermission(targetAccountId, permission, granterAccountId);
      }
    }

    await auditLogService.record({
      actorAccountId: granterAccountId,
      action: "admin_permission:grant_bulk",
      targetEntity: "account",
      targetId: targetAccountId,
      reason: `Granted bulk permissions: [${permissions.join(", ")}]`,
      metadata: { permissions, targetAccountId, granterAccountId },
    });

    return this.repository.listPermissionsByAccountId(targetAccountId);
  }

  async revoke(
    revokerAccountId: number,
    targetAccountId: number,
    permission: AdminPermission,
  ) {
    const targetAccount = await authRepository.findAccountById(targetAccountId);
    if (!targetAccount) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Target account not found.");
    }

    const removed = await this.repository.revokePermission(targetAccountId, permission);

    await auditLogService.record({
      actorAccountId: revokerAccountId,
      action: "admin_permission:revoke",
      targetEntity: "account",
      targetId: targetAccountId,
      reason: `Revoked permission '${permission}'`,
      metadata: { permission, targetAccountId, revokerAccountId, removed },
    });

    return this.repository.listPermissionsByAccountId(targetAccountId);
  }

  async getPermissions(accountId: number): Promise<AdminPermission[]> {
    return this.repository.listPermissionsByAccountId(accountId);
  }

  async listEmployees() {
    return this.repository.listEmployeesWithPermissions();
  }
}

export const adminPermissionService = new AdminPermissionService(adminPermissionRepository);
