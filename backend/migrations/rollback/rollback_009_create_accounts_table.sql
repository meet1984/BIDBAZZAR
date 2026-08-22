-- Rollback script for Migration 009: Create accounts table
--
-- This script removes the `accounts` table created in migration 009.
-- Legacy data in `users` and related business tables remains unaffected.

DROP TABLE IF EXISTS accounts;
