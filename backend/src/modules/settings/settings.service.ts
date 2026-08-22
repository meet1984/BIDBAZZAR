import type { SettingsRepository } from "./settings.repository.js";
import { settingsRepository } from "./settings.repository.js";
import { AppError } from "../../shared/AppError.js";

const HOW_IT_WORKS_BANNER_KEY = "how_it_works_banner_url";
const DEFAULT_BANNER_URL = "/hero-auction-marketplace.png";

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async getHowItWorksBanner(): Promise<string> {
    return this.repository.getSetting(HOW_IT_WORKS_BANNER_KEY, DEFAULT_BANNER_URL);
  }

  async updateHowItWorksBanner(bannerUrl: string): Promise<string> {
    const trimmed = bannerUrl.trim();
    if (!trimmed) {
      return this.getHowItWorksBanner();
    }
    const isLocalAsset = /^\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/i.test(trimmed);
    let isHttpsUrl = false;
    try { isHttpsUrl = new URL(trimmed).protocol === "https:"; } catch { isHttpsUrl = false; }
    if (!isLocalAsset && !isHttpsUrl) {
      throw new AppError(422, "INVALID_BANNER_URL", "Banner URL must be an HTTPS URL or a local image path.");
    }
    await this.repository.setSetting(HOW_IT_WORKS_BANNER_KEY, trimmed);
    return trimmed;
  }
}

export const settingsService = new SettingsService(settingsRepository);
