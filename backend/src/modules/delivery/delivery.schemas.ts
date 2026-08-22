import { z } from "zod";

export const proofOfDeliveryTypeEnum = z.enum([
  "signature",
  "photo",
  "otp",
  "carrier_confirmation",
  "buyer_acknowledgement",
]);

export const shipOrderSchema = z.object({
  carrierName: z.string().trim().min(2, "Carrier name is required").max(100),
  trackingNumber: z.string().trim().min(3, "Tracking number is required").max(100),
  trackingUrl: z.string().url("Tracking URL must be a valid URL").optional().or(z.literal("")),
  dispatchNotes: z.string().max(500).optional(),
  estimatedDeliveryAt: z.coerce.date().optional(),
});

export const readyForCollectionSchema = z.object({
  collectionLocation: z.string().trim().min(5, "Collection location is required").max(255),
  collectionInstructions: z.string().trim().min(5, "Collection instructions are required").max(1000),
  collectionReadyAt: z.coerce.date().optional(),
});

export const markDeliveredSchema = z.object({
  proofOfDeliveryType: proofOfDeliveryTypeEnum,
  proofOfDeliveryRef: z.string().trim().max(255).optional(),
  proofOfDeliveryNotes: z.string().trim().max(500).optional(),
  buyerConfirmationDeadlineDays: z.number().int().min(1).max(30).default(7),
});

export const buyerConfirmDeliverySchema = z
  .object({
    notes: z.string().trim().max(500).optional(),
  })
  .optional()
  .default({});

export type ShipOrderInput = z.infer<typeof shipOrderSchema>;
export type ReadyForCollectionInput = z.infer<typeof readyForCollectionSchema>;
export type MarkDeliveredInput = z.infer<typeof markDeliveredSchema>;
export type BuyerConfirmDeliveryInput = z.infer<typeof buyerConfirmDeliverySchema>;
