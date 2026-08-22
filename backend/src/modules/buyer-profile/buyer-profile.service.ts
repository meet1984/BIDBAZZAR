import { AppError } from "../../shared/AppError.js";
import type { BuyerProfileRecord } from "../../types/database.types.js";
import { buyerProfileRepository, type BuyerProfileRepository } from "./buyer-profile.repository.js";
import type { UpdateBuyerProfileInput } from "./buyer-profile.schemas.js";

export interface PublicBuyerProfileDTO {
  accountId: number;
  displayName: string;
  buyerType: string;
  profileImage: string | null;
  verificationStatus: string;
  createdAt: string;
}

export class BuyerProfileService {
  constructor(private readonly repository: BuyerProfileRepository) {}

  async getOwnProfile(accountId: number): Promise<BuyerProfileRecord> {
    const profile = await this.repository.findByAccountId(accountId);
    if (!profile) throw new AppError(409, "PROFILE_MISSING", "Buyer profile setup is incomplete. Please contact support.");
    return profile;
  }

  async updateOwnProfile(accountId: number, input: UpdateBuyerProfileInput): Promise<BuyerProfileRecord> {
    const existing = await this.getOwnProfile(accountId);
    
    // In Phase 2: Allow editing draft or incomplete profiles.
    if (existing.verificationStatus === "submitted" || existing.verificationStatus === "under_review") {
      throw new AppError(400, "PROFILE_LOCKED", "Profile is currently under review and cannot be modified.");
    }
    if (existing.verificationStatus === "suspended") {
      throw new AppError(403, "ACCOUNT_SUSPENDED", "Suspended profiles cannot be updated.");
    }

    const updated = await this.repository.update(accountId, input);
    if (updated.verificationStatus === "profile_incomplete") {
      await buyerProfileRepository.updateVerificationStatus(accountId, "draft");
      return (await this.repository.findByAccountId(accountId))!;
    }
    return updated;
  }

  async getPublicProfile(targetAccountId: number): Promise<PublicBuyerProfileDTO> {
    const profile = await this.repository.findByAccountId(targetAccountId);
    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Buyer profile not found.");
    }

    // Public DTO — STRICT REDACTION ENFORCED:
    // NO address, NO phone, NO email, NO govt ID number, NO internal admin notes
    return {
      accountId: profile.accountId,
      displayName: profile.legalFullName,
      buyerType: profile.buyerType,
      profileImage: profile.profileImage,
      verificationStatus: profile.verificationStatus === "verified" ? "verified" : "unverified",
      createdAt: profile.createdAt.toISOString(),
    };
  }
}

export const buyerProfileService = new BuyerProfileService(buyerProfileRepository);
