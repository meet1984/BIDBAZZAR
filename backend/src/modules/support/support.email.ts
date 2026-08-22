import { env } from "../../config/env.js";
import { sendEmail } from "../../shared/mailer.js";
import type { SupportEnquiryInput } from "./support.schemas.js";

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export async function sendSupportSubmitterConfirmationEmail(
  reference: string,
  input: SupportEnquiryInput,
): Promise<boolean> {
  const subject = `[${reference}] We received your bidmylot support request`;

  const categoryText = input.reason ? `<p style="color: #475569; font-size: 14px; line-height: 1.5;"><strong>Topic:</strong> ${escapeHtml(input.reason)}</p>` : "";
  const categoryTextPlain = input.reason ? `Topic: ${input.reason}\n` : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0;">bidmylot Support Confirmation</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Hello ${escapeHtml(input.fullName)},</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Thank you for contacting bidmylot Customer Support. We have received your inquiry and our support team is reviewing it.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px;">
        <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: bold;">Reference Code: ${escapeHtml(reference)}</p>
      </div>
      ${categoryText}
      <p style="color: #475569; font-size: 13px; line-height: 1.5;">Please keep this reference code for future communications regarding your request.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-t: 1px solid #f1f5f9; padding-top: 12px;">
        This is an automated notification from bidmylot.
      </p>
    </div>
  `;

  const text = `Hello ${input.fullName},\n\nThank you for contacting bidmylot Support. We have received your inquiry.\n\nReference Code: ${reference}\n${categoryTextPlain}\nPlease keep this reference code for future communications.`;

  return sendEmail({
    to: input.email,
    subject,
    html,
    text,
  });
}

export async function sendSupportAdminNotificationEmail(
  reference: string,
  input: SupportEnquiryInput,
  hasAttachment: boolean,
): Promise<boolean> {
  const subject = `[New Support Request] ${reference} - ${input.reason || "General Inquiry"}`;

  const attachmentNoticeHtml = hasAttachment
    ? `<p style="color: #2563eb; font-size: 13px; font-weight: bold;">Attachment: Yes (viewable in Admin Dashboard)</p>`
    : `<p style="color: #64748b; font-size: 13px;">Attachment: None</p>`;

  const attachmentNoticeText = hasAttachment ? "Attachment: Yes" : "Attachment: None";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h3 style="color: #0f172a; margin-top: 0;">New Support Ticket Submitted</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
        <tr><td style="padding: 6px 0; font-weight: bold; width: 120px;">Reference:</td><td>${escapeHtml(reference)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">Submitter:</td><td>${escapeHtml(input.fullName)} (&lt;${escapeHtml(input.email)}&gt;)</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold;">Category:</td><td>${escapeHtml(input.reason || "General")}</td></tr>
      </table>
      ${attachmentNoticeHtml}
      <p style="color: #475569; font-size: 13px; margin-top: 16px;">
        Please log into the <strong>bidmylot Admin Dashboard</strong> to view the complete ticket details and respond.
      </p>
    </div>
  `;

  const text = `New Support Ticket Submitted\n\nReference: ${reference}\nSubmitter: ${input.fullName} <${input.email}>\nCategory: ${input.reason || "General"}\n${attachmentNoticeText}\n\nPlease check the Admin Dashboard for full details.`;

  return sendEmail({
    to: env.SUPPORT_NOTIFICATION_EMAIL,
    subject,
    html,
    text,
  });
}
