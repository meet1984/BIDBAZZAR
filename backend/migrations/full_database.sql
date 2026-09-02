-- ==============================================================================
-- BidMyLot Consolidated Production Database Initialization
-- ==============================================================================
-- Target Engine: MySQL 8.0+ (cPanel / MilesWeb compatible)
-- Character Set: utf8mb4
-- Collation:     utf8mb4_unicode_ci
-- Storage:       InnoDB
-- Description:   Complete standalone schema initialization script combining
--                all baseline, feature, repair, and cleanup migrations (001-021).
-- ==============================================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

-- ------------------------------------------------------------------------------
-- 1. Schema Migration History
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `filename` VARCHAR(255) NOT NULL,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. System Settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Legacy Users Table (Preserved for compatibility)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role` ENUM('buyer', 'seller', 'admin') NOT NULL,
  `is_buyer` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_seller` BOOLEAN NOT NULL DEFAULT FALSE,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  `accepted_terms_at` DATETIME NOT NULL,
  `marketing_consent` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role_status` (`role`, `status`),
  CONSTRAINT `chk_users_admin_capabilities` CHECK (
    NOT (`role` = 'admin' AND (`is_buyer` = TRUE OR `is_seller` = TRUE))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Accounts Table (Primary Authentication & Identity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_type` ENUM('buyer', 'seller', 'admin', 'admin_employee') NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  `accepted_terms_at` DATETIME NOT NULL,
  `marketing_consent` BOOLEAN NOT NULL DEFAULT FALSE,
  `migration_review_required` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_accounts_email` (`email`),
  KEY `idx_accounts_type_status` (`account_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Buyer Profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `buyer_profiles` (
  `account_id` BIGINT UNSIGNED NOT NULL,
  `legal_full_name` VARCHAR(150) NOT NULL,
  `date_of_birth` DATE NULL,
  `buyer_type` ENUM('individual', 'business') NOT NULL DEFAULT 'individual',
  `verified_email` VARCHAR(254) NULL,
  `verified_phone` VARCHAR(30) NULL,
  `address_line1` VARCHAR(255) NULL,
  `address_line2` VARCHAR(255) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pin_code` VARCHAR(20) NULL,
  `country` VARCHAR(100) NULL,
  `government_id_type` ENUM('passport', 'drivers_license', 'national_id', 'voter_id', 'ssn_last4', 'tax_id', 'other') NULL,
  `masked_government_id_ref` VARCHAR(50) NULL,
  `business_name` VARCHAR(150) NULL,
  `gst_number` VARCHAR(50) NULL,
  `profile_image` VARCHAR(500) NULL,
  `verification_status` ENUM('profile_incomplete', 'draft', 'submitted', 'under_review', 'verified', 'changes_requested', 'rejected', 'suspended') NOT NULL DEFAULT 'profile_incomplete',
  `verification_submitted_at` DATETIME NULL,
  `verification_reviewed_at` DATETIME NULL,
  `rejection_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`account_id`),
  KEY `idx_buyer_profiles_status` (`verification_status`),
  CONSTRAINT `fk_buyer_profiles_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Seller Profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `seller_profiles` (
  `account_id` BIGINT UNSIGNED NOT NULL,
  `seller_name` VARCHAR(120) NOT NULL DEFAULT '',
  `legal_name` VARCHAR(150) NOT NULL DEFAULT '',
  `business_name` VARCHAR(150) NOT NULL DEFAULT '',
  `seller_type` ENUM('individual', 'business', 'distributor') NOT NULL DEFAULT 'individual',
  `verified_email` VARCHAR(254) NULL,
  `verified_phone` VARCHAR(30) NULL,
  `registered_address_line1` VARCHAR(255) NULL,
  `registered_address_line2` VARCHAR(255) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pin_code` VARCHAR(20) NULL,
  `country` VARCHAR(100) NULL,
  `pan_gst_ref` VARCHAR(50) NULL,
  `business_registration_info` TEXT NULL,
  `product_categories` JSON NULL,
  `public_business_description` TEXT NULL,
  `profile_logo` VARCHAR(500) NULL,
  `verification_status` ENUM('profile_incomplete', 'draft', 'submitted', 'under_review', 'verified', 'changes_requested', 'rejected', 'suspended') NOT NULL DEFAULT 'profile_incomplete',
  `verification_submitted_at` DATETIME NULL,
  `verification_reviewed_at` DATETIME NULL,
  `rejection_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`account_id`),
  KEY `idx_seller_profiles_status` (`verification_status`),
  CONSTRAINT `fk_seller_profiles_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Verification Documents (Metadata only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `verification_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `account_type` ENUM('buyer', 'seller') NOT NULL,
  `document_type` ENUM('government_id', 'address_proof', 'business_registration', 'tax_certificate', 'other') NOT NULL,
  `file_key` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_mime` VARCHAR(100) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_verification_docs_key` (`file_key`),
  KEY `idx_verification_docs_account` (`account_id`, `account_type`),
  CONSTRAINT `fk_verification_docs_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. Verification Decisions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `verification_decisions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `account_type` ENUM('buyer', 'seller') NOT NULL,
  `reviewer_account_id` BIGINT UNSIGNED NOT NULL,
  `action` ENUM('approve', 'reject', 'request_changes', 'suspend') NOT NULL,
  `reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_verification_decisions_account` (`account_id`, `account_type`, `created_at` DESC),
  CONSTRAINT `fk_verification_decisions_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_verification_decisions_reviewer` FOREIGN KEY (`reviewer_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. Verification Audit Log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `verification_audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_account_id` BIGINT UNSIGNED NOT NULL,
  `target_account_id` BIGINT UNSIGNED NOT NULL,
  `account_type` ENUM('buyer', 'seller') NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `metadata` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_verif_audit_target` (`target_account_id`, `account_type`, `created_at` DESC),
  KEY `idx_verif_audit_actor` (`actor_account_id`, `created_at` DESC),
  CONSTRAINT `fk_bml18_verif_actor` FOREIGN KEY (`actor_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bml18_verif_target` FOREIGN KEY (`target_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. Refresh Tokens (Session families & token replay prevention)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` CHAR(36) NOT NULL,
  `family_id` CHAR(36) NOT NULL,
  `parent_token_id` CHAR(36) NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `remember_me` BOOLEAN NOT NULL DEFAULT FALSE,
  `revoked_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_tokens_hash` (`token_hash`),
  KEY `idx_refresh_tokens_account_expiry` (`account_id`, `expires_at`),
  KEY `idx_refresh_tokens_family` (`family_id`, `revoked_at`),
  KEY `idx_refresh_tokens_parent` (`parent_token_id`),
  CONSTRAINT `fk_refresh_tokens_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_refresh_tokens_parent` FOREIGN KEY (`parent_token_id`) REFERENCES `refresh_tokens` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 11. Login OTP Challenges
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_otp_challenges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `challenge_token` CHAR(64) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `remember_me` BOOLEAN NOT NULL DEFAULT FALSE,
  `consumed_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_login_otp_challenge_token` (`challenge_token`),
  KEY `idx_login_otp_account_expires` (`account_id`, `expires_at`),
  CONSTRAINT `fk_login_otp_challenges_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 12. Password Reset Tokens
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` CHAR(36) NOT NULL,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_reset_token_hash` (`token_hash`),
  KEY `idx_password_reset_account_active` (`account_id`, `used_at`, `expires_at`),
  CONSTRAINT `fk_password_reset_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 13. Marketplace Categories
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `image_url` VARCHAR(500) NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  KEY `idx_categories_order_active` (`display_order`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 14. Marketplace Subcategories
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subcategories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subcategories_slug` (`slug`),
  KEY `idx_subcategories_category_order` (`category_id`, `display_order`, `is_active`),
  CONSTRAINT `fk_subcategories_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 15. Legacy Auctions Table (Preserved for compatibility)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `auctions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `lot_number` VARCHAR(30) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `description` TEXT NOT NULL,
  `item_condition` ENUM('new', 'like-new', 'used', 'refurbished') NOT NULL,
  `location` VARCHAR(120) NOT NULL,
  `image_url` MEDIUMTEXT NULL,
  `starting_price` DECIMAL(15,2) NOT NULL,
  `current_bid` DECIMAL(15,2) NULL,
  `minimum_increment` DECIMAL(15,2) NOT NULL DEFAULT 100.00,
  `bid_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `starts_at` DATETIME NOT NULL,
  `ends_at` DATETIME NOT NULL,
  `status` ENUM('draft', 'pending', 'approved', 'rejected', 'closed', 'changes_requested') NOT NULL DEFAULT 'draft',
  `review_notes` VARCHAR(1000) NULL,
  `reviewed_by` BIGINT UNSIGNED NULL,
  `reviewed_at` DATETIME NULL,
  `winner_id` BIGINT UNSIGNED NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auctions_slug` (`slug`),
  UNIQUE KEY `uq_auctions_lot_number` (`lot_number`),
  KEY `idx_auctions_public` (`status`, `starts_at`, `ends_at`, `deleted_at`),
  KEY `idx_auctions_seller` (`seller_id`, `status`, `created_at`),
  CONSTRAINT `fk_auctions_seller` FOREIGN KEY (`seller_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_auctions_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_auctions_winner` FOREIGN KEY (`winner_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_auction_prices` CHECK (
    `starting_price` >= 0 AND `minimum_increment` > 0 AND
    (`current_bid` IS NULL OR `current_bid` >= `starting_price`)
  ),
  CONSTRAINT `chk_auction_schedule` CHECK (`ends_at` > `starts_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 16. Legacy Bids Table (Preserved for compatibility)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bids` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `auction_id` BIGINT UNSIGNED NOT NULL,
  `bidder_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_bids_auction_amount` (`auction_id`, `amount` DESC, `id` DESC),
  KEY `idx_bids_bidder_created` (`bidder_id`, `created_at` DESC),
  CONSTRAINT `fk_bids_auction` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bids_bidder` FOREIGN KEY (`bidder_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_bid_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 17. Legacy Watchlists Table (Preserved for compatibility)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `watchlists` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `auction_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `auction_id`),
  KEY `idx_watchlists_auction` (`auction_id`),
  CONSTRAINT `fk_watchlists_user` FOREIGN KEY (`user_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_watchlists_auction` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 18. Marketplace Listings (Negotiated Offer & Multi-Unit Offer)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `listings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `subcategory_id` BIGINT UNSIGNED NULL,
  `sale_mode` ENUM('negotiated_offer', 'multi_unit_offer') NOT NULL DEFAULT 'negotiated_offer',
  `title` VARCHAR(180) NOT NULL,
  `description` TEXT NOT NULL,
  `condition` ENUM('new', 'like-new', 'used', 'refurbished') NOT NULL,
  `location` VARCHAR(120) NOT NULL,
  `asking_price` DECIMAL(15,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `offer_selection_deadline` DATETIME NULL,
  `public_slug` VARCHAR(180) NOT NULL,
  `listing_reference` VARCHAR(30) NOT NULL,
  `review_status` ENUM(
    'draft',
    'submitted',
    'under_review',
    'approved',
    'scheduled',
    'open',
    'offer_selection',
    'sold',
    'partially_sold',
    'unsold',
    'completed',
    'changes_requested',
    'rejected',
    'cancelled',
    'suspended',
    'expired'
  ) NOT NULL DEFAULT 'draft',
  `review_notes` TEXT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,

  -- Multi-unit offer specific fields
  `total_quantity` INT UNSIGNED NULL,
  `unit_name` VARCHAR(50) NULL,
  `asking_price_per_unit` DECIMAL(15,2) NULL,
  `min_order_quantity` INT UNSIGNED NULL,
  `max_order_quantity` INT UNSIGNED NULL,
  `quantity_increment` INT UNSIGNED NULL DEFAULT 1,
  `allow_partial_allocation` BOOLEAN NOT NULL DEFAULT TRUE,
  `min_acceptable_unit_price` DECIMAL(15,2) NULL,
  `offer_start_time` DATETIME NULL,
  `offer_end_time` DATETIME NULL,
  `buyer_confirmation_deadline_hours` INT UNSIGNED NOT NULL DEFAULT 48,

  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_listings_public_slug` (`public_slug`),
  UNIQUE KEY `uq_listings_reference` (`listing_reference`),
  KEY `idx_listings_public` (`review_status`, `start_time`, `end_time`, `deleted_at`),
  KEY `idx_listings_seller` (`seller_id`, `review_status`, `created_at`),
  KEY `idx_listings_category_sub` (`category_id`, `subcategory_id`, `review_status`),
  CONSTRAINT `fk_listings_seller` FOREIGN KEY (`seller_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_listings_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_listings_subcategory` FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_listing_schedule` CHECK (`end_time` > `start_time`),
  CONSTRAINT `chk_asking_price` CHECK (`asking_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 19. Listing Images
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `listing_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `display_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_listing_images_listing_order` (`listing_id`, `display_order`),
  CONSTRAINT `fk_listing_images_listing` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 20. Listing Watchlists (Marketplace direct-deal watchlists)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `listing_watchlists` (
  `account_id` BIGINT UNSIGNED NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`account_id`, `listing_id`),
  KEY `idx_listing_watchlists_listing` (`listing_id`),
  CONSTRAINT `fk_bml18_watch_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bml18_watch_listing` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 21. Listing Audit Log (Admin Listing Moderation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `listing_audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_account_id` BIGINT UNSIGNED NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `action` ENUM('approve', 'reject', 'request_changes', 'admin_update', 'cancel', 'suspend') NOT NULL,
  `reason` TEXT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_listing_audit_listing` (`listing_id`, `created_at` DESC),
  KEY `idx_listing_audit_actor` (`actor_account_id`, `created_at` DESC),
  CONSTRAINT `fk_bml18_listing_actor` FOREIGN KEY (`actor_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bml18_listing_target` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 22. Offers (Negotiated Offers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `offers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `buyer_id` BIGINT UNSIGNED NOT NULL,
  `offered_amount` DECIMAL(15,2) NOT NULL,
  `counter_amount` DECIMAL(15,2) NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `buyer_message` TEXT NULL,
  `seller_message` TEXT NULL,
  `offer_expiry` DATETIME NULL,
  `status` ENUM(
    'submitted',
    'revised',
    'withdrawn',
    'shortlisted',
    'contact_requested',
    'countered',
    'accepted_pending_buyer',
    'buyer_confirmed',
    'buyer_declined',
    'rejected',
    'expired',
    'cancelled'
  ) NOT NULL DEFAULT 'submitted',
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `active_buyer_listing` VARCHAR(90) GENERATED ALWAYS AS (
    CASE WHEN `status` IN (
      'submitted','revised','shortlisted','contact_requested','countered','accepted_pending_buyer'
    ) THEN CONCAT(`listing_id`, ':', `buyer_id`) ELSE NULL END
  ) STORED,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_offers_active_buyer_listing` (`active_buyer_listing`),
  KEY `idx_offers_listing_status` (`listing_id`, `status`, `created_at`),
  KEY `idx_offers_buyer_status` (`buyer_id`, `status`, `created_at`),
  CONSTRAINT `fk_offers_listing` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_offers_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_offered_amount` CHECK (`offered_amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 23. Multi-Unit Offers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `multi_unit_offers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `buyer_id` BIGINT UNSIGNED NOT NULL,
  `quantity_requested` INT UNSIGNED NOT NULL,
  `offered_price_per_unit` DECIMAL(15,2) NOT NULL,
  `total_offer_value` DECIMAL(15,2) NOT NULL,
  `buyer_message` TEXT NULL,
  `offer_expiry` DATETIME NULL,
  `counter_quantity` INT UNSIGNED NULL,
  `counter_unit_price` DECIMAL(15,2) NULL,
  `seller_message` TEXT NULL,
  `status` ENUM(
    'submitted',
    'revised',
    'shortlisted',
    'countered',
    'allocation_proposed',
    'allocation_reserved',
    'confirmed',
    'declined',
    'expired',
    'rejected',
    'cancelled'
  ) NOT NULL DEFAULT 'submitted',
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `active_buyer_listing` VARCHAR(90) GENERATED ALWAYS AS (
    CASE WHEN `status` IN (
      'submitted','revised','shortlisted','countered','allocation_proposed','allocation_reserved'
    ) THEN CONCAT(`listing_id`, ':', `buyer_id`) ELSE NULL END
  ) STORED,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_multi_offers_active_buyer_listing` (`active_buyer_listing`),
  KEY `idx_multi_unit_offers_listing_status` (`listing_id`, `status`, `created_at`),
  KEY `idx_multi_unit_offers_buyer_status` (`buyer_id`, `status`, `created_at`),
  CONSTRAINT `fk_multi_unit_offers_listing` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_multi_unit_offers_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_multi_unit_quantity_requested` CHECK (`quantity_requested` > 0),
  CONSTRAINT `chk_multi_unit_offered_price` CHECK (`offered_price_per_unit` > 0),
  CONSTRAINT `chk_multi_offer_total` CHECK (`total_offer_value` = `quantity_requested` * `offered_price_per_unit`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 24. Multi-Unit Allocations (Inventory Reservations & Commitments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `multi_unit_allocations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `offer_id` BIGINT UNSIGNED NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `buyer_id` BIGINT UNSIGNED NOT NULL,
  `allocated_quantity` INT UNSIGNED NOT NULL,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `total_allocation_value` DECIMAL(15,2) NOT NULL,
  `status` ENUM(
    'proposed',
    'reserved',
    'confirmed',
    'released',
    'cancelled',
    'expired'
  ) NOT NULL DEFAULT 'proposed',
  `reserved_until` DATETIME NULL,
  `confirmed_at` DATETIME NULL,
  `released_at` DATETIME NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_multi_unit_alloc_listing_status` (`listing_id`, `status`, `created_at`),
  KEY `idx_multi_unit_alloc_offer` (`offer_id`),
  KEY `idx_multi_unit_alloc_buyer_status` (`buyer_id`, `status`, `created_at`),
  CONSTRAINT `fk_multi_unit_alloc_offer` FOREIGN KEY (`offer_id`) REFERENCES `multi_unit_offers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_multi_unit_alloc_listing` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_multi_unit_alloc_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_multi_unit_allocated_qty` CHECK (`allocated_quantity` > 0),
  CONSTRAINT `chk_multi_unit_alloc_unit_price` CHECK (`unit_price` > 0),
  CONSTRAINT `chk_multi_allocation_total` CHECK (`total_allocation_value` = `allocated_quantity` * `unit_price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 25. Orders (Direct-Deal Orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_reference` VARCHAR(50) NOT NULL,
  `buyer_id` BIGINT UNSIGNED NOT NULL,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `listing_id` BIGINT UNSIGNED NOT NULL,
  `source_type` ENUM('negotiated_offer', 'multi_unit_allocation') NOT NULL,
  `source_offer_id` BIGINT UNSIGNED NULL,
  `source_allocation_id` BIGINT UNSIGNED NULL,
  `source_reference` VARCHAR(100) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `total_amount` DECIMAL(15,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `order_status` ENUM(
    'confirmed',
    'completed',
    'cancelled',
    'disputed',
    'resolved',
    'failed'
  ) NOT NULL DEFAULT 'confirmed',
  `buyer_completed_at` DATETIME NULL,
  `seller_completed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_reference` (`order_reference`),
  UNIQUE KEY `uq_orders_source_ref` (`source_reference`),
  KEY `idx_orders_buyer_status` (`buyer_id`, `order_status`, `created_at`),
  KEY `idx_orders_seller_status` (`seller_id`, `order_status`, `created_at`),
  KEY `idx_orders_listing` (`listing_id`),
  KEY `idx_orders_status` (`order_status`),
  CONSTRAINT `fk_orders_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_seller` FOREIGN KEY (`seller_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_listing` FOREIGN KEY (`listing_id`) REFERENCES `listings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_source_offer` FOREIGN KEY (`source_offer_id`) REFERENCES `offers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_source_allocation` FOREIGN KEY (`source_allocation_id`) REFERENCES `multi_unit_allocations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_orders_quantity` CHECK (`quantity` > 0),
  CONSTRAINT `chk_orders_unit_price` CHECK (`unit_price` >= 0),
  CONSTRAINT `chk_orders_total_amount` CHECK (`total_amount` >= 0),
  CONSTRAINT `chk_orders_source_identity` CHECK (
    (`source_type` = 'negotiated_offer' AND `source_offer_id` IS NOT NULL AND `source_allocation_id` IS NULL)
    OR
    (`source_type` = 'multi_unit_allocation' AND `source_offer_id` IS NULL AND `source_allocation_id` IS NOT NULL)
  ),
  CONSTRAINT `chk_orders_total_consistency` CHECK (`total_amount` = `quantity` * `unit_price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 26. Disputes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `disputes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `dispute_reference` VARCHAR(50) NOT NULL,
  `opened_by_account_id` BIGINT UNSIGNED NOT NULL,
  `reason` ENUM(
    'item_not_received',
    'item_damaged',
    'not_as_described',
    'seller_unresponsive',
    'buyer_unresponsive',
    'other'
  ) NOT NULL,
  `details` TEXT NOT NULL,
  `status` ENUM(
    'opened',
    'under_review',
    'resolved_buyer_favour',
    'resolved_seller_favour',
    'resolved_compromise',
    'closed'
  ) NOT NULL DEFAULT 'opened',
  `resolution_notes` TEXT NULL,
  `resolved_by_account_id` BIGINT UNSIGNED NULL,
  `resolved_at` DATETIME NULL,
  `active_order_key` BIGINT UNSIGNED GENERATED ALWAYS AS (
    CASE WHEN `status` IN ('opened', 'under_review') THEN `order_id` ELSE NULL END
  ) STORED,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_disputes_reference` (`dispute_reference`),
  UNIQUE KEY `uq_disputes_one_active_order` (`active_order_key`),
  KEY `idx_disputes_order` (`order_id`),
  KEY `idx_disputes_opened_by` (`opened_by_account_id`),
  KEY `idx_disputes_status` (`status`),
  CONSTRAINT `fk_disputes_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_disputes_opened_by` FOREIGN KEY (`opened_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_disputes_resolved_by` FOREIGN KEY (`resolved_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 27. Reviews (Bidirectional Trust Profile)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `reviewer_id` BIGINT UNSIGNED NOT NULL,
  `reviewee_id` BIGINT UNSIGNED NOT NULL,
  `direction` ENUM('buyer_to_seller', 'seller_to_buyer') NOT NULL,
  `rating_score` DECIMAL(3,2) NOT NULL,
  `category_ratings` JSON NOT NULL,
  `comment` TEXT NOT NULL,
  `is_published` BOOLEAN NOT NULL DEFAULT TRUE,
  `hidden_reason` TEXT NULL,
  `hidden_by_account_id` BIGINT UNSIGNED NULL,
  `hidden_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_review_direction` (`order_id`, `direction`),
  KEY `idx_reviews_reviewer` (`reviewer_id`),
  KEY `idx_reviews_reviewee` (`reviewee_id`, `is_published`, `created_at`),
  CONSTRAINT `fk_reviews_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_reviews_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_reviews_reviewee` FOREIGN KEY (`reviewee_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_reviews_hidden_by` FOREIGN KEY (`hidden_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_reviews_rating_score` CHECK (`rating_score` >= 1.00 AND `rating_score` <= 5.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 28. Review Reports
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `review_reports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `review_id` BIGINT UNSIGNED NOT NULL,
  `reporter_id` BIGINT UNSIGNED NOT NULL,
  `reason` ENUM(
    'offensive_language',
    'spam',
    'false_information',
    'harassment',
    'privacy_violation',
    'other'
  ) NOT NULL,
  `details` TEXT NULL,
  `status` ENUM('pending', 'reviewed', 'dismissed', 'action_taken') NOT NULL DEFAULT 'pending',
  `reviewed_by_account_id` BIGINT UNSIGNED NULL,
  `reviewed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_reports_reporter` (`review_id`, `reporter_id`),
  KEY `idx_review_reports_review` (`review_id`),
  KEY `idx_review_reports_reporter` (`reporter_id`),
  KEY `idx_review_reports_status` (`status`),
  CONSTRAINT `fk_review_reports_review` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_review_reports_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_review_reports_reviewer` FOREIGN KEY (`reviewed_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 29. Admin Permissions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` BIGINT UNSIGNED NOT NULL,
  `permission` ENUM(
    'verification_review',
    'listing_review',
    'support_management',
    'order_oversight',
    'dispute_management',
    'review_moderation',
    'category_management'
  ) NOT NULL,
  `granted_by_account_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_account_permission` (`account_id`, `permission`),
  KEY `idx_admin_permissions_account` (`account_id`),
  CONSTRAINT `fk_admin_permissions_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_admin_permissions_granter` FOREIGN KEY (`granted_by_account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 30. Append-Only Audit Log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_account_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_entity` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(100) NOT NULL,
  `reason` TEXT NULL,
  `metadata` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_log_actor` (`actor_account_id`, `created_at` DESC),
  KEY `idx_audit_log_target` (`target_entity`, `target_id`, `created_at` DESC),
  KEY `idx_audit_log_action` (`action`, `created_at` DESC),
  CONSTRAINT `fk_bml18_audit_actor_account` FOREIGN KEY (`actor_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 31. Notifications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipient_account_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `payload` JSON NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `read_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_recipient` (`recipient_account_id`, `is_read`, `created_at` DESC),
  CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient_account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 32. Support Enquiries
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `support_enquiries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference` VARCHAR(30) NOT NULL,
  `account_id` BIGINT UNSIGNED NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `contact_role` ENUM('buyer', 'seller', 'visitor', 'other') NOT NULL,
  `reason` VARCHAR(40) NOT NULL,
  `subject` VARCHAR(120) NOT NULL,
  `auction_reference` VARCHAR(60) NULL,
  `message` TEXT NOT NULL,
  `attachment_path` VARCHAR(500) NULL,
  `attachment_name` VARCHAR(255) NULL,
  `attachment_mime` VARCHAR(100) NULL,
  `status` ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_support_enquiries_reference` (`reference`),
  KEY `idx_support_enquiries_status_created` (`status`, `created_at` DESC),
  CONSTRAINT `fk_bml18_support_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 33. Newsletter Subscriptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `newsletter_subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(254) NOT NULL,
  `status` ENUM('subscribed', 'unsubscribed') NOT NULL DEFAULT 'subscribed',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_newsletter_subscriptions_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 34. Legal Pages (Terms & Conditions, Privacy Policy)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `legal_pages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` ENUM('terms', 'privacy') NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content_html` LONGTEXT NOT NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_legal_pages_slug` (`slug`),
  KEY `idx_legal_pages_updated_by` (`updated_by`),
  CONSTRAINT `fk_legal_pages_updated_by_account` FOREIGN KEY (`updated_by`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- DEFAULT SEED DATA (Safe / Idempotent)
-- ==============================================================================

-- 1. System Settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`)
VALUES ('how_it_works_banner_url', '/hero-auction-marketplace.png')
ON DUPLICATE KEY UPDATE `setting_value` = `setting_value`;

-- 2. Categories
INSERT INTO `categories` (`id`, `name`, `slug`, `description`, `display_order`, `is_active`) VALUES
(1, 'Electronics & Tech', 'electronics', 'Cameras, audio, computing and devices', 1, TRUE),
(2, 'Automotive & Vehicles', 'vehicles', 'Inspected cars, motorcycles and commercial vehicles', 2, TRUE),
(3, 'Antiques & Collectibles', 'collectibles', 'Art, coins, memorabilia and rare finds', 3, TRUE),
(4, 'Fashion & Luxury', 'fashion-luxury', 'Luxury apparel, bags and designer items', 4, TRUE),
(5, 'Jewelry & Watches', 'jewelry-watches', 'Fine jewelry, watches and precious gems', 5, TRUE),
(6, 'Industrial & Equipment', 'industrial-equipment', 'Machinery, tools and business assets', 6, TRUE),
(7, 'Home & Lifestyle', 'home-lifestyle', 'Furniture, décor and home appliances', 7, TRUE),
(8, 'Art & Paintings', 'art-paintings', 'Original paintings, sculptures and fine art', 8, TRUE),
(9, 'Real Estate', 'real-estate', 'Residential, commercial land and property', 9, TRUE),
(10, 'Other', 'other', 'Distinctive lots worth exploring', 10, TRUE)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `display_order` = VALUES(`display_order`),
  `is_active` = VALUES(`is_active`);

-- 3. Subcategories
INSERT INTO `subcategories` (`category_id`, `name`, `slug`, `description`, `display_order`, `is_active`) VALUES
-- Electronics (id: 1)
(1, 'Audio & Sound', 'audio-sound', 'Headphones, speakers and sound systems', 1, TRUE),
(1, 'Cameras & Optics', 'cameras-optics', 'DSLR, lenses and photography gear', 2, TRUE),
(1, 'Computers & Laptops', 'computers-laptops', 'Desktops, laptops and components', 3, TRUE),
(1, 'Mobile & Devices', 'mobile-devices', 'Smartphones, tablets and wearables', 4, TRUE),

-- Vehicles (id: 2)
(2, 'Cars & Sedans', 'cars-sedans', 'Passenger cars, SUVs and luxury vehicles', 1, TRUE),
(2, 'Motorcycles & Two-Wheelers', 'motorcycles', 'Bikes, scooters and cruisers', 2, TRUE),
(2, 'Commercial & Trucks', 'commercial-trucks', 'Trucks, vans and fleet vehicles', 3, TRUE),

-- Collectibles (id: 3)
(3, 'Coins & Stamps', 'coins-stamps', 'Rare coins, currency and postal stamps', 1, TRUE),
(3, 'Vintage & Antiquities', 'vintage-antiquities', 'Historical items and antique decor', 2, TRUE),

-- Fashion (id: 4)
(4, 'Designer Apparel', 'designer-apparel', 'Luxury coats, dresses and formalwear', 1, TRUE),
(4, 'Bags & Accessories', 'bags-accessories', 'Handbags, wallets and leather goods', 2, TRUE),

-- Jewelry & Watches (id: 5)
(5, 'Fine Jewelry', 'fine-jewelry', 'Rings, necklaces and precious ornaments', 1, TRUE),
(5, 'Luxury Watches', 'luxury-watches', 'Chronographs, automatic and vintage timepieces', 2, TRUE),

-- Industrial (id: 6)
(6, 'Machinery & Tools', 'machinery-tools', 'Heavy machinery, CNC and industrial tools', 1, TRUE),
(6, 'Commercial Assets', 'commercial-assets', 'Restaurant, office and retail inventory', 2, TRUE),

-- Home (id: 7)
(7, 'Furniture & Decor', 'furniture-decor', 'Sofas, tables, lighting and home decor', 1, TRUE),
(7, 'Home Appliances', 'home-appliances', 'Kitchen and household appliances', 2, TRUE),

-- Art (id: 8)
(8, 'Original Paintings', 'original-paintings', 'Oil, acrylic and watercolor paintings', 1, TRUE),
(8, 'Sculptures & Prints', 'sculptures-prints', 'Bronze, stone sculptures and fine prints', 2, TRUE),

-- Real Estate (id: 9)
(9, 'Residential Property', 'residential-property', 'Plots, apartments and villas', 1, TRUE),
(9, 'Commercial Property', 'commercial-property', 'Offices, shops and industrial plots', 2, TRUE),

-- Other (id: 10)
(10, 'General & Miscellaneous', 'general-misc', 'All other unique listings', 1, TRUE)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `display_order` = VALUES(`display_order`),
  `is_active` = VALUES(`is_active`);

-- 4. Legal Pages (Default Marketplace Terms & Privacy Policy)
INSERT INTO `legal_pages` (`slug`, `title`, `content_html`) VALUES
('terms', 'Marketplace Terms & Conditions', '<h2>1. Marketplace Overview & Account Accuracy</h2>\n<p>BidMyLot is a dedicated auction and offer marketplace connecting buyers and sellers for negotiated single-unit and multi-unit lots. All users must provide accurate, verifiable account details and listing information at all times.</p>\n<h2>2. Offers, Negotiations & Agreements</h2>\n<p>Offers and bids placed on BidMyLot are private between the buyer, seller, and authorized marketplace administrators. A confirmed offer or allocation creates a direct, binding transaction agreement between the buyer and seller.</p>\n<h2>3. Settlement & Logistics</h2>\n<p>BidMyLot facilitates listing discovery, offer negotiation, and deal confirmation. BidMyLot does not process direct payments, delivery, or logistics collection. Parties are directly responsible for executing settlement and delivery as agreed.</p>\n<h2>4. Prohibited Activities</h2>\n<p>Fraud, price manipulation, shill bidding, self-offering, harassment, and unauthorized system access are strictly prohibited. Violations will result in immediate account suspension and potential legal action.</p>\n<h2>5. Reviews & Dispute Resolution</h2>\n<p>All dispute actions and transaction reviews must reflect genuine transactions. The marketplace administration reserves the right to moderate reviews and oversee dispute resolution according to platform policies.</p>'),
('privacy', 'Privacy Policy & Data Notice', '<h2>1. Information We Collect</h2>\n<p>BidMyLot collects and processes account details, verification documents, listings, offers, orders, and inquiry information necessary to operate a secure marketplace.</p>\n<h2>2. Document Privacy & Confidentiality</h2>\n<p>Government identity and business verification documents are strictly private and accessible only through authorized, authenticated administrative endpoints for verification purposes.</p>\n<h2>3. Public vs Private Profile Information</h2>\n<p>Public marketplace profiles exclude private offer terms, confidential identity records, and direct contact details. Contact information is shared only between confirmed transaction counterparties and authorized administrators.</p>\n<h2>4. Data Retention & Security</h2>\n<p>Operational, transactional, and audit records are retained securely as required for security auditing, fraud prevention, dispute resolution, and legal compliance.</p>\n<h2>5. Your Rights & Data Requests</h2>\n<p>Users may review and update their profile details or contact BidMyLot support to request data corrections or account inquiries.</p>')
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `content_html` = VALUES(`content_html`);

-- 5. Mark all historical migrations as executed
INSERT IGNORE INTO `schema_migrations` (`filename`) VALUES
('001_initial_schema.sql'),
('002_expand_image_url.sql'),
('003_add_changes_requested_status.sql'),
('004_create_settings_table.sql'),
('005_expand_support_status.sql'),
('006_add_dual_role_support.sql'),
('007_create_login_otp_challenges.sql'),
('008_add_remember_me_support.sql'),
('009_create_accounts_table.sql'),
('010_create_buyer_seller_verification_tables.sql'),
('011_create_categories_listings_and_images_tables.sql'),
('012_create_listing_audit_log_table.sql'),
('013_create_offers_table.sql'),
('014_add_seller_counter_fields.sql'),
('015_migrate_legacy_bids_to_offers.sql'),
('016_create_multi_unit_tables.sql'),
('017_create_orders_delivery_reviews_audit_notifications_tables.sql'),
('018_repair_integrity_and_identity.sql'),
('019_create_password_reset_tokens.sql'),
('020_add_refresh_token_families.sql'),
('021_remove_payment_delivery_and_simplify_orders.sql');

-- Restore configuration
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
