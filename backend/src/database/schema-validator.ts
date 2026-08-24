import type { Connection, Pool, RowDataPacket } from "mysql2/promise";
import { pool } from "./pool.js";

export const REQUIRED_TABLES = [
  "schema_migrations",
  "system_settings",
  "users",
  "accounts",
  "buyer_profiles",
  "seller_profiles",
  "verification_documents",
  "verification_decisions",
  "verification_audit_log",
  "refresh_tokens",
  "login_otp_challenges",
  "password_reset_tokens",
  "categories",
  "subcategories",
  "auctions",
  "bids",
  "watchlists",
  "listings",
  "listing_images",
  "listing_watchlists",
  "listing_audit_log",
  "offers",
  "multi_unit_offers",
  "multi_unit_allocations",
  "orders",
  "disputes",
  "reviews",
  "review_reports",
  "admin_permissions",
  "audit_log",
  "notifications",
  "support_enquiries",
  "newsletter_subscriptions",
] as const;

export const REQUIRED_COLUMNS: Record<string, string[]> = {
  offers: [
    "id",
    "listing_id",
    "buyer_id",
    "offered_amount",
    "counter_amount",
    "currency",
    "buyer_message",
    "seller_message",
    "offer_expiry",
    "status",
    "version",
    "active_buyer_listing",
  ],
  multi_unit_offers: [
    "id",
    "listing_id",
    "buyer_id",
    "quantity_requested",
    "offered_price_per_unit",
    "total_offer_value",
    "buyer_message",
    "offer_expiry",
    "counter_quantity",
    "counter_unit_price",
    "seller_message",
    "status",
    "version",
    "active_buyer_listing",
  ],
  multi_unit_allocations: [
    "id",
    "offer_id",
    "listing_id",
    "buyer_id",
    "allocated_quantity",
    "unit_price",
    "total_allocation_value",
    "status",
    "reserved_until",
    "version",
  ],
  listings: [
    "id",
    "seller_id",
    "category_id",
    "subcategory_id",
    "sale_mode",
    "title",
    "description",
    "condition",
    "location",
    "asking_price",
    "currency",
    "start_time",
    "end_time",
    "public_slug",
    "listing_reference",
    "review_status",
    "version",
    "total_quantity",
    "unit_name",
    "asking_price_per_unit",
    "min_order_quantity",
    "max_order_quantity",
    "quantity_increment",
    "allow_partial_allocation",
    "min_acceptable_unit_price",
    "offer_start_time",
    "offer_end_time",
    "buyer_confirmation_deadline_hours",
  ],
  accounts: [
    "id",
    "account_type",
    "email",
    "password_hash",
    "full_name",
    "phone",
    "status",
    "accepted_terms_at",
    "marketing_consent",
    "migration_review_required",
  ],
  seller_profiles: [
    "account_id",
    "seller_name",
    "legal_name",
    "business_name",
    "seller_type",
    "verification_status",
  ],
  buyer_profiles: [
    "account_id",
    "legal_full_name",
    "buyer_type",
    "verification_status",
  ],
  orders: [
    "id",
    "order_reference",
    "buyer_id",
    "seller_id",
    "listing_id",
    "source_type",
    "source_reference",
    "quantity",
    "unit_price",
    "total_amount",
    "currency",
    "order_status",
    "buyer_completed_at",
    "seller_completed_at",
  ],
  disputes: [
    "id",
    "order_id",
    "dispute_reference",
    "opened_by_account_id",
    "reason",
    "details",
    "status",
    "active_order_key",
  ],
  reviews: [
    "id",
    "order_id",
    "reviewer_id",
    "reviewee_id",
    "direction",
    "rating_score",
    "category_ratings",
    "comment",
    "is_published",
  ],
  listing_watchlists: ["account_id", "listing_id"],
};

export const FORBIDDEN_TABLES = ["payment_events", "order_deliveries"];

export const FORBIDDEN_COLUMNS: Record<string, string[]> = {
  orders: ["payment_status", "fulfilment_status", "delivery_method", "buyer_confirmation_deadline"],
  seller_profiles: ["delivery_return_info", "payout_provider_ref"],
  offers: ["preferred_fulfilment"],
  multi_unit_offers: ["preferred_fulfilment"],
};

export interface SchemaValidationResult {
  valid: boolean;
  tableCount: number;
  missingTables: string[];
  missingColumns: string[];
  obsoleteTables: string[];
  obsoleteColumns: string[];
  errors: string[];
}

export async function validateDatabaseSchema(
  executor: Connection | Pool = pool,
): Promise<SchemaValidationResult> {
  const [tableRows] = await executor.execute<(RowDataPacket & { name: string })[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
  const existingTables = new Set(tableRows.map((row) => String(row.name)));

  const [columnRows] = await executor.execute<
    (RowDataPacket & { tableName: string; columnName: string })[]
  >(
    "SELECT table_name AS tableName, column_name AS columnName FROM information_schema.columns WHERE table_schema = DATABASE()",
  );

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of columnRows) {
    const cols = columnsByTable.get(row.tableName) ?? new Set<string>();
    cols.add(row.columnName);
    columnsByTable.set(row.tableName, cols);
  }

  const missingTables = REQUIRED_TABLES.filter((name) => !existingTables.has(name));
  const obsoleteTables = FORBIDDEN_TABLES.filter((name) => existingTables.has(name));

  const missingColumns = Object.entries(REQUIRED_COLUMNS).flatMap(([table, required]) => {
    if (!existingTables.has(table)) return [];
    return required
      .filter((column) => !columnsByTable.get(table)?.has(column))
      .map((column) => `${table}.${column}`);
  });

  const obsoleteColumns = Object.entries(FORBIDDEN_COLUMNS).flatMap(([table, forbidden]) => {
    if (!existingTables.has(table)) return [];
    return forbidden
      .filter((column) => columnsByTable.get(table)?.has(column))
      .map((column) => `${table}.${column}`);
  });

  const errors: string[] = [];
  if (missingTables.length > 0) {
    errors.push(`Missing required tables (${missingTables.length}): ${missingTables.join(", ")}`);
  }
  if (obsoleteTables.length > 0) {
    errors.push(`Obsolete deprecated tables still present: ${obsoleteTables.join(", ")}`);
  }
  if (missingColumns.length > 0) {
    errors.push(`Missing required columns (${missingColumns.length}): ${missingColumns.join(", ")}`);
  }
  if (obsoleteColumns.length > 0) {
    errors.push(`Obsolete deprecated columns still present: ${obsoleteColumns.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    tableCount: existingTables.size,
    missingTables,
    missingColumns,
    obsoleteTables,
    obsoleteColumns,
    errors,
  };
}
