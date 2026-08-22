import type { NextFunction, Request, RequestHandler, Response } from "express";
import { authRepository } from "../modules/auth/auth.repository.js";
import { AppError } from "../shared/AppError.js";
import { verifyAccessToken, type AccountType, type UserRole } from "../shared/tokens.js";

function bearerToken(request: Request): string | null {
  const authorization = request.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return null;
}

export function optionalAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const token = bearerToken(request);
  if (!token) {
    next();
    return;
  }
  try {
    request.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    const tokenExpired = error instanceof Error && error.name === "TokenExpiredError";
    next(
      new AppError(
        401,
        tokenExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
        tokenExpired ? "Your session has expired." : "The access token is invalid.",
      ),
    );
  }
}

export const requireAuth: RequestHandler[] = [
  optionalAuth,
  async (request, _response, next) => {
    if (!request.auth) {
      next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
      return;
    }
    try {
      const account = await authRepository.findAccountById(request.auth.id);
      if (!account || account.status !== "active") {
        next(new AppError(403, "ACCOUNT_SUSPENDED", "This account is no longer active."));
        return;
      }
      // Never trust client token state if account_type has changed in DB
      if (account.accountType !== request.auth.accountType) {
        next(new AppError(403, "ROLE_FORBIDDEN", "Your account type has changed. Please sign in again."));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  },
];

export function requireAccountType(...allowedTypes: AccountType[]): RequestHandler[] {
  return [
    ...requireAuth,
    (request, _response, next) => {
      if (!request.auth) {
        next(
          new AppError(403, "ROLE_FORBIDDEN", "Your account cannot perform this action."),
        );
        return;
      }
      const userType = request.auth.accountType || "buyer";
      // Strict account_type match: admin_employee is NOT auto-admin unless explicitly specified
      const hasPermission = allowedTypes.includes(userType);

      if (!hasPermission) {
        next(
          new AppError(403, "ROLE_FORBIDDEN", "Your account cannot perform this action."),
        );
        return;
      }
      next();
    },
  ];
}

export function requireRole(...roles: UserRole[]): RequestHandler[] {
  return requireAccountType(...roles);
}
