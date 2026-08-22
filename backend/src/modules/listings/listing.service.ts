import { AppError } from "../../shared/AppError.js";
import type { ListingReviewStatus } from "../../types/database.types.js";
import { categoryRepository } from "../categories/category.repository.js";
import type {
  AdminReviewListingInput,
  CreateListingInput,
  PublicListingQuery,
  UpdateListingInput,
} from "./listing.schemas.js";
import type { FullListingRecord, ListingRepository } from "./listing.repository.js";
import { listingRepository } from "./listing.repository.js";
import { listingAuditRepository } from "./listing-audit.repository.js";

export function publicListingDto(record: FullListingRecord) {
  const images = record.images || [];
  const primaryImg =
    record.primaryImageUrl ||
    images.find((i) => i.isPrimary)?.imageUrl ||
    images[0]?.imageUrl ||
    null;

  return {
    id: record.id,
    publicSlug: record.publicSlug,
    listingReference: record.listingReference,
    title: record.title,
    description: record.description,
    condition: record.condition,
    location: record.location,
    askingPrice: record.askingPrice,
    currency: record.currency,
    saleMode: record.saleMode,
    startTime: record.startTime.toISOString(),
    endTime: record.endTime.toISOString(),
    offerSelectionDeadline: record.offerSelectionDeadline ? record.offerSelectionDeadline.toISOString() : null,
    status: record.publicDisplayStatus,
    isWatched: record.isWatched,

    // Image fields
    imageUrl: primaryImg,
    thumbnailUrl: primaryImg,
    images: images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      displayOrder: img.displayOrder,
      isPrimary: img.isPrimary,
    })),

    // Category & Subcategory info
    category: {
      id: record.categoryId,
      name: record.categoryName,
      slug: record.categorySlug,
    },
    subcategory: record.subcategoryId
      ? {
          id: record.subcategoryId,
          name: record.subcategoryName,
          slug: record.subcategorySlug,
        }
      : null,

    // Multi-unit fields (public details)
    ...(record.saleMode === "multi_unit_offer"
      ? {
          totalQuantity: record.totalQuantity,
          remainingInventory: record.remainingInventory ?? record.totalQuantity,
          unitName: record.unitName ?? "unit",
          askingPricePerUnit: record.askingPricePerUnit,
          minOrderQuantity: record.minOrderQuantity,
          maxOrderQuantity: record.maxOrderQuantity,
          quantityIncrement: record.quantityIncrement,
          allowPartialAllocation: record.allowPartialAllocation,
        }
      : {}),

    sellerId: record.sellerId,
    seller: record.sellerName ? { name: record.sellerName } : null,
  };
}

