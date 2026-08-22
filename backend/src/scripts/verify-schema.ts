import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../database/pool.js";

const requiredTables = [
  "accounts", "buyer_profiles", "seller_profiles", "categories", "subcategories",
  "listings", "listing_images", "offers", "multi_unit_offers", "multi_unit_allocations",
  "orders", "disputes", "reviews", "review_reports", "notifications", "support_enquiries",
];
const forbiddenTables = ["payment_events", "order_deliveries"];
const requiredOrderColumns = ["buyer_completed_at", "seller_completed_at", "order_status", "source_type"];
const forbiddenOrderColumns = ["payment_status", "fulfilment_status", "delivery_method", "buyer_confirmation_deadline"];

async function names(query: string, values: string[]): Promise<Set<string>> {
  const [rows] = await pool.execute<RowDataPacket[]>(query, values);
  return new Set(rows.map((row) => String(row.name)));
}

async function run(): Promise<void> {
  const tables = await names(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()",
    [],
  );
  const columns = await names(
    "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders'",
    [],
  );
  const missingTables = requiredTables.filter((name) => !tables.has(name));
  const obsoleteTables = forbiddenTables.filter((name) => tables.has(name));
  const missingColumns = requiredOrderColumns.filter((name) => !columns.has(name));
  const obsoleteColumns = forbiddenOrderColumns.filter((name) => columns.has(name));

  const failures = [
    missingTables.length ? `missing tables: ${missingTables.join(", ")}` : "",
    obsoleteTables.length ? `obsolete tables still present: ${obsoleteTables.join(", ")}` : "",
    missingColumns.length ? `missing order columns: ${missingColumns.join(", ")}` : "",
    obsoleteColumns.length ? `obsolete order columns still present: ${obsoleteColumns.join(", ")}` : "",
  ].filter(Boolean);
  if (failures.length) throw new Error(`Schema verification failed: ${failures.join("; ")}`);
  console.log("Schema verification passed: direct-deal order model is active.");
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
