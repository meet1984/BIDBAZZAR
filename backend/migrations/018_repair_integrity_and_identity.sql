-- Repair the incomplete legacy-to-accounts migration and add database invariants.
-- Review the unmatched-row queries before applying this migration to any existing database.

-- All legacy users were copied to accounts by migration 009. Abort operational rollout
-- if any of these queries return rows; do not delete or guess unmatched identities.
SELECT sp.account_id AS unmatched_seller_profile
FROM seller_profiles sp LEFT JOIN accounts a ON a.id = sp.account_id
WHERE a.id IS NULL;

SELECT rt.user_id AS unmatched_refresh_token
FROM refresh_tokens rt LEFT JOIN accounts a ON a.id = rt.user_id
WHERE a.id IS NULL;

SELECT oc.user_id AS unmatched_otp_challenge
FROM login_otp_challenges oc LEFT JOIN accounts a ON a.id = oc.user_id
WHERE a.id IS NULL;

SELECT se.user_id AS unmatched_support_enquiry
FROM support_enquiries se LEFT JOIN accounts a ON a.id = se.user_id
WHERE se.user_id IS NOT NULL AND a.id IS NULL;

-- Enforced guard: fail before the first persistent DDL when identity or
-- uniqueness conflicts require operator resolution.
CREATE TEMPORARY TABLE migration_018_guard (
  conflict_count BIGINT NOT NULL,
  CONSTRAINT chk_migration_018_no_conflicts CHECK (conflict_count = 0)
);
INSERT INTO migration_018_guard (conflict_count)
SELECT
  (SELECT COUNT(*) FROM seller_profiles sp LEFT JOIN accounts a ON a.id = sp.account_id WHERE a.id IS NULL)
  + (SELECT COUNT(*) FROM refresh_tokens rt LEFT JOIN accounts a ON a.id = rt.user_id WHERE a.id IS NULL)
  + (SELECT COUNT(*) FROM login_otp_challenges oc LEFT JOIN accounts a ON a.id = oc.user_id WHERE a.id IS NULL)
  + (SELECT COUNT(*) FROM support_enquiries se LEFT JOIN accounts a ON a.id = se.user_id WHERE se.user_id IS NOT NULL AND a.id IS NULL)
  + (SELECT COUNT(*) FROM (
      SELECT listing_id, buyer_id FROM offers
      WHERE status IN ('submitted','revised','shortlisted','contact_requested','countered','accepted_pending_buyer')
      GROUP BY listing_id, buyer_id HAVING COUNT(*) > 1
    ) offer_conflicts)
  + (SELECT COUNT(*) FROM (
      SELECT listing_id, buyer_id FROM multi_unit_offers
      WHERE status IN ('submitted','revised','shortlisted','countered','allocation_proposed','allocation_reserved')
      GROUP BY listing_id, buyer_id HAVING COUNT(*) > 1
    ) multi_offer_conflicts)
  + (SELECT COUNT(*) FROM (
      SELECT order_id FROM disputes
      WHERE status IN ('opened', 'under_review')
      GROUP BY order_id HAVING COUNT(*) > 1
    ) dispute_conflicts)
  + (SELECT COUNT(*) FROM multi_unit_offers WHERE offered_price_per_unit <= 0)
  + (SELECT COUNT(*) FROM multi_unit_allocations WHERE unit_price <= 0);
DROP TEMPORARY TABLE migration_018_guard;

-- Zero-value legacy offers/allocations must be resolved before enforcing paid commerce.
SELECT id, listing_id, buyer_id FROM multi_unit_offers WHERE offered_price_per_unit <= 0;
SELECT id, listing_id, buyer_id FROM multi_unit_allocations WHERE unit_price <= 0;

ALTER TABLE seller_profiles
  DROP FOREIGN KEY fk_seller_profiles_user,
  ADD CONSTRAINT fk_seller_profiles_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  MODIFY seller_type ENUM('individual', 'business', 'distributor') NOT NULL;

ALTER TABLE refresh_tokens
  DROP FOREIGN KEY fk_refresh_tokens_user,
  RENAME COLUMN user_id TO account_id,
  ADD CONSTRAINT fk_refresh_tokens_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE login_otp_challenges
  DROP FOREIGN KEY fk_login_otp_challenges_user,
  RENAME COLUMN user_id TO account_id,
  ADD CONSTRAINT fk_login_otp_challenges_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE support_enquiries
  DROP FOREIGN KEY fk_support_enquiries_user,
  RENAME COLUMN user_id TO account_id,
  ADD CONSTRAINT fk_support_enquiries_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

