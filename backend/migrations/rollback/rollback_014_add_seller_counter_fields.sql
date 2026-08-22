-- Rollback Migration 014: Remove counter_amount and seller_message columns from offers table

ALTER TABLE offers
  DROP COLUMN counter_amount,
  DROP COLUMN seller_message;
