import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { authRateLimit, loginRateLimit, otpRateLimit, registerRateLimit } from "../../middleware/rateLimit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { authController } from "./auth.controller.js";
import { buyerRegistrationSchema, forgotPasswordSchema, loginSchema, registrationSchema, resendOtpSchema, resetPasswordSchema, sellerRegistrationSchema, verifyOtpSchema } from "./auth.schemas.js";

export const authRouter = Router();

// Per-type registration endpoints
authRouter.post(
  "/buyer/register",
  registerRateLimit,
  validate(buyerRegistrationSchema),
  asyncHandler(authController.registerBuyer),
);
authRouter.post(
  "/seller/register",
  registerRateLimit,
  validate(sellerRegistrationSchema),
  asyncHandler(authController.registerSeller),
);

// Per-type login endpoints
authRouter.post(
  "/buyer/login",
  loginRateLimit,
  validate(loginSchema),
  asyncHandler(authController.loginBuyer),
);
authRouter.post(
  "/seller/login",
  loginRateLimit,
  validate(loginSchema),
  asyncHandler(authController.loginSeller),
);
authRouter.post(
  "/admin/login",
  loginRateLimit,
  validate(loginSchema),
  asyncHandler(authController.loginAdmin),
);

// Generic auth endpoints
authRouter.post(
  "/register",
  registerRateLimit,
  validate(registrationSchema),
  asyncHandler(authController.register),
);
authRouter.post(
  "/login",
  loginRateLimit,
  validate(loginSchema),
  asyncHandler(authController.login),
);

authRouter.post(
  "/login/verify-otp",
  otpRateLimit,
  validate(verifyOtpSchema),
  asyncHandler(authController.verifyOtp),
);
authRouter.post(
  "/login/resend-otp",
  otpRateLimit,
  validate(resendOtpSchema),
  asyncHandler(authController.resendOtp),
);
authRouter.post("/refresh", authRateLimit, asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.post("/password/forgot", loginRateLimit, validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRouter.post("/password/reset", loginRateLimit, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));
authRouter.get("/me", ...requireAuth, asyncHandler(authController.me));
