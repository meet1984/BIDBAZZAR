import type { Request, Response } from "express";
import { multiUnitOfferSellerService } from "./multi-unit-offer-seller.service.js";
import type { AcceptPartialInput, CounterMultiUnitOfferInput, ReviseMultiUnitOfferInput, SubmitMultiUnitOfferInput } from "./multi-unit-offer.schemas.js";
import { multiUnitOfferService } from "./multi-unit-offer.service.js";

export class MultiUnitOfferController {
  async submitOffer(request: Request, response: Response) {
    const listingId = Number(request.params.listingId);
    const buyerId = request.auth!.id;
    const offer = await multiUnitOfferService.submitOffer(
      buyerId,
      listingId,
      request.body as SubmitMultiUnitOfferInput,
    );
    response.status(201).json({
      message: "Multi-unit offer submitted successfully.",
      offer,
    });
  }

  async reviseOffer(request: Request, response: Response) {
    const offerId = Number(request.params.id);
    const buyerId = request.auth!.id;
    const offer = await multiUnitOfferService.reviseOffer(
      buyerId,
      offerId,
      request.body as ReviseMultiUnitOfferInput,
    );
    response.json({
      message: "Multi-unit offer revised successfully.",
      offer,
    });
  }

  async withdrawOffer(request: Request, response: Response) {
    const offerId = Number(request.params.id);
    const buyerId = request.auth!.id;
    const offer = await multiUnitOfferService.withdrawOffer(buyerId, offerId);
    response.json({
      message: "Multi-unit offer withdrawn successfully.",
      offer,
    });
  }

  async listBuyerOffers(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const offers = await multiUnitOfferService.listBuyerOffers(buyerId);
    response.json({
      items: offers,
    });
  }

  // --- SELLER ALLOCATION HANDLERS ---

  async listSellerOffers(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const listingId = Number(request.params.listingId);
    const data = await multiUnitOfferSellerService.listSellerOffers(sellerId, listingId);
    response.json(data);
  }

  async acceptFullOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const result = await multiUnitOfferSellerService.acceptFullOffer(sellerId, offerId);
    response.json({
      message: "Full allocation reserved for buyer.",
      allocation: result,
    });
  }

  async acceptPartialOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const result = await multiUnitOfferSellerService.acceptPartialOffer(
      sellerId,
      offerId,
      request.body as AcceptPartialInput,
    );
    response.json({
      message: "Partial allocation reserved for buyer.",
      allocation: result,
    });
  }

  async counterOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await multiUnitOfferSellerService.counterOffer(
      sellerId,
      offerId,
      request.body as CounterMultiUnitOfferInput,
    );
    response.json({
      message: "Counteroffer submitted.",
      offer,
    });
  }

  async shortlistOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await multiUnitOfferSellerService.shortlistOffer(sellerId, offerId);
    response.json({
      message: "Offer shortlisted.",
      offer,
    });
  }

  async rejectOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await multiUnitOfferSellerService.rejectOffer(sellerId, offerId);
    response.json({
      message: "Offer rejected.",
      offer,
    });
  }

  // --- BUYER CONFIRM / DECLINE ALLOCATION HANDLERS ---

  async buyerConfirmAllocation(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const allocationId = Number(request.params.id);
    const allocation = await multiUnitOfferSellerService.buyerConfirmAllocation(buyerId, allocationId);
    response.json({
      message: "Allocation confirmed by buyer.",
      allocation,
    });
  }

  async buyerDeclineAllocation(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const allocationId = Number(request.params.id);
    const allocation = await multiUnitOfferSellerService.buyerDeclineAllocation(buyerId, allocationId);
    response.json({
      message: "Allocation declined by buyer.",
      allocation,
    });
  }
}

export const multiUnitOfferController = new MultiUnitOfferController();
