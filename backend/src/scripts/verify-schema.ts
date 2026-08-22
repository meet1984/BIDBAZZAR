import fs from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../database/pool.js";

const requiredTables = [
  "schema_migrations",
  "accounts",
  "buyer_profiles",
  "seller_profiles",
  "categories",
  "subcategories",
  "listings",
  "listing_images",
  "listing_watchlists",
  "offers",
  "multi_unit_offers",
  "multi_unit_allocations",
  "orders",
  "disputes",
  "reviews",
  "review_reports",
  "notifications",
  "support_enquiries",
];

const forbiddenTables = ["payment_events", "order_deliveries"];

const requiredColumns: Record<string, string[]> = {
  seller_profiles: ["account_id", "business_name", "seller_type"],
  listings: [
    "seller_id",
    "category_id",
    "sale_mode",
    "review_status",
    "min_acceptable_unit_price",
    "offer_start_time",
    "offer_end_time",
    "buyer_confirmation_deadline_hours",
  ],
  listing_watchlists: ["account_id", "listing_id"],
  multi_unit_allocations: ["listing_id", "allocated_quantity", "status", "reserved_until"],
  orders: ["buyer_completed_at", "seller_completed_at", "order_status", "source_type"],
};

const forbiddenColumns: Record<string, string[]> = {
  orders: ["payment_status", "fulfilment_status", "delivery_method", "buyer_confirmation_deadline"],
  seller_profiles: ["delivery_return_info", "payout_provider_ref"],
};

async function run(): Promise<void> {
  const [tableRows] = await pool.execute<(RowDataPacket & { name: string })[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const tables = new Set(tableRows.map((row) => String(row.name)));

  const [columnRows] = await pool.execute<
    (RowDataPacket & { tableName: string; columnName: string })[]
  >(
    "SELECT table_name AS tableName, column_name AS columnName FROM information_schema.columns WHERE table_schema = DATABASE()",
  );
  const columnsByTable = new Map<string, Set<string>>();
  for (const row of columnRows) {
    const tableColumns = columnsByTable.get(row.tableName) ?? new Set<string>();
    tableColumns.add(row.columnName);
    columnsByTable.set(row.tableName, tableColumns);
  }

  const missingTables = requiredTables.filter((name) => !tables.has(name));
  const obsoleteTables = forbiddenTables.filter((name) => tables.has(name));
  const missingColumns = Object.entries(requiredColumns).flatMap(([table, required]) =>
    required
      .filter((column) => !columnsByTable.get(table)?.has(column))
      .map((column) => `${table}.${column}`),
  );
  const obsoleteColumns = Object.entries(forbiddenColumns).flatMap(([table, forbidden]) =>
    forbidden
      .filter((column) => columnsByTable.get(table)?.has(column))
      .map((column) => `${table}.${column}`),
  );

  const migrationFiles = (await fs.readdir(path.resolve(process.cwd(), "migrations")))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  const completedMigrations = new Set<string>();
  if (tables.has("schema_migrations")) {
    const [migrationRows] = await pool.execute<(RowDataPacket & { filename: string })[]>(
      "SELECT filename FROM schema_migrations",
    );
    for (const row of migrationRows) completedMigrations.add(row.filename);
  }
  const pendingMigrations = migrationFiles.filter((file) => !completedMigrations.has(file));

  const failures = [
    missingTables.length ? `missing tables: ${missingTables.join(", ")}` : "",
    obsoleteTables.length ? `obsolete tables still present: ${obsoleteTables.join(", ")}` : "",
    missingColumns.length ? `missing columns: ${missingColumns.join(", ")}` : "",
    obsoleteColumns.length ? `obsolete columns: ${obsoleteColumns.join(", ")}` : "",
    pendingMigrations.length ? `pending migrations: ${pendingMigrations.join(", ")}` : "",
  ].filter(Boolean);

  if (failures.length) {
    throw new Error(`Schema verification failed: ${failures.join("; ")}`);
  }
  console.log(
    `Schema verification passed: ${migrationFiles.length} migrations are applied and the direct-deal runtime schema is active.`,
  );
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
