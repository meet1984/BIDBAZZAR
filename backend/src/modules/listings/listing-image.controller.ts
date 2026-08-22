import type { Request, Response } from "express";
import { listingImageService } from "./listing-image.service.js";

export const listingImageController = {
  async listImages(request: Request, response: Response) {
    const images = await listingImageService.getListingImages(Number(request.params.id));
    response.json({ images });
  },

  async uploadImages(request: Request, response: Response) {
    const files = request.files as Express.Multer.File[];
    const images = await listingImageService.uploadImages(
      { id: request.auth!.id, accountType: request.auth?.accountType ?? "seller" },
      Number(request.params.id),
      files,
    );
    response.status(201).json({ images });
  },

  async reorderImages(request: Request, response: Response) {
    const items = (request.body as { items: { id: number; displayOrder: number; isPrimary?: boolean }[] }).items;
    const images = await listingImageService.reorderImages(
      { id: request.auth!.id, accountType: request.auth?.accountType ?? "seller" },
      Number(request.params.id),
      items,
    );
    response.json({ images });
  },

  async deleteImage(request: Request, response: Response) {
    await listingImageService.deleteImage(
      { id: request.auth!.id, accountType: request.auth?.accountType ?? "seller" },
      Number(request.params.id),
      Number(request.params.imageId),
    );
    response.status(204).send();
  },
};
