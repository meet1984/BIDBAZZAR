import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env, isAllowedOrigin } from "./config/env.js";
import { pool } from "./database/pool.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { newsletterRouter } from "./modules/newsletter/newsletter.routes.js";
import { adminSupportRouter, supportRouter } from "./modules/support/support.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { watchlistRouter } from "./modules/watchlist/watchlist.routes.js";
import { adminSettingsRouter, publicSettingsRouter } from "./modules/settings/settings.routes.js";
import { buyerProfileRouter } from "./modules/buyer-profile/buyer-profile.routes.js";
import { sellerProfileRouter } from "./modules/seller-profile/seller-profile.routes.js";
import { adminVerificationRouter, verificationRouter } from "./modules/verification/verification.routes.js";
import { verificationDocumentRouter } from "./modules/verification-documents/verification-documents.routes.js";
import { adminCategoryRouter, publicCategoryRouter } from "./modules/categories/category.routes.js";
import {
  adminListingRouter,
  publicListingRouter,
  sellerListingRouter,
} from "./modules/listings/listing.routes.js";
import { buyerOfferRouter } from "./modules/offers/offer.routes.js";
import multiUnitOfferRouter from "./modules/multi-unit-offers/multi-unit-offer.routes.js";
import { adminPermissionRouter } from "./modules/admin-permissions/admin-permission.routes.js";
import { auditLogRouter } from "./modules/audit-log/audit-log.routes.js";
import { disputeRouter } from "./modules/disputes/dispute.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { orderRouter } from "./modules/orders/order.routes.js";
import { getPublicTrustProfileHandler } from "./modules/reviews/review.controller.js";
import { reviewRouter } from "./modules/reviews/review.routes.js";
import { asyncHandler } from "./shared/asyncHandler.js";
import { validate } from "./middleware/validate.middleware.js";
import { reviewIdSchema } from "./modules/reviews/review.schemas.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY_HOPS > 0) app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(cookieParser());
  // Only listing/media uploads are public. Identity and support documents use
  // PRIVATE_UPLOAD_DIR and are streamed through authenticated endpoints.
  app.use(
    "/uploads/listings",
    express.static(path.resolve(process.cwd(), env.UPLOAD_DIR, "listings"), {
      fallthrough: false,
      index: false,
      dotfiles: "deny",
    }),
  );

  const healthHandler = asyncHandler(async (_req, res) => {
    let dbStatus = "ok";
    try {
      await pool.query("SELECT 1");
    } catch {
      dbStatus = "error";
    }
    const statusCode = dbStatus === "ok" ? 200 : 503;
    res.status(statusCode).json({
      status: dbStatus === "ok" ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      services: { database: dbStatus },
    });
  });

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.use("/api/auth", authRouter);
  app.use("/api/watchlist", watchlistRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/admin/users", userRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/admin/support", adminSupportRouter);
  app.use("/api/newsletter", newsletterRouter);
  app.use("/api/settings", publicSettingsRouter);
  app.use("/api/admin/settings", adminSettingsRouter);
  app.use("/api/buyer/profile", buyerProfileRouter);
  app.use("/api/seller/profile", sellerProfileRouter);
  app.use("/api/verification/documents", verificationDocumentRouter);
  app.use("/api/verification", verificationRouter);
  app.use("/api/admin/verification", adminVerificationRouter);
  app.use("/api/categories", publicCategoryRouter);
  app.use("/api/admin", adminCategoryRouter);
  app.use("/api/listings", publicListingRouter);
  app.use("/api/auctions", publicListingRouter);
  app.use("/api/seller/listings", sellerListingRouter);
  app.use("/api/admin/listings", adminListingRouter);
  app.use("/api/multi-unit-offers", multiUnitOfferRouter);
  app.use("/api/admin", adminPermissionRouter);
  app.use("/api/admin/audit-logs", auditLogRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/disputes", disputeRouter);
  app.use("/api/reviews", reviewRouter);
  app.use("/api/notifications", notificationRouter);
  app.get("/api/users/:id/trust-profile", validate(reviewIdSchema, "params"), getPublicTrustProfileHandler);
  app.use("/api", buyerOfferRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