CREATE TABLE listing_watchlists (
  account_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, listing_id),
  KEY idx_listing_watchlists_listing (listing_id),
  CONSTRAINT fk_listing_watchlists_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_listing_watchlists_listing
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO listing_watchlists (account_id, listing_id, created_at)
SELECT w.user_id, w.auction_id, w.created_at
FROM watchlists w
INNER JOIN accounts a ON a.id = w.user_id
INNER JOIN listings l ON l.id = w.auction_id;

-- One active offer per buyer/listing. NULL generated values may repeat in MySQL.
SELECT listing_id, buyer_id, COUNT(*) AS active_offers
FROM offers
WHERE status IN ('submitted','revised','shortlisted','contact_requested','countered','accepted_pending_buyer')
GROUP BY listing_id, buyer_id
HAVING COUNT(*) > 1;

ALTER TABLE offers
  ADD COLUMN active_buyer_listing VARCHAR(90)
    GENERATED ALWAYS AS (
      CASE WHEN status IN (
        'submitted','revised','shortlisted','contact_requested','countered','accepted_pending_buyer'
      ) THEN CONCAT(listing_id, ':', buyer_id) ELSE NULL END
    ) STORED,
  ADD UNIQUE KEY uq_offers_active_buyer_listing (active_buyer_listing);

UPDATE multi_unit_offers
SET total_offer_value = quantity_requested * offered_price_per_unit;

SELECT listing_id, buyer_id, COUNT(*) AS active_offers
FROM multi_unit_offers
WHERE status IN ('submitted','revised','shortlisted','countered','allocation_proposed','allocation_reserved')
GROUP BY listing_id, buyer_id
HAVING COUNT(*) > 1;

ALTER TABLE multi_unit_offers
  ADD COLUMN active_buyer_listing VARCHAR(90)
    GENERATED ALWAYS AS (
      CASE WHEN status IN (
        'submitted','revised','shortlisted','countered','allocation_proposed','allocation_reserved'
      ) THEN CONCAT(listing_id, ':', buyer_id) ELSE NULL END
    ) STORED,
  ADD UNIQUE KEY uq_multi_offers_active_buyer_listing (active_buyer_listing),
  ADD CONSTRAINT chk_multi_offer_total
    CHECK (total_offer_value = quantity_requested * offered_price_per_unit);

ALTER TABLE multi_unit_offers
  DROP CHECK chk_multi_unit_offered_price,
  ADD CONSTRAINT chk_multi_unit_offered_price CHECK (offered_price_per_unit > 0);

UPDATE multi_unit_allocations
SET total_allocation_value = allocated_quantity * unit_price;

ALTER TABLE multi_unit_allocations
  DROP CHECK chk_multi_unit_alloc_unit_price,
  ADD CONSTRAINT chk_multi_unit_alloc_unit_price CHECK (unit_price > 0),
  ADD CONSTRAINT chk_multi_allocation_total
    CHECK (total_allocation_value = allocated_quantity * unit_price);

ALTER TABLE payment_events
  DROP INDEX uq_payment_events_provider_event,
  ADD UNIQUE KEY uq_payment_events_provider_event (provider, provider_event_id);

ALTER TABLE audit_log
  DROP FOREIGN KEY fk_audit_log_actor,
  MODIFY actor_account_id BIGINT UNSIGNED NULL;

ALTER TABLE audit_log
  ADD CONSTRAINT fk_audit_log_actor
    FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE SET NULL;

-- Only one unresolved dispute may exist per order. Resolve duplicate active
-- rows during the preflight review before applying this constraint.
SELECT order_id, COUNT(*) AS active_disputes
FROM disputes
WHERE status IN ('opened', 'under_review')
GROUP BY order_id
HAVING COUNT(*) > 1;

ALTER TABLE disputes
  ADD COLUMN active_order_key BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status IN ('opened', 'under_review') THEN order_id ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_disputes_one_active_order (active_order_key);

ALTER TABLE verification_audit_log
  DROP FOREIGN KEY fk_verif_audit_actor,
  DROP FOREIGN KEY fk_verif_audit_target;

ALTER TABLE verification_audit_log
  ADD CONSTRAINT fk_verif_audit_actor
    FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_verif_audit_target
    FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE listing_audit_log
  DROP FOREIGN KEY fk_listing_audit_actor,
  DROP FOREIGN KEY fk_listing_audit_listing;

ALTER TABLE listing_audit_log
  ADD CONSTRAINT fk_listing_audit_actor
    FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_listing_audit_listing
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT