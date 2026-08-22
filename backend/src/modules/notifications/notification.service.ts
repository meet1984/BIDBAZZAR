import { sendEmail } from "../../shared/mailer.js";
import { authRepository } from "../auth/auth.repository.js";
import { notificationRepository, type NotificationRepository } from "./notification.repository.js";
import { notificationTemplates } from "./notification.templates.js";
import type { DispatchNotificationOptions, NotificationRecord } from "./notification.types.js";
import type {
  DisputeRecord,
  OrderRecord,
  ReviewRecord,
} from "../../types/database.types.js";

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  /**
   * Unified notification dispatcher:
   * 1. Persists in-app notification to database.
   * 2. Dispatches async email with error isolation (email failure never rolls back state).
   */
  async dispatch(options: DispatchNotificationOptions): Promise<NotificationRecord> {
    // 1. In-app database record
    const notification = await this.repository.create({
      recipientAccountId: options.recipientAccountId,
      type: options.type,
      title: options.title,
      message: options.message,
      payload: options.linkUrl ? { linkUrl: options.linkUrl } : null,
    });

    // Email dispatch with complete error isolation
    if (options.emailSubject && options.emailHtml) {
      try {
        const recipient = await authRepository.findAccountById(options.recipientAccountId);
        if (recipient?.email) {
          await sendEmail({
            to: recipient.email,
            subject: options.emailSubject,
            html: options.emailHtml,
            text: options.emailText,
          });
        }
      } catch (mailErr) {
        // Log failure safely without breaking the caller's business transaction
        console.warn(
          `[Email Warning] Non-fatal failure dispatching email to user #${options.recipientAccountId}:`,
          mailErr instanceof Error ? mailErr.message : mailErr,
        );
      }
    }

    return notification;
  }

  async notifyOrderCreated(order: OrderRecord) {
    const tBuyer = notificationTemplates.orderCreated(order.orderReference, order.totalAmount, order.currency, true);
    await this.dispatch({
      recipientAccountId: order.buyerId,
      type: "order_created",
      title: tBuyer.title,
      message: tBuyer.message,
      linkUrl: `/orders/${order.id}`,
      emailSubject: `[BidMyLot] ${tBuyer.title}: ${order.orderReference}`,
      emailHtml: tBuyer.html,
    });

    const tSeller = notificationTemplates.orderCreated(order.orderReference, order.totalAmount, order.currency, false);
    await this.dispatch({
      recipientAccountId: order.sellerId,
      type: "order_created",
      title: tSeller.title,
      message: tSeller.message,
      linkUrl: `/seller/orders/${order.id}`,
      emailSubject: `[BidMyLot] ${tSeller.title}: ${order.orderReference}`,
      emailHtml: tSeller.html,
    });
  }

  async notifyOrderCompleted(order: OrderRecord) {
    const tBuyer = notificationTemplates.orderCompleted(order.orderReference, true);
    await this.dispatch({
      recipientAccountId: order.buyerId,
      type: "order_completed",
      title: tBuyer.title,
      message: tBuyer.message,
      linkUrl: `/orders/${order.id}`,
      emailSubject: `[BidMyLot] Order Completed: ${order.orderReference}`,
      emailHtml: tBuyer.html,
    });

    const tSeller = notificationTemplates.orderCompleted(order.orderReference, false);
    await this.dispatch({
      recipientAccountId: order.sellerId,
      type: "order_completed",
      title: tSeller.title,
      message: tSeller.message,
      linkUrl: `/seller/orders/${order.id}`,
      emailSubject: `[BidMyLot] Deal Completed: ${order.orderReference}`,
      emailHtml: tSeller.html,
    });
  }

  async notifyDisputeOpened(dispute: DisputeRecord, order: OrderRecord, openerAccountId: number) {
    const isBuyerOpener = order.buyerId === openerAccountId;
    const tOpener = notificationTemplates.disputeOpened(order.orderReference, dispute.disputeReference, dispute.reason, true);
    const tTarget = notificationTemplates.disputeOpened(order.orderReference, dispute.disputeReference, dispute.reason, false);

    // Notify opener
    await this.dispatch({
      recipientAccountId: openerAccountId,
      type: "dispute_opened",
      title: tOpener.title,
      message: tOpener.message,
      linkUrl: `/orders/${order.id}`,
      emailSubject: `[BidMyLot] Dispute Submitted: ${dispute.disputeReference}`,
      emailHtml: tOpener.html,
    });

    // Notify target
    const targetAccountId = isBuyerOpener ? order.sellerId : order.buyerId;
    await this.dispatch({
      recipientAccountId: targetAccountId,
      type: "dispute_opened",
      title: tTarget.title,
      message: tTarget.message,
      linkUrl: `/seller/orders/${order.id}`,
      emailSubject: `[BidMyLot] Dispute Notice: ${dispute.disputeReference}`,
      emailHtml: tTarget.html,
    });
  }

  async notifyDisputeResolved(dispute: DisputeRecord, order: OrderRecord) {
    const outcome = dispute.status;
    const t = notificationTemplates.disputeResolved(order.orderReference, dispute.disputeReference, outcome);

    await Promise.all([
      this.dispatch({
        recipientAccountId: order.buyerId,
        type: "dispute_resolved",
        title: t.title,
        message: t.message,
        linkUrl: `/orders/${order.id}`,
        emailSubject: `[BidMyLot] Dispute Resolved: ${dispute.disputeReference}`,
        emailHtml: t.html,
      }),
      this.dispatch({
        recipientAccountId: order.sellerId,
        type: "dispute_resolved",
        title: t.title,
        message: t.message,
        linkUrl: `/seller/orders/${order.id}`,
        emailSubject: `[BidMyLot] Dispute Resolved: ${dispute.disputeReference}`,
        emailHtml: t.html,
      }),
    ]);
  }

  async notifyReviewReceived(review: ReviewRecord, reviewerName: string) {
    const t = notificationTemplates.reviewReceived(reviewerName, review.ratingScore);
    await this.dispatch({
      recipientAccountId: review.revieweeId,
      type: "review_received",
      title: t.title,
      message: t.message,
      linkUrl: `/reviews`,
      emailSubject: `[BidMyLot] New ${review.ratingScore}-Star Review Received`,
      emailHtml: t.html,
    });
  }

  async notifyOfferAccepted(params: {
    buyerId: number;
    sellerId: number;
    buyerName: string;
    listingTitle: string;
    lotReference: string;
    amount: number;
    currency: string;
    deadlineHours?: number;
    listingSlug?: string;
  }) {
    const hours = params.deadlineHours || 48;
    const tBuyer = notificationTemplates.offerAcceptedBuyer(
      params.listingTitle,
      params.lotReference,
      params.amount,
      params.currency,
      hours,
    );
    const tSeller = notificationTemplates.offerAcceptedSeller(
      params.listingTitle,
      params.lotReference,
      params.buyerName,
      params.amount,
      params.currency,
    );

    await Promise.all([
      // Email & in-app to selected Buyer
      this.dispatch({
        recipientAccountId: params.buyerId,
        type: "offer_accepted",
        title: tBuyer.title,
        message: tBuyer.message,
        linkUrl: `/auctions/${params.listingSlug || ""}`,
        emailSubject: `[BidMyLot] Your Offer for ${params.lotReference} Has Been Accepted!`,
        emailHtml: tBuyer.html,
      }).catch((err) => console.warn("[Notification Warning] Buyer notification failed:", err)),

      // Email & in-app confirmation to Seller
      this.dispatch({
        recipientAccountId: params.sellerId,
        type: "offer_accepted",
        title: tSeller.title,
        message: tSeller.message,
        linkUrl: `/seller/dashboard`,
        emailSubject: `[BidMyLot] Confirmation: Offer Selected for ${params.lotReference}`,
        emailHtml: tSeller.html,
      }).catch((err) => console.warn("[Notification Warning] Seller notification failed:", err)),
    ]);
  }

  async notifyOffersUnsuccessful(
    recipientAccountIds: number[],
    listingTitle: string,
    lotReference: string,
  ) {
    if (!recipientAccountIds || recipientAccountIds.length === 0) return;
    const uniqueIds = Array.from(new Set(recipientAccountIds));
    const t = notificationTemplates.offerUnsuccessful(listingTitle, lotReference);

    await Promise.all(
      uniqueIds.map((buyerId) =>
        this.dispatch({
          recipientAccountId: buyerId,
          type: "offer_unsuccessful",
          title: t.title,
          message: t.message,
          linkUrl: `/auctions`,
          emailSubject: `[BidMyLot] Update on your offer for ${lotReference}`,
          emailHtml: t.html,
        }).catch((err) => console.warn(`[Notification Warning] Unsuccessful offer notification failed for user #${buyerId}:`, err)),
      ),
    );
  }

  async notifyAllocationAccepted(params: {
    buyerId: number;
    sellerId: number;
    buyerName: string;
    listingTitle: string;
    lotReference: string;
    quantity: number;
    unitPrice: number;
    currency: string;
  }) {
    const tBuyer = notificationTemplates.allocationAcceptedBuyer(
      params.listingTitle,
      params.lotReference,
      params.quantity,
      params.unitPrice,
      params.currency,
    );
    const tSeller = notificationTemplates.allocationAcceptedSeller(
      params.listingTitle,
      params.lotReference,
      params.buyerName,
      params.quantity,
      params.unitPrice,
      params.currency,
    );

    await Promise.all([
      this.dispatch({
        recipientAccountId: params.buyerId,
        type: "allocation_accepted",
        title: tBuyer.title,
        message: tBuyer.message,
        linkUrl: `/buyer/dashboard`,
        emailSubject: `[BidMyLot] Units Allocated to You for ${params.lotReference}`,
        emailHtml: tBuyer.html,
      }).catch((err) => console.warn("[Notification Warning] Buyer allocation notification failed:", err)),

      this.dispatch({
        recipientAccountId: params.sellerId,
        type: "allocation_accepted",
        title: tSeller.title,
        message: tSeller.message,
        linkUrl: `/seller/dashboard`,
        emailSubject: `[BidMyLot] Confirmation: Wholesale Allocation for ${params.lotReference}`,
        emailHtml: tSeller.html,
      }).catch((err) => console.warn("[Notification Warning] Seller allocation notification failed:", err)),
    ]);
  }

  async listUserNotifications(accountId: number, limit = 50, offset = 0) {
    const [notifications, unreadCount] = await Promise.all([
      this.repository.listByAccountId(accountId, limit, offset),
      this.repository.countUnread(accountId),
    ]);
    return { notifications, unreadCount };
  }

  async markAsRead(id: number, accountId: number) {
    return this.repository.markAsRead(id, accountId);
  }

  async markAllAsRead(accountId: number) {
    return this.repository.markAllAsRead(accountId);
  }
}

export const notificationService = new NotificationService(notificationRepository);
