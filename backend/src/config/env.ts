import "dotenv/config";
import { z } from "zod";

const booleanFromEnvironment = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const rawPort = process.env.PORT;
const PORT = rawPort
  ? Number.isNaN(Number(rawPort))
    ? rawPort
    : Number(rawPort)
  : 5000;

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .union([z.number().int().positive(), z.string().min(1)])
    .default(PORT),
  CLIENT_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:5173")
    .refine(
      (val) =>
        val
          .split(",")
          .map((s) => s.trim())
          .every((origin) => {
            try {
              new URL(origin);
              return true;
            } catch {
              return false;
            }
          }),
      { message: "CLIENT_ORIGIN must contain valid URL(s), separated by commas if multiple" },
    ),
  DB_HOST: z.string().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().optional(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_SECURE: booleanFromEnvironment,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  PRIVATE_UPLOAD_DIR: z.string().min(1).default("private_uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(10 * 1024 * 1024).default(5 * 1024 * 1024),
  ADMIN_NAME: z.string().min(1).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: booleanFromEnvironment,
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  SMTP_FROM_NAME: z.string().min(1),
  SMTP_FROM_EMAIL: z.string().email(),
  SUPPORT_NOTIFICATION_EMAIL: z.string().email(),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid backend environment configuration:\n${details}`);
}

const placeholders = ["change-this", "change_this", "your-secret-here", "changeme", "placeholder"];
const isInvalidSecret = (secret?: string) => {
  if (!secret || secret.length < 32) return true;
  const lower = secret.toLowerCase();
  return placeholders.some((p) => lower.includes(p));
};

const refreshSecret = process.env.JWT_REFRESH_SECRET;
if (isInvalidSecret(parsed.data.JWT_ACCESS_SECRET) || (refreshSecret !== undefined && isInvalidSecret(refreshSecret))) {
  throw new Error(
    "JWT secrets must be non-placeholder values of at least 32 characters."
  );
}

if (parsed.data.NODE_ENV === "production") {
  if (!parsed.data.COOKIE_SECURE) {
    throw new Error("COOKIE_SECURE must be true in production.");
  }
  const hasInsecureOrigin = parsed.data.CLIENT_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .some((origin) => new URL(origin).protocol !== "https:");
  if (hasInsecureOrigin) {
    throw new Error("CLIENT_ORIGIN must use HTTPS in production.");
  }
}

export const env = parsed.data;

export const allowedOrigins: string[] = env.CLIENT_ORIGIN.split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, "");
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === "[::1]" ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}
