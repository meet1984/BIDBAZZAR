import { Router, type Request, type Response } from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { requireAccountType } from "../../middleware/auth.middleware.js";
import { settingsService } from "./settings.service.js";
import { env } from "../../config/env.js";

export const publicSettingsRouter = Router();
export const adminSettingsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
});

publicSettingsRouter.get(
  "/how-it-works-banner",
  asyncHandler(async (_req: Request, res: Response) => {
    const bannerUrl = await settingsService.getHowItWorksBanner();
    res.json({ bannerUrl });
  }),
);

adminSettingsRouter.use(requireAccountType("admin", "admin_employee"));

adminSettingsRouter.put(
  "/how-it-works-banner",
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { bannerUrl?: unknown };
    const rawBannerUrl = typeof body.bannerUrl === "string" ? body.bannerUrl : "";
    const bannerUrl = await settingsService.updateHowItWorksBanner(rawBannerUrl);
    res.json({ success: true, bannerUrl });
  }),
);

adminSettingsRouter.post(
  "/how-it-works-banner/upload",
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      const bannerUrl = await settingsService.getHowItWorksBanner();
      res.json({ success: true, bannerUrl });
      return;
    }
    const bannerUrl = await settingsService.uploadBannerImage(file);
    res.json({ success: true, bannerUrl });
  }),
);

