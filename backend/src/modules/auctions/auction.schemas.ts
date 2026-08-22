import { z } from "zod";

const commaSeparated = z.preprocess((value) => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return value.split(",");
  return [];
}, z.array(z.string().trim().min(1)).max(20));

export const publicAuctionQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: commaSeparated.default([]),
  category: commaSeparated.default([]),
  location: z.string().trim().max(120).default(""),
  condition: commaSeparated.default([]),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z
    .enum(["recommended", "ending-soon", "newly-listed", "price-low", "price-high", "most-bids"])
    .default("recommended"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  featured: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
});

export const auctionIdentifierSchema = z.object({
  identifier: z.string().trim().min(1).max(180),
});

export const auctionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const sanitizeString = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim() : v),
    z.string().min(min).max(max),
  );

const auctionFields = {
  title: sanitizeString(4, 180),
  category: sanitizeString(2, 80),
  description: sanitizeString(20, 10000),
  condition: z.enum(["new", "like-new", "used", "refurbished"]),
  location: sanitizeString(2, 120),
  imageUrl: z.string().trim().max(10000000).nullable().optional(),
  imageUrls: z.array(z.string().trim().max(10000000)).max(6).optional(),
  startingPrice: z.coerce.number().min(0).max(9999999999999),
  minimumIncrement: z.coerce.number().positive().max(9999999999999),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
};

export const createAuctionSchema = z
  .object(auctionFields)
  .refine((value) => value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "Auction end time must be after its start time.",
  });

export const updateAuctionSchema = z
  .object(auctionFields)
  .partial()
  .refine(
    (value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
    { path: ["endsAt"], message: "Auction end time must be after its start time." },
  );

export const adminReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    notes: z.string().trim().max(1000).default(""),
  })
  .refine((value) => value.decision !== "reject" || value.notes.length >= 4, {
    path: ["notes"],
    message: "A rejection reason is required.",
  });

export const adminAuctionUpdateSchema = updateAuctionSchema;

export const adminAuctionListSchema = z.object({
  status: z.enum(["draft", "pending", "approved", "rejected", "closed", "changes_requested"]).optional(),
});

export type PublicAuctionQuery = z.infer<typeof publicAuctionQuerySchema>;
export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
export type UpdateAuctionInput = z.infer<typeof updateAuctionSchema>;
export type AdminReviewInput = z.infer<typeof adminReviewSchema>;
