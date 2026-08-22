import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { verificationDocumentUpload } from "../../middleware/upload.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { verificationDocumentController } from "./verification-documents.controller.js";
import { createDocumentMetadataSchema, documentIdParamSchema } from "./verification-documents.schemas.js";

export const verificationDocumentRouter = Router();

verificationDocumentRouter.use(...requireAuth);

verificationDocumentRouter.get(
  "/",
  asyncHandler(verificationDocumentController.listMine),
);

verificationDocumentRouter.post(
  "/",
  verificationDocumentUpload,
  validate(createDocumentMetadataSchema),
  asyncHandler(verificationDocumentController.uploadDocument),
);

verificationDocumentRouter.get(
  "/:id/download",
  validate(documentIdParamSchema, "params"),
  asyncHandler(verificationDocumentController.downloadFile),
);

verificationDocumentRouter.delete(
  "/:id",
  validate(documentIdParamSchema, "params"),
  asyncHandler(verificationDocumentController.remove),
);
