-- Migration 016: Extend listing configuration for multi-unit offers, create multi_unit_offers and multi_unit_allocations tables

-- 1. Extend listings table with private minimum unit price, offer timing windows, and confirmation deadline
-- SECURITY CRITICAL COMMENT:
-- Column `min_acceptable_unit_price` is the seller's PRIVATE minimum acceptable unit price.
-- It MUST NEVER be selected or included in any query path that serves public or buyer-facing responses.

ALTER TABLE listings
  ADD COLUMN min_acceptable_unit_price DECIMAL(15,2) NULL AFTER allow_partial_allocation,
  ADD COLUMN offer_start_time DATETIME NULL AFTER min_acceptable_unit_price,
  ADD COLUMN offer_end_time DATETIME NULL AFTER offer_start_time,
  ADD COLUMN buyer_confirmation_deadline_hours INT UNSIGNED NOT NULL DEFAULT 48 AFTER offer_end_time;

-- 2. Create multi_unit_offers table
CREATE TABLE IF NOT EXISTS multi_unit_offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  quantity_requested INT UNSIGNED NOT NULL,
  offered_price_per_unit DECIMAL(15,2) NOT NULL,
  total_offer_value DECIMAL(15,2) NOT NULL,
  buyer_message TEXT NULL,
  preferred_fulfilment VARCHAR(100) NULL,
  offer_expiry DATETIME NULL,
  counter_quantity INT UNSIGNED NULL,
  counter_unit_price DECIMAL(15,2) NULL,
  seller_message TEXT NULL,
  status ENUM(
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
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_multi_unit_offers_listing_status (listing_id, status, created_at),
  KEY idx_multi_unit_offers_buyer_status (buyer_id, status, created_at),
  CONSTRAINT fk_multi_unit_offers_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_multi_unit_offers_buyer FOREIGN KEY (buyer_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_multi_unit_quantity_requested CHECK (quantity_requested > 0),
  CONSTRAINT chk_multi_unit_offered_price CHECK (offered_price_per_unit >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create multi_unit_allocations table
CREATE TABLE IF NOT EXISTS multi_unit_allocations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  offer_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  allocated_quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  total_allocation_value DECIMAL(15,2) NOT NULL,
  status ENUM(
    'proposed',
    'reserved',
    'confirmed',
    'released',
    'cancelled',
    'expired'
  ) NOT NULL DEFAULT 'proposed',
  reserved_until DATETIME NULL,
  confirmed_at DATETIME NULL,
  released_at DATETIME NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_multi_unit_alloc_listing_status (listing_id, status, created_at),
  KEY idx_multi_unit_alloc_offer (offer_id),
  KEY idx_multi_unit_alloc_buyer_status (buyer_id, status, created_at),
  CONSTRAINT fk_multi_unit_alloc_offer FOREIGN KEY (offer_id) REFERENCES multi_unit_offers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_multi_unit_alloc_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_multi_unit_alloc_buyer FOREIGN KEY (buyer_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_multi_unit_allocated_qty CHECK (allocated_quantity > 0),
  CONSTRAINT chk_multi_unit_alloc_unit_price CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
