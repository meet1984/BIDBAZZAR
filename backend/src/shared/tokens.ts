import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccountType = "buyer" | "seller" | "admin" | "admin_employee";
export type UserRole = AccountType;

export interface AccessTokenUser {
  id: number;
  accountType?: AccountType;
  email: string;
  fullName: string;
  // Deprecated backward-compatible fields
  role?: AccountType;
  isBuyer?: boolean;
  isSeller?: boolean;
  isAdmin?: boolean;
}

export const REFRESH_COOKIE_NAME = "bidmylot_refresh";

export function signAccessToken(user: AccessTokenUser): string {
  const accountType = user.accountType || (user.isAdmin ? "admin" : user.isSeller ? "seller" : "buyer");
  const isAdmin = accountType === "admin" || accountType === "admin_employee";
  return jwt.sign(
    {
      accountType,
      // Backward compatibility fields in payload
      role: accountType,
      isBuyer: accountType === "buyer",
      isSeller: accountType === "seller",
      isAdmin,
      email: user.email,
      fullName: user.fullName,
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: String(user.id),
      expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
      issuer: "bidmylot-api",
      audience: "bidmylot-web",
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenUser {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "bidmylot-api",
    audience: "bidmylot-web",
  });
  if (
    typeof payload === "string" ||
    !payload.sub ||
    !payload.email ||
    !payload.fullName
  ) {
    throw new Error("Invalid access token payload");
  }

  let accountType: AccountType = "buyer";
  if (payload.accountType && ["buyer", "seller", "admin", "admin_employee"].includes(String(payload.accountType))) {
    accountType = payload.accountType as AccountType;
  } else if (payload.isAdmin === true || payload.role === "admin" || payload.role === "admin_employee") {
    accountType = (payload.role === "admin_employee" ? "admin_employee" : "admin");
  } else if (payload.isSeller === true || payload.role === "seller") {
    accountType = "seller";
  } else if (payload.isBuyer === true || payload.role === "buyer") {
    accountType = "buyer";
  }

  const isAdmin = accountType === "admin" || accountType === "admin_employee";

  return {
    id: Number(payload.sub),
    accountType,
    role: accountType,
    isBuyer: accountType === "buyer",
    isSeller: accountType === "seller",
    isAdmin,
    email: String(payload.email),
    fullName: String(payload.fullName),
  };
}

export function createRefreshToken(familyId?: string, parentTokenId?: string): {
  id: string;
  familyId: string;
  parentTokenId: string | null;
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  );
  const id = randomUUID();
  return {
    id,
    familyId: familyId || id,
    parentTokenId: parentTokenId || null,
    rawToken,
    tokenHash: hashRefreshToken(rawToken),
    expiresAt,
  };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshCookieOptions(rememberMe = true) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.COOKIE_SECURE,
    path: "/api/auth",
    maxAge: rememberMe
      ? env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
      : undefined,
  };
}
