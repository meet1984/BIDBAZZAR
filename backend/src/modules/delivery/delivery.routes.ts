import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  buyerConfirmDeliveryHandler,
  markDeliveredHandler,
  markReadyForCollectionHandler,
  markShippedHandler,
} from "./delivery.controller.js";
import {
  buyerConfirmDeliverySchema,
  markDeliveredSchema,
  readyForCollectionSchema,
  shipOrderSchema,
} from "./delivery.schemas.js";

export const deliveryRouter = Router();

// Seller dispatches shipping
deliveryRouter.post("/orders/:id/ship", requireAuth, validate(shipOrderSchema), markShippedHandler);

// Seller readies collection lot
deliveryRouter.post(
  "/orders/:id/ready-for-collection",
  requireAuth,
  validate(readyForCollectionSchema),
  markReadyForCollectionHandler,
);

// Seller or carrier records proof of delivery
deliveryRouter.post("/orders/:id/delivered", requireAuth, validate(markDeliveredSchema), markDeliveredHandler);

// Buyer confirms delivery receipt -> Order completed
deliveryRouter.post(
  "/orders/:id/buyer-confirm",
  requireAuth,
  validate(buyerConfirmDeliverySchema),
  buyerConfirmDeliveryHandler,
);
