-- Migration 010: Create buyer profiles, seller profiles expansion, verification documents, decisions, and audit log tables.
-- Non-destructive migration to support separate buyer and seller verification workflows.

-- 1. Create buyer_profiles table
CREATE TABLE IF NOT EXISTS buyer_profiles (
  account_id BIGINT UNSIGNED NOT NULL,
  legal_full_name VARCHAR(150) NOT NULL,
  date_of_birth DATE NULL,
  buyer_type ENUM('individual', 'business') NOT NULL DEFAULT 'individual',
  verified_email VARCHAR(254) NULL,
  verified_phone VARCHAR(30) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  pin_code VARCHAR(20) NULL,
  country VARCHAR(100) NULL,
  government_id_type ENUM('passport', 'drivers_license', 'national_id', 'voter_id', 'ssn_last4', 'tax_id', 'other') NULL,
  masked_government_id_ref VARCHAR(50) NULL,
  business_name VARCHAR(150) NULL,
  gst_number VARCHAR(50) NULL,
  profile_image VARCHAR(500) NULL,
  verification_status ENUM('profile_incomplete', 'draft', 'submitted', 'under_review', 'verified', 'changes_requested', 'rejected', 'suspended') NOT NULL DEFAULT 'profile_incomplete',
  verification_submitted_at DATETIME NULL,
  verification_reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id),
  KEY idx_buyer_profiles_status (verification_status),
  CONSTRAINT fk_buyer_profiles_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Expand seller_profiles table safely
ALTER TABLE seller_profiles
  RENAME COLUMN user_id TO account_id,
  ADD COLUMN legal_name VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN business_name VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN verified_email VARCHAR(254) NULL,
  ADD COLUMN verified_phone VARCHAR(30) NULL,
  ADD COLUMN registered_address_line1 VARCHAR(255) NULL,
  ADD COLUMN registered_address_line2 VARCHAR(255) NULL,
  ADD COLUMN city VARCHAR(100) NULL,
  ADD COLUMN state VARCHAR(100) NULL,
  ADD COLUMN pin_code VARCHAR(20) NULL,
  ADD COLUMN country VARCHAR(100) NULL,
  ADD COLUMN pan_gst_ref VARCHAR(50) NULL,
  ADD COLUMN business_registration_info TEXT NULL,
  ADD COLUMN product_categories JSON NULL,
  ADD COLUMN public_business_description TEXT NULL,
  ADD COLUMN profile_logo VARCHAR(500) NULL,
  ADD COLUMN delivery_return_info TEXT NULL,
  ADD COLUMN payout_provider_ref VARCHAR(100) NULL,
  ADD COLUMN verification_status ENUM('profile_incomplete', 'draft', 'submitted', 'under_review', 'verified', 'changes_requested', 'rejected', 'suspended') NOT NULL DEFAULT 'profile_incomplete',
  ADD COLUMN verification_submitted_at DATETIME NULL,
  ADD COLUMN verification_reviewed_at DATETIME NULL,
  ADD COLUMN rejection_reason TEXT NULL;

-- Populate legal_name and business_name from legacy seller_name if empty
UPDATE seller_profiles 
SET legal_name = seller_name, business_name = seller_name 
WHERE (legal_name = '' OR legal_name IS NULL) AND seller_name IS NOT NULL AND seller_name != '';

-- 3. Create verification_documents table (metadata only, no raw file paths)
CREATE TABLE IF NOT EXISTS verification_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL,
  account_type ENUM('buyer', 'seller') NOT NULL,
  document_type ENUM('government_id', 'address_proof', 'business_registration', 'tax_certificate', 'other') NOT NULL,
  file_key VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_mime VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_verification_docs_key (file_key),
  KEY idx_verification_docs_account (account_id, account_type),
  CONSTRAINT fk_verification_docs_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create verification_decisions table
CREATE TABLE IF NOT EXISTS verification_decisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL,
  account_type ENUM('buyer', 'seller') NOT NULL,
  reviewer_account_id BIGINT UNSIGNED NOT NULL,
  action ENUM('approve', 'reject', 'request_changes', 'suspend') NOT NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_verification_decisions_account (account_id, account_type, created_at DESC),
  CONSTRAINT fk_verification_decisions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_verification_decisions_reviewer FOREIGN KEY (reviewer_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create verification_audit_log table
CREATE TABLE IF NOT EXISTS verification_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_account_id BIGINT UNSIGNED NOT NULL,
  target_account_id BIGINT UNSIGNED NOT NULL,
  account_type ENUM('buyer', 'seller') NOT NULL,
  action VARCHAR(50) NOT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_verif_audit_target (target_account_id, account_type, created_at DESC),
  KEY idx_verif_audit_actor (actor_account_id, created_at DESC),
  CONSTRAINT fk_verif_audit_actor FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_verif_audit_target FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Populate default buyer profiles for existing buyer accounts with verification_status = 'profile_incomplete'
INSERT INTO buyer_profiles (account_id, legal_full_name, buyer_type, verification_status, created_at, updated_at)
SELECT a.id, a.full_name, 'individual', 'profile_incomplete', a.created_at, a.updated_at
FROM accounts a
WHERE a.account_type = 'buyer'
ON DUPLICATE KEY UPDATE account_id = account_id;

-- 7. Ensure default seller profiles for existing seller accounts with verification_status = 'profile_incomplete'
INSERT INTO seller_profiles (account_id, legal_name, business_name, seller_name, seller_type, verification_status, created_at, updated_at)
SELECT a.id, a.full_name, a.full_name, a.full_name, 'individual', 'profile_incomplete', a.created_at, a.updated_at
FROM accounts a
WHERE a.account_type = 'seller'
ON DUPLICATE KEY UPDATE verification_status = IF(verification_status IS NULL OR verification_status = '', 'profile_incomplete', verification_status);
