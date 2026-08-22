import type { NotificationRecord } from "../../types/database.types.js";

export type NotificationType =
  | "order_created"
  | "order_completed"
  | "dispute_opened"
  | "dispute_resolved"
  | "review_received"
  | "account_verified"
  | "offer_accepted"
  | "offer_unsuccessful"
  | "allocation_accepted"
  | "general";

export interface CreateNotificationParams {
  recipientAccountId: number;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
}

export interface DispatchNotificationOptions {
  recipientAccountId: number;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  emailSubject?: string;
  emailHtml?: string;
  emailText?: string;
}

export type { NotificationRecord };
