import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "../../database/pool.js";
import type { AccountType } from "../../shared/tokens.js";
import type { BuyerRegistrationInput, SellerRegistrationInput } from "./auth.schemas.js";

export interface AccountRecord {
  id: number;
  accountType: AccountType;
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  status: "active" | "suspended";
  migrationReviewRequired: boolean;
  // Backward compatibility fields
  role: AccountType;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
}

export type UserRecord = AccountRecord;

interface RefreshTokenRecord extends AccountRecord {
  refreshTokenId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rememberMe: boolean;
}

interface NewRefreshToken {
  id: string;
  familyId: string;
  parentTokenId: string | null;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}

function accountFromRow(row: RowDataPacket): AccountRecord {
  const accountType = (row.account_type || row.role || "buyer") as AccountType;
  return {
    id: Number(row.id),
    accountType,
    role: accountType,
    isBuyer: accountType === "buyer",
    isSeller: accountType === "seller",
    isAdmin: accountType === "admin",
    fullName: String(row.full_name),
    email: String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    passwordHash: String(row.password_hash),
    status: row.status as "active" | "suspended",
    migrationReviewRequired: Boolean(row.migration_review_required),
  };
}

export class AuthRepository {
  async findAccountByEmail(email: string): Promise<AccountRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, account_type, full_name, email, phone, password_hash, status, migration_review_required
       FROM accounts WHERE email = ? LIMIT 1`,
      [email],
    );
    return rows[0] ? accountFromRow(rows[0]) : null;
  }

  async findAccountById(id: number): Promise<AccountRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, account_type, full_name, email, phone, password_hash, status, migration_review_required
       FROM accounts WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? accountFromRow(rows[0]) : null;
  }

  async findUserById(id: number): Promise<AccountRecord | null> {
    return this.findAccountById(id);
  }

  async findUserByEmail(email: string): Promise<AccountRecord | null> {
    return this.findAccountByEmail(email);
  }

  async createBuyerAccount(input: BuyerRegistrationInput, passwordHash: string): Promise<number> {
    return withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO accounts
          (account_type, full_name, email, phone, password_hash, accepted_terms_at, marketing_consent, status)
         VALUES ('buyer', ?, ?, ?, ?, UTC_TIMESTAMP(), ?, 'active')`,
        [
          input.fullName,
          input.email,
          input.phone || null,
          passwordHash,
          input.marketingConsent,
        ],
      );
      const accountId = Number(result.insertId);
      await connection.execute(
        `INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status)
         VALUES (?, ?, 'individual', 'profile_incomplete')`,
        [accountId, input.fullName],
      );
      return accountId;
    });
  }

  async createSellerAccount(input: SellerRegistrationInput, passwordHash: string): Promise<number> {
    return withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO accounts
          (account_type, full_name, email, phone, password_hash, accepted_terms_at, marketing_consent, status)
         VALUES ('seller', ?, ?, ?, ?, UTC_TIMESTAMP(), ?, 'active')`,
        [
          input.fullName,
          input.email,
          input.phone || null,
          passwordHash,
          input.marketingConsent,
        ],
      );
      const accountId = Number(result.insertId);

      // Insert seller profile
      await connection.execute(
        `INSERT INTO seller_profiles (account_id, seller_name, seller_type)
         VALUES (?, ?, ?)`,
        [accountId, input.sellerName, input.sellerType],
      );

      return accountId;
    });
  }

  async createUser(input: { role?: string; fullName: string; email: string; phone?: string; passwordHash?: string; sellerName?: string; sellerType?: "individual" | "business" | "distributor"; acceptedTerms: boolean; marketingConsent: boolean }, passwordHash: string): Promise<number> {
    if (input.role === "seller") {
      return this.createSellerAccount(
        {
          accountType: "seller",
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          password: "",
          sellerName: input.sellerName || input.fullName,
          sellerType: input.sellerType || "individual",
          acceptedTerms: true,
          marketingConsent: input.marketingConsent,
        },
        passwordHash,
      );
    }
    return this.createBuyerAccount(
      {
        accountType: "buyer",
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        password: "",
        acceptedTerms: true,
        marketingConsent: input.marketingConsent,
      },
      passwordHash,
    );
  }

  async storeRefreshToken(token: NewRefreshToken & { rememberMe?: boolean }): Promise<void> {
    await pool.execute(
      `INSERT INTO refresh_tokens (id, family_id, parent_token_id, account_id, token_hash, expires_at, remember_me)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [token.id, token.familyId, token.parentTokenId, token.userId, token.tokenHash, token.expiresAt, Boolean(token.rememberMe)],
    );
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rt.id AS refresh_token_id, rt.family_id, rt.expires_at, rt.revoked_at, rt.remember_me,
              a.id, a.account_type, a.full_name, a.email, a.phone, a.password_hash, a.status, a.migration_review_required
       FROM refresh_tokens rt
       INNER JOIN accounts a ON a.id = rt.account_id
       WHERE rt.token_hash = ?
       LIMIT 1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...accountFromRow(row),
      refreshTokenId: String(row.refresh_token_id),
      familyId: String(row.family_id),
      expiresAt: new Date(row.expires_at as string | Date),
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string | Date) : null,
      rememberMe: Boolean(row.remember_me),
    };
  }

  async rotateRefreshToken(oldTokenId: string, token: NewRefreshToken & { rememberMe?: boolean }): Promise<boolean> {
    return withTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL",
        [oldTokenId],
      );
      if (result.affectedRows !== 1) return false;
      await connection.execute(
        `INSERT INTO refresh_tokens (id, family_id, parent_token_id, account_id, token_hash, expires_at, remember_me)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [token.id, token.familyId, token.parentTokenId, token.userId, token.tokenHash, token.expiresAt, Boolean(token.rememberMe)],
      );
      return true;
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await pool.execute(
      `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP()
       WHERE token_hash = ? AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await pool.execute(
      "UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE family_id = ? AND revoked_at IS NULL",
      [familyId],
    );
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    await pool.execute(
      `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP()
       WHERE account_id = ? AND revoked_at IS NULL`,
      [userId],
    );
  }

  async createOtpChallenge(params: {
    userId: number;
    challengeToken: string;
    otpHash: string;
    expiresAt: Date;
    rememberMe?: boolean;
  }): Promise<void> {
    await pool.execute(
      `INSERT INTO login_otp_challenges (account_id, challenge_token, otp_hash, expires_at, remember_me)
       VALUES (?, ?, ?, ?, ?)`,
      [params.userId, params.challengeToken, params.otpHash, params.expiresAt, Boolean(params.rememberMe)],
    );
  }

  async findOtpChallengeByToken(challengeToken: string): Promise<(LoginOtpChallengeRecord & { user: AccountRecord }) | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.id AS challenge_id, c.challenge_token, c.otp_hash, c.expires_at, c.attempt_count, c.consumed_at, c.created_at, c.remember_me,
              a.id, a.account_type, a.full_name, a.email, a.phone, a.password_hash, a.status, a.migration_review_required
       FROM login_otp_challenges c
       INNER JOIN accounts a ON a.id = c.account_id
       WHERE c.challenge_token = ?
       LIMIT 1`,
      [challengeToken],
    );
    const row = rows[0];
    if (!row) return null;

    const user = accountFromRow(row);
    return {
      id: Number(row.challenge_id),
      userId: user.id,
      challengeToken: String(row.challenge_token),
      otpHash: String(row.otp_hash),
      expiresAt: new Date(row.expires_at as string | Date),
      attemptCount: Number(row.attempt_count),
      consumedAt: row.consumed_at ? new Date(row.consumed_at as string | Date) : null,
      createdAt: new Date(row.created_at as string | Date),
      rememberMe: Boolean(row.remember_me),
      user,
    };
  }

  async incrementOtpAttempt(id: number): Promise<void> {
    await pool.execute(
      `UPDATE login_otp_challenges SET attempt_count = attempt_count + 1 WHERE id = ?`,
      [id],
    );
  }

  async markOtpChallengeConsumed(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE login_otp_challenges SET consumed_at = UTC_TIMESTAMP()
       WHERE id = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [id],
    );
    return result.affectedRows === 1;
  }

  async invalidateUserOtpChallenges(userId: number): Promise<void> {
    await pool.execute(
      `UPDATE login_otp_challenges SET consumed_at = UTC_TIMESTAMP() WHERE account_id = ? AND consumed_at IS NULL`,
      [userId],
    );
  }

  async createPasswordResetToken(accountId: number, id: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await withTransaction(async (connection) => {
      await connection.execute(
        "UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE account_id = ? AND used_at IS NULL",
        [accountId],
      );
      await connection.execute(
        "INSERT INTO password_reset_tokens (id, account_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
        [id, accountId, tokenHash, expiresAt],
      );
    });
  }

  async consumePasswordResetToken(tokenHash: string, passwordHash: string): Promise<boolean> {
    return withTransaction(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, account_id FROM password_reset_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
         LIMIT 1 FOR UPDATE`,
        [tokenHash],
      );
      const token = rows[0];
      if (!token) return false;
      const [accountResult] = await connection.execute<ResultSetHeader>("UPDATE accounts SET password_hash = ? WHERE id = ? AND status = 'active'", [passwordHash, token.account_id]);
      if (accountResult.affectedRows !== 1) return false;
      await connection.execute("UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?", [token.id]);
      await connection.execute("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE account_id = ? AND revoked_at IS NULL", [token.account_id]);
      await connection.execute("UPDATE login_otp_challenges SET consumed_at = UTC_TIMESTAMP() WHERE account_id = ? AND consumed_at IS NULL", [token.account_id]);
      return true;
    });
  }
}

export interface LoginOtpChallengeRecord {
  id: number;
  userId: number;
  challengeToken: string;
  otpHash: string;
  expiresAt: Date;
  attemptCount: number;
  consumedAt: Date | null;
  createdAt: Date;
  rememberMe: boolean;
}

export const authRepository = new AuthRepository();
