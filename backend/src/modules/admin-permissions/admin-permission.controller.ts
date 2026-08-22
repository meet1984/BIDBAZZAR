import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import type { AdminPermission } from "../../types/database.types.js";
import { adminPermissionService } from "./admin-permission.service.js";
import {
  type GrantBulkPermissionsInput,
  type GrantPermissionInput,
} from "./admin-permission.schemas.js";
import { ADMIN_PERMISSIONS } from "./admin-permission.schemas.js";

export const grantPermissionHandler = asyncHandler(async (req: Request, res: Response) => {
  const targetAccountId = Number(req.params.accountId);
  if (!targetAccountId || Number.isNaN(targetAccountId)) {
    throw new AppError(400, "INVALID_ACCOUNT_ID", "Invalid target account ID.");
  }

  const granterAccountId = req.auth!.id;
  const body = req.body as GrantPermissionInput;

  const permissions = await adminPermissionService.grant(
    granterAccountId,
    targetAccountId,
    body.permission,
  );

  res.status(200).json({
    success: true,
    message: `Permission '${body.permission}' granted successfully.`,
    data: {
      accountId: targetAccountId,
      permissions,
    },
  });
});

export const grantBulkPermissionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const targetAccountId = Number(req.params.accountId);
  if (!targetAccountId || Number.isNaN(targetAccountId)) {
    throw new AppError(400, "INVALID_ACCOUNT_ID", "Invalid target account ID.");
  }

  const granterAccountId = req.auth!.id;
  const body = req.body as GrantBulkPermissionsInput;

  const permissions = await adminPermissionService.grantBulk(
    granterAccountId,
    targetAccountId,
    body.permissions,
  );

  res.status(200).json({
    success: true,
    message: "Permissions granted successfully.",
    data: {
      accountId: targetAccountId,
      permissions,
    },
  });
});

export const revokePermissionHandler = asyncHandler(async (req: Request, res: Response) => {
  const targetAccountId = Number(req.params.accountId);
  const permission = req.params.permission as AdminPermission;

  if (!targetAccountId || Number.isNaN(targetAccountId)) {
    throw new AppError(400, "INVALID_ACCOUNT_ID", "Invalid target account ID.");
  }

  const revokerAccountId = req.auth!.id;
  const permissions = await adminPermissionService.revoke(
    revokerAccountId,
    targetAccountId,
    permission,
  );

  res.status(200).json({
    success: true,
    message: `Permission '${permission}' revoked successfully.`,
    data: {
      accountId: targetAccountId,
      permissions,
    },
  });
});

export const getEmployeePermissionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const accountId = Number(req.params.accountId);
  if (!accountId || Number.isNaN(accountId)) {
    throw new AppError(400, "INVALID_ACCOUNT_ID", "Invalid account ID.");
  }

  const permissions = await adminPermissionService.getPermissions(accountId);

  res.status(200).json({
    success: true,
    data: {
      accountId,
      permissions,
    },
  });
});

export const listEmployeesHandler = asyncHandler(async (_req: Request, res: Response) => {
  const employees = await adminPermissionService.listEmployees();

  res.status(200).json({
    success: true,
    data: employees,
  });
});

export const getMyPermissionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const permissions = req.auth!.accountType === "admin"
    ? [...ADMIN_PERMISSIONS]
    : await adminPermissionService.getPermissions(req.auth!.id);
  res.status(200).json({ success: true, data: { permissions } });
});