export function sellerListingDto(record: FullListingRecord) {
  return {
    ...publicListingDto(record),
    ...(record.saleMode === "multi_unit_offer"
      ? {
          minAcceptableUnitPrice: record.minAcceptableUnitPrice ?? null,
          offerStartTime: record.offerStartTime ? record.offerStartTime.toISOString() : null,
          offerEndTime: record.offerEndTime ? record.offerEndTime.toISOString() : null,
          buyerConfirmationDeadlineHours: record.buyerConfirmationDeadlineHours ?? 48,
        }
      : {}),
    reviewStatus: record.reviewStatus,
    reviewNotes: record.reviewNotes,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}


export function adminListingDto(record: FullListingRecord) {
  return {
    ...sellerListingDto(record),
    sellerId: record.sellerId,
  };
}

function validateSchedule(startTime: Date, endTime: Date): void {
  const minDurationMs = 48 * 60 * 60 * 1000;
  if (endTime.getTime() < startTime.getTime() + minDurationMs) {
    throw new AppError(422, "INVALID_SCHEDULE", "Listing end time must be at least 48 hours after start time.");
  }
}

export class ListingService {
  constructor(private readonly repository: ListingRepository) {}

  async listPublic(query: PublicListingQuery, userId?: number) {
    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.maxPrice < query.minPrice) {
      throw new AppError(422, "INVALID_PRICE_RANGE", "Maximum price must not be below minimum price.");
    }
    const result = await this.repository.listPublic(query, userId);
    return {
      items: result.items.map(publicListingDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  async publicDetail(identifier: string, userId?: number) {
    const record = await this.repository.findPublic(identifier, userId);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "This public listing was not found.");
    }
    return publicListingDto(record);
  }

  async listSeller(sellerId: number) {
    const records = await this.repository.listSeller(sellerId);
    return records.map(sellerListingDto);
  }

  async createSeller(sellerId: number, input: CreateListingInput) {
    validateSchedule(input.startTime, input.endTime);

    // Verify category exists and is active
    const category = await categoryRepository.findCategoryById(input.categoryId);
    if (!category || !category.isActive) {
      throw new AppError(422, "INACTIVE_CATEGORY", "Selected category is invalid or inactive.");
    }

    if (input.subcategoryId) {
      const subcategory = await categoryRepository.findSubcategoryById(input.subcategoryId);
      if (!subcategory || !subcategory.isActive || subcategory.categoryId !== input.categoryId) {
        throw new AppError(422, "INACTIVE_SUBCATEGORY", "Selected subcategory is invalid or inactive.");
      }
    }

    const id = await this.repository.create(sellerId, input);
    const created = await this.repository.findOwned(id, sellerId);
    return sellerListingDto(created!);
  }

  async updateSeller(sellerId: number, id: number, input: UpdateListingInput) {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (!["draft", "changes_requested", "rejected"].includes(record.reviewStatus)) {
      throw new AppError(409, "LISTING_NOT_EDITABLE", "Only draft, rejected, or change-requested listings can be edited.");
    }

    const startTime = input.startTime ?? record.startTime;
    const endTime = input.endTime ?? record.endTime;
    validateSchedule(startTime, endTime);

    if (input.categoryId) {
      const category = await categoryRepository.findCategoryById(input.categoryId);
      if (!category || !category.isActive) {
        throw new AppError(422, "INACTIVE_CATEGORY", "Selected category is invalid or inactive.");
      }
    }
    if (input.subcategoryId !== undefined || input.categoryId !== undefined) {
      const effectiveCategoryId = input.categoryId ?? record.categoryId;
      const effectiveSubcategoryId = input.subcategoryId === undefined ? record.subcategoryId : input.subcategoryId;
      if (effectiveSubcategoryId) {
        const subcategory = await categoryRepository.findSubcategoryById(effectiveSubcategoryId);
        if (!subcategory || !subcategory.isActive || subcategory.categoryId !== effectiveCategoryId) {
          throw new AppError(422, "INACTIVE_SUBCATEGORY", "Selected subcategory is invalid or does not belong to the selected category.");
        }
      }
    }

    await this.repository.update(id, input, true);
    const updated = await this.repository.findOwned(id, sellerId);
    return sellerListingDto(updated!);
  }

  async submitSeller(sellerId: number, id: number) {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (!["draft", "changes_requested", "rejected"].includes(record.reviewStatus)) {
      throw new AppError(409, "LISTING_NOT_SUBMITTABLE", "Only draft, rejected, or change-requested listings can be submitted.");
    }
    await this.repository.publishDirect(id);
    const updated = await this.repository.findOwned(id, sellerId);
    return sellerListingDto(updated!);
  }

  async confirmSeller(sellerId: number, id: number) {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (record.reviewStatus !== "changes_requested") {
      throw new AppError(409, "LISTING_NOT_CONFIRMABLE", "Only listings with requested changes can be resubmitted.");
    }

    const updated = await this.repository.confirmChanges(id);
    if (!updated) {
      throw new AppError(
        409,
        "LISTING_NOT_CONFIRMABLE",
        "This listing could not be confirmed.",
      );
    }

    const updatedRecord = (await this.repository.findOwned(id, sellerId))!;
    return sellerListingDto(updatedRecord);
  }

  async deleteSeller(sellerId: number, id: number): Promise<void> {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (!["draft", "rejected", "changes_requested"].includes(record.reviewStatus)) {
      throw new AppError(409, "LISTING_NOT_DELETABLE", "Submitted, approved, active, or completed listings cannot be deleted.");
    }

    await this.repository.softDelete(id);
  }

  // --- ADMIN METHODS ---

  async listAdmin(reviewStatus?: string, saleMode?: string) {
    const records = await this.repository.listAdmin(reviewStatus, saleMode);
    return records.map(adminListingDto);
  }

  async reviewAdmin(adminId: number, id: number, input: AdminReviewListingInput) {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (!["submitted", "under_review"].includes(record.reviewStatus)) {
      throw new AppError(409, "LISTING_NOT_REVIEWABLE", "Only submitted listings can be reviewed.");
    }

    let targetStatus: ListingReviewStatus;
    if (input.decision === "approve") {
      targetStatus = "approved";
    } else if (input.decision === "reject") {
      targetStatus = "rejected";
    } else {
      targetStatus = "changes_requested";
    }

    const updated = await this.repository.review(id, targetStatus, input.reason);
    if (!updated) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found or could not be updated.");
    }

    // Record audit trail
    await listingAuditRepository.record(adminId, id, input.decision, input.reason);

    const updatedRecord = (await this.repository.findById(id))!;
    return adminListingDto(updatedRecord);
  }

  async updateAdmin(adminId: number, id: number, input: UpdateListingInput & { reviewStatus?: ListingReviewStatus }) {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    if (input.startTime || input.endTime) {
      validateSchedule(input.startTime ?? record.startTime, input.endTime ?? record.endTime);
    }

    if (input.categoryId) {
      const category = await categoryRepository.findCategoryById(input.categoryId);
      if (!category || !category.isActive) {
        throw new AppError(422, "INACTIVE_CATEGORY", "Selected category is invalid or inactive.");
      }
    }
    if (input.subcategoryId !== undefined || input.categoryId !== undefined) {
      const effectiveCategoryId = input.categoryId ?? record.categoryId;
      const effectiveSubcategoryId = input.subcategoryId === undefined ? record.subcategoryId : input.subcategoryId;
      if (effectiveSubcategoryId) {
        const subcategory = await categoryRepository.findSubcategoryById(effectiveSubcategoryId);
        if (!subcategory || subcategory.categoryId !== effectiveCategoryId) {
          throw new AppError(422, "INVALID_SUBCATEGORY", "Selected subcategory does not belong to the selected category.");
        }
      }
    }

    const newStatus = input.reviewStatus;
    await this.repository.updateAdminWithStatus(id, input, newStatus);

    // Record audit log
    await listingAuditRepository.record(adminId, id, "admin_update", `Admin modified listing (status: ${newStatus || record.reviewStatus})`);

    const updatedRecord = (await this.repository.findById(id))!;
    return adminListingDto(updatedRecord);
  }

  async deleteAdmin(adminId: number, id: number): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    }

    await this.repository.softDelete(id);
    await listingAuditRepository.record(adminId, id, "cancel", "Listing deleted by admin");
  }
}

export const listingService = new ListingService(listingRepository);
