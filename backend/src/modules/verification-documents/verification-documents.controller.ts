import type { Request, Response } from "express";
import { AppError } from "../../shared/AppError.js";
import { verificationDocumentService } from "./verification-documents.service.js";
import type { CreateDocumentMetadataInput } from "./verification-documents.schemas.js";
import { hasAdminCapability } from "../admin-permissions/admin-permission.authorization.js";

export class VerificationDocumentController {
  async listMine(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const queryAccountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const mayReview = queryAccountId
      ? await hasAdminCapability(req.auth.id, req.auth.accountType, "verification_review")
      : false;
    const targetAccountId = queryAccountId && !isNaN(queryAccountId) && mayReview
      ? queryAccountId
      : req.auth.id;
    const docs = await verificationDocumentService.listAccountDocuments(targetAccountId);
    res.json({ success: true, data: docs });
  }

  async listForUser(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw new AppError(400, "INVALID_ID", "Invalid target account ID.");
    const docs = await verificationDocumentService.listAccountDocuments(id);
    res.json({ success: true, data: docs });
  }

  async uploadDocument(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    if (req.auth.accountType !== "buyer" && req.auth.accountType !== "seller") {
      throw new AppError(403, "ACCOUNT_TYPE_FORBIDDEN", "Only buyer and seller accounts can upload verification documents.");
    }
    const accountType = req.auth.accountType;
    const input = req.body as CreateDocumentMetadataInput;
    const created = await verificationDocumentService.uploadDocumentFile(req.auth.id, accountType, input, req.file);
    res.status(201).json({ success: true, message: "Verification document uploaded successfully.", data: created });
  }

  async downloadFile(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw new AppError(400, "INVALID_ID", "Invalid document ID.");

    const { stream, fileMime, originalName } = await verificationDocumentService.getDocumentFileStream(
      id,
      req.auth.id,
      req.auth.accountType || "buyer",
      req.ip,
      req.get("user-agent"),
    );

    res.setHeader("Content-Type", fileMime);
    const fallbackName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
    res.setHeader("Content-Disposition", `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`);
    stream.pipe(res);
  }

  async remove(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw new AppError(400, "INVALID_ID", "Invalid document ID.");
    await verificationDocumentService.deleteDocument(id, req.auth.id);
    res.json({ success: true, message: "Document removed successfully." });
  }
}

export const verificationDocumentController = new VerificationDocumentController();
