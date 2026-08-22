import { z } from "zod";
import type { AdminPermission } from "../../types/database.types.js";

export const ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  "verification_review",
  "listing_review",
  "support_management",
  "order_oversight",
  "dispute_management",
  "review_moderation",
  "category_management",
] as const;

export const adminPermissionEnumSchema = z.enum([
  "verification_review",
  "listing_review",
  "support_management",
  "order_oversight",
  "dispute_management",
  "review_moderation",
  "category_management",
]);

export const grantPermissionSchema = z.object({
  permission: adminPermissionEnumSchema,
});

export const grantBulkPermissionsSchema = z.object({
  permissions: z.array(adminPermissionEnumSchema).min(1, "At least one permission must be provided"),
});

export const employeeAccountParamSchema = z.object({ accountId: z.coerce.number().int().positive() });
export const employeePermissionParamSchema = employeeAccountParamSchema.extend({ permission: adminPermissionEnumSchema });

export type GrantPermissionInput = z.infer<typeof grantPermissionSchema>;
export type GrantBulkPermissionsInput = z.infer<typeof grantBulkPermissionsSchema>;
