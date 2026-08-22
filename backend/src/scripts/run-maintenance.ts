import { pool } from "../database/pool.js";
import { sweepMultiUnitExpiries } from "../jobs/multi-unit-sweeper.js";
import { sweepNegotiatedOfferExpiries } from "../jobs/negotiated-offer-sweeper.js";
import { logger } from "../shared/logger.js";

async function run(): Promise<void> {
  await pool.query("SELECT 1");
  const result = await sweepMultiUnitExpiries();
  const expiredNegotiatedOffers = await sweepNegotiatedOfferExpiries();
  logger.info("Maintenance completed.", { ...result, expiredNegotiatedOffers });
  await pool.end();
}

run().catch(async (error: unknown) => {
  logger.error("Maintenance failed.", error);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
