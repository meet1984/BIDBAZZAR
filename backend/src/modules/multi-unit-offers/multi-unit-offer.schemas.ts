import { z } from "zod";

export const submitMultiUnitOfferSchema = z.object({
  quantityRequested: z.coerce.number().int().positive("Requested quantity must be at least 1."),
  offeredPricePerUnit: z
    .coerce
    .number()
    .positive("Offered price per unit must be greater than zero.")
    .refine((val) => Number(val.toFixed(2)) === val, {
      message: "Offered price per unit cannot have more than two decimal places.",
    }),
  buyerMessage: z.string().trim().max(1000).optional(),
  offerExpiry: z.string().datetime().optional().nullable(),
});

export const reviseMultiUnitOfferSchema = z.object({
  quantityRequested: z.coerce.number().int().positive("Requested quantity must be at least 1.").optional(),
  offeredPricePerUnit: z
    .coerce
    .number()
    .positive("Offered price per unit must be greater than zero.")
    .refine((val) => Number(val.toFixed(2)) === val, {
      message: "Offered price per unit cannot have more than two decimal places.",
    })
    .optional(),
  buyerMessage: z.string().trim().max(1000).optional(),
  offerExpiry: z.string().datetime().optional().nullable(),
});

export const multiUnitOfferIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const multiUnitListingIdParamSchema = z.object({ listingId: z.coerce.number().int().positive() });

export const acceptPartialSchema = z.object({
  partialQuantity: z.coerce.number().int().positive("Partial quantity must be at least 1."),
});

export const counterMultiUnitOfferSchema = z.object({
  counterQuantity: z.coerce.number().int().positive("Counter quantity must be at least 1.").optional(),
  counterUnitPrice: z
    .coerce
    .number()
    .positive("Counter unit price must be greater than zero.")
    .refine((val) => Number(val.toFixed(2)) === val, {
      message: "Counter unit price cannot have more than two decimal places.",
    })
    .optional(),
  sellerMessage: z.string().trim().max(1000).optional(),
});

export type SubmitMultiUnitOfferInput = z.infer<typeof submitMultiUnitOfferSchema>;
export type ReviseMultiUnitOfferInput = z.infer<typeof reviseMultiUnitOfferSchema>;
export type AcceptPartialInput = z.infer<typeof acceptPartialSchema>;
export type CounterMultiUnitOfferInput = z.infer<typeof counterMultiUnitOfferSchema>;
