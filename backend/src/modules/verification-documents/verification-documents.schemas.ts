import { z } from "zod";

export const documentIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid document ID"),
});

export const createDocumentMetadataSchema = z.object({
  documentType: z.enum([
    "government_id",
    "address_proof",
    "business_registration",
    "tax_certificate",
    "other",
  ]),
});

export type CreateDocumentMetadataInput = z.infer<typeof createDocumentMetadataSchema>;
