import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import { deliveryService } from "./delivery.service.js";
import type {
  BuyerConfirmDeliveryInput,
  MarkDeliveredInput,
  ReadyForCollectionInput,
  ShipOrderInput,
} from "./delivery.schemas.js";

export const markShippedHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "seller";
  const body = req.body as ShipOrderInput;

  const result = await deliveryService.markShipped(orderId, callerAccountId, callerAccountType, body);

  res.status(200).json({
    success: true,
    message: "Order marked as shipped.",
    data: result,
  });
});

export const markReadyForCollectionHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "seller";
  const body = req.body as ReadyForCollectionInput;

  const result = await deliveryService.markReadyForCollection(orderId, callerAccountId, callerAccountType, body);

  res.status(200).json({
    success: true,
    message: "Order marked as ready for collection.",
    data: result,
  });
});

export const markDeliveredHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "seller";
  const body = req.body as MarkDeliveredInput;

  const result = await deliveryService.markDelivered(orderId, callerAccountId, callerAccountType, body);

  res.status(200).json({
    success: true,
    message: "Proof of delivery recorded. Confirmation window opened.",
    data: result,
  });
});

export const buyerConfirmDeliveryHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";
  const body = req.body as BuyerConfirmDeliveryInput;

  const result = await deliveryService.buyerConfirmDelivery(orderId, callerAccountId, callerAccountType, body);

  res.status(200).json({
    success: true,
    message: "Delivery receipt confirmed. Order completed.",
    data: result,
  });
});
