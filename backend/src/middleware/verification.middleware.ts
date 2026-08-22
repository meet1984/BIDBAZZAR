import type { RequestHandler } from "express";
import { buyerProfileRepository } from "../modules/buyer-profile/buyer-profile.repository.js";
import { sellerProfileRepository } from "../modules/seller-profile/seller-profile.repository.js";
import { AppError } from "../shared/AppError.js";
import { requireAuth } from "./auth.middleware.js";

export const requireVerifiedBuyer: RequestHandler[] = [
  ...requireAuth,
  async (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
      return;
    }
    if (req.auth.accountType !== "buyer") {
      next(new AppError(403, "ROLE_FORBIDDEN", "Only buyer accounts can perform this action."));
      return;
    }
    try {
      const profile = await buyerProfileRepository.findByAccountId(req.auth.id);
      if (!profile || profile.verificationStatus === "profile_incomplete") {
        next(new AppError(403, "VERIFICATION_REQUIRED", "Complete your buyer profile to participate in bidding."));
        return;
      }
      if (profile.verificationStatus === "suspended") {
        next(new AppError(403, "ACCOUNT_SUSPENDED", "Your account is suspended and cannot submit offers."));
        return;
      }
      if (profile.verificationStatus !== "verified") {
        next(new AppError(403, "VERIFICATION_REQUIRED", "Your buyer profile verification is pending. Only verified buyers can submit offers."));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  },
];

export const requireVerifiedSeller: RequestHandler[] = [
  ...requireAuth,
  async (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
      return;
    }
    if (req.auth.accountType !== "seller" && req.auth.accountType !== "admin") {
      next(new AppError(403, "ROLE_FORBIDDEN", "Only seller accounts can create or submit listings."));
      return;
    }

    if (req.auth.accountType === "admin") {
      next();
      return;
    }

    try {
      const profile = await sellerProfileRepository.findByAccountId(req.auth.id);
      if (!profile || profile.verificationStatus === "profile_incomplete") {
        next(new AppError(403, "VERIFICATION_REQUIRED", "Complete your business profile to create listings."));
        return;
      }
      if (profile.verificationStatus === "suspended") {
        next(new AppError(403, "ACCOUNT_SUSPENDED", "Your account is suspended and cannot create or submit listings."));
        return;
      }
      if (profile.verificationStatus !== "verified") {
        next(new AppError(403, "VERIFICATION_REQUIRED", "Your seller business profile verification is pending. Only verified sellers can create or submit listings."));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  },
];
