-- Migration 017: Create orders, order_deliveries, payment_events, disputes, reviews, review_reports, admin_permissions, audit_log, and notifications tables.

-- 1. Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_reference VARCHAR(50) NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  source_type ENUM('negotiated_offer', 'multi_unit_allocation') NOT NULL,
  source_offer_id BIGINT UNSIGNED NULL,
  source_allocation_id BIGINT UNSIGNED NULL,
  source_reference VARCHAR(100) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  order_status ENUM(
    'created',
    'awaiting_payment',
    'payment_confirmed',
    'processing',
    'shipped',
    'ready_for_collection',
    'delivered',
    'buyer_confirmation',
    'completed',
    'payment_failed',
    'cancelled',
    'disputed',
    'refunded',
    'partially_refunded',
    'failed'
  ) NOT NULL DEFAULT 'created',
  payment_status ENUM(
    'pending',
    'held_pending_confirmation',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded'
  ) NOT NULL DEFAULT 'pending',
  fulfilment_status ENUM(
    'unfulfilled',
    'processing',
    'shipped',
    'ready_for_collection',
    'delivered',
    'collected',
    'returned'
  ) NOT NULL DEFAULT 'unfulfilled',
  delivery_method ENUM('shipping', 'collection') NOT NULL DEFAULT 'shipping',
  buyer_confirmation_deadline DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_reference (order_reference),
  UNIQUE KEY uq_orders_source_ref (source_reference),
  KEY idx_orders_buyer_status (buyer_id, order_status, created_at),
  KEY idx_orders_seller_status (seller_id, order_status, created_at),
  KEY idx_orders_listing (listing_id),
  KEY idx_orders_status (order_status),
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_source_offer FOREIGN KEY (source_offer_id) REFERENCES offers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_source_allocation FOREIGN KEY (source_allocation_id) REFERENCES multi_unit_allocations(id) ON DELETE RESTRICT,
  CONSTRAINT chk_orders_quantity CHECK (quantity > 0),
  CONSTRAINT chk_orders_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create order_deliveries table
CREATE TABLE IF NOT EXISTS order_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  delivery_method ENUM('shipping', 'collection') NOT NULL DEFAULT 'shipping',
  carrier_name VARCHAR(100) NULL,
  tracking_number VARCHAR(100) NULL,
  tracking_url VARCHAR(500) NULL,
  dispatch_notes TEXT NULL,
  dispatched_at DATETIME NULL,
  collection_location TEXT NULL,
  collection_instructions TEXT NULL,
  collection_ready_at DATETIME NULL,
  collected_at DATETIME NULL,
  estimated_delivery_at DATETIME NULL,
  delivered_at DATETIME NULL,
  proof_of_delivery_type ENUM('signature', 'photo', 'otp', 'carrier_confirmation', 'buyer_acknowledgement') NULL,
  proof_of_delivery_ref VARCHAR(255) NULL,
  proof_of_delivery_notes TEXT NULL,
  buyer_confirmed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_deliveries_order (order_id),
  KEY idx_order_deliveries_tracking (tracking_number),
  CONSTRAINT fk_order_deliveries_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create payment_events table
CREATE TABLE IF NOT EXISTS payment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'pending_provider',
  provider_event_id VARCHAR(150) NOT NULL,
  provider_transaction_ref VARCHAR(150) NULL,
  event_type VARCHAR(100) NOT NULL,
  raw_payload JSON NOT NULL,
  processed_status ENUM('received', 'processed', 'ignored', 'failed') NOT NULL DEFAULT 'received',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_events_provider_event (provider_event_id),
  KEY idx_payment_events_order (order_id),
  KEY idx_payment_events_provider_ref (provider_transaction_ref),
  CONSTRAINT fk_payment_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  dispute_reference VARCHAR(50) NOT NULL,
  opened_by_account_id BIGINT UNSIGNED NOT NULL,
  reason ENUM(
    'item_not_received',
    'item_damaged',
    'not_as_described',
    'seller_unresponsive',
    'buyer_unresponsive',
    'other'
  ) NOT NULL,
  details TEXT NOT NULL,
  status ENUM(
    'opened',
    'under_review',
    'resolved_buyer_favour',
    'resolved_seller_favour',
    'resolved_compromise',
    'closed'
  ) NOT NULL DEFAULT 'opened',
  resolution_notes TEXT NULL,
  resolved_by_account_id BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_disputes_reference (dispute_reference),
  KEY idx_disputes_order (order_id),
  KEY idx_disputes_opened_by (opened_by_account_id),
  KEY idx_disputes_status (status),
  CONSTRAINT fk_disputes_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_disputes_opened_by FOREIGN KEY (opened_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_disputes_resolved_by FOREIGN KEY (resolved_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  reviewer_id BIGINT UNSIGNED NOT NULL,
  reviewee_id BIGINT UNSIGNED NOT NULL,
  direction ENUM('buyer_to_seller', 'seller_to_buyer') NOT NULL,
  rating_score DECIMAL(3,2) NOT NULL,
  category_ratings JSON NOT NULL,
  comment TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  hidden_reason TEXT NULL,
  hidden_by_account_id BIGINT UNSIGNED NULL,
  hidden_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_review_direction (order_id, direction),
  KEY idx_reviews_reviewer (reviewer_id),
  KEY idx_reviews_reviewee (reviewee_id, is_published, created_at),
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_hidden_by FOREIGN KEY (hidden_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_reviews_rating_score CHECK (rating_score >= 1.00 AND rating_score <= 5.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create review_reports table
CREATE TABLE IF NOT EXISTS review_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reason ENUM(
    'offensive_language',
    'spam',
    'false_information',
    'harassment',
    'privacy_violation',
    'other'
  ) NOT NULL,
  details TEXT NULL,
  status ENUM('pending', 'reviewed', 'dismissed', 'action_taken') NOT NULL DEFAULT 'pending',
  reviewed_by_account_id BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_review_reports_review (review_id),
  KEY idx_review_reports_reporter (reporter_id),
  KEY idx_review_reports_status (status),
  CONSTRAINT fk_review_reports_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_reports_reporter FOREIGN KEY (reporter_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_review_reports_reviewer FOREIGN KEY (reviewed_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL,
  permission ENUM(
    'verification_review',
    'listing_review',
    'support_management',
    'order_oversight',
    'dispute_management',
    'review_moderation',
    'category_management'
  ) NOT NULL,
  granted_by_account_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_account_permission (account_id, permission),
  KEY idx_admin_permissions_account (account_id),
  CONSTRAINT fk_admin_permissions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_permissions_granter FOREIGN KEY (granted_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Create audit_log table (Append-only audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_account_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_entity VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  reason TEXT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_log_actor (actor_account_id, created_at DESC),
  KEY idx_audit_log_target (target_entity, target_id, created_at DESC),
  KEY idx_audit_log_action (action, created_at DESC),
  CONSTRAINT fk_audit_log_actor FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_account_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  payload JSON NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_recipient (recipient_account_id, is_read, created_at DESC),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
