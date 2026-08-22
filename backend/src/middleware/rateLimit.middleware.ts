import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

const response = {
  code: "RATE_LIMITED",
  message: "Too many attempts, retry again later.",
};

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
});

export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
});


export const bidRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
  keyGenerator: (request: Request & { auth?: { id: number } }) =>
    request.auth?.id ? String(request.auth.id) : ipKeyGenerator(request.ip!),
});

export const publicFormRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
});

export const offerRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
  keyGenerator: (request: Request & { auth?: { id: number } }) =>
    request.auth?.id ? String(request.auth.id) : ipKeyGenerator(request.ip!),
});

export const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: response,
  keyGenerator: (request: Request & { auth?: { id: number } }) =>
    request.auth?.id ? String(request.auth.id) : ipKeyGenerator(request.ip!),
});

