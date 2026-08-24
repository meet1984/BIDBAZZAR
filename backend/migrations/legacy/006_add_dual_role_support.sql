-- Migration: Add dual role support (is_buyer, is_seller) to users table.
--
-- NOTE ON `role` COLUMN:
-- The `role` column is retained for backward compatibility and to explicitly flag admin accounts ('admin').
-- For non-admin accounts, capability is now governed by the boolean flags `is_buyer` and `is_seller`.

ALTER TABLE users
  ADD COLUMN is_buyer BOOLEAN NOT NULL DEFAULT FALSE AFTER role,
  ADD COLUMN is_seller BOOLEAN NOT NULL DEFAULT FALSE AFTER is_buyer;

UPDATE users SET is_buyer = TRUE WHERE role = 'buyer';
UPDATE users SET is_seller = TRUE WHERE role = 'seller';

ALTER TABLE users
  ADD CONSTRAINT chk_users_admin_capabilities CHECK (
    NOT (role = 'admin' AND (is_buyer = TRUE OR is_seller = TRUE))
  );
