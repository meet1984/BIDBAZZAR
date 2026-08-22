# Direct Deal Workflow

BidMyLot records the agreement created by an accepted offer; it does not collect money, arrange shipping, or provide eDelivery.

## State and access rules

1. A seller selects an offer or reserves a multi-unit allocation.
2. The buyer confirms before the applicable confirmation deadline.
3. The same database transaction confirms the offer/allocation, adjusts listing or inventory state, and creates one `confirmed` order.
4. Only that order's buyer, seller, or an administrator with `order_oversight` can read its contact cards.
5. Buyer and seller coordinate directly using the recorded contact details and agreed amount.
6. Buyer and seller independently confirm their side is complete. The order changes to `completed` only after both timestamps exist.
7. Either participant may open a dispute while the order is `confirmed`, or within 14 days after completion. Only an administrator with `dispute_management` can resolve it.
8. Reviews are available only after both parties completed the deal.

Allowed order transitions:

- `confirmed` → `completed`, `cancelled`, `disputed`, or `failed`
- `completed` → `disputed`
- `disputed` → `resolved`, `completed`, `cancelled`, or `failed`
- `cancelled`, `resolved`, and `failed` are terminal

## Production migration

Migration `021_remove_payment_delivery_and_simplify_orders.sql` removes payment/delivery tables and columns and preserves existing orders by mapping legacy states to the direct-deal states. The application migration runner applies migration 021 through restart-safe, object-by-object checks because MySQL DDL implicitly commits.

Before applying it:

1. Back up the production database and verify a restore.
2. Run `npm run db:migrate:dry`.
3. Apply migrations in a maintenance window with `npm run db:migrate`.
4. Run `npm run db:verify-schema`.
5. Manually test one single-item and one multi-unit confirmation with disposable test accounts.

The migration deliberately stops instead of deleting records if it finds invalid order totals or duplicate review reports.
