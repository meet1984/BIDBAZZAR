import type { RequestHandler } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { AppError } from "../../shared/AppError.js";
import type { AdminPermission } from "../../types/database.types.js";
import { adminPermissionRepository } from "./admin-permission.repository.js";

/**
 * Middleware enforcing that the caller is either a full admin or an admin_employee
 * who possesses the specific granular permission required.
 */
export function requireAdminPermission(permission: AdminPermission): RequestHandler[] {
  return [
    ...requireAuth,
    async (req, _res, next) => {
      if (!req.auth) {
        next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
        return;
      }

      // Full admin always has superuser capability across all admin workflows
      if (req.auth.accountType === "admin") {
        next();
        return;
      }

      // Admin employee must possess the specific granular permission
      if (req.auth.accountType === "admin_employee") {
        try {
          const hasPerm = await adminPermissionRepository.hasPermission(req.auth.id, permission);
          if (!hasPerm) {
            next(
              new AppError(
                403,
                "PERMISSION_DENIED",
                `You do not have the required permission (${permission}) for this action.`,
              ),
            );
            return;
          }
          next();
        } catch (err) {
          next(err);
        }
        return;
      }

      // Non-admin roles (buyer, seller) are rejected
      next(new AppError(403, "ROLE_FORBIDDEN", "Your account cannot perform this action."));
    },
  ];
}

/**
 * Middleware enforcing that the caller has at least one of the specified permissions (or full admin).
 */
export function requireAnyAdminPermission(...permissions: AdminPermission[]): RequestHandler[] {
  return [
    ...requireAuth,
    async (req, _res, next) => {
      if (!req.auth) {
        next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
        return;
      }

      if (req.auth.accountType === "admin") {
        next();
        return;
      }

      if (req.auth.accountType === "admin_employee") {
        try {
          for (const perm of permissions) {
            const hasPerm = await adminPermissionRepository.hasPermission(req.auth.id, perm);
            if (hasPerm) {
              next();
              return;
            }
          }
          next(
            new AppError(
              403,
              "PERMISSION_DENIED",
              `You lack the required permissions for this action. Required one of: [${permissions.join(", ")}]`,
            ),
          );
        } catch (err) {
          next(err);
        }
        return;
      }

      next(new AppError(403, "ROLE_FORBIDDEN", "Your account cannot perform this action."));
    },
  ];
}
