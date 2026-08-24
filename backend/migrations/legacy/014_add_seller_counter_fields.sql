-- Migration 014: Add counter_amount and seller_message columns to offers table

ALTER TABLE offers
  ADD COLUMN counter_amount DECIMAL(15,2) NULL AFTER offered_amount,
  ADD COLUMN seller_message TEXT NULL AFTER buyer_message;
