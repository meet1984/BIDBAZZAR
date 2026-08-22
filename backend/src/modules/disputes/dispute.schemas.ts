import { z } from "zod";

export const disputeReasonEnum = z.enum([
  "item_not_received",
  "item_damaged",
  "not_as_described",
  "seller_unresponsive",
  "buyer_unresponsive",
  "other",
]);

export const disputeStatusEnum = z.enum([
  "opened",
  "under_review",
  "resolved_buyer_favour",
  "resolved_seller_favour",
  "resolved_compromise",
  "closed",
]);

export const resolveDisputeOutcomeEnum = z.enum([
  "resolved_buyer_favour",
  "resolved_seller_favour",
  "resolved_compromise",
  "closed",
]);

export const openDisputeSchema = z.object({
  reason: disputeReasonEnum,
  details: z.string().trim().min(10, "Dispute details must be at least 10 characters").max(2000),
});

export const resolveDisputeSchema = z.object({
  resolutionOutcome: resolveDisputeOutcomeEnum,
  resolutionNotes: z.string().trim().min(10, "Audited resolution notes must be at least 10 characters").max(2000),
});

export const disputeQuerySchema = z.object({
  status: disputeStatusEnum.optional(),
  orderId: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const disputeIdSchema = z.object({ id: z.coerce.number().int().positive() });

export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export type DisputeQueryInput = z.infer<typeof disputeQuerySchema>;
