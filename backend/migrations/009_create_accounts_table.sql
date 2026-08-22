-- Migration 009: Create accounts table and migrate authentication data
--
-- This migration introduces the shared `accounts` table to separate account-level
-- authentication and identity from role-specific business profiles and features.
-- Legacy columns in `users` are preserved for backward compatibility and non-destructive operations.

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_type ENUM('buyer', 'seller', 'admin', 'admin_employee') NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NULL,
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  accepted_terms_at DATETIME NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  migration_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_email (email),
  KEY idx_accounts_type_status (account_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate user accounts into the accounts table while preserving exact primary key IDs.
-- Flag dual-role (ambiguous) accounts with migration_review_required = TRUE.
INSERT INTO accounts (
  id,
  account_type,
  email,
  password_hash,
  full_name,
  phone,
  status,
  accepted_terms_at,
  marketing_consent,
  migration_review_required,
  created_at,
  updated_at
)
SELECT
  u.id,
  CASE
    WHEN u.role = 'admin' THEN 'admin'
    WHEN (u.is_buyer = TRUE AND u.is_seller = TRUE) OR u.role = 'both' THEN
      CASE
        WHEN EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.user_id = u.id) THEN 'seller'
        ELSE 'buyer'
      END
    WHEN u.is_seller = TRUE OR u.role = 'seller' THEN 'seller'
    ELSE 'buyer'
  END AS account_type,
  u.email,
  u.password_hash,
  u.full_name,
  u.phone,
  u.status,
  u.accepted_terms_at,
  u.marketing_consent,
  CASE
    WHEN (u.is_buyer = TRUE AND u.is_seller = TRUE) OR u.role = 'both' THEN TRUE
    ELSE FALSE
  END AS migration_review_required,
  u.created_at,
  u.updated_at
FROM users u
ON DUPLICATE KEY UPDATE
  account_type = VALUES(account_type),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  full_name = VALUES(full_name),
  phone = VALUES(phone),
  status = VALUES(status),
  accepted_terms_at = VALUES(accepted_terms_at),
  marketing_consent = VALUES(marketing_consent),
  migration_review_required = VALUES(migration_review_required),
  updated_at = VALUES(updated_at);
