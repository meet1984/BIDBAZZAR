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

publicSettingsRouter.get(
  "/about-photos",
  asyncHandler(async (_req: Request, res: Response) => {
    const photos = await settingsService.getAboutPhotos();
    res.json({ photos });
  }),
);

publicSettingsRouter.get(
  "/about-categories",
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await settingsService.getAboutCategories();
    res.json({ categories });
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

adminSettingsRouter.put(
  "/about-photos",
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as {
      photos?: {
        heroImage1?: unknown;
        heroImage2?: unknown;
        heroImage3?: unknown;
      };
      heroImage1?: unknown;
      heroImage2?: unknown;
      heroImage3?: unknown;
    };

    const photosPayload: {
      heroImage1?: string;
      heroImage2?: string;
      heroImage3?: string;
    } = {};

    const rawPhotos = body.photos || body;

    if (typeof rawPhotos.heroImage1 === "string") {
      photosPayload.heroImage1 = rawPhotos.heroImage1;
    }
    if (typeof rawPhotos.heroImage2 === "string") {
      photosPayload.heroImage2 = rawPhotos.heroImage2;
    }
    if (typeof rawPhotos.heroImage3 === "string") {
      photosPayload.heroImage3 = rawPhotos.heroImage3;
    }

    const photos = await settingsService.updateAboutPhotos(photosPayload);
    res.json({ success: true, photos });
  }),
);

adminSettingsRouter.post(
  "/about-photos/upload",
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    const rawSlot = Number(req.body.slot ?? req.query.slot ?? 1);
    const slot = Number.isInteger(rawSlot) && rawSlot >= 1 && rawSlot <= 3 ? rawSlot : 1;

    if (!file) {
      const photos = await settingsService.getAboutPhotos();
      res.json({ success: true, photos });
      return;
    }

    const photos = await settingsService.uploadAboutPhoto(slot, file);
    res.json({ success: true, photos });
  }),
);

adminSettingsRouter.put(
  "/about-categories",
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { categories?: unknown } | unknown[];
    const rawList = Array.isArray(body) ? body : (body as { categories?: unknown })?.categories;
    const categories = await settingsService.updateAboutCategories(rawList || []);
    res.json({ success: true, categories });
  }),
);

adminSettingsRouter.post(
  "/about-categories/upload",
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ code: "FILE_REQUIRED", message: "No image file uploaded." });
      return;
    }
    const imageUrl = await settingsService.uploadAboutCategoryImage(file);
    res.json({ success: true, imageUrl });
  }),
);


