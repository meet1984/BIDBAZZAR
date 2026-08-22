import type { Request, Response } from "express";
import type {
  AdminReviewInput,
  CreateAuctionInput,
  PublicAuctionQuery,
  UpdateAuctionInput,
} from "./auction.schemas.js";
import { auctionService } from "./auction.service.js";

export const auctionController = {
  async listPublic(request: Request, response: Response) {
    const result = await auctionService.listPublic(
      request.query as unknown as PublicAuctionQuery,
      request.auth?.id,
    );
    response.json(result);
  },

  async publicDetail(request: Request, response: Response) {
    const result = await auctionService.publicDetail(String(request.params.identifier), request.auth?.id);
    response.json({ auction: result });
  },

  async listSeller(request: Request, response: Response) {
    response.json({ items: await auctionService.listSeller(request.auth!.id) });
  },

  async createSeller(request: Request, response: Response) {
    const auction = await auctionService.createSeller(
      request.auth!.id,
      request.body as CreateAuctionInput,
    );
    response.status(201).json({ auction });
  },

  async updateSeller(request: Request, response: Response) {
    const auction = await auctionService.updateSeller(
      request.auth!.id,
      Number(request.params.id),
      request.body as UpdateAuctionInput,
    );
    response.json({ auction });
  },

  async submitSeller(request: Request, response: Response) {
    const auction = await auctionService.submitSeller(request.auth!.id, Number(request.params.id));
    response.json({ auction });
  },

  async confirmSeller(request: Request, response: Response) {
    const auction = await auctionService.confirmSeller(request.auth!.id, Number(request.params.id));
    response.json({ auction });
  },

  async deleteSeller(request: Request, response: Response) {
    await auctionService.deleteSeller(request.auth!.id, Number(request.params.id));
    response.status(204).send();
  },

  async listAdmin(request: Request, response: Response) {
    response.json({ items: await auctionService.listAdmin(request.query.status as string | undefined) });
  },

  async reviewAdmin(request: Request, response: Response) {
    const auction = await auctionService.reviewAdmin(
      request.auth!.id,
      Number(request.params.id),
      request.body as AdminReviewInput,
    );
    response.json({ auction });
  },

  async updateAdmin(request: Request, response: Response) {
    const auction = await auctionService.updateAdmin(
      Number(request.params.id),
      request.body as UpdateAuctionInput,
    );
    response.json({ auction });
  },

  async deleteAdmin(request: Request, response: Response) {
    await auctionService.deleteAdmin(Number(request.params.id));
    response.status(204).send();
  },
};
