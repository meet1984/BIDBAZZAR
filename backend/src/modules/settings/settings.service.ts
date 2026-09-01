import type { SettingsRepository } from "./settings.repository.js";
import { settingsRepository } from "./settings.repository.js";
import { categoryRepository, type CategoryWithStats } from "../categories/category.repository.js";
import { AppError } from "../../shared/AppError.js";
import { localStorageService } from "../../shared/storage/localStorage.service.js";

const HOW_IT_WORKS_BANNER_KEY = "how_it_works_banner_url";
const DEFAULT_BANNER_URL = "/hero-auction-marketplace.png";

const ABOUT_HERO_IMAGE_1_KEY = "about_hero_image_1";
const ABOUT_HERO_IMAGE_2_KEY = "about_hero_image_2";
const ABOUT_HERO_IMAGE_3_KEY = "about_hero_image_3";
const ABOUT_CATEGORIES_KEY = "about_categories";
const DEFAULT_ABOUT_IMAGE = "/hero-auction-marketplace.png";

export interface AboutPhotos {
  heroImage1: string;
  heroImage2: string;
  heroImage3: string;
}

export interface AboutCategoryItem {
  id?: number;
  name: string;
  slug: string;
  imageUrl: string;
  displayOrder: number;
  isDisplayed: boolean;
  iconName?: string;
}

