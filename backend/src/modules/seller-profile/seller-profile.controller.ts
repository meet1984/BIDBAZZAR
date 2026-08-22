import type { Request, Response } from "express";
import { AppError } from "../../shared/AppError.js";
import { sellerProfileService } from "./seller-profile.service.js";
import type { UpdateSellerProfileInput } from "./seller-profile.schemas.js";

export class SellerProfileController {
  async getOwnProfile(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const profile = await sellerProfileService.getOwnProfile(req.auth.id);
    res.json({ success: true, data: profile });
  }

  async updateOwnProfile(req: Request, res: Response): Promise<void> {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
    const input = req.body as UpdateSellerProfileInput;
    const updated = await sellerProfileService.updateOwnProfile(req.auth.id, input);
    res.json({ success: true, message: "Seller profile updated successfully.", data: updated });
  }

  async getPublicProfile(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) throw new AppError(400, "INVALID_ID", "Invalid seller profile ID.");
    const publicProfile = await sellerProfileService.getPublicProfile(id);
    res.json({ success: true, data: publicProfile });
  }
}

export const sellerProfileController = new SellerProfileController();
