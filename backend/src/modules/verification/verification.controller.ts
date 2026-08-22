import type { Request, Response } from "express";
import { AppError } from "../../shared/AppError.js";
import type { VerificationAccountType } from "../../types/database.types.js";
import { verificationService } from "./verification.service.js";
import type { AdminDecisionInput, AdminQueueQuery } from "./verification.schemas.js";

export class VerificationController {
  async getStatus(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const accountType = (req.auth.accountType || "buyer") as VerificationAccountType;
    const status = await verificationService.getVerificationStatus(req.auth.id, accountType);
    res.json({ success: true, data: status });
  }

  async submit(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const accountType = (req.auth.accountType || "buyer") as VerificationAccountType;
    const updated = await verificationService.submitVerification(req.auth.id, accountType);
    res.json({ success: true, message: "Verification submitted successfully.", data: updated });
  }

  async getBuyerQueue(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as AdminQueueQuery;
    const queue = await verificationService.listBuyerQueue(query);
    res.json({ success: true, data: queue });
  }

  async getSellerQueue(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as AdminQueueQuery;
    const queue = await verificationService.listSellerQueue(query);
    res.json({ success: true, data: queue });
  }

  async getAdminProfile(req: Request, res: Response): Promise<void> {
    const type = req.params.type as VerificationAccountType;
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw new AppError(400, "INVALID_ID", "Invalid target account ID.");
    const details = await verificationService.getAdminProfileDetails(id, type);
    res.json({ success: true, data: details });
  }

  async approve(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const type = req.params.type as VerificationAccountType;
    const id = Number(req.params.id);
    await verificationService.approveVerification(id, type, req.auth.id);
    res.json({ success: true, message: `Verification approved for ${type} account #${id}.` });
  }

  async reject(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const type = req.params.type as VerificationAccountType;
    const id = Number(req.params.id);
    const body = req.body as AdminDecisionInput;
    const reason = body.reason || "";
    await verificationService.rejectVerification(id, type, req.auth.id, reason);
    res.json({ success: true, message: `Verification rejected for ${type} account #${id}.` });
  }

  async requestChanges(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const type = req.params.type as VerificationAccountType;
    const id = Number(req.params.id);
    const body = req.body as AdminDecisionInput;
    const reason = body.reason || "";
    await verificationService.requestChanges(id, type, req.auth.id, reason);
    res.json({ success: true, message: `Changes requested for ${type} account #${id}.` });
  }

  async suspend(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const type = req.params.type as VerificationAccountType;
    const id = Number(req.params.id);
    const body = req.body as AdminDecisionInput;
    const reason = body.reason;
    await verificationService.suspendAccount(id, type, req.auth.id, reason);
    res.json({ success: true, message: `Account #${id} (${type}) suspended.` });
  }
}

export const verificationController = new VerificationController();
