import { Router } from "express";
import { requireAccountType, requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import {
  cancelOrderHandler,
  completeOrderHandler,
  createOrderFromAllocationHandler,
  createOrderFromOfferHandler,
  getOrderHandler,
  getOrderByReferenceHandler,
  listAdminOrdersHandler,
  listBuyerOrdersHandler,
  listSellerOrdersHandler,
} from "./order.controller.js";
import { allocationIdSchema, cancelOrderSchema, completeOrderSchema, offerIdSchema, orderIdSchema, orderQuerySchema, orderReferenceSchema } from "./order.schemas.js";

export const orderRouter = Router();

// Order creation from confirmed offers/allocations (Buyer, Seller, or Admin)
orderRouter.post("/from-offer/:offerId", requireAuth, validate(offerIdSchema, "params"), createOrderFromOfferHandler);
orderRouter.post("/from-allocation/:allocationId", requireAuth, validate(allocationIdSchema, "params"), createOrderFromAllocationHandler);

// Order listings for authenticated parties
orderRouter.get("/buyer", requireAccountType("buyer"), validate(orderQuerySchema, "query"), listBuyerOrdersHandler);
orderRouter.get("/seller", requireAccountType("seller"), validate(orderQuerySchema, "query"), listSellerOrdersHandler);

// Admin oversight list
orderRouter.get("/admin", requireAdminPermission("order_oversight"), validate(orderQuerySchema, "query"), listAdminOrdersHandler);

// Order lookup
orderRouter.get("/reference/:reference", requireAuth, validate(orderReferenceSchema, "params"), getOrderByReferenceHandler);
orderRouter.get("/:id", requireAuth, validate(orderIdSchema, "params"), getOrderHandler);

// Order transitions
orderRouter.post("/:id/complete", requireAuth, validate(orderIdSchema, "params"), validate(completeOrderSchema), completeOrderHandler);
orderRouter.post("/:id/cancel", requireAuth, validate(orderIdSchema, "params"), validate(cancelOrderSchema), cancelOrderHandler);
