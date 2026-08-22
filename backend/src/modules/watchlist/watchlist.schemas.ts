import { z } from "zod";

export const watchlistListingSchema = z.object({
  listingId: z.coerce.number().int().positive(),
});
