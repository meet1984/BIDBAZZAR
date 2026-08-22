import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import { orderService } from "./order.service.js";
import type { CancelOrderInput, CompleteOrderInput, OrderQueryInput } from "./order.schemas.js";

export const createOrderFromOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const offerId = Number(req.params.offerId);
  if (!offerId || Number.isNaN(offerId)) {
    throw new AppError(400, "INVALID_OFFER_ID", "Invalid offer ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType;

  const result = await orderService.createFromOffer(offerId, callerAccountId, callerAccountType);

  res.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created ? "Order created successfully." : "Existing order returned.",
    data: result.order,
    created: result.created,
  });
});

export const createOrderFromAllocationHandler = asyncHandler(async (req: Request, res: Response) => {
  const allocationId = Number(req.params.allocationId);
  if (!allocationId || Number.isNaN(allocationId)) {
    throw new AppError(400, "INVALID_ALLOCATION_ID", "Invalid allocation ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType;

  const result = await orderService.createFromAllocation(allocationId, callerAccountId, callerAccountType);

  res.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created ? "Order created successfully." : "Existing order returned.",
    data: result.order,
    created: result.created,
  });
});

export const getOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";

  const order = await orderService.getOrder(orderId, callerAccountId, callerAccountType);

  res.status(200).json({
    success: true,
    data: order,
  });
});

export const getOrderByReferenceHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawRef = req.params.reference;
  const reference = Array.isArray(rawRef) ? rawRef[0] : rawRef;
  if (!reference) {
    throw new AppError(400, "INVALID_ORDER_REF", "Order reference is required.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";

  const order = await orderService.getOrderByReference(reference, callerAccountId, callerAccountType);

  res.status(200).json({
    success: true,
    data: order,
  });
});

export const cancelOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";
  const body = req.body as CancelOrderInput;

  const order = await orderService.cancelOrder(orderId, callerAccountId, callerAccountType, body.reason);

  res.status(200).json({
    success: true,
    message: "Order cancelled successfully.",
    data: order,
  });
});

export const completeOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const body = req.body as CompleteOrderInput | undefined;
  const note = body?.note ? String(body.note) : undefined;

  const order = await orderService.completeOrder(orderId, callerAccountId, note);

  res.status(200).json({
    success: true,
    message: "Deal marked as completed / done successfully.",
    data: order,
  });
});

export const listBuyerOrdersHandler = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.auth!.id;
  const query = req.query as unknown as OrderQueryInput;

  const result = await orderService.listBuyerOrders(buyerId, {
    orderStatus: query.status,
    limit: query.limit,
    offset: query.offset,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: {
      total: result.total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    },
  });
});

export const listSellerOrdersHandler = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.auth!.id;
  const query = req.query as unknown as OrderQueryInput;

  const result = await orderService.listSellerOrders(sellerId, {
    orderStatus: query.status,
    limit: query.limit,
    offset: query.offset,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: {
      total: result.total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    },
  });
});

export const listAdminOrdersHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as OrderQueryInput;

  const result = await orderService.listAdminOrders({
    orderStatus: query.status,
    limit: query.limit,
    offset: query.offset,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: {
      total: result.total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    },
  });
});
