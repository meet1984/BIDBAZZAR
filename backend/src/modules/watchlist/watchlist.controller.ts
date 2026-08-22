import type { Request, Response } from "express";
import { watchlistService } from "./watchlist.service.js";

export const watchlistController = {
  async list(request: Request, response: Response) {
    response.json({ items: await watchlistService.list(request.auth!.id) });
  },
  async add(request: Request, response: Response) {
    response.status(201).json(
      await watchlistService.add(request.auth!.id, Number(request.params.listingId)),
    );
  },
  async remove(request: Request, response: Response) {
    response.json(
      await watchlistService.remove(request.auth!.id, Number(request.params.listingId)),
    );
  },
};
