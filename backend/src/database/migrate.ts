import fs from "node:fs/promises";
import path from "node:path";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

const isDryRun = process.argv.includes("--dry-run");
const migrationsDirectory = path.resolve(process.cwd(), "migrations");
const filePattern = /^\d{3}_[a-z0-9_]+\.sql$/;

async function migrationFiles(): Promise<string[]> {
  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (!files.length) throw new Error("No SQL migrations were found.");
  for (const file of files) {
    if (!filePattern.test(file)) {
      throw new Error(`Invalid migration filename: ${file}`);
    }
    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
    if (!sql.trim()) throw new Error(`Migration is empty: ${file}`);
  }
  return files;
}

async function exists(connection: Connection, sql: string, values: string[]): Promise<boolean> {
  const [rows] = await connection.execute<RowDataPacket[]>(sql, values);
  return Number(rows[0]?.total ?? 0) > 0;
}

async function columnExists(connection: Connection, table: string, column: string): Promise<boolean> {
  return exists(connection,
    "SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column]);
}

async function constraintExists(connection: Connection, table: string, name: string): Promise<boolean> {
  return exists(connection,
    "SELECT COUNT(*) AS total FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ?",
    [table, name]);
}

async function indexExists(connection: Connection, table: string, name: string): Promise<boolean> {
  return exists(connection,
    "SELECT COUNT(*) AS total FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
    [table, name]);
}

async function tableExists(connection: Connection, table: string): Promise<boolean> {
  return exists(connection,
    "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table]);
}

async function dropConstraint(connection: Connection, table: string, name: string): Promise<void> {
  if (await constraintExists(connection, table, name)) await connection.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``);
}

/**
 * Migration 018 originally grouped irreversible MySQL DDL in one transaction.
 * This repair-aware implementation safely finishes both fresh and partially
 * applied databases by checking every object before changing it.
 */
async function applyMigration018(connection: Connection): Promise<void> {
  const [conflicts] = await connection.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM seller_profiles sp LEFT JOIN accounts a ON a.id=sp.account_id WHERE a.id IS NULL) +
      (SELECT COUNT(*) FROM offers WHERE offered_amount <= 0) +
      (SELECT COUNT(*) FROM multi_unit_offers WHERE offered_price_per_unit <= 0) +
      (SELECT COUNT(*) FROM multi_unit_allocations WHERE unit_price <= 0) +
      (SELECT COUNT(*) FROM (SELECT listing_id,buyer_id FROM offers WHERE status IN ('submitted','revised','shortlisted','contact_requested','countered','accepted_pending_buyer') GROUP BY listing_id,buyer_id HAVING COUNT(*)>1) x) +
      (SELECT COUNT(*) FROM (SELECT listing_id,buyer_id FROM multi_unit_offers WHERE status IN ('submitted','revised','shortlisted','countered','allocation_proposed','allocation_reserved') GROUP BY listing_id,buyer_id HAVING COUNT(*)>1) y) +
      (SELECT COUNT(*) FROM (SELECT order_id FROM disputes WHERE status IN ('opened','under_review') GROUP BY order_id HAVING COUNT(*)>1) z) AS total
  `);
  if (Number(conflicts[0]?.total ?? 0) > 0) {
    throw new Error(
      "Migration 018 preflight found orphan identities, invalid offer values, duplicate active offers, or duplicate active disputes. Resolve them before retrying.",
    );
  }

  for (const spec of [
    { table: "seller_profiles", oldColumn: null, oldFk: "fk_seller_profiles_user", priorNewFk: "fk_seller_profiles_account", newColumn: "account_id", newFk: "fk_bml18_seller_profile_account", onDelete: "CASCADE" },
    { table: "refresh_tokens", oldColumn: "user_id", oldFk: "fk_refresh_tokens_user", priorNewFk: "fk_refresh_tokens_account", newColumn: "account_id", newFk: "fk_bml18_refresh_account", onDelete: "CASCADE" },
    { table: "login_otp_challenges", oldColumn: "user_id", oldFk: "fk_login_otp_challenges_user", priorNewFk: "fk_login_otp_challenges_account", newColumn: "account_id", newFk: "fk_bml18_otp_account", onDelete: "CASCADE" },
    { table: "support_enquiries", oldColumn: "user_id", oldFk: "fk_support_enquiries_user", priorNewFk: "fk_support_enquiries_account", newColumn: "account_id", newFk: "fk_bml18_support_account", onDelete: "SET NULL" },
  ]) {
    await dropConstraint(connection, spec.table, spec.oldFk);
    if (spec.oldColumn && await columnExists(connection, spec.table, spec.oldColumn) && !await columnExists(connection, spec.table, spec.newColumn)) {
      await connection.query(`ALTER TABLE \`${spec.table}\` RENAME COLUMN \`${spec.oldColumn}\` TO \`${spec.newColumn}\``);
    }
    if (!await constraintExists(connection, spec.table, spec.priorNewFk) && !await constraintExists(connection, spec.table, spec.newFk)) {
      await connection.query(`ALTER TABLE \`${spec.table}\` ADD CONSTRAINT \`${spec.newFk}\` FOREIGN KEY (\`${spec.newColumn}\`) REFERENCES accounts(id) ON DELETE ${spec.onDelete}`);
    }
  }

  // Migration 010 retained the legacy two-value enum. The application supports
  // distributor sellers, so finish this change even when migration 018 resumes
  // after MySQL has already committed some of its DDL statements.
  await connection.query(
    "ALTER TABLE seller_profiles MODIFY seller_type ENUM('individual','business','distributor') NOT NULL",
  );

  await connection.query(`CREATE TABLE IF NOT EXISTS listing_watchlists (
    account_id BIGINT UNSIGNED NOT NULL, listing_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, listing_id), KEY idx_listing_watchlists_listing (listing_id),
    CONSTRAINT fk_bml18_watch_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_bml18_watch_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query(`INSERT IGNORE INTO listing_watchlists (account_id, listing_id, created_at)
    SELECT w.user_id, w.auction_id, w.created_at FROM watchlists w
    JOIN accounts a ON a.id=w.user_id JOIN listings l ON l.id=w.auction_id`);

  if (!await columnExists(connection, "offers", "active_buyer_listing")) {
    await connection.query(`ALTER TABLE offers ADD COLUMN active_buyer_listing VARCHAR(90)
      GENERATED ALWAYS AS (CASE WHEN status IN ('submitted','revised','shortlisted','contact_requested','countered','accepted_pending_buyer') THEN CONCAT(listing_id, ':', buyer_id) ELSE NULL END) STORED`);
  }
  if (!await indexExists(connection, "offers", "uq_offers_active_buyer_listing")) {
    await connection.query("ALTER TABLE offers ADD UNIQUE KEY uq_offers_active_buyer_listing (active_buyer_listing)");
  }
  await connection.query("UPDATE multi_unit_offers SET total_offer_value=quantity_requested*offered_price_per_unit");
  if (!await columnExists(connection, "multi_unit_offers", "active_buyer_listing")) {
    await connection.query(`ALTER TABLE multi_unit_offers ADD COLUMN active_buyer_listing VARCHAR(90)
      GENERATED ALWAYS AS (CASE WHEN status IN ('submitted','revised','shortlisted','countered','allocation_proposed','allocation_reserved') THEN CONCAT(listing_id, ':', buyer_id) ELSE NULL END) STORED`);
  }
  if (!await indexExists(connection, "multi_unit_offers", "uq_multi_offers_active_buyer_listing")) {
    await connection.query("ALTER TABLE multi_unit_offers ADD UNIQUE KEY uq_multi_offers_active_buyer_listing (active_buyer_listing)");
  }
  if (!await constraintExists(connection, "multi_unit_offers", "chk_multi_offer_total")) {
    await connection.query("ALTER TABLE multi_unit_offers ADD CONSTRAINT chk_multi_offer_total CHECK (total_offer_value = quantity_requested * offered_price_per_unit)");
  }
  await connection.query("UPDATE multi_unit_allocations SET total_allocation_value=allocated_quantity*unit_price");
  if (!await constraintExists(connection, "multi_unit_allocations", "chk_multi_allocation_total")) {
    await connection.query("ALTER TABLE multi_unit_allocations ADD CONSTRAINT chk_multi_allocation_total CHECK (total_allocation_value = allocated_quantity * unit_price)");
  }

  await dropConstraint(connection, "audit_log", "fk_audit_log_actor");
  await connection.query("ALTER TABLE audit_log MODIFY actor_account_id BIGINT UNSIGNED NULL");
  if (!await constraintExists(connection, "audit_log", "fk_bml18_audit_actor_account")) {
    await connection.query("ALTER TABLE audit_log ADD CONSTRAINT fk_bml18_audit_actor_account FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE SET NULL");
  }
  if (!await columnExists(connection, "disputes", "active_order_key")) {
    await connection.query("ALTER TABLE disputes ADD COLUMN active_order_key BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('opened','under_review') THEN order_id ELSE NULL END) STORED");
  }
  if (!await indexExists(connection, "disputes", "uq_disputes_one_active_order")) {
    await connection.query("ALTER TABLE disputes ADD UNIQUE KEY uq_disputes_one_active_order (active_order_key)");
  }

  for (const [table, oldNames, newName, column, target, onDelete] of [
    ["verification_audit_log", ["fk_verif_audit_actor"], "fk_bml18_verif_actor", "actor_account_id", "accounts", "RESTRICT"],
    ["verification_audit_log", ["fk_verif_audit_target"], "fk_bml18_verif_target", "target_account_id", "accounts", "RESTRICT"],
    ["listing_audit_log", ["fk_listing_audit_actor"], "fk_bml18_listing_actor", "actor_account_id", "accounts", "RESTRICT"],
    ["listing_audit_log", ["fk_listing_audit_listing"], "fk_bml18_listing_target", "listing_id", "listings", "RESTRICT"],
  ] as const) {
    for (const oldName of oldNames) await dropConstraint(connection, table, oldName);
    if (!await constraintExists(connection, table, newName)) {
      await connection.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${newName}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${target}\`(id) ON DELETE ${onDelete}`);
    }
  }
}

