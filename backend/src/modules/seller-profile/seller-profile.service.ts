import { AppError } from "../../shared/AppError.js";
import type { SellerProfileRecord } from "../../types/database.types.js";
import { sellerProfileRepository, type SellerProfileRepository } from "./seller-profile.repository.js";
import type { UpdateSellerProfileInput } from "./seller-profile.schemas.js";

export interface PublicSellerProfileDTO {
  accountId: number;
  businessName: string;
  sellerType: string;
  productCategories: string[] | null;
  publicBusinessDescription: string | null;
  profileLogo: string | null;
  verificationStatus: string;
  createdAt: string;
}

export class SellerProfileService {
  constructor(private readonly repository: SellerProfileRepository) { }

  async getOwnProfile(accountId: number): Promise<SellerProfileRecord> {
    const profile = await this.repository.findByAccountId(accountId);
    if (!profile) throw new AppError(409, "PROFILE_MISSING", "Seller profile setup is incomplete. Please contact support.");
    return profile;
  }

  async updateOwnProfile(accountId: number, input: UpdateSellerProfileInput): Promise<SellerProfileRecord> {
    const existing = await this.getOwnProfile(accountId);

    if (existing.verificationStatus === "submitted" || existing.verificationStatus === "under_review") {
      throw new AppError(400, "PROFILE_LOCKED", "Profile is under review and cannot be updated.");
    }
    if (existing.verificationStatus === "suspended") {
      throw new AppError(403, "ACCOUNT_SUSPENDED", "Suspended profiles cannot be updated.");
    }

    const updated = await this.repository.update(accountId, input);
    if (updated.verificationStatus === "profile_incomplete") {
      await sellerProfileRepository.updateVerificationStatus(accountId, "draft");
      return (await this.repository.findByAccountId(accountId))!;
    }
    return updated;
  }

  async getPublicProfile(targetAccountId: number): Promise<PublicSellerProfileDTO> {
    const profile = await this.repository.findByAccountId(targetAccountId);
    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Seller profile not found.");
    }

    // Public DTO — STRICT REDACTION ENFORCED:
    // NO registered address, NO phone, NO email, NO PAN/GST, NO internal admin notes
    return {
      accountId: profile.accountId,
      businessName: profile.businessName,
      sellerType: profile.sellerType,
      productCategories: profile.productCategories,
      publicBusinessDescription: profile.publicBusinessDescription,
      profileLogo: profile.profileLogo,
      verificationStatus: profile.verificationStatus === "verified" ? "verified" : "unverified",
      createdAt: profile.createdAt.toISOString(),
    };
  }
}

export const sellerProfileService = new SellerProfileService(sellerProfileRepository);
