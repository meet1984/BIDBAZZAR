import type { Request, Response } from "express";
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "../../shared/tokens.js";
import type { BuyerRegistrationInput, ForgotPasswordInput, LoginInput, RegistrationInput, ResendOtpInput, ResetPasswordInput, SellerRegistrationInput, VerifyOtpInput } from "./auth.schemas.js";
import { authService } from "./auth.service.js";

export const authController = {
  async registerBuyer(request: Request, response: Response) {
    const result = await authService.registerBuyer(request.body as BuyerRegistrationInput);
    response.status(201).json(result);
  },

  async registerSeller(request: Request, response: Response) {
    const result = await authService.registerSeller(request.body as SellerRegistrationInput);
    response.status(201).json(result);
  },

  async loginBuyer(request: Request, response: Response) {
    const result = await authService.login(request.body as LoginInput, "buyer");
    response.json(result);
  },

  async loginSeller(request: Request, response: Response) {
    const result = await authService.login(request.body as LoginInput, "seller");
    response.json(result);
  },

  async loginAdmin(request: Request, response: Response) {
    const result = await authService.login(request.body as LoginInput, ["admin", "admin_employee"]);
    response.json(result);
  },

  async register(request: Request, response: Response) {
    const result = await authService.register(request.body as RegistrationInput);
    response.status(201).json(result);
  },

  async login(request: Request, response: Response) {
    const result = await authService.login(request.body as LoginInput);
    response.json(result);
  },

  async verifyOtp(request: Request, response: Response) {
    const result = await authService.verifyOtp(request.body as VerifyOtpInput);
    response.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      refreshCookieOptions(result.rememberMe),
    );
    const { refreshToken: _refreshToken, ...body } = result;
    response.json(body);
  },

  async resendOtp(request: Request, response: Response) {
    const result = await authService.resendOtp(request.body as ResendOtpInput);
    response.json(result);
  },

  async refresh(request: Request, response: Response) {
    const result = await authService.refresh(request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.rememberMe));
    const { refreshToken: _refreshToken, ...body } = result;
    response.json(body);
  },

  async logout(request: Request, response: Response) {
    await authService.logout(request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);
    response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(true));
    response.status(204).send();
  },

  async me(request: Request, response: Response) {
    const user = await authService.me(request.auth!.id);
    response.json({ user });
  },
  async forgotPassword(request: Request, response: Response) {
    await authService.forgotPassword(request.body as ForgotPasswordInput);
    response.json({ message: "If that account exists, a reset link has been sent." });
  },
  async resetPassword(request: Request, response: Response) {
    await authService.resetPassword(request.body as ResetPasswordInput);
    response.json({ message: "Password updated successfully." });
  },
};
