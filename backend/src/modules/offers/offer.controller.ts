import type { Request, Response } from "express";
import { offerSellerService } from "./offer-seller.service.js";
import type { AcceptOfferInput, CounterOfferInput, ReviseOfferInput, SubmitOfferInput } from "./offer.schemas.js";
import { offerService } from "./offer.service.js";

export class OfferController {
  async submitOffer(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const listingId = Number(request.params.listingId);
    const offer = await offerService.submitOffer(buyerId, listingId, request.body as SubmitOfferInput);
    response.status(201).json({
      message: "Offer submitted successfully.",
      offer,
    });
  }

  async reviseOffer(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerService.reviseOffer(buyerId, offerId, request.body as ReviseOfferInput);
    response.json({
      message: "Offer revised successfully.",
      offer,
    });
  }

  async withdrawOffer(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerService.withdrawOffer(buyerId, offerId);
    response.json({
      message: "Offer withdrawn successfully.",
      offer,
    });
  }

  async listBuyerOffers(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const offers = await offerService.listBuyerOffers(buyerId);
    response.json({ items: offers });
  }

  async listSellerOffers(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const listingId = Number(request.params.listingId);
    const data = await offerSellerService.listSellerOffers(sellerId, listingId);
    response.json(data);
  }

  async shortlistOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerSellerService.shortlistOffer(sellerId, offerId);
    response.json({ message: "Offer shortlisted.", offer });
  }

  async rejectOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerSellerService.rejectOffer(sellerId, offerId);
    response.json({ message: "Offer rejected.", offer });
  }

  async counterOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerSellerService.counterOffer(sellerId, offerId, request.body as CounterOfferInput);
    response.json({ message: "Counteroffer sent.", offer });
  }

  async requestContact(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerSellerService.requestContact(sellerId, offerId);
    response.json({ message: "Contact request registered.", offer });
  }

  async acceptOffer(request: Request, response: Response) {
    const sellerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerSellerService.acceptOffer(sellerId, offerId, request.body as AcceptOfferInput);
    response.json({ message: "Offer accepted pending buyer confirmation.", offer });
  }

  async buyerConfirmOffer(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerSellerService.buyerConfirmOffer(buyerId, offerId);
    response.json({ message: "Offer accepted and confirmed by buyer.", offer });
  }

  async buyerDeclineOffer(request: Request, response: Response) {
    const buyerId = request.auth!.id;
    const offerId = Number(request.params.id);
    const offer = await offerSellerService.buyerDeclineOffer(buyerId, offerId);
    response.json({ message: "Offer declined by buyer.", offer });
  }
}

export const offerController = new OfferController();
