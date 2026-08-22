-- Remove platform-managed payment and delivery. Confirmed parties contact each other directly.

-- Add the replacement state before normalizing historical values.
ALTER TABLE orders MODIFY order_status ENUM(
  'created', 'awaiting_payment', 'payment_confirmed', 'processing', 'shipped',
  'ready_for_collection', 'delivered', 'buyer_confirmation', 'completed',
  'payment_failed', 'cancelled', 'disputed', 'refunded', 'partially_refunded',
  'failed', 'confirmed', 'resolved'
) NOT NULL DEFAULT 'confirmed';

UPDATE orders SET order_status = CASE
  WHEN order_status = 'completed' THEN 'completed'
  WHEN order_status = 'cancelled' THEN 'cancelled'
  WHEN order_status = 'disputed' THEN 'disputed'
  WHEN order_status IN ('failed', 'payment_failed') THEN 'failed'
  ELSE 'confirmed'
END;

DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS order_deliveries;

ALTER TABLE orders
  MODIFY order_status ENUM('confirmed', 'completed', 'cancelled', 'disputed', 'resolved', 'failed') NOT NULL DEFAULT 'confirmed',
  DROP COLUMN payment_status,
  DROP COLUMN fulfilment_status,
  DROP COLUMN delivery_method,
  DROP COLUMN buyer_confirmation_deadline,
  ADD COLUMN buyer_completed_at DATETIME NULL AFTER order_status,
  ADD COLUMN seller_completed_at DATETIME NULL AFTER buyer_completed_at;

UPDATE orders
SET buyer_completed_at = updated_at, seller_completed_at = updated_at
WHERE order_status = 'completed';

ALTER TABLE offers DROP COLUMN preferred_fulfilment;
ALTER TABLE multi_unit_offers DROP COLUMN preferred_fulfilment;
ALTER TABLE seller_profiles
  DROP COLUMN delivery_return_info,
  DROP COLUMN payout_provider_ref;

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_source_identity CHECK (
    (source_type = 'negotiated_offer' AND source_offer_id IS NOT NULL AND source_allocation_id IS NULL)
    OR
    (source_type = 'multi_unit_allocation' AND source_offer_id IS NULL AND source_allocation_id IS NOT NULL)
  ),
  ADD CONSTRAINT chk_orders_total_consistency CHECK (total_amount = quantity * unit_price);

ALTER TABLE review_reports
  ADD UNIQUE KEY uq_review_reports_reporter (review_id, reporter_id);
