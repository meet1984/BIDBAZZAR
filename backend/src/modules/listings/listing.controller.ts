import type { Request, Response } from "express";
import type {
  AdminReviewListingInput,
  CreateListingInput,
  PublicListingQuery,
  UpdateListingInput,
} from "./listing.schemas.js";
import { listingService } from "./listing.service.js";

export const listingController = {
  async listPublic(request: Request, response: Response) {
    const result = await listingService.listPublic(
      request.query as unknown as PublicListingQuery,
      request.auth?.id,
    );
    response.json(result);
  },

  async publicDetail(request: Request, response: Response) {
    const listing = await listingService.publicDetail(
      String(request.params.identifier),
      request.auth?.id,
    );
    response.json({ listing });
  },

  async listSeller(request: Request, response: Response) {
    const items = await listingService.listSeller(request.auth!.id);
    response.json({ items });
  },

  async createSeller(request: Request, response: Response) {
    const listing = await listingService.createSeller(
      request.auth!.id,
      request.body as CreateListingInput,
    );
    response.status(201).json({ listing });
  },

  async updateSeller(request: Request, response: Response) {
    const listing = await listingService.updateSeller(
      request.auth!.id,
      Number(request.params.id),
      request.body as UpdateListingInput,
    );
    response.json({ listing });
  },

  async submitSeller(request: Request, response: Response) {
    const listing = await listingService.submitSeller(
      request.auth!.id,
      Number(request.params.id),
    );
    response.json({ listing });
  },

  async confirmSeller(request: Request, response: Response) {
    const listing = await listingService.confirmSeller(
      request.auth!.id,
      Number(request.params.id),
    );
    response.json({ listing });
  },

  async deleteSeller(request: Request, response: Response) {
    await listingService.deleteSeller(request.auth!.id, Number(request.params.id));
    response.status(204).send();
  },

  // --- ADMIN HANDLERS ---

  async listAdmin(request: Request, response: Response) {
    const items = await listingService.listAdmin(
      request.query.reviewStatus as string | undefined,
      request.query.saleMode as string | undefined,
    );
    response.json({ items });
  },

  async reviewAdmin(request: Request, response: Response) {
    const listing = await listingService.reviewAdmin(
      request.auth!.id,
      Number(request.params.id),
      request.body as AdminReviewListingInput,
    );
    response.json({ listing });
  },

  async updateAdmin(request: Request, response: Response) {
    const listing = await listingService.updateAdmin(
      request.auth!.id,
      Number(request.params.id),
      request.body as UpdateListingInput,
    );
    response.json({ listing });
  },

  async deleteAdmin(request: Request, response: Response) {
    await listingService.deleteAdmin(request.auth!.id, Number(request.params.id));
    response.status(204).send();
  },
};
