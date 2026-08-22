import type { Request, Response } from "express";
import type { NewsletterInput } from "./newsletter.schemas.js";
import { newsletterService } from "./newsletter.service.js";

export const newsletterController = {
  async subscribe(request: Request, response: Response) {
    response.status(201).json(await newsletterService.subscribe(request.body as NewsletterInput));
  },
};
