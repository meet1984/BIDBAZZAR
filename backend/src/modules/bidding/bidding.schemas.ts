import { z } from "zod";

import { isValidCurrencyAmount } from "../../shared/currency.js";

export const bidAuctionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const placeBidSchema = z.object({
  amount: z.coerce
    .number()
    .positive()
    .max(9999999999999)
    .refine(isValidCurrencyAmount, "Bid amount supports at most two decimals."),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
