import { AppError } from "../../shared/AppError.js";
import type {
  AdminReviewInput,
  CreateAuctionInput,
  PublicAuctionQuery,
  UpdateAuctionInput,
} from "./auction.schemas.js";
import type { AuctionRepository } from "./auction.repository.js";
import {
  auctionRepository,
  publicAuction,
  type AuctionRecord,
} from "./auction.repository.js";

import { syncAuctionStatus } from "../../jobs/sync-auction-status.js";

function sellerAuction(record: AuctionRecord) {
  return {
    ...publicAuction(record),
    workflowStatus: record.workflowStatus,
    reviewNotes: record.reviewNotes,
    createdAt: record.createdAt.toISOString(),
  };
}

function validateSchedule(startsAt: Date, endsAt: Date): void {
  if (endsAt <= startsAt) {
    throw new AppError(422, "INVALID_SCHEDULE", "Auction end time must be after its start time.");
  }
}

export class AuctionService {
  constructor(private readonly repository: AuctionRepository) {}

  async listPublic(query: PublicAuctionQuery, userId?: number) {
    await syncAuctionStatus();
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.maxPrice < query.minPrice
    ) {
      throw new AppError(422, "INVALID_PRICE_RANGE", "Maximum price must not be below minimum price.");
    }
    return this.repository.listPublic(query, userId);
  }

  async publicDetail(identifier: string, userId?: number) {
    await syncAuctionStatus();
    const record = await this.repository.findPublic(identifier, userId);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "This public auction was not found.");
    const history = await this.repository.bidHistory(record.id);
    return { ...publicAuction(record), bidHistory: history };
  }

  async listSeller(sellerId: number) {
    const records = await this.repository.listSeller(sellerId);
    return records.map(sellerAuction);
  }

  async createSeller(sellerId: number, input: CreateAuctionInput) {
    validateSchedule(input.startsAt, input.endsAt);
    if (input.startsAt <= new Date()) {
      throw new AppError(422, "START_TIME_PAST", "Auction start time must be in the future.");
    }
    const id = await this.repository.create(sellerId, input);
    const created = await this.repository.findOwned(id, sellerId);
    return sellerAuction(created!);
  }

  async updateSeller(sellerId: number, id: number, input: UpdateAuctionInput) {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "The auction was not found.");
    if (!(["draft", "rejected"] as const).includes(record.workflowStatus as "draft" | "rejected")) {
      throw new AppError(409, "AUCTION_NOT_EDITABLE", "Only draft or rejected auctions can be edited.");
    }
    const startsAt = input.startsAt ?? record.startsAt;
    const endsAt = input.endsAt ?? record.endsAt;
    validateSchedule(startsAt, endsAt);
    await this.repository.update(id, input, record.workflowStatus === "rejected");
    return sellerAuction((await this.repository.findOwned(id, sellerId))!);
  }

  async submitSeller(sellerId: number, id: number) {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "The auction was not found.");
    if (!(["draft", "rejected", "changes_requested"] as const).includes(record.workflowStatus as "draft" | "rejected" | "changes_requested")) {
      throw new AppError(409, "AUCTION_NOT_SUBMITTABLE", "This auction cannot be submitted again.");
    }
    const reviewWindowEnds = Date.now() + 48 * 60 * 60 * 1000;
    if (record.startsAt.getTime() < reviewWindowEnds) {
      throw new AppError(
        422,
        "REVIEW_WINDOW_REQUIRED",
        "Choose a start time at least 48 hours away so the listing can be reviewed.",
      );
    }
    await this.repository.submit(id);
    return sellerAuction((await this.repository.findOwned(id, sellerId))!);
  }

  async confirmSeller(sellerId: number, id: number) {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "The auction was not found.");
    if (record.workflowStatus !== "changes_requested") {
      throw new AppError(
        409,
        "AUCTION_NOT_CONFIRMABLE",
        "Only auctions awaiting your confirmation of admin changes can be confirmed.",
      );
    }
    const updated = await this.repository.confirmChanges(id);
    if (!updated) {
      throw new AppError(
        409,
        "AUCTION_NOT_CONFIRMABLE",
        "Only auctions awaiting your confirmation of admin changes can be confirmed.",
      );
    }
    const updatedRecord = (await this.repository.findOwned(id, sellerId))!;
    return sellerAuction(updatedRecord);
  }

  async deleteSeller(sellerId: number, id: number): Promise<void> {
    const record = await this.repository.findOwned(id, sellerId);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "The auction was not found.");
    if (!(["draft", "rejected", "changes_requested"] as const).includes(record.workflowStatus as "draft" | "rejected" | "changes_requested")) {
      throw new AppError(409, "AUCTION_NOT_DELETABLE", "Only draft or rejected auctions can be deleted.");
    }
    await this.repository.softDelete(id);
  }

  async listAdmin(status?: string) {
    const records = await this.repository.listAdmin(status);
    return records.map(sellerAuction);
  }

  async reviewAdmin(adminId: number, id: number, input: AdminReviewInput) {
    const record = await this.repository.findById(id);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "The auction was not found.");
    if (record.workflowStatus !== "pending") {
      throw new AppError(409, "REVIEW_STATE_CHANGED", "This auction is no longer awaiting review.");
    }
    if (input.decision === "approve" && record.startsAt <= new Date()) {
      throw new AppError(409, "START_TIME_PASSED", "The seller must choose a new future start time.");
    }
    const updated = await this.repository.review(id, adminId, input);
    if (!updated) {
      throw new AppError(409, "REVIEW_STATE_CHANGED", "This auction is no longer awaiting review.");
    }
    const updatedRecord = (await this.repository.findById(id))!;
    return sellerAuction(updatedRecord);
  }

  async updateAdmin(id: number, input: UpdateAuctionInput) {
    const record = await this.repository.findById(id);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "The auction was not found.");
    if (record.publicStatus === "live" || record.publicStatus === "ending-soon") {
      throw new AppError(409, "LIVE_AUCTION_LOCKED", "Live auction details cannot be changed.");
    }
    validateSchedule(input.startsAt ?? record.startsAt, input.endsAt ?? record.endsAt);

    // If admin is modifying a pending or draft seller listing, set to changes_requested so seller confirms
    const newStatus = record.workflowStatus === "pending" || record.workflowStatus === "draft" ? "changes_requested" : undefined;
    const reviewNotes = newStatus === "changes_requested" ? "Administrator modified listing details. Please review and confirm to publish." : undefined;

    await this.repository.updateAdminWithStatus(id, input, newStatus, reviewNotes);
    const updated = (await this.repository.findById(id))!;
    return sellerAuction(updated);
  }

  async deleteAdmin(id: number): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) throw new AppError(404, "AUCTION_NOT_FOUND", "The auction was not found.");
    if (record.publicStatus === "live" || record.publicStatus === "ending-soon") {
      throw new AppError(409, "LIVE_AUCTION_LOCKED", "A live auction cannot be deleted.");
    }
    await this.repository.softDelete(id);
  }
}

export const auctionService = new AuctionService(auctionRepository);
