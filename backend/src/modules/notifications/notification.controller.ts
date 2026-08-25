import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import { notificationService } from "./notification.service.js";

export const listNotificationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const accountId = req.auth!.id;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const result = await notificationService.listUserNotifications(accountId, limit, offset);

  res.status(200).json({
    success: true,
    data: result.notifications,
    unreadCount: result.unreadCount,
    pagination: { limit, offset },
  });
});

export const markNotificationReadHandler = asyncHandler(async (req: Request, res: Response) => {
  const notificationId = Number(req.params.id);
  if (!notificationId || Number.isNaN(notificationId) || notificationId <= 0) {
    throw new AppError(400, "INVALID_NOTIFICATION_ID", "Invalid notification ID.");
  }

  const accountId = req.auth!.id;
  const found = await notificationService.markAsRead(notificationId, accountId);

  if (!found) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
  }

  res.status(200).json({
    success: true,
    message: "Notification marked as read.",
  });
});

export const markAllNotificationsReadHandler = asyncHandler(async (req: Request, res: Response) => {
  const accountId = req.auth!.id;
  const count = await notificationService.markAllAsRead(accountId);

  res.status(200).json({
    success: true,
    message: `${count} notifications marked as read.`,
    updatedCount: count,
  });
});
