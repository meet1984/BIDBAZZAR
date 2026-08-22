import { AppError } from "../../shared/AppError.js";
import type { StorageService } from "../../shared/storage/storage.interface.js";
import { localStorageService } from "../../shared/storage/localStorage.service.js";
import { listingRepository } from "./listing.repository.js";
import type { ListingImageRepository } from "./listing-image.repository.js";
import { listingImageRepository } from "./listing-image.repository.js";

export class ListingImageService {
  constructor(
    private readonly repository: ListingImageRepository,
    private readonly storage: StorageService = localStorageService,
  ) {}

  async getListingImages(listingId: number) {
    return this.repository.findByListingId(listingId);
  }

  async uploadImages(
    account: { id: number; accountType: string },
    listingId: number,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new AppError(422, "NO_FILES_UPLOADED", "At least one image file is required.");
    }

    const listing = await listingRepository.findById(listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    // Ownership check (seller owns or admin)
    if (account.accountType !== "admin" && listing.sellerId !== account.id) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to manage images for this listing.");
    }

    const currentCount = await this.repository.countByListingId(listingId);
    if (currentCount + files.length > 6) {
      throw new AppError(
        422,
        "IMAGE_LIMIT_EXCEEDED",
        `Listings can have a maximum of 6 images. (Current: ${currentCount}, Uploading: ${files.length})`,
      );
    }

    let isPrimary = currentCount === 0;
    const created: Array<{ id: number; fileKey: string }> = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const stored = await this.storage.saveImage(file.buffer, file.originalname, file.mimetype, "listings");
        try {
          const id = await this.repository.createImage(listingId, stored.url, currentCount + i + 1, isPrimary);
          created.push({ id, fileKey: stored.fileKey });
        } catch (error) {
          await this.storage.deleteImage(stored.fileKey).catch(() => undefined);
          throw error;
        }
        isPrimary = false;
      }
    } catch (error) {
      await Promise.all(created.map(async (item) => {
        await this.repository.delete(item.id).catch(() => undefined);
        await this.storage.deleteImage(item.fileKey).catch(() => undefined);
      }));
      throw error;
    }

    return this.repository.findByListingId(listingId);
  }

  async reorderImages(
    account: { id: number; accountType: string },
    listingId: number,
    items: { id: number; displayOrder: number; isPrimary?: boolean }[],
  ) {
    const listing = await listingRepository.findById(listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (account.accountType !== "admin" && listing.sellerId !== account.id) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to manage images for this listing.");
    }

    const existing = await this.repository.findByListingId(listingId);
    const existingIds = new Set(existing.map((image) => image.id));
    if (items.length !== existing.length || new Set(items.map((item) => item.id)).size !== items.length || items.some((item) => !existingIds.has(item.id))) {
      throw new AppError(422, "INVALID_IMAGE_ORDER", "The reorder list must contain every image exactly once.");
    }

    const primaryCount = items.filter((item) => item.isPrimary).length;
    const formattedItems = items.map((item, index) => ({
      id: item.id,
      displayOrder: item.displayOrder ?? index + 1,
      isPrimary: primaryCount > 0 ? Boolean(item.isPrimary) : index === 0,
    }));

    await this.repository.updateOrderAndPrimary(listingId, formattedItems);
    return this.repository.findByListingId(listingId);
  }

  async deleteImage(
    account: { id: number; accountType: string },
    listingId: number,
    imageId: number,
  ): Promise<void> {
    const listing = await listingRepository.findById(listingId);
    if (!listing) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (account.accountType !== "admin" && listing.sellerId !== account.id) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to manage images for this listing.");
    }

    const image = await this.repository.findById(imageId);
    if (!image || image.listingId !== listingId) {
      throw new AppError(404, "IMAGE_NOT_FOUND", "The image was not found.");
    }

    // Remove the database reference first so a storage outage cannot leave a
    // broken image URL in a live listing. A failed file removal only orphans a file.
    await this.repository.delete(imageId);
    await this.storage.deleteImage(image.imageUrl).catch(() => undefined);

    // If deleted image was primary, promote remaining first image to primary
    if (image.isPrimary) {
      const remaining = await this.repository.findByListingId(listingId);
      if (remaining.length > 0 && remaining[0]) {
        await this.repository.clearPrimaryForListing(listingId);
        await this.repository.setPrimary(remaining[0].id);
      }
    }
  }
}

export const listingImageService = new ListingImageService(listingImageRepository);
