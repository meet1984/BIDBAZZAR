import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { signAccessToken } from "../src/shared/tokens.js";
import { auditLogService } from "../src/modules/audit-log/audit-log.service.js";
import { auditLogRepository } from "../src/modules/audit-log/audit-log.repository.js";
import { adminPermissionRepository } from "../src/modules/admin-permissions/admin-permission.repository.js";
import type { AdminPermission } from "../src/types/database.types.js";

// Mock accounts store
const accounts: Record<number, any> = {
  1: { id: 1, accountType: "admin", fullName: "Root Admin", email: "admin@test.com", status: "active" },
  2: { id: 2, accountType: "admin_employee", fullName: "Employee One", email: "emp1@test.com", status: "active" },
  3: { id: 3, accountType: "admin_employee", fullName: "Employee Two", email: "emp2@test.com", status: "active" },
  4: { id: 4, accountType: "buyer", fullName: "Buyer Bob", email: "buyer@test.com", status: "active" },
  5: { id: 5, accountType: "seller", fullName: "Seller Alice", email: "seller@test.com", status: "active" },
};

// In-memory permissions store
let employeePermissions: Record<number, Set<AdminPermission>> = {
  2: new Set<AdminPermission>(["verification_review"]),
  3: new Set<AdminPermission>(["order_oversight", "dispute_management"]),
};

// In-memory audit log store
let auditLogs: any[] = [];
let nextAuditId = 1;

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  authRepository: {
    findAccountById: vi.fn(async (id: number) => accounts[id] || null),
  },
}));

vi.mock("../src/modules/admin-permissions/admin-permission.repository.js", () => ({
  adminPermissionRepository: {
    grantPermission: vi.fn(async (accountId: number, permission: AdminPermission) => {
      if (!employeePermissions[accountId]) {
        employeePermissions[accountId] = new Set();
      }
      employeePermissions[accountId].add(permission);
    }),
    revokePermission: vi.fn(async (accountId: number, permission: AdminPermission) => {
      if (employeePermissions[accountId]) {
        const deleted = employeePermissions[accountId].delete(permission);
        return deleted;
      }
      return false;
    }),
    listPermissionsByAccountId: vi.fn(async (accountId: number) => {
      return Array.from(employeePermissions[accountId] || []);
    }),
    hasPermission: vi.fn(async (accountId: number, permission: AdminPermission) => {
      return employeePermissions[accountId]?.has(permission) ?? false;
    }),
    listEmployeesWithPermissions: vi.fn(async () => {
      return [
        {
          accountId: 2,
          fullName: "Employee One",
          email: "emp1@test.com",
          status: "active",
          permissions: Array.from(employeePermissions[2] || []),
        },
        {
          accountId: 3,
          fullName: "Employee Two",
          email: "emp2@test.com",
          status: "active",
          permissions: Array.from(employeePermissions[3] || []),
        },
      ];
    }),
  },
}));

vi.mock("../src/modules/audit-log/audit-log.repository.js", () => ({
  auditLogRepository: {
    create: vi.fn(async (params: any) => {
      const entry = {
        id: nextAuditId++,
        actorAccountId: params.actorAccountId,
        action: params.action,
        targetEntity: params.targetEntity,
        targetId: String(params.targetId),
        reason: params.reason ?? null,
        metadata: params.metadata ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        createdAt: new Date(),
      };
      auditLogs.push(entry);
      return entry.id;
    }),
    list: vi.fn(async (filter: any) => {
      let result = [...auditLogs];
      if (filter.targetEntity) {
        result = result.filter((r) => r.targetEntity === filter.targetEntity);
      }
      if (filter.action) {
        result = result.filter((r) => r.action === filter.action);
      }
      return result;
    }),
    count: vi.fn(async () => auditLogs.length),
  },
}));

