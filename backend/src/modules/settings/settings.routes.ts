import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { requireRole } from "../../middleware/auth.middleware.js";
import { settingsService } from "./settings.service.js";

export const publicSettingsRouter = Router();
export const adminSettingsRouter = Router();

publicSettingsRouter.get(
  "/how-it-works-banner",
  asyncHandler(async (_req: Request, res: Response) => {
    const bannerUrl = await settingsService.getHowItWorksBanner();
    res.json({ bannerUrl });
  }),
);

adminSettingsRouter.use(requireRole("admin"));

adminSettingsRouter.put(
  "/how-it-works-banner",
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { bannerUrl?: unknown };
    const rawBannerUrl = typeof body.bannerUrl === "string" ? body.bannerUrl : "";
    const bannerUrl = await settingsService.updateHowItWorksBanner(rawBannerUrl);
    res.json({ success: true, bannerUrl });
  }),
);
