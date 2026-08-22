import { z } from "zod";

export const submitOfferSchema = z.object({
  offeredAmount: z.number().positive("Offered amount must be positive."),
  currency: z.string().max(10).optional().default("INR"),
  buyerMessage: z.string().max(1000).optional().nullable(),
  offerExpiry: z.string().datetime().optional().nullable(),
});

export const reviseOfferSchema = z.object({
  offeredAmount: z.number().positive("Offered amount must be positive.").optional(),
  buyerMessage: z.string().max(1000).optional().nullable(),
  offerExpiry: z.string().datetime().optional().nullable(),
});

export const counterOfferSchema = z.object({
  counterAmount: z.number().positive("Counter amount must be positive."),
  sellerMessage: z.string().max(1000).optional().nullable(),
});

export const acceptOfferSchema = z
  .object({
    confirmDeadlineHours: z.number().int().min(1).max(168).optional(),
    buyerConfirmationDeadlineHours: z.number().int().min(1).max(168).optional(),
  })
  .transform((data) => ({
    confirmDeadlineHours: data.confirmDeadlineHours ?? data.buyerConfirmationDeadlineHours ?? 48,
  }));

export const offerIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const offerListingIdParamSchema = z.object({ listingId: z.coerce.number().int().positive() });

export type SubmitOfferInput = z.infer<typeof submitOfferSchema>;
export type ReviseOfferInput = z.infer<typeof reviseOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>;
