# Shared backend helpers

This folder contains the standard application error, async Express wrapper, pagination, public reference generation, JWT/refresh-cookie helpers, and the central SMTP mailer module (`mailer.ts`). Modules depend on these small primitives; they must not accumulate feature-specific business logic. Add code here only when multiple modules use it.

## SMTP Mailer Configuration & Testing

The mailer utility (`mailer.ts`) uses Nodemailer to send emails across the platform via standard SMTP.

### Required Environment Variables
- `SMTP_HOST`: The SMTP server hostname (e.g. `sandbox.smtp.mailtrap.io`).
- `SMTP_PORT`: The SMTP port (e.g. `2525`, `587`, or `465`).
- `SMTP_SECURE`: Set to `true` for TLS (port 465) or `false` for STARTTLS/unencrypted.
- `SMTP_USER`: SMTP authentication username.
- `SMTP_PASSWORD`: SMTP authentication password.
- `SMTP_FROM_NAME`: Display name for outgoing emails (default: `BidMyLot`).
- `SMTP_FROM_EMAIL`: Sender address for outgoing emails (e.g. `no-reply@bidmylot.com`).
- `SUPPORT_NOTIFICATION_EMAIL`: Inbox email address where internal support enquiry notifications are routed.

### Testing Locally with Mailtrap
1. Create a free account at [Mailtrap.io](https://mailtrap.io).
2. Go to **Inboxes** -> **Integration** -> Select **Nodemailer**.
3. Copy the `host`, `port`, `user`, and `pass` values into your `.env` file.
4. Outgoing emails sent by the backend during development will be captured securely in your Mailtrap inbox.

