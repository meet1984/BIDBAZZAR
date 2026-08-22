import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
