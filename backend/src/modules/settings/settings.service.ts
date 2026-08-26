import type { SettingsRepository } from "./settings.repository.js";
import { settingsRepository } from "./settings.repository.js";
import { AppError } from "../../shared/AppError.js";
import { localStorageService } from "../../shared/storage/localStorage.service.js";

const HOW_IT_WORKS_BANNER_KEY = "how_it_works_banner_url";
const DEFAULT_BANNER_URL = "/hero-auction-marketplace.png";

function parseDataUri(dataUri: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUri.trim());
  if (!match || !match[1] || !match[2]) return null;
  try {
    const buffer = Buffer.from(match[2], "base64");
    return {
      mimeType: match[1].toLowerCase(),
      buffer,
    };
  } catch {
    return null;
  }
}

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async getHowItWorksBanner(): Promise<string> {
    return this.repository.getSetting(HOW_IT_WORKS_BANNER_KEY, DEFAULT_BANNER_URL);
  }

  async uploadBannerImage(file: Express.Multer.File): Promise<string> {
    if (!file || !file.buffer) {
      throw new AppError(400, "FILE_REQUIRED", "No image file uploaded.");
    }
    const stored = await localStorageService.saveImage(
      file.buffer,
      file.originalname || "banner.jpg",
      file.mimetype,
      "listings",
    );
    await this.repository.setSetting(HOW_IT_WORKS_BANNER_KEY, stored.url);
    return stored.url;
  }

  async updateHowItWorksBanner(bannerUrl: string): Promise<string> {
    const trimmed = bannerUrl.trim();
    if (!trimmed) {
      return this.getHowItWorksBanner();
    }

    // Handle base64 Data URL (e.g. from client-side compression)
    if (trimmed.startsWith("data:image/")) {
      const parsed = parseDataUri(trimmed);
      if (!parsed) {
        throw new AppError(422, "INVALID_BANNER_DATA", "The provided image data is invalid.");
      }
      const stored = await localStorageService.saveImage(
        parsed.buffer,
        "banner.jpg",
        parsed.mimeType,
        "listings",
      );
      await this.repository.setSetting(HOW_IT_WORKS_BANNER_KEY, stored.url);
      return stored.url;
    }

    const isLocalAsset = /^\/[a-zA-Z0-9/._-]+\.(?:png|jpe?g|webp|svg)$/i.test(trimmed);
    let isWebUrl = false;
    try {
      const url = new URL(trimmed);
      isWebUrl = url.protocol === "https:" || url.protocol === "http:";
    } catch {
      isWebUrl = false;
    }

    if (!isLocalAsset && !isWebUrl) {
      throw new AppError(422, "INVALID_BANNER_URL", "Banner URL must be a valid web URL or a local image path.");
    }

    await this.repository.setSetting(HOW_IT_WORKS_BANNER_KEY, trimmed);
    return trimmed;
  }
}

export const settingsService = new SettingsService(settingsRepository);

