import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import { disputeService } from "./dispute.service.js";
import type { DisputeQueryInput, OpenDisputeInput, ResolveDisputeInput } from "./dispute.schemas.js";

export const openDisputeHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";
  const body = req.body as OpenDisputeInput;

  const dispute = await disputeService.openDispute(orderId, callerAccountId, callerAccountType, body);

  res.status(201).json({
    success: true,
    message: "Dispute opened successfully.",
    data: dispute,
  });
});

export const resolveDisputeHandler = asyncHandler(async (req: Request, res: Response) => {
  const disputeId = Number(req.params.id);
  if (!disputeId || Number.isNaN(disputeId)) {
    throw new AppError(400, "INVALID_DISPUTE_ID", "Invalid dispute ID.");
  }

  const adminAccountId = req.auth!.id;
  const body = req.body as ResolveDisputeInput;

  const dispute = await disputeService.resolveDispute(disputeId, adminAccountId, body);

  res.status(200).json({
    success: true,
    message: "Dispute resolved successfully.",
    data: dispute,
  });
});

export const getDisputeHandler = asyncHandler(async (req: Request, res: Response) => {
  const disputeId = Number(req.params.id);
  if (!disputeId || Number.isNaN(disputeId)) {
    throw new AppError(400, "INVALID_DISPUTE_ID", "Invalid dispute ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";

  const dispute = await disputeService.getDispute(disputeId, callerAccountId, callerAccountType);

  res.status(200).json({
    success: true,
    data: dispute,
  });
});

export const listOrderDisputesHandler = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    throw new AppError(400, "INVALID_ORDER_ID", "Invalid order ID.");
  }

  const callerAccountId = req.auth!.id;
  const callerAccountType = req.auth!.accountType || "buyer";

  const disputes = await disputeService.listOrderDisputes(orderId, callerAccountId, callerAccountType);

  res.status(200).json({
    success: true,
    data: disputes,
  });
});

export const listAdminDisputesHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as DisputeQueryInput;

  const result = await disputeService.listAdminDisputes(query);

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
