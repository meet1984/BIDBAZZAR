import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
  createCheckoutSessionHandler,
  listOrderPaymentEventsHandler,
  webhookHandler,
} from "./payment.controller.js";

export const paymentRouter = Router();

// Public webhook receiver (verifies cryptographic signature header)
paymentRouter.post("/webhook", webhookHandler);

// Checkout session generation for an order (buyer or admin)
paymentRouter.post("/orders/:id/checkout", requireAuth, createCheckoutSessionHandler);

// Order payment audit event log (buyer, seller, or admin)
paymentRouter.get("/orders/:id/events", requireAuth, listOrderPaymentEventsHandler);
