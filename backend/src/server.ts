import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { runMigration } from "./database/migrate.js";
import { pool } from "./database/pool.js";
import { validateDatabaseSchema } from "./database/schema-validator.js";
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

  // 1. Connect to MySQL database
  logger.info("Connecting to database...");
  try {
    await pool.query("SELECT 1");
    logger.info("Database connection established");
  } catch (error) {
    logger.error("Database connection failed:", error instanceof Error ? error.message : error);
    logger.error("Application startup aborted");
    process.exit(1);
  }

  // 2. Run ONLY the consolidated database migration (full_database.sql)
  try {
    logger.info("Running database migration: full_database.sql");
    await runMigration({ silent: true });
    logger.info("Database migration completed successfully");
  } catch (error) {
    logger.error("Database migration failed:", error instanceof Error ? error.message : error);
    logger.error("Application startup aborted");
    process.exit(1);
  }

  // 3. Validate database schema against the consolidated migration
  logger.info("Validating database schema...");
  const validation = await validateDatabaseSchema(pool);
  if (!validation.valid) {
    logger.error("Database schema validation failed:", validation.errors.join("; "));
    logger.error("Application startup aborted");
    process.exit(1);
  }
  logger.info("Database schema validation passed");

  // 4. Start background jobs ONLY after migration and schema validation succeed
  logger.info("Starting background jobs...");
  runBackgroundJob("multi-unit-expiry", sweepMultiUnitExpiries);
  runBackgroundJob("negotiated-offer-expiry", sweepNegotiatedOfferExpiries);

  // Keep short-lived offer reservations synchronized while process is alive
  const sweeperTimer = setInterval(() => {
    runBackgroundJob("multi-unit-expiry", sweepMultiUnitExpiries);
    runBackgroundJob("negotiated-offer-expiry", sweepNegotiatedOfferExpiries);
  }, 60_000);
  logger.info("Background jobs started");

  // 5. Start HTTP Server
  const httpServer = createServer(app);

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
  logger.error("Failed to start BidMyLot API server:", error instanceof Error ? error.message : error);
  process.exit(1);
});
