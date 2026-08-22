import { z } from "zod";

export const adminQueueQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum([
    "profile_incomplete",
    "draft",
    "submitted",
    "under_review",
    "verified",
    "changes_requested",
    "rejected",
    "suspended",
  ]).optional(),
  q: z.string().trim().optional(),
});

export const verificationTargetParamSchema = z.object({
  type: z.enum(["buyer", "seller"]),
  id: z.coerce.number().int().positive("Invalid account ID"),
});

export const adminDecisionSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export type AdminQueueQuery = z.infer<typeof adminQueueQuerySchema>;
export type AdminDecisionInput = z.infer<typeof adminDecisionSchema>;
