import type { Request, Response } from "express";
import { AppError } from "../../shared/AppError.js";
import { buyerProfileService } from "./buyer-profile.service.js";
import type { UpdateBuyerProfileInput } from "./buyer-profile.schemas.js";

export class BuyerProfileController {
  async getOwnProfile(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const profile = await buyerProfileService.getOwnProfile(req.auth.id);
    res.json({ success: true, data: profile });
  }

  async updateOwnProfile(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const input = req.body as UpdateBuyerProfileInput;
    const updated = await buyerProfileService.updateOwnProfile(req.auth.id, input);
    res.json({ success: true, message: "Buyer profile updated successfully.", data: updated });
  }

  async getPublicProfile(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw new AppError(400, "INVALID_ID", "Invalid buyer profile ID.");
    const publicProfile = await buyerProfileService.getPublicProfile(id);
    res.json({ success: true, data: publicProfile });
  }
}

export const buyerProfileController = new BuyerProfileController();
