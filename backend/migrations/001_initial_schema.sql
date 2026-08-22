CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role ENUM('buyer', 'seller', 'admin') NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  accepted_terms_at DATETIME NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE seller_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  seller_name VARCHAR(120) NOT NULL,
  seller_type ENUM('individual', 'business') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_seller_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user_expiry (user_id, expires_at),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auctions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(180) NOT NULL,
  lot_number VARCHAR(30) NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  item_condition ENUM('new', 'like-new', 'used', 'refurbished') NOT NULL,
  location VARCHAR(120) NOT NULL,
  image_url VARCHAR(500) NULL,
  starting_price DECIMAL(15,2) NOT NULL,
  current_bid DECIMAL(15,2) NULL,
  minimum_increment DECIMAL(15,2) NOT NULL DEFAULT 100.00,
  bid_count INT UNSIGNED NOT NULL DEFAULT 0,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status ENUM('draft', 'pending', 'approved', 'rejected', 'closed') NOT NULL DEFAULT 'draft',
  review_notes VARCHAR(1000) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  winner_id BIGINT UNSIGNED NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auctions_slug (slug),
  UNIQUE KEY uq_auctions_lot_number (lot_number),
  KEY idx_auctions_public (status, starts_at, ends_at, deleted_at),
  KEY idx_auctions_seller (seller_id, status, created_at),
  CONSTRAINT fk_auctions_seller
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_auctions_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_auctions_winner
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_auction_prices CHECK (
    starting_price >= 0 AND minimum_increment > 0 AND
    (current_bid IS NULL OR current_bid >= starting_price)
  ),
  CONSTRAINT chk_auction_schedule CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bids (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  auction_id BIGINT UNSIGNED NOT NULL,
  bidder_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_bids_auction_amount (auction_id, amount DESC, id DESC),
  KEY idx_bids_bidder_created (bidder_id, created_at DESC),
  CONSTRAINT fk_bids_auction
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bids_bidder
    FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_bid_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE watchlists (
  user_id BIGINT UNSIGNED NOT NULL,
  auction_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, auction_id),
  KEY idx_watchlists_auction (auction_id),
  CONSTRAINT fk_watchlists_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_watchlists_auction
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_enquiries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference VARCHAR(30) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(30) NULL,
  contact_role ENUM('buyer', 'seller', 'visitor', 'other') NOT NULL,
  reason VARCHAR(40) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  auction_reference VARCHAR(60) NULL,
  message TEXT NOT NULL,
  attachment_path VARCHAR(500) NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_mime VARCHAR(100) NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_support_enquiries_reference (reference),
  KEY idx_support_enquiries_status_created (status, created_at DESC),
  CONSTRAINT fk_support_enquiries_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE newsletter_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  status ENUM('subscribed', 'unsubscribed') NOT NULL DEFAULT 'subscribed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_newsletter_subscriptions_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
