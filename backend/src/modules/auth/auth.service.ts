import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { AppError } from "../../shared/AppError.js";
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  type AccessTokenUser,
  type AccountType,
} from "../../shared/tokens.js";
import type { BuyerRegistrationInput, ForgotPasswordInput, LoginInput, RegistrationInput, ResendOtpInput, ResetPasswordInput, SellerRegistrationInput, VerifyOtpInput } from "./auth.schemas.js";
import type { AccountRecord, AuthRepository } from "./auth.repository.js";
import { authRepository } from "./auth.repository.js";
import { isDuplicateEntry } from "../../database/pool.js";
import { logger } from "../../shared/logger.js";
import { sendOtpEmail, sendPasswordResetEmail } from "./auth.email.js";
import { allowedOrigins } from "../../config/env.js";

export function publicUser(user: AccountRecord): AccessTokenUser {
  return {
    id: user.id,
    accountType: user.accountType,
    role: user.accountType,
    isBuyer: user.accountType === "buyer",
    isSeller: user.accountType === "seller",
    isAdmin: user.accountType === "admin" || user.accountType === "admin_employee",
    email: user.email,
    fullName: user.fullName,
  };
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) { }

  async registerBuyer(input: BuyerRegistrationInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    let userId: number;
    try {
      userId = await this.repository.createBuyerAccount(input, passwordHash);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new AppError(409, "EMAIL_EXISTS", "An account already exists with this email.");
      }
      throw error;
    }

    const account = await this.repository.findAccountById(userId);
    if (!account) {
      throw new AppError(500, "USER_CREATION_FAILED", "Failed to retrieve newly created buyer account.");
    }

    const challenge = await this.createAndSendOtpChallenge(account);
    return {
      ...challenge,
      message: "Your buyer account was created successfully. Please enter the verification code sent to your email.",
    };
  }

  async registerSeller(input: SellerRegistrationInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    let userId: number;
    try {
      userId = await this.repository.createSellerAccount(input, passwordHash);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new AppError(409, "EMAIL_EXISTS", "An account already exists with this email.");
      }
      throw error;
    }

    const account = await this.repository.findAccountById(userId);
    if (!account) {
      throw new AppError(500, "USER_CREATION_FAILED", "Failed to retrieve newly created seller account.");
    }

    const challenge = await this.createAndSendOtpChallenge(account);
    return {
      ...challenge,
      message: "Your seller account was created successfully. Please enter the verification code sent to your email.",
    };
  }

  async register(input: RegistrationInput) {
    if (input.accountType === "seller" || input.role === "seller") {
      return this.registerSeller({
        accountType: "seller",
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        password: input.password,
        sellerName: input.sellerName || input.fullName,
        sellerType: input.sellerType || "individual",
        acceptedTerms: true,
        marketingConsent: input.marketingConsent,
      });
    }
    return this.registerBuyer({
      accountType: "buyer",
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      password: input.password,
      acceptedTerms: true,
      marketingConsent: input.marketingConsent,
    });
  }

  async issueUserSession(account: AccountRecord, returnTo?: string | null, rememberMe?: boolean) {
    const isAdminType = account.accountType === "admin" || account.accountType === "admin_employee";
    const effectiveRememberMe = isAdminType ? false : Boolean(rememberMe);

    const refresh = createRefreshToken();
    await this.repository.storeRefreshToken({
      ...refresh,
      userId: account.id,
      rememberMe: effectiveRememberMe,
    });
    const safeUser = publicUser(account);
    return {
      accessToken: signAccessToken(safeUser),
      refreshToken: refresh.rawToken,
      user: safeUser,
      accountType: account.accountType,
      role: account.accountType,
      redirectTo: returnTo || `/${account.accountType === "admin_employee" ? "admin" : account.accountType}/dashboard`,
      rememberMe: effectiveRememberMe,
      message: "Sign-in successful.",
    };
  }

  private async createAndSendOtpChallenge(account: AccountRecord, rememberMe?: boolean) {
    const isAdminType = account.accountType === "admin" || account.accountType === "admin_employee";
    const effectiveRememberMe = isAdminType ? false : Boolean(rememberMe);

    await this.repository.invalidateUserOtpChallenges(account.id);
    const challengeId = crypto.randomBytes(32).toString("hex");
    const rawOtp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
    const otpHash = await bcrypt.hash(rawOtp, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.repository.createOtpChallenge({
      userId: account.id,
      challengeToken: challengeId,
      otpHash,
      expiresAt,
      rememberMe: effectiveRememberMe,
    });

    try {
      await sendOtpEmail({
        to: account.email,
        fullName: account.fullName,
        otpCode: rawOtp,
      });
    } catch (emailError) {
      logger.error(`Failed to dispatch OTP verification email to user ${account.id}:`, emailError);
      throw new AppError(
        500,
        "EMAIL_DISPATCH_FAILED",
        "Unable to send verification code email. Please click resend code to try again.",
      );
    }

    return {
      otpRequired: true,
      challengeId,
      expiresInSeconds: 600,
      message: "A 6-digit verification code has been sent to your email.",
    };
  }

  async login(input: LoginInput, expectedAccountType?: AccountType | AccountType[]) {
    const account = await this.repository.findAccountByEmail(input.email);
    const validPassword = account && account.passwordHash
      ? await bcrypt.compare(input.password, account.passwordHash)
      : await bcrypt.compare(input.password, "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5Y5b4luw1DeYekYCQVDXVyWvM1R9l2a");

    if (!account || !validPassword) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    if (account.status !== "active") {
      throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is not active.");
    }

    if (expectedAccountType) {
      const allowed = Array.isArray(expectedAccountType) ? expectedAccountType : [expectedAccountType];
      if (!allowed.includes(account.accountType)) {
        throw new AppError(403, "ROLE_FORBIDDEN", `This sign-in form is for ${allowed.join("/")} accounts only.`);
      }
    }

    return this.createAndSendOtpChallenge(account, input.rememberMe);
  }

  async verifyOtp(input: VerifyOtpInput) {
    const challenge = await this.repository.findOtpChallengeByToken(input.challengeId);
    if (!challenge || challenge.consumedAt) {
      throw new AppError(404, "CHALLENGE_NOT_FOUND", "The verification challenge was not found or is no longer valid.");
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new AppError(400, "OTP_EXPIRED", "The verification code has expired. Please request a new one.");
    }

    if (challenge.attemptCount >= 5) {
      throw new AppError(400, "OTP_ATTEMPTS_EXCEEDED", "Maximum verification attempts exceeded. Please sign in again.");
    }

    const isValid = await bcrypt.compare(input.otp, challenge.otpHash);
    if (!isValid) {
      await this.repository.incrementOtpAttempt(challenge.id);
      const remaining = 5 - (challenge.attemptCount + 1);
      if (remaining <= 0) {
        throw new AppError(400, "OTP_ATTEMPTS_EXCEEDED", "Maximum verification attempts exceeded. Please sign in again.");
      }
      throw new AppError(400, "OTP_INVALID", `Invalid verification code. ${remaining} attempt(s) remaining.`);
    }

    if (challenge?.user?.status !== "active") {
      throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is not active.");
    }

    const consumed = await this.repository.markOtpChallengeConsumed(challenge.id);
    if (!consumed) {
      throw new AppError(409, "OTP_ALREADY_USED", "This verification code was already used or expired.");
    }
    return this.issueUserSession(challenge.user, null, challenge.rememberMe);
  }

  async resendOtp(input: ResendOtpInput) {
    const challenge = await this.repository.findOtpChallengeByToken(input.challengeId);
    if (!challenge) {
      throw new AppError(404, "CHALLENGE_NOT_FOUND", "The verification challenge was not found.");
    }

    if (challenge?.user?.status !== "active") {
      throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is not active.");
    }

    return this.createAndSendOtpChallenge(challenge.user, challenge.rememberMe);
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new AppError(401, "REFRESH_REQUIRED", "The session cookie is missing.");
    const record = await this.repository.findRefreshToken(hashRefreshToken(rawToken));
    if (!record || record.expiresAt.getTime() <= Date.now() || record.status !== "active") {
      throw new AppError(401, "REFRESH_INVALID", "The session is expired or revoked.");
    }
    if (record.revokedAt) {
      await this.repository.revokeRefreshTokenFamily(record.familyId);
      throw new AppError(401, "REFRESH_REPLAY_DETECTED", "The session was revoked because a rotated token was reused.");
    }

    const isAdminType = record.accountType === "admin" || record.accountType === "admin_employee";
    const effectiveRememberMe = isAdminType ? false : Boolean(record.rememberMe);

    const refresh = createRefreshToken(record.familyId, record.refreshTokenId);
    const rotated = await this.repository.rotateRefreshToken(record.refreshTokenId, {
      ...refresh,
      userId: record.id,
      rememberMe: effectiveRememberMe,
    });
    if (!rotated) {
      await this.repository.revokeRefreshTokenFamily(record.familyId);
      throw new AppError(401, "REFRESH_INVALID", "The session is expired or revoked.");
    }
    const safeUser = publicUser(record);
    return {
      accessToken: signAccessToken(safeUser),
      refreshToken: refresh.rawToken,
      rememberMe: effectiveRememberMe,
      user: safeUser,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.repository.revokeRefreshToken(hashRefreshToken(rawToken));
  }

  async me(userId: number) {
    const account = await this.repository.findAccountById(userId);
    if (!account || account.status !== "active") {
      throw new AppError(401, "USER_UNAVAILABLE", "The account is no longer available.");
    }
    return publicUser(account);
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const account = await this.repository.findAccountByEmail(input.email);
    if (!account || account.status !== "active") return;
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await this.repository.createPasswordResetToken(account.id, crypto.randomUUID(), tokenHash, new Date(Date.now() + 20 * 60 * 1000));
    const baseUrl = allowedOrigins[0] || "http://localhost:5173";
    const sent = await sendPasswordResetEmail({
      to: account.email,
      fullName: account.fullName,
      resetUrl: `${baseUrl}/forgot-password?token=${rawToken}`,
    });
    if (!sent) logger.error(`Password reset email dispatch failed for account ${account.id}.`);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const consumed = await this.repository.consumePasswordResetToken(tokenHash, passwordHash);
    if (!consumed) throw new AppError(400, "RESET_TOKEN_INVALID", "The reset link is invalid or has expired.");
  }
}

export const authService = new AuthService(authRepository);
