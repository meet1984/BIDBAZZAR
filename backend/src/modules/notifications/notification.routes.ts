import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { notificationIdSchema, notificationQuerySchema } from "./notification.schemas.js";
import {
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
} from "./notification.controller.js";

export const notificationRouter = Router();

// List in-app notifications for authenticated user
notificationRouter.get("/", requireAuth, validate(notificationQuerySchema, "query"), listNotificationsHandler);

// Mark a single notification as read (supports PATCH and POST)
notificationRouter.patch("/:id/read", requireAuth, validate(notificationIdSchema, "params"), markNotificationReadHandler);
notificationRouter.post("/:id/read", requireAuth, validate(notificationIdSchema, "params"), markNotificationReadHandler);

// Mark all unread notifications as read
notificationRouter.post("/mark-all-read", requireAuth, markAllNotificationsReadHandler);
