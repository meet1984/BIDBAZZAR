import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./database/pool.js";
import { sweepMultiUnitExpiries } from "./jobs/multi-unit-sweeper.js";
import { sweepNegotiatedOfferExpiries } from "./jobs/negotiated-offer-sweeper.js";
import { logger } from "./shared/logger.js";

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
});

let isStarted = false;

function runBackgroundJob(name: string, job: () => Promise<unknown>): void {
  void job().catch((error: unknown) => logger.error(`Background job '${name}' failed:`, error));
}

async function start(): Promise<void> {
  if (isStarted) return;
  isStarted = true;

  await pool.query("SELECT 1");
  const httpServer = createServer(app);

  runBackgroundJob("multi-unit-expiry", sweepMultiUnitExpiries);
  runBackgroundJob("negotiated-offer-expiry", sweepNegotiatedOfferExpiries);
  // Keep short-lived offer reservations synchronized while this process is alive.
  const sweeperTimer = setInterval(() => {
    runBackgroundJob("multi-unit-expiry", sweepMultiUnitExpiries);
    runBackgroundJob("negotiated-offer-expiry", sweepNegotiatedOfferExpiries);
  }, 60_000);


  await new Promise<void>((resolve) => {
    httpServer.listen(env.PORT, () => {
      logger.info(`BidMyLot API listening on ${typeof env.PORT === "number" ? `port ${env.PORT}` : env.PORT}`);
      resolve();
    });
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received; shutting down.`);
    clearInterval(sweeperTimer);
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((error: unknown) => {
  logger.error("Failed to start BidMyLot API server:", error);
  process.exitCode = 1;
});
