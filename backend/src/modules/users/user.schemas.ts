import { z } from "zod";

export const userListSchema = z.object({
  q: z.string().trim().max(120).default(""),
  role: z.enum(["buyer", "seller", "admin", "admin_employee"]).optional(),
  accountType: z.enum(["buyer", "seller", "admin", "admin_employee"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const userIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const userStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "admin_employee", "buyer", "seller"]).optional(),
  accountType: z.enum(["admin", "admin_employee", "buyer", "seller"]).optional(),
}).superRefine((data, context) => {
  if (!data.role && !data.accountType) context.addIssue({ code: "custom", path: ["accountType"], message: "An account type is required." });
  if (data.role && data.accountType && data.role !== data.accountType) context.addIssue({ code: "custom", path: ["accountType"], message: "role and accountType must match." });
});

export const adminCreateUserSchema = z
  .object({
    role: z.enum(["admin", "admin_employee", "buyer", "seller"]).optional(),
    accountType: z.enum(["admin", "admin_employee", "buyer", "seller"]).optional(),
    fullName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().max(30).optional(),
    password: z.string().min(8).max(72).refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
      message: "Password must contain at least one letter and one number.",
    }),
    sellerName: z.string().trim().max(120).optional(),
    sellerType: z.enum(["individual", "business", "distributor"]).optional(),
  })
  .superRefine((data, context) => {
    const type = data.accountType || data.role;
    if (!type) {
      context.addIssue({ code: "custom", path: ["accountType"], message: "An account type is required." });
      return;
    }
    if (data.accountType && data.role && data.accountType !== data.role) {
      context.addIssue({ code: "custom", path: ["accountType"], message: "role and accountType must match." });
    }
    if (type === "seller") {
      if (!data.sellerName) {
        context.addIssue({
          code: "custom",
          path: ["sellerName"],
          message: "Seller name is required for seller accounts.",
        });
      }
      if (!data.sellerType) {
        context.addIssue({
          code: "custom",
          path: ["sellerType"],
          message: "Seller type is required for seller accounts.",
        });
      }
    }
  });

export type UserListQuery = z.infer<typeof userListSchema>;
export type UserStatusInput = z.infer<typeof userStatusSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
