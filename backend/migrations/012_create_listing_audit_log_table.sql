-- Migration 012: Create listing_audit_log table for auditing admin listing actions
-- Non-destructive migration creating audit trail table for admin listing approvals, rejections, change requests, and updates.

CREATE TABLE IF NOT EXISTS listing_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_account_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  action ENUM('approve', 'reject', 'request_changes', 'admin_update', 'cancel', 'suspend') NOT NULL,
  reason TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listing_audit_listing (listing_id, created_at DESC),
  KEY idx_listing_audit_actor (actor_account_id, created_at DESC),
  CONSTRAINT fk_listing_audit_actor FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_listing_audit_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
