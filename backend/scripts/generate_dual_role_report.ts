import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

interface DualRoleRow {
  id: number;
  email: string;
  full_name: string;
  legacy_role: string;
  is_buyer: number;
  is_seller: number;
  assigned_account_type: string;
  migration_review_required: number;
  has_seller_profile: number;
  auctions_count: number;
  bids_count: number;
  watchlist_count: number;
  created_at: string;
}

export async function generateDualRoleReport() {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    ...(env.DB_PORT ? { port: env.DB_PORT } : {}),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    timezone: "Z",
  });

  try {
    console.log("=================================================");
    console.log("  DUAL-ROLE ACCOUNT MIGRATION AUDIT REPORT");
    console.log("=================================================\n");

    // Check if accounts table exists
    const [tables] = await connection.query<mysql.RowDataPacket[]>(
      "SHOW TABLES LIKE 'accounts'"
    );
    if (tables.length === 0) {
      console.log("[!] Warning: 'accounts' table does not exist. Please run migrations first.");
      return;
    }

    const [rows] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role AS legacy_role,
        u.is_buyer,
        u.is_seller,
        a.account_type AS assigned_account_type,
        a.migration_review_required,
        (SELECT COUNT(*) FROM seller_profiles sp WHERE sp.user_id = u.id) > 0 AS has_seller_profile,
        (SELECT COUNT(*) FROM auctions auc WHERE auc.seller_id = u.id) AS auctions_count,
        (SELECT COUNT(*) FROM bids b WHERE b.bidder_id = u.id) AS bids_count,
        (SELECT COUNT(*) FROM watchlists w WHERE w.user_id = u.id) AS watchlist_count,
        a.created_at
      FROM users u
      JOIN accounts a ON a.id = u.id
      WHERE a.migration_review_required = TRUE OR (u.is_buyer = 1 AND u.is_seller = 1) OR u.role = 'both'
      ORDER BY u.id ASC
    `);

    const flaggedAccounts = rows as unknown as DualRoleRow[];

    const [totalAccountsRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM accounts"
    );
    const totalAccounts = Number(totalAccountsRows[0]?.total ?? 0);

    console.log(`Total Accounts in Database: ${totalAccounts}`);
    console.log(`Flagged Dual-Role Accounts Requiring Review: ${flaggedAccounts.length}\n`);

    if (flaggedAccounts.length === 0) {
      console.log("✓ No dual-role / ambiguous accounts were found requiring manual review.");
      console.log("✓ All migrated accounts have explicit, single account types.\n");
      return;
    }

    console.log("| ID | Email | Name | Legacy Role | Assigned Type | Review Flag | Seller Profile | Auctions | Bids | Watchlist |");
    console.log("|---|---|---|---|---|---|---|---|---|---|");
    for (const acc of flaggedAccounts) {
      console.log(
        `| ${acc.id} | ${acc.email} | ${acc.full_name} | ${acc.legacy_role} (b:${acc.is_buyer}, s:${acc.is_seller}) | ${acc.assigned_account_type} | ${acc.migration_review_required ? "YES" : "NO"} | ${acc.has_seller_profile ? "Yes" : "No"} | ${acc.auctions_count} | ${acc.bids_count} | ${acc.watchlist_count} |`
      );
    }

    console.log("\n-------------------------------------------------");
    console.log("RECOMMENDED ADMIN ACTION:");
    console.log("Dual-role accounts have been preserved without auto-deletion.");
    console.log("The primary account_type was provisionally assigned based on seller profile presence.");
    console.log("Administrators can review and convert or split flagged accounts as needed.");
    console.log("-------------------------------------------------\n");

  } finally {
    await connection.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("generate_dual_role_report.ts")) {
  generateDualRoleReport().catch((err) => {
    console.error("Failed to generate dual-role report:", err);
    process.exitCode = 1;
  });
}
