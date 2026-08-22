import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import { orderService } from "../orders/order.service.js";
import { paymentService } from "./payment.service.js";

export const createCheckoutSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";

  // Note: Even if a client sends { paymentSuccessful: true } in the request body,
  // it is strictly ignored. Only verified provider webhooks can advance order payment state.
  const result = await paymentService.createPaymentSession(orderId, callerAccountId, callerAccountType);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const webhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const signature =
    req.get("x-webhook-signature") ||
    req.get("stripe-signature") ||
    req.get("x-signature") ||
    "";

  if (!signature) {
    throw new AppError(401, "MISSING_SIGNATURE", "Webhook signature header is required.");
  }

  // express.raw() supplies a Buffer. Preserve those exact bytes because
  // re-serializing a Buffer changes the signed payload.
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);

  const result = await paymentService.handleWebhook(rawBody, signature, req.headers);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const listOrderPaymentEventsHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  // Access check: Only buyer, seller, or permitted admin can view payment event history
  await orderService.getOrder(orderId, req.auth!.id, req.auth!.accountType || "buyer");

  const events = await paymentService.listOrderPaymentEvents(orderId);

  res.status(200).json({
    success: true,
    data: events,
  });
});
