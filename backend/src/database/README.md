# Database infrastructure

`pool.ts` exposes the mysql2 pool and transaction helper. `migrate.ts` validates/applies numbered SQL migrations and records them. `seedAdmin.ts` creates or updates the first admin from explicit operator environment variables, hashing the password. Repositories are the only feature layer that should execute SQL. Add schema changes under `backend/migrations`, not inline startup synchronization; CI supplies a disposable MySQL service.

## Migrations and DDL Auto-Commit

Each migration file should be written to be safely re-runnable / idempotent up to its point of failure, or isolate logical DDL changes into separate files.

**Important**: MySQL automatically and implicitly commits transactions upon executing DDL statements (like `CREATE TABLE` or `ALTER TABLE`). Because of this, if a migration file contains multiple DDL statements and a later one fails, the earlier DDL statements in that same file are already permanently applied. The `rollback()` call in `migrate.ts` cannot undo them. 

If a migration fails partially, inspect `schema_migrations` and the actual database tables before re-running. Migrations 018 and 021 use repair-aware compiled handlers because those migrations contain multiple DDL operations and must safely resume after partial application.