function parseDataUri(dataUri: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/.exec(dataUri.trim());
  if (!match || !match[1] || !match[2]) return null;
  try {
    let mimeType = match[1].toLowerCase();
    if (mimeType === "image/jpg" || mimeType === "image/pjpeg") {
      mimeType = "image/jpeg";
    }
    const cleanBase64 = match[2].replace(/\s/g, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    if (buffer.length === 0) return null;
    return {
      mimeType,
      buffer,
    };
  } catch {
    return null;
  }
}

const DEFAULT_CURATED_CATEGORIES: AboutCategoryItem[] = [
  { name: "Automotive & Vehicles", slug: "vehicles", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 1, isDisplayed: true },
  { name: "Electronics & Tech", slug: "electronics", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 2, isDisplayed: true },
  { name: "Antiques & Collectibles", slug: "collectibles", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 3, isDisplayed: true },
  { name: "Fashion & Luxury", slug: "fashion-luxury", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 4, isDisplayed: true },
  { name: "Industrial & Equipment", slug: "industrial-equipment", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 5, isDisplayed: true },
  { name: "Home & Lifestyle", slug: "home-lifestyle", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 6, isDisplayed: true },
  { name: "Jewelry & Watches", slug: "jewelry-watches", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 7, isDisplayed: true },
  { name: "Other", slug: "other", imageUrl: DEFAULT_ABOUT_IMAGE, displayOrder: 8, isDisplayed: true },
];

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  private async processImageString(rawValue: unknown, defaultFallback: string): Promise<string> {
    if (typeof rawValue !== "string") {
      return defaultFallback;
    }
    let trimmed = rawValue.trim();
    if (!trimmed) {
      return defaultFallback;
    }

    if (trimmed.startsWith("data:image/")) {
      const parsed = parseDataUri(trimmed);
      if (!parsed) {
        throw new AppError(422, "INVALID_IMAGE_DATA", "The provided image data is invalid.");
      }
      const stored = await localStorageService.saveImage(
        parsed.buffer,
        "photo.jpg",
        parsed.mimeType,
        "listings",
      );
      return stored.url;
    }

    // Auto-normalize relative paths without leading slash
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
      trimmed = "/" + trimmed;
    }

    const isLocalAsset = /^\/[a-zA-Z0-9/_.-]+(?:\.(?:png|jpe?g|webp|svg|gif|avif))?(?:\?.*)?$/i.test(trimmed);
    let isWebUrl = false;
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      isWebUrl = url.protocol === "https:" || url.protocol === "http:";
    } catch {
      isWebUrl = false;
    }

    if (!isLocalAsset && !isWebUrl) {
      throw new AppError(422, "INVALID_IMAGE_URL", "Image URL must be a valid web URL or a local image path.");
    }

    return trimmed;
  }

  async getHowItWorksBanner(): Promise<string> {
    return this.repository.getSetting(HOW_IT_WORKS_BANNER_KEY, DEFAULT_BANNER_URL);
  }

  async uploadBannerImage(file: Express.Multer.File): Promise<string> {
    if (!file || !file.buffer) {
      throw new AppError(400, "FILE_REQUIRED", "No image file uploaded.");
    }
    let mimeType = file.mimetype?.toLowerCase() || "image/jpeg";
    if (mimeType === "image/jpg" || mimeType === "image/pjpeg") {
      mimeType = "image/jpeg";
    }
    const stored = await localStorageService.saveImage(
      file.buffer,
      file.originalname || "banner.jpg",
      mimeType,
      "listings",
    );
    await this.repository.setSetting(HOW_IT_WORKS_BANNER_KEY, stored.url);
    return stored.url;
  }

  async updateHowItWorksBanner(bannerUrl: string): Promise<string> {
    const processed = await this.processImageString(bannerUrl, DEFAULT_BANNER_URL);
    await this.repository.setSetting(HOW_IT_WORKS_BANNER_KEY, processed);
    return processed;
  }

  async getAboutPhotos(): Promise<AboutPhotos> {
    const [heroImage1, heroImage2, heroImage3] = await Promise.all([
      this.repository.getSetting(ABOUT_HERO_IMAGE_1_KEY, DEFAULT_ABOUT_IMAGE),
      this.repository.getSetting(ABOUT_HERO_IMAGE_2_KEY, DEFAULT_ABOUT_IMAGE),
      this.repository.getSetting(ABOUT_HERO_IMAGE_3_KEY, DEFAULT_ABOUT_IMAGE),
    ]);
    return { heroImage1, heroImage2, heroImage3 };
  }

  async updateAboutPhotos(photos: Partial<AboutPhotos>): Promise<AboutPhotos> {
    const current = await this.getAboutPhotos();

    if (photos.heroImage1 !== undefined) {
      const processed = await this.processImageString(photos.heroImage1, DEFAULT_ABOUT_IMAGE);
      await this.repository.setSetting(ABOUT_HERO_IMAGE_1_KEY, processed);
      current.heroImage1 = processed;
    }

    if (photos.heroImage2 !== undefined) {
      const processed = await this.processImageString(photos.heroImage2, DEFAULT_ABOUT_IMAGE);
      await this.repository.setSetting(ABOUT_HERO_IMAGE_2_KEY, processed);
      current.heroImage2 = processed;
    }

    if (photos.heroImage3 !== undefined) {
      const processed = await this.processImageString(photos.heroImage3, DEFAULT_ABOUT_IMAGE);
      await this.repository.setSetting(ABOUT_HERO_IMAGE_3_KEY, processed);
      current.heroImage3 = processed;
    }

    return current;
  }

  async uploadAboutPhoto(slot: number, file: Express.Multer.File): Promise<AboutPhotos> {
    if (slot < 1 || slot > 3) {
      throw new AppError(400, "INVALID_SLOT", "Slot must be 1, 2, or 3.");
    }
    if (!file || !file.buffer) {
      throw new AppError(400, "FILE_REQUIRED", "No image file uploaded.");
    }

    let mimeType = file.mimetype?.toLowerCase() || "image/jpeg";
    if (mimeType === "image/jpg" || mimeType === "image/pjpeg") {
      mimeType = "image/jpeg";
    }

    const stored = await localStorageService.saveImage(
      file.buffer,
      file.originalname || `about-slot-${slot}.jpg`,
      mimeType,
      "listings",
    );

    const key =
      slot === 1
        ? ABOUT_HERO_IMAGE_1_KEY
        : slot === 2
          ? ABOUT_HERO_IMAGE_2_KEY
          : ABOUT_HERO_IMAGE_3_KEY;

    await this.repository.setSetting(key, stored.url);
    return this.getAboutPhotos();
  }

  async getAboutCategories(): Promise<AboutCategoryItem[]> {
    let allDbCategories: CategoryWithStats[] = [];
    try {
      allDbCategories = await categoryRepository.findAllCategories(true);
    } catch {
      allDbCategories = [];
    }

    const dbCatMapById = new Map<number, CategoryWithStats>();
    const dbCatMapBySlug = new Map<string, CategoryWithStats>();
    for (const cat of allDbCategories) {
      dbCatMapById.set(cat.id, cat);
      if (cat.slug) dbCatMapBySlug.set(cat.slug.toLowerCase(), cat);
    }

    const raw = await this.repository.getSetting(ABOUT_CATEGORIES_KEY, "");
    if (raw && typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const result: AboutCategoryItem[] = [];
          for (let index = 0; index < parsed.length; index++) {
            const item = parsed[index] as Record<string, unknown> | null;
            if (!item || typeof item !== "object") continue;

            const id = typeof item.id === "number" ? item.id : undefined;
            const slug = typeof item.slug === "string" ? item.slug.trim() : "";
            const matchedDbCat =
              (id ? dbCatMapById.get(id) : null) ||
              (slug ? dbCatMapBySlug.get(slug.toLowerCase()) : null);

            // If linked to a DB category that is deactivated, hide it from public display
            const dbIsActive = matchedDbCat ? matchedDbCat.isActive : true;
            const isExplicitlyHidden =
              item.isDisplayed === false || item.isDisplayed === "false" || item.isDisplayed === 0;
            const isDisplayed = dbIsActive && !isExplicitlyHidden;

            // Live sync name & slug from the DB category so edits in Category Hierarchy take effect immediately!
            const rawItemName = typeof item.name === "string" ? item.name : "";
            const name = (matchedDbCat?.name || rawItemName || "Category").trim();
            const syncedSlug = (
              matchedDbCat?.slug ||
              slug ||
              name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
            ).trim();

            // Photo: prefer custom item imageUrl if set, otherwise fallback to dbCat.imageUrl
            const rawItemImg = typeof item.imageUrl === "string" ? item.imageUrl : null;
            const itemImg =
              rawItemImg && rawItemImg !== DEFAULT_ABOUT_IMAGE ? rawItemImg : null;
            const dbImg =
              matchedDbCat?.imageUrl && matchedDbCat.imageUrl !== DEFAULT_ABOUT_IMAGE
                ? matchedDbCat.imageUrl
                : null;
            const imageUrl = itemImg || dbImg || rawItemImg || DEFAULT_ABOUT_IMAGE;

            const displayOrder = typeof item.displayOrder === "number" ? item.displayOrder : index + 1;
            const iconName = typeof item.iconName === "string" && item.iconName.trim() ? item.iconName.trim() : undefined;

            result.push({
              id: matchedDbCat?.id || id,
              name,
              slug: syncedSlug,
              imageUrl,
              displayOrder,
              isDisplayed,
              iconName,
            });
          }

          if (result.length > 0) {
            return result;
          }
        }
      } catch {
        // Fallback if parsing fails
      }
    }

    // Default fallback: return active marketplace categories from DB
    const activeCats = allDbCategories.filter((c) => c.isActive);
    if (activeCats.length > 0) {
      return activeCats.map((cat, index) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        imageUrl: cat.imageUrl || DEFAULT_ABOUT_IMAGE,
        displayOrder: index + 1,
        isDisplayed: true,
      }));
    }

    return DEFAULT_CURATED_CATEGORIES;
  }

  async updateAboutCategories(rawItems: unknown): Promise<AboutCategoryItem[]> {
    if (!Array.isArray(rawItems)) {
      throw new AppError(400, "INVALID_CATEGORIES_PAYLOAD", "Categories must be an array.");
    }

    const processed: AboutCategoryItem[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i] as Record<string, unknown> | null;
      if (!item || typeof item !== "object") continue;
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) continue;

      const slug =
        typeof item.slug === "string" && item.slug.trim()
          ? item.slug.trim()
          : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const rawImg =
        typeof item.imageUrl === "string"
          ? item.imageUrl
          : typeof item.image === "string"
            ? item.image
            : DEFAULT_ABOUT_IMAGE;
      const imageUrl = await this.processImageString(rawImg, DEFAULT_ABOUT_IMAGE);

      const id = typeof item.id === "number" ? item.id : undefined;
      const isDisplayed =
        item.isDisplayed !== false && item.isDisplayed !== "false" && item.isDisplayed !== 0;

      const displayOrder = typeof item.displayOrder === "number" ? item.displayOrder : i + 1;
      const iconName = typeof item.iconName === "string" && item.iconName.trim() ? item.iconName.trim() : undefined;

      processed.push({
        id,
        name,
        slug,
        imageUrl,
        displayOrder,
        isDisplayed,
        iconName,
      });

      // If category has an ID in database and an image or name was updated, sync to DB category record too
      if (id) {
        try {
          await categoryRepository.updateCategory(id, {
            name,
            imageUrl: imageUrl === DEFAULT_ABOUT_IMAGE ? undefined : imageUrl,
          });
        } catch {
          // Ignore DB sync error if record not found
        }
      }
    }

    await this.repository.setSetting(ABOUT_CATEGORIES_KEY, JSON.stringify(processed));
    return processed;
  }

  async uploadAboutCategoryImage(file: Express.Multer.File): Promise<string> {
    if (!file || !file.buffer) {
      throw new AppError(400, "FILE_REQUIRED", "No image file uploaded.");
    }
    let mimeType = file.mimetype?.toLowerCase() || "image/jpeg";
    if (mimeType === "image/jpg" || mimeType === "image/pjpeg") {
      mimeType = "image/jpeg";
    }
    const stored = await localStorageService.saveImage(
      file.buffer,
      file.originalname || "category-about.jpg",
      mimeType,
      "listings",
    );
    return stored.url;
  }
}

export const settingsService = new SettingsService(settingsRepository);

