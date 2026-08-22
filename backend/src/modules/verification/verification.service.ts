import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { AppError } from "../../shared/AppError.js";
import type { VerificationAccountType, VerificationStatus } from "../../types/database.types.js";
import { buyerProfileRepository } from "../buyer-profile/buyer-profile.repository.js";
import { sellerProfileRepository } from "../seller-profile/seller-profile.repository.js";
import { verificationDocumentRepository } from "../verification-documents/verification-documents.repository.js";
import { verificationRepository, type VerificationRepository } from "./verification.repository.js";
import type { AdminQueueQuery } from "./verification.schemas.js";
import { validateStateTransition } from "./verification.state-machine.js";

export interface VerificationStatusResponse {
  accountId: number;
  accountType: VerificationAccountType;
  verificationStatus: VerificationStatus;
  verificationSubmittedAt: string | null;
  verificationReviewedAt: string | null;
  rejectionReason: string | null;
}

function toIsoString(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
}

export class VerificationService {
  constructor(private readonly repository: VerificationRepository) {}

  async getVerificationStatus(accountId: number, accountType: VerificationAccountType): Promise<VerificationStatusResponse> {
    if (accountType === "buyer") {
      const profile = await buyerProfileRepository.findByAccountId(accountId);
      if (!profile) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Buyer profile not found.");
      }
      return {
        accountId: profile.accountId,
        accountType: "buyer",
        verificationStatus: profile.verificationStatus,
        verificationSubmittedAt: toIsoString(profile.verificationSubmittedAt),
        verificationReviewedAt: toIsoString(profile.verificationReviewedAt),
        rejectionReason: profile.rejectionReason,
      };
    } else {
      const profile = await sellerProfileRepository.findByAccountId(accountId);
      if (!profile) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Seller profile not found.");
      }
      return {
        accountId: profile.accountId,
        accountType: "seller",
        verificationStatus: profile.verificationStatus,
        verificationSubmittedAt: toIsoString(profile.verificationSubmittedAt),
        verificationReviewedAt: toIsoString(profile.verificationReviewedAt),
        rejectionReason: profile.rejectionReason,
      };
    }
  }

  async submitVerification(accountId: number, accountType: VerificationAccountType): Promise<VerificationStatusResponse> {
    const current = await this.getVerificationStatus(accountId, accountType);
    validateStateTransition(current.verificationStatus, "submitted");
    await this.assertProfileComplete(accountId, accountType);

    if (accountType === "buyer") {
      await buyerProfileRepository.updateVerificationStatus(accountId, "submitted");
    } else {
      await sellerProfileRepository.updateVerificationStatus(accountId, "submitted");
    }

    await this.repository.recordAuditLog(
      accountId,
      accountId,
      accountType,
      "verification_submitted",
    );

    return this.getVerificationStatus(accountId, accountType);
  }

  async listBuyerQueue(query: AdminQueueQuery) {
    return this.repository.listBuyerQueue(query);
  }

  async listSellerQueue(query: AdminQueueQuery) {
    return this.repository.listSellerQueue(query);
  }

  async getAdminProfileDetails(targetAccountId: number, accountType: VerificationAccountType) {
    const [accountRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, email, account_type FROM accounts WHERE id = ? LIMIT 1",
      [targetAccountId],
    );
    const account = accountRows[0];
    if (!account) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account record not found.");
    }

    if (accountType === "buyer") {
      const profile = await buyerProfileRepository.findByAccountId(targetAccountId);
      return {
        accountId: targetAccountId,
        accountType: "buyer" as const,
        email: String(account.email),
        profile: profile || null,
      };
    } else {
      const profile = await sellerProfileRepository.findByAccountId(targetAccountId);
      return {
        accountId: targetAccountId,
        accountType: "seller" as const,
        email: String(account.email),
        profile: profile || null,
      };
    }
  }

  async approveVerification(targetAccountId: number, accountType: VerificationAccountType, adminAccountId: number): Promise<void> {
    const current = await this.getVerificationStatus(targetAccountId, accountType);
    validateStateTransition(current.verificationStatus, "verified");
    await this.assertProfileComplete(targetAccountId, accountType);

    await this.repository.setVerificationStatusTransaction(
      targetAccountId,
      accountType,
      "verified",
      adminAccountId,
      "approve",
    );
  }

  private async assertProfileComplete(accountId: number, accountType: VerificationAccountType): Promise<void> {
    const missing: string[] = [];
    const present = (value: unknown) => typeof value === "string" && value.trim().length > 0;

    if (accountType === "buyer") {
      const profile = await buyerProfileRepository.findByAccountId(accountId);
      if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Buyer profile not found.");
      if (!present(profile.legalFullName)) missing.push("legal full name");
      if (!profile.dateOfBirth) missing.push("date of birth");
      if (!present(profile.addressLine1)) missing.push("address");
      if (!present(profile.city)) missing.push("city");
      if (!present(profile.state)) missing.push("state");
      if (!present(profile.pinCode)) missing.push("PIN/postal code");
      if (!present(profile.country)) missing.push("country");
      if (!profile.governmentIdType || !present(profile.maskedGovernmentIdRef)) missing.push("government ID details");
      if (profile.buyerType === "business") {
        if (!present(profile.businessName)) missing.push("business name");
        if (!present(profile.gstNumber)) missing.push("GST/tax number");
      }
    } else {
      const profile = await sellerProfileRepository.findByAccountId(accountId);
      if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Seller profile not found.");
      if (!present(profile.legalName)) missing.push("legal name");
      if (!present(profile.businessName)) missing.push("business/display name");
      if (!present(profile.registeredAddressLine1)) missing.push("registered address");
      if (!present(profile.city)) missing.push("city");
      if (!present(profile.state)) missing.push("state");
      if (!present(profile.pinCode)) missing.push("PIN/postal code");
      if (!present(profile.country)) missing.push("country");
      if (!present(profile.panGstRef)) missing.push("PAN/GST/tax reference");
      if (profile.sellerType !== "individual" && !present(profile.businessRegistrationInfo)) {
        missing.push("business registration information");
      }
    }

    const documents = await verificationDocumentRepository.findByAccount(accountId, accountType);
    const documentTypes = new Set(documents.map((document) => document.documentType));
    for (const requiredType of ["government_id", "address_proof"] as const) {
      if (!documentTypes.has(requiredType)) missing.push(requiredType.replaceAll("_", " "));
    }
    if (accountType === "seller") {
      const seller = await sellerProfileRepository.findByAccountId(accountId);
      if (
        seller?.sellerType !== "individual" &&
        !documentTypes.has("business_registration") &&
        !documentTypes.has("tax_certificate")
      ) {
        missing.push("business registration or GST/tax certificate");
      }
    }

    if (missing.length > 0) {
      throw new AppError(422, "VERIFICATION_INCOMPLETE", `Complete the following before submission: ${missing.join(", ")}.`);
    }
  }

  async rejectVerification(targetAccountId: number, accountType: VerificationAccountType, adminAccountId: number, reason: string): Promise<void> {
    const current = await this.getVerificationStatus(targetAccountId, accountType);
    validateStateTransition(current.verificationStatus, "rejected", reason);

    await this.repository.setVerificationStatusTransaction(
      targetAccountId,
      accountType,
      "rejected",
      adminAccountId,
      "reject",
      reason.trim(),
    );
  }

  async requestChanges(targetAccountId: number, accountType: VerificationAccountType, adminAccountId: number, reason: string): Promise<void> {
    const current = await this.getVerificationStatus(targetAccountId, accountType);
    validateStateTransition(current.verificationStatus, "changes_requested", reason);

    await this.repository.setVerificationStatusTransaction(
      targetAccountId,
      accountType,
      "changes_requested",
      adminAccountId,
      "request_changes",
      reason.trim(),
    );
  }

  async suspendAccount(targetAccountId: number, accountType: VerificationAccountType, adminAccountId: number, reason?: string): Promise<void> {
    const current = await this.getVerificationStatus(targetAccountId, accountType);
    validateStateTransition(current.verificationStatus, "suspended", reason);

    await this.repository.setVerificationStatusTransaction(
      targetAccountId,
      accountType,
      "suspended",
      adminAccountId,
      "suspend",
      reason ? reason.trim() : "Account suspended by admin",
    );
  }
}

export const verificationService = new VerificationService(verificationRepository);