describe("Phase 2: Admin Permissions & Audit Logging", () => {
  const adminToken = signAccessToken({ id: 1, accountType: "admin", email: "admin@test.com", fullName: "Root Admin" });
  const emp1Token = signAccessToken({ id: 2, accountType: "admin_employee", email: "emp1@test.com", fullName: "Employee One" }); // Has verification_review
  const emp2Token = signAccessToken({ id: 3, accountType: "admin_employee", email: "emp2@test.com", fullName: "Employee Two" }); // Has order_oversight, dispute_management
  const buyerToken = signAccessToken({ id: 4, accountType: "buyer", email: "buyer@test.com", fullName: "Buyer Bob" });
  const sellerToken = signAccessToken({ id: 5, accountType: "seller", email: "seller@test.com", fullName: "Seller Alice" });

  beforeEach(() => {
    employeePermissions = {
      2: new Set<AdminPermission>(["verification_review"]),
      3: new Set<AdminPermission>(["order_oversight", "dispute_management"]),
    };
    auditLogs = [];
    nextAuditId = 1;
    vi.clearAllMocks();
  });

  describe("1. Permission Enforcement Middleware", () => {
    it("allows full admin access to permission-protected routes by default", async () => {
      const response = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("allows employee with the specific required permission (order_oversight)", async () => {
      const response = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", `Bearer ${emp2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("blocks employee WITHOUT the required permission with 403 PERMISSION_DENIED", async () => {
      // Employee 1 only has verification_review, not order_oversight
      const response = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", `Bearer ${emp1Token}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("PERMISSION_DENIED");
      expect(response.body.message).toContain("order_oversight");
    });

    it("blocks non-admin users (buyers, sellers) with 403 ROLE_FORBIDDEN", async () => {
      const buyerRes = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", `Bearer ${buyerToken}`);
      expect(buyerRes.status).toBe(403);

      const sellerRes = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", `Bearer ${sellerToken}`);
      expect(sellerRes.status).toBe(403);
    });
  });

  describe("2. Admin Permission Management & Auditing", () => {
    it("allows full admin to list all employees with their permissions", async () => {
      const response = await request(app)
        .get("/api/admin/employees")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].permissions).toContain("verification_review");
    });

    it("blocks employee from granting or modifying permissions", async () => {
      const response = await request(app)
        .post("/api/admin/employees/2/permissions")
        .set("Authorization", `Bearer ${emp1Token}`)
        .send({ permission: "dispute_management" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("ROLE_FORBIDDEN");
    });

    it("allows full admin to grant a permission to an employee and records an audit entry", async () => {
      const response = await request(app)
        .post("/api/admin/employees/2/permissions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ permission: "dispute_management" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify permission repository was called
      expect(adminPermissionRepository.grantPermission).toHaveBeenCalledWith(2, "dispute_management", 1);

      // Verify audit log entry was created
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorAccountId: 1,
          action: "admin_permission:grant",
          targetEntity: "account",
          targetId: 2,
        }),
        undefined,
      );
    });

    it("allows full admin to revoke a permission and records an audit entry", async () => {
      const response = await request(app)
        .delete("/api/admin/employees/2/permissions/verification_review")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(adminPermissionRepository.revokePermission).toHaveBeenCalledWith(2, "verification_review");
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorAccountId: 1,
          action: "admin_permission:revoke",
          targetEntity: "account",
          targetId: 2,
        }),
        undefined,
      );
    });
  });

  describe("3. Audit Log Service Invariants", () => {
    it("creates an immutable audit log entry via auditLogService.record", async () => {
      const logId = await auditLogService.record({
        actorAccountId: 1,
        action: "order:dispute_resolved",
        targetEntity: "order",
        targetId: 101,
        reason: "Seller failed to deliver tracked package",
        metadata: { refundAmount: 5000, currency: "INR" },
        ipAddress: "127.0.0.1",
        userAgent: "Vitest Agent",
      });

      expect(logId).toBe(1);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorAccountId: 1,
          action: "order:dispute_resolved",
          targetEntity: "order",
          targetId: 101,
          reason: "Seller failed to deliver tracked package",
        }),
        undefined,
      );
    });

    it("confirms NO endpoint exists to update or delete audit log entries", async () => {
      const putRes = await request(app)
        .put("/api/admin/audit-logs/1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Modified reason" });
      expect([404, 405]).toContain(putRes.status);

      const patchRes = await request(app)
        .patch("/api/admin/audit-logs/1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Modified reason" });
      expect([404, 405]).toContain(patchRes.status);

      const deleteRes = await request(app)
        .delete("/api/admin/audit-logs/1")
        .set("Authorization", `Bearer ${adminToken}`);
      expect([404, 405]).toContain(deleteRes.status);
    });
  });

  describe("4. Granular Admin Sub-Router Gating", () => {
    it("allows admin_employee with verification_review to access /api/admin/verification/buyers", async () => {
      const res = await request(app)
        .get("/api/admin/verification/buyers")
        .set("Authorization", `Bearer ${emp1Token}`);
      expect(res.status).not.toBe(403);
    });

    it("rejects admin_employee without verification_review on /api/admin/verification/buyers", async () => {
      const res = await request(app)
        .get("/api/admin/verification/buyers")
        .set("Authorization", `Bearer ${emp2Token}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PERMISSION_DENIED");
    });

    it("rejects admin_employee without listing_review on /api/admin/listings", async () => {
      const res = await request(app)
        .get("/api/admin/listings")
        .set("Authorization", `Bearer ${emp1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PERMISSION_DENIED");
    });

    it("rejects admin_employee without support_management on /api/admin/support/enquiries", async () => {
      const res = await request(app)
        .get("/api/admin/support/enquiries")
        .set("Authorization", `Bearer ${emp1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PERMISSION_DENIED");
    });
  });
});
