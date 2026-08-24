import fs from "node:fs/promises";
import path from "node:path";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { validateDatabaseSchema } from "./schema-validator.js";

const CONSOLIDATED_MIGRATION_FILE = "full_database.sql";

export interface MigrationOptions {
  dryRun?: boolean;
  silent?: boolean;
}

export interface MigrationResult {
  success: boolean;
  applied: boolean;
  filename: string;
  tableCount: number;
}

async function findConsolidatedMigrationPath(): Promise<string> {
  const possiblePaths = [
    path.resolve(process.cwd(), "migrations", CONSOLIDATED_MIGRATION_FILE),
    path.resolve(process.cwd(), "backend", "migrations", CONSOLIDATED_MIGRATION_FILE),
    path.resolve(import.meta.dirname, "../../migrations", CONSOLIDATED_MIGRATION_FILE),
    path.resolve(import.meta.dirname, "../../../migrations", CONSOLIDATED_MIGRATION_FILE),
  ];

  for (const candidate of possiblePaths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue searching
    }
  }

  throw new Error(`Consolidated migration file '${CONSOLIDATED_MIGRATION_FILE}' was not found.`);
}

/**
 * Runs ONLY the consolidated production migration file (full_database.sql).
 * Old/historical migration files are ignored.
 */
export async function runMigration(options: MigrationOptions = {}): Promise<MigrationResult> {
  const isDryRun = options.dryRun ?? process.argv.includes("--dry-run");
  const migrationPath = await findConsolidatedMigrationPath();
  const sql = await fs.readFile(migrationPath, "utf8");

  if (!sql.trim()) {
    throw new Error(`Consolidated migration file is empty: ${migrationPath}`);
  }

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    ...(env.DB_PORT ? { port: env.DB_PORT } : {}),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
    timezone: "Z",
  });

  try {
    if (isDryRun) {
      const [tableRows] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()",
      );
      const currentTableCount = Number(tableRows[0]?.total ?? 0);
      const validation = await validateDatabaseSchema(connection);

      if (!options.silent) {
        logger.info(`[DRY-RUN] Consolidated migration file: ${CONSOLIDATED_MIGRATION_FILE}`);
        logger.info(`[DRY-RUN] Current database table count: ${currentTableCount}`);
        logger.info(`[DRY-RUN] Schema validation status: ${validation.valid ? "VALID" : "PENDING/INCOMPLETE"}`);
        if (!validation.valid) {
          logger.info(`[DRY-RUN] Missing tables: ${validation.missingTables.join(", ") || "none"}`);
        }
      }

      return {
        success: validation.valid,
        applied: false,
        filename: CONSOLIDATED_MIGRATION_FILE,
        tableCount: currentTableCount,
      };
    }

    if (!options.silent) {
      logger.info(`Running database migration: ${CONSOLIDATED_MIGRATION_FILE}`);
    }

    // Execute the consolidated DDL script
    await connection.query(sql);

    // Record the consolidated migration execution in schema_migrations
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
        \`filename\` VARCHAR(255) NOT NULL,
        \`executed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`filename\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.execute(
      "INSERT INTO schema_migrations (filename) VALUES (?) ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP",
      [CONSOLIDATED_MIGRATION_FILE],
    );

    // Validate the schema after applying
    const validation = await validateDatabaseSchema(connection);
    if (!validation.valid) {
      throw new Error(`Database schema validation failed after migration: ${validation.errors.join("; ")}`);
    }

    if (!options.silent) {
      logger.info("Database migration completed successfully");
    }

    return {
      success: true,
      applied: true,
      filename: CONSOLIDATED_MIGRATION_FILE,
      tableCount: validation.tableCount,
    };
  } finally {
    await connection.end();
  }
}

// CLI execution handler
const isDirectCliExecution =
  process.argv[1] &&
  (process.argv[1].endsWith("migrate.ts") ||
    process.argv[1].endsWith("migrate.js") ||
    process.argv[1].includes("migrate"));

if (isDirectCliExecution) {
  runMigration()
    .then((res) => {
      if (!res.success) {
        process.exitCode = 1;
      }
    })
    .catch((error: unknown) => {
      logger.error("Database migration error:", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
