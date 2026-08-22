import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const isPlaceholderSmtp =
  env.SMTP_USER.includes("your-mailtrap") ||
  env.SMTP_USER.includes("your_smtp") ||
  env.SMTP_USER.includes("placeholder") ||
  env.SMTP_USER.includes("local-dev-user") ||
  env.SMTP_USER.startsWith("your-");

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const plainTextContent = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (isPlaceholderSmtp && env.NODE_ENV !== "production") {
    console.info(`[DEV MAIL] Suppressed message body for ${to}; subject: ${subject}`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: plainTextContent,
    });
    return true;
  } catch (error: unknown) {
    if (env.NODE_ENV !== "production") {
      console.warn(`\n[SMTP Notice] Unable to connect to SMTP server at ${env.SMTP_HOST}:${env.SMTP_PORT}. Falling back to console mail preview in dev mode.`);
      console.info(`[DEV MAIL] Suppressed fallback message body for ${to}; subject: ${subject}`);
      return true;
    }

    console.error("Failed to send email via SMTP transporter:", error);
    return false;
  }
}
