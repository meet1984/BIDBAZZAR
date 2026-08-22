import { Router } from "express";
import { requireAccountType } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getEmployeePermissionsHandler,
  getMyPermissionsHandler,
  grantBulkPermissionsHandler,
  grantPermissionHandler,
  listEmployeesHandler,
  revokePermissionHandler,
} from "./admin-permission.controller.js";
import {
  grantBulkPermissionsSchema,
  grantPermissionSchema,
  employeeAccountParamSchema,
  employeePermissionParamSchema,
} from "./admin-permission.schemas.js";

export const adminPermissionRouter = Router();

adminPermissionRouter.get(
  "/my-permissions",
  requireAccountType("admin", "admin_employee"),
  getMyPermissionsHandler,
);

// Only full admins can assign or modify employee permissions
adminPermissionRouter.get("/employees", requireAccountType("admin"), listEmployeesHandler);
adminPermissionRouter.get("/employees/:accountId/permissions", requireAccountType("admin"), validate(employeeAccountParamSchema, "params"), getEmployeePermissionsHandler);
adminPermissionRouter.post(
  "/employees/:accountId/permissions",
  requireAccountType("admin"),
  validate(employeeAccountParamSchema, "params"),
  validate(grantPermissionSchema),
  grantPermissionHandler,
);
adminPermissionRouter.post(
  "/employees/:accountId/permissions/bulk",
  requireAccountType("admin"),
  validate(employeeAccountParamSchema, "params"),
  validate(grantBulkPermissionsSchema),
  grantBulkPermissionsHandler,
);
adminPermissionRouter.delete(
  "/employees/:accountId/permissions/:permission",
  requireAccountType("admin"),
  validate(employeePermissionParamSchema, "params"),
  revokePermissionHandler,
);
