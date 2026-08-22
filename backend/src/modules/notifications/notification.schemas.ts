import { z } from "zod";

export const notificationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const notificationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
