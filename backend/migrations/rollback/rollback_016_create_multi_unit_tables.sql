-- Rollback Migration 016: Drop multi_unit_allocations, multi_unit_offers, and remove extended columns from listings

DROP TABLE IF EXISTS multi_unit_allocations;
DROP TABLE IF EXISTS multi_unit_offers;

ALTER TABLE listings
  DROP COLUMN IF EXISTS min_acceptable_unit_price,
  DROP COLUMN IF EXISTS offer_start_time,
  DROP COLUMN IF EXISTS offer_end_time,
  DROP COLUMN IF EXISTS buyer_confirmation_deadline_hours;
