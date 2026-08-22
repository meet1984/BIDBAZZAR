import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { SellerProfileRecord, SellerType, VerificationStatus } from "../../types/database.types.js";
import type { UpdateSellerProfileInput } from "./seller-profile.schemas.js";

function mapSellerProfileRow(row: RowDataPacket): SellerProfileRecord {
  let categories: string[] | null = null;
  if (row.product_categories) {
    if (Array.isArray(row.product_categories)) {
      categories = row.product_categories as string[];
    } else if (typeof row.product_categories === "string") {
      try {
        categories = JSON.parse(row.product_categories) as string[];
      } catch {
        categories = null;
      }
    }
  }

  return {
    accountId: Number(row.account_id),
    legalName: String(row.legal_name || row.seller_name || ""),
    businessName: String(row.business_name || row.seller_name || ""),
    sellerType: (row.seller_type || "individual") as SellerType,
    verifiedEmail: row.verified_email ? String(row.verified_email) : null,
    verifiedPhone: row.verified_phone ? String(row.verified_phone) : null,
    registeredAddressLine1: row.registered_address_line1 ? String(row.registered_address_line1) : null,
    registeredAddressLine2: row.registered_address_line2 ? String(row.registered_address_line2) : null,
    city: row.city ? String(row.city) : null,
    state: row.state ? String(row.state) : null,
    pinCode: row.pin_code ? String(row.pin_code) : null,
    country: row.country ? String(row.country) : null,
    panGstRef: row.pan_gst_ref ? String(row.pan_gst_ref) : null,
    businessRegistrationInfo: row.business_registration_info ? String(row.business_registration_info) : null,
    productCategories: categories,
    publicBusinessDescription: row.public_business_description ? String(row.public_business_description) : null,
    profileLogo: row.profile_logo ? String(row.profile_logo) : null,
    verificationStatus: (row.verification_status || "profile_incomplete") as VerificationStatus,
    verificationSubmittedAt: row.verification_submitted_at ? new Date(row.verification_submitted_at as string | Date) : null,
    verificationReviewedAt: row.verification_reviewed_at ? new Date(row.verification_reviewed_at as string | Date) : null,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export function maskPanGst(ref?: string | null): string | null {
  if (!ref) return null;
  const clean = ref.trim();
  if (clean.length <= 4) return `XXXX-${clean}`;
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

export class SellerProfileRepository {
  async findByAccountId(accountId: number): Promise<SellerProfileRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT account_id, legal_name, business_name, seller_name, seller_type, verified_email, verified_phone,
              registered_address_line1, registered_address_line2, city, state, pin_code, country,
              pan_gst_ref, business_registration_info, product_categories, public_business_description,
              profile_logo, verification_status,
              verification_submitted_at, verification_reviewed_at, rejection_reason, created_at, updated_at
       FROM seller_profiles WHERE account_id = ? LIMIT 1`,
      [accountId],
    );
    return rows[0] ? mapSellerProfileRow(rows[0]) : null;
  }

  async createDefault(accountId: number, businessName: string): Promise<SellerProfileRecord> {
    await pool.execute(
      `INSERT INTO seller_profiles (account_id, legal_name, business_name, seller_name, seller_type, verification_status)
       VALUES (?, ?, ?, ?, 'individual', 'profile_incomplete')
       ON DUPLICATE KEY UPDATE business_name = VALUES(business_name)`,
      [accountId, businessName, businessName, businessName],
    );
    const created = await this.findByAccountId(accountId);
    if (!created) throw new Error("Failed to create default seller profile.");
    return created;
  }

  async update(accountId: number, input: UpdateSellerProfileInput): Promise<SellerProfileRecord> {
    const maskedRef = input.panGstNumber ? maskPanGst(input.panGstNumber) : undefined;
    const categoriesJson = input.productCategories ? JSON.stringify(input.productCategories) : undefined;

    await pool.execute(
      `UPDATE seller_profiles
       SET legal_name = COALESCE(?, legal_name),
           business_name = COALESCE(?, business_name),
           seller_name = COALESCE(?, seller_name),
           seller_type = COALESCE(?, seller_type),
           registered_address_line1 = COALESCE(?, registered_address_line1),
           registered_address_line2 = COALESCE(?, registered_address_line2),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           pin_code = COALESCE(?, pin_code),
           country = COALESCE(?, country),
           pan_gst_ref = COALESCE(?, pan_gst_ref),
           business_registration_info = COALESCE(?, business_registration_info),
           product_categories = COALESCE(?, product_categories),
           public_business_description = COALESCE(?, public_business_description),
           profile_logo = COALESCE(?, profile_logo)
       WHERE account_id = ?`,
      [
        input.legalName ?? null,
        input.businessName ?? null,
        input.businessName ?? null,
        input.sellerType ?? null,
        input.registeredAddressLine1 ?? null,
        input.registeredAddressLine2 ?? null,
        input.city ?? null,
        input.state ?? null,
        input.pinCode ?? null,
        input.country ?? null,
        maskedRef ?? null,
        input.businessRegistrationInfo ?? null,
        categoriesJson ?? null,
        input.publicBusinessDescription ?? null,
        input.profileLogo ?? null,
        accountId,
      ],
    );

    const updated = await this.findByAccountId(accountId);
    if (!updated) throw new Error("Seller profile not found for update.");
    return updated;
  }

  async updateVerificationStatus(
    accountId: number,
    status: VerificationStatus,
    rejectionReason: string | null = null,
  ): Promise<void> {
    const now = new Date();
    await pool.execute(
      `UPDATE seller_profiles
       SET verification_status = ?,
           rejection_reason = ?,
           verification_reviewed_at = IF(? IN ('verified', 'rejected', 'changes_requested', 'suspended'), ?, verification_reviewed_at)
       WHERE account_id = ?`,
      [status, rejectionReason, status, now, accountId],
    );
  }
}

export const sellerProfileRepository = new SellerProfileRepository();
