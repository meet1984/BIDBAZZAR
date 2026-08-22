# Database migrations

Numbered `.sql` files define forward-only MySQL schema changes and the runner records each completed filename in `schema_migrations`. MySQL DDL commits implicitly, so production changes require a tested backup and restore plan. Migration 018 executes a database-enforced conflict guard before its first persistent DDL; its diagnostic queries identify records that must be resolved manually. The `rollback/` files are operator guidance, not automatic rollback scripts. Never rewrite a migration already applied to an environment.
