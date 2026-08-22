import type { NewsletterInput } from "./newsletter.schemas.js";
import type { NewsletterRepository } from "./newsletter.repository.js";
import { newsletterRepository } from "./newsletter.repository.js";

export class NewsletterService {
  constructor(private readonly repository: NewsletterRepository) { }

  async subscribe(input: NewsletterInput) {
    await this.repository.subscribe(input.email);
    return { message: "You are subscribed to bidmylot updates." };
  }
}

export const newsletterService = new NewsletterService(newsletterRepository);
