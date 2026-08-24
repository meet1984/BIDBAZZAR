import { pool } from "../database/pool.js";
import { validateDatabaseSchema } from "../database/schema-validator.js";

async function run(): Promise<void> {
  const validation = await validateDatabaseSchema(pool);

  if (!validation.valid) {
    throw new Error(`Schema verification failed:\n - ${validation.errors.join("\n - ")}`);
  }

  console.log(
    `Schema verification passed: All ${validation.tableCount} tables and runtime columns required by BidMyLot are verified.`,
  );
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
