import { pool } from "../../database/pool.js";

export class NewsletterRepository {
  async subscribe(email: string): Promise<void> {
    await pool.execute(
      `INSERT INTO newsletter_subscriptions (email, status)
       VALUES (?, 'subscribed')
       ON DUPLICATE KEY UPDATE status = 'subscribed', updated_at = UTC_TIMESTAMP()`,
      [email],
    );
  }
}

export const newsletterRepository = new NewsletterRepository();
