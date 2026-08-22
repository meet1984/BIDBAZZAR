import { sendEmail } from "../../shared/mailer.js";

export interface SendOtpEmailOptions {
  to: string;
  fullName: string;
  otpCode: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export async function sendOtpEmail({ to, fullName, otpCode }: SendOtpEmailOptions): Promise<boolean> {
  const subject = "Your bidmylot Sign-In Verification Code";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0;">bidmylot Verification Code</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Hello ${escapeHtml(fullName)},</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">Your 6-digit sign-in verification code is:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; background-color: #eff6ff; padding: 12px 24px; border-radius: 8px; display: inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #475569; font-size: 13px; line-height: 1.5;">This code will expire in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-t: 1px solid #f1f5f9; padding-top: 12px;">
        If you did not attempt to sign in to your bidmylot account, please ignore this email or contact support if you have security concerns.
      </p>
    </div>
  `;

  const text = `Hello ${fullName},\n\nYour bidmylot sign-in verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not attempt to sign in, please ignore this message.`;

  return sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail(options: { to: string; fullName: string; resetUrl: string }): Promise<boolean> {
  const safeName = escapeHtml(options.fullName);
  const safeUrl = escapeHtml(options.resetUrl);
  return sendEmail({
    to: options.to,
    subject: "Reset your BidMyLot password",
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>Reset your password</h2><p>Hello ${safeName},</p><p>This single-use link expires in 20 minutes.</p><p><a href="${safeUrl}">Set a new password</a></p><p>If you did not request this, ignore this message.</p></div>`,
    text: `Hello ${options.fullName},\n\nUse this single-use link within 20 minutes to reset your BidMyLot password:\n${options.resetUrl}\n\nIf you did not request this, ignore this message.`,
  });
}
