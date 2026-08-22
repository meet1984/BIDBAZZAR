import { env } from "../config/env.js";

type LogLevel = "info" | "warn" | "error" | "debug";

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  let metaString = "";
  if (meta !== undefined) {
    if (meta instanceof Error) {
      metaString = ` | Error: ${meta.message}${meta.stack ? `\n${meta.stack}` : ""}`;
    } else if (typeof meta === "string") {
      metaString = ` | ${meta}`;
    } else if (typeof meta === "number" || typeof meta === "boolean") {
      metaString = ` | ${String(meta)}`;
    } else {
      try {
        metaString = ` | ${JSON.stringify(meta)}`;
      } catch {
        metaString = " | [Unserializable object]";
      }
    }
  }
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
}

export const logger = {
  info(message: string, meta?: unknown) {
    console.log(formatMessage("info", message, meta));
  },
  warn(message: string, meta?: unknown) {
    console.warn(formatMessage("warn", message, meta));
  },
  error(message: string, meta?: unknown) {
    if (env.NODE_ENV !== "test") {
      console.error(formatMessage("error", message, meta));
    }
  },
  debug(message: string, meta?: unknown) {
    if (env.NODE_ENV === "development") {
      console.log(formatMessage("debug", message, meta));
    }
  },
};
