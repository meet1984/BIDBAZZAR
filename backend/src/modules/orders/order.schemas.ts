import { z } from "zod";

export const orderStatusEnum = z.enum([
  "confirmed",
  "completed",
  "cancelled",
  "disputed",
  "resolved",
  "failed",
]);

export const orderIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const offerIdSchema = z.object({ offerId: z.coerce.number().int().positive() });
export const allocationIdSchema = z.object({ allocationId: z.coerce.number().int().positive() });
export const orderReferenceSchema = z.object({ reference: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9-]+$/) });

export const completeOrderSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(5, "Cancellation reason must be at least 5 characters").max(500),
});

export const orderQuerySchema = z.object({
  status: orderStatusEnum.optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type CompleteOrderInput = z.infer<typeof completeOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