/**
 * Payment/delivery removal changes several tables. Every operation is guarded
 * so the migration can safely resume after MySQL's implicit DDL commits.
 */
async function applyMigration021(connection: Connection): Promise<void> {
  await connection.query(`ALTER TABLE orders MODIFY order_status ENUM(
    'created','awaiting_payment','payment_confirmed','processing','shipped','ready_for_collection','delivered','buyer_confirmation',
    'completed','failed','payment_failed','cancelled','disputed','refunded',
    'partially_refunded','confirmed','resolved'
  ) NOT NULL DEFAULT 'confirmed'`);

  await connection.query(`UPDATE orders SET order_status = CASE
    WHEN order_status IN ('created','awaiting_payment','payment_confirmed','processing','shipped','ready_for_collection','delivered','buyer_confirmation') THEN 'confirmed'
    WHEN order_status IN ('refunded','partially_refunded') THEN 'resolved'
    WHEN order_status = 'payment_failed' THEN 'failed'
    ELSE order_status END`);

  for (const table of ["payment_events", "order_deliveries"]) {
    if (await tableExists(connection, table)) await connection.query(`DROP TABLE \`${table}\``);
  }

  for (const column of [
    "payment_status", "fulfilment_status", "delivery_method", "contact_reveal_at",
    "payment_deadline_at", "shipment_deadline_at", "delivery_deadline_at", "buyer_confirmation_deadline",
  ]) {
    if (await columnExists(connection, "orders", column)) {
      await connection.query(`ALTER TABLE orders DROP COLUMN \`${column}\``);
    }
  }
  if (!await columnExists(connection, "orders", "buyer_completed_at")) {
    await connection.query("ALTER TABLE orders ADD COLUMN buyer_completed_at DATETIME NULL AFTER order_status");
  }
  if (!await columnExists(connection, "orders", "seller_completed_at")) {
    await connection.query("ALTER TABLE orders ADD COLUMN seller_completed_at DATETIME NULL AFTER buyer_completed_at");
  }

  await connection.query(`UPDATE orders SET
    buyer_completed_at = COALESCE(buyer_completed_at, updated_at),
    seller_completed_at = COALESCE(seller_completed_at, updated_at)
    WHERE order_status = 'completed'`);
  await connection.query(`ALTER TABLE orders MODIFY order_status ENUM(
    'confirmed','completed','cancelled','disputed','resolved','failed'
  ) NOT NULL DEFAULT 'confirmed'`);

  for (const table of ["offers", "multi_unit_offers"]) {
    if (await columnExists(connection, table, "preferred_fulfilment")) {
      await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN preferred_fulfilment`);
    }
  }
  for (const column of ["delivery_return_info", "payout_provider_ref"]) {
    if (await columnExists(connection, "seller_profiles", column)) {
      await connection.query(`ALTER TABLE seller_profiles DROP COLUMN \`${column}\``);
    }
  }

  const [invalidOrders] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM orders
    WHERE source_type NOT IN ('negotiated_offer','multi_unit_allocation') OR quantity <= 0 OR unit_price <= 0
      OR total_amount <> quantity * unit_price
      OR (source_type = 'negotiated_offer' AND (source_offer_id IS NULL OR source_allocation_id IS NOT NULL))
      OR (source_type = 'multi_unit_allocation' AND (source_allocation_id IS NULL OR source_offer_id IS NOT NULL))`);
  if (Number(invalidOrders[0]?.total ?? 0) > 0) {
    throw new Error("Migration 021 preflight found invalid order source, quantity, price, or total values.");
  }
  if (!await constraintExists(connection, "orders", "chk_orders_source_identity")) {
    await connection.query(`ALTER TABLE orders ADD CONSTRAINT chk_orders_source_identity CHECK (
      (source_type = 'negotiated_offer' AND source_offer_id IS NOT NULL AND source_allocation_id IS NULL)
      OR (source_type = 'multi_unit_allocation' AND source_offer_id IS NULL AND source_allocation_id IS NOT NULL))`);
  }
  if (!await constraintExists(connection, "orders", "chk_orders_total_consistency")) {
    await connection.query("ALTER TABLE orders ADD CONSTRAINT chk_orders_total_consistency CHECK (quantity > 0 AND unit_price > 0 AND total_amount = quantity * unit_price)");
  }

  const [duplicateReports] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM (
    SELECT review_id, reporter_id FROM review_reports GROUP BY review_id, reporter_id HAVING COUNT(*) > 1
  ) duplicates`);
  if (Number(duplicateReports[0]?.total ?? 0) > 0) {
    throw new Error("Migration 021 found duplicate review reports. Resolve duplicates before retrying; no records were deleted.");
  }
  if (!await indexExists(connection, "review_reports", "uq_review_reports_reporter")) {
    await connection.query("ALTER TABLE review_reports ADD UNIQUE KEY uq_review_reports_reporter (review_id, reporter_id)");
  }
}

