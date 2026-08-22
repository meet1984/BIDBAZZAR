import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { BuyerProfileRecord, BuyerType, GovernmentIdType, VerificationStatus } from "../../types/database.types.js";
import type { UpdateBuyerProfileInput } from "./buyer-profile.schemas.js";

function mapBuyerProfileRow(row: RowDataPacket): BuyerProfileRecord {
  return {
    accountId: Number(row.account_id),
    legalFullName: String(row.legal_full_name),
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth as string | Date).toISOString().split("T")[0]! : null,
    buyerType: (row.buyer_type || "individual") as BuyerType,
    verifiedEmail: row.verified_email ? String(row.verified_email) : null,
    verifiedPhone: row.verified_phone ? String(row.verified_phone) : null,
    addressLine1: row.address_line1 ? String(row.address_line1) : null,
    addressLine2: row.address_line2 ? String(row.address_line2) : null,
    city: row.city ? String(row.city) : null,
    state: row.state ? String(row.state) : null,
    pinCode: row.pin_code ? String(row.pin_code) : null,
    country: row.country ? String(row.country) : null,
    governmentIdType: row.government_id_type ? (row.government_id_type as GovernmentIdType) : null,
    maskedGovernmentIdRef: row.masked_government_id_ref ? String(row.masked_government_id_ref) : null,
    businessName: row.business_name ? String(row.business_name) : null,
    gstNumber: row.gst_number ? String(row.gst_number) : null,
    profileImage: row.profile_image ? String(row.profile_image) : null,
    verificationStatus: (row.verification_status || "profile_incomplete") as VerificationStatus,
    verificationSubmittedAt: row.verification_submitted_at ? new Date(row.verification_submitted_at as string | Date) : null,
    verificationReviewedAt: row.verification_reviewed_at ? new Date(row.verification_reviewed_at as string | Date) : null,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export function maskGovtId(idNumber?: string | null): string | null {
  if (!idNumber) return null;
  const clean = idNumber.trim();
  if (clean.length <= 4) return `XXXX-${clean}`;
  const visible = clean.slice(-4);
  return `XXXX-XXXX-${visible}`;
}

export class BuyerProfileRepository {
  async findByAccountId(accountId: number): Promise<BuyerProfileRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT account_id, legal_full_name, date_of_birth, buyer_type, verified_email, verified_phone,
              address_line1, address_line2, city, state, pin_code, country,
              government_id_type, masked_government_id_ref, business_name, gst_number, profile_image,
              verification_status, verification_submitted_at, verification_reviewed_at, rejection_reason,
              created_at, updated_at
       FROM buyer_profiles WHERE account_id = ? LIMIT 1`,
      [accountId],
    );
    return rows[0] ? mapBuyerProfileRow(rows[0]) : null;
  }

  async createDefault(accountId: number, legalFullName: string): Promise<BuyerProfileRecord> {
    await pool.execute(
      `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
       VALUES (?, ?, 'individual', 'profile_incomplete')
       ON DUPLICATE KEY UPDATE legal_full_name = VALUES(legal_full_name)`,
      [accountId, legalFullName],
    );
    const created = await this.findByAccountId(accountId);
    if (!created) throw new Error("Failed to create default buyer profile.");
    return created;
  }

  async update(accountId: number, input: UpdateBuyerProfileInput): Promise<BuyerProfileRecord> {
    const maskedRef = input.governmentIdNumber ? maskGovtId(input.governmentIdNumber) : undefined;

    await pool.execute(
      `UPDATE buyer_profiles
       SET legal_full_name = COALESCE(?, legal_full_name),
           date_of_birth = COALESCE(?, date_of_birth),
           buyer_type = COALESCE(?, buyer_type),
           address_line1 = COALESCE(?, address_line1),
           address_line2 = COALESCE(?, address_line2),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           pin_code = COALESCE(?, pin_code),
           country = COALESCE(?, country),
           government_id_type = COALESCE(?, government_id_type),
           masked_government_id_ref = COALESCE(?, masked_government_id_ref),
           business_name = COALESCE(?, business_name),
           gst_number = COALESCE(?, gst_number),
           profile_image = COALESCE(?, profile_image)
       WHERE account_id = ?`,
      [
        input.legalFullName ?? null,
        input.dateOfBirth ?? null,
        input.buyerType ?? null,
        input.addressLine1 ?? null,
        input.addressLine2 ?? null,
        input.city ?? null,
        input.state ?? null,
        input.pinCode ?? null,
        input.country ?? null,
        input.governmentIdType ?? null,
        maskedRef ?? null,
        input.businessName ?? null,
        input.gstNumber ?? null,
        input.profileImage ?? null,
        accountId,
      ],
    );

    const updated = await this.findByAccountId(accountId);
    if (!updated) throw new Error("Buyer profile not found for update.");
    return updated;
  }

  async updateVerificationStatus(
    accountId: number,
    status: VerificationStatus,
    rejectionReason: string | null = null,
  ): Promise<void> {
    const now = new Date();
    await pool.execute(
      `UPDATE buyer_profiles
       SET verification_status = ?,
           rejection_reason = ?,
           verification_reviewed_at = IF(? IN ('verified', 'rejected', 'changes_requested', 'suspended'), ?, verification_reviewed_at)
       WHERE account_id = ?`,
      [status, rejectionReason, status, now, accountId],
    );
  }
}

export const buyerProfileRepository = new BuyerProfileRepository();
