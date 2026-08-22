-- Migration 013: Create offers table for negotiated offer marketplace listings

CREATE TABLE IF NOT EXISTS offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  offered_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  buyer_message TEXT NULL,
  preferred_fulfilment VARCHAR(100) NULL,
  offer_expiry DATETIME NULL,
  status ENUM(
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
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_offers_listing_status (listing_id, status, created_at),
  KEY idx_offers_buyer_status (buyer_id, status, created_at),
  CONSTRAINT fk_offers_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_offers_buyer FOREIGN KEY (buyer_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_offered_amount CHECK (offered_amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