async function run(): Promise<void> {
  const files = await migrationFiles();
  const { env } = await import("../config/env.js");
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
      const hasMigrationTable = await tableExists(connection, "schema_migrations");
      const completed = new Set<string>();
      if (hasMigrationTable) {
        const [rows] = await connection.query<(RowDataPacket & { filename: string })[]>(
          "SELECT filename FROM schema_migrations",
        );
        for (const row of rows) completed.add(row.filename);
      }
      const pending = files.filter((file) => !completed.has(file));
      const unknown = [...completed].filter((file) => !files.includes(file));
      console.log(`Validated ${files.length} migration file(s).`);
      console.log(`Applied: ${files.filter((file) => completed.has(file)).join(", ") || "none"}`);
      console.log(`Pending: ${pending.join(", ") || "none"}`);
      if (unknown.length) {
        console.warn(`Recorded but missing locally: ${unknown.join(", ")}`);
      }
      return;
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [rows] = await connection.query<(RowDataPacket & { filename: string })[]>(
      "SELECT filename FROM schema_migrations",
    );
    const completed = new Set(rows.map((row) => row.filename));

    for (const file of files) {
      if (completed.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
      // Note: MySQL implicitly commits on DDL statements (CREATE, ALTER, etc).
      // The transaction boundary here does NOT protect against partial failures
      // of multi-DDL migration files. It only rolls back DML (INSERT, UPDATE) failures.
      await connection.beginTransaction();
      try {
        if (file === "018_repair_integrity_and_identity.sql") await applyMigration018(connection);
        else if (file === "021_remove_payment_delivery_and_simplify_orders.sql") await applyMigration021(connection);
        else await connection.query(sql);
        await connection.execute(
          "INSERT INTO schema_migrations (filename) VALUES (?)",
          [file],
        );
        await connection.commit();
        console.log(`Applied ${file}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
