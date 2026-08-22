# Multi-unit Offer System Architecture

The **Multi-unit Offer** module implements quantity-based bulk item offers for listings configured with `sale_mode = multi_unit_offer` on BidMyLot.

---

## 1. Overview & Business Model

Unlike single-winner negotiated offers or clock-based auctions, Multi-unit Offer listings allow sellers to liquidate large inventories (e.g. 100 boxes, 500 tons) to one or multiple verified buyers.

### Key Rules & Invariants
1. **Terminology**: Always use **"Multi-unit Offer"** throughout UI, API, and documentation. No Dutch auction or clock-auction terminology is permitted.
2. **Server-side Invariant**: `total_offer_value = quantityRequested × offeredPricePerUnit` is calculated strictly on the backend.
3. **Seller Confidential Floor Price**: `min_acceptable_unit_price` is stored strictly for the seller and is never returned in public or buyer DTOs.
4. **Concurrency Safety**: Stock allocations are protected with transactional `SELECT ... FOR UPDATE` row locks to prevent stock overcommitment.
5. **No Hard Deletes**: Offers and allocations are soft-status updated (`submitted`, `revised`, `shortlisted`, `countered`, `allocation_reserved`, `confirmed`, `declined`, `rejected`, `expired`).

---

## 2. Database Schema

- `listings`: Extended with `total_quantity`, `unit_name`, `asking_price_per_unit`, `min_order_quantity`, `max_order_quantity`, `quantity_increment`, `allow_partial_allocation`, `min_acceptable_unit_price`, `buyer_confirmation_deadline_hours`.
- `multi_unit_offers`: Records buyer quantity requested, per-unit offered price, calculated total offer value, notes, counteroffer details, and status.
- `multi_unit_allocations`: Tracks stock reservations allocated by the seller to specific buyers with `allocated_quantity`, `unit_price`, `reserved_until` countdowns, and statuses (`reserved`, `confirmed`, `declined`, `expired`, `cancelled`).

---

## 3. Background Sweeper

The `sweepMultiUnitExpiries()` background job runs on boot and every 60 seconds to:
1. Expire unaccepted offers past `offer_expiry`.
2. Expire unconfirmed reservations past `reserved_until` and automatically return stock to available inventory.
3. Transition fully allocated or expired listings to `sold`, `partially_sold`, or `unsold`.
