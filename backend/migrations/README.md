# Database Migrations

`full_database.sql` is the **single consolidated source of truth** for the BidMyLot production database schema.

- Target Database: MySQL 8.0+ (cPanel / MilesWeb compatible)
- Charset: `utf8mb4`
- Collation: `utf8mb4_unicode_ci`
- Storage Engine: `InnoDB`

Historical step-by-step migrations (`001` through `021`) have been archived to the `legacy/` directory for historical reference and are ignored by the application migration runner.

## Commands

- `npm run db:migrate:dry`: Inspects the database and validates the schema against `full_database.sql` without making changes.
- `npm run db:migrate`: Applies `full_database.sql` idempotently using safe `CREATE TABLE IF NOT EXISTS` and `INSERT ... ON DUPLICATE KEY UPDATE` statements, then validates the schema.
- `npm run db:verify-schema`: Verifies that all 33 required tables and operational columns exist in the connected database.
- `node dist/server.js`: Automatically ensures the database connection is alive, applies `full_database.sql`, validates the schema, starts background sweepers, and launches the HTTP API server.
