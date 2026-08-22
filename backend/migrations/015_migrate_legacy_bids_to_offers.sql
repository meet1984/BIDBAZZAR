-- Migration 015: Migrate Legacy Bids to Negotiated Offers
-- Maps existing legacy bids table entries to the offers table for Listings

INSERT INTO offers (
  listing_id,
  buyer_id,
  offered_amount,
  currency,
  buyer_message,
  status,
  version,
  created_at,
  updated_at
)
SELECT 
  b.auction_id AS listing_id,
  b.bidder_id AS buyer_id,
  b.amount AS offered_amount,
  'INR' AS currency,
  'Migrated from legacy bid' AS buyer_message,
  CASE 
    WHEN a.winner_id = b.bidder_id AND a.status = 'closed' AND b.amount = a.current_bid THEN 'buyer_confirmed'
    ELSE 'submitted'
  END AS status,
  1 AS version,
  b.created_at AS created_at,
  b.created_at AS updated_at
FROM bids b
LEFT JOIN auctions a ON a.id = b.auction_id
WHERE EXISTS (SELECT 1 FROM listings l WHERE l.id = b.auction_id)
  AND NOT EXISTS (
    SELECT 1 FROM offers o 
    WHERE o.listing_id = b.auction_id 
      AND o.buyer_id = b.bidder_id 
      AND o.offered_amount = b.amount 
      AND o.created_at = b.created_at
  );
