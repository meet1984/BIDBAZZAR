import { Router } from "express";
import { requireRole } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { dashboardController } from "./dashboard.controller.js";

export const dashboardRouter = Router();
dashboardRouter.get("/admin", ...requireRole("admin"), asyncHandler(dashboardController.admin));
