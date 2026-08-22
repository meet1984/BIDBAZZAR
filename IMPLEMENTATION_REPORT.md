# BidMyLot Direct-Deal Implementation Report

## Outcome

The active application no longer exposes or runs platform payment, shipment, collection, tracking, or eDelivery functionality. A confirmed offer now creates a direct deal and reveals buyer/seller contact cards only to the two participants and authorized administrators. Completion requires an independent confirmation from both parties.

## Main corrections

- Removed payment and delivery routes, controllers, services, repositories, scheduled work, environment variables, types, UI fields, and notification templates.
- Added restart-safe migration 021 handling that drops obsolete schema, maps historical order states, retains agreed amounts, and refuses ambiguous destructive cleanup.
- Prevented sellers from self-publishing or editing live/approved listings; seller changes return eligible records to draft and require admin review.
- Made single-offer confirmation and multi-unit allocation confirmation create orders atomically with listing/inventory updates.
- Locked completion, cancellation, dispute, and allocation transitions to prevent concurrent state corruption.
- Added ownership/role checks for orders, reviews, disputes, profiles, listings, images, offers, support tickets, and administrative capabilities.
- Removed raw OTP logging; retained refresh-token rotation/replay protection and live account-status/account-type checks on protected requests.
- Made buyer profile creation atomic with registration and blocked unsafe role conversion after marketplace history exists.
- Added strict request validation for order, dispute, review, notification, listing-image, and category routes.
- Added upload signature checks/compensation and protected private identity/support documents from public static serving.
- Removed the obsolete auction/bidding runtime and its failing `auctions`-table scheduler; the current listing/offer modules are canonical.
- Changed production deployment to explicit manual approval, added schema verification, backend health verification, immutable backend releases, and locked cron maintenance for Passenger.

## Important deployment requirements

- Back up and test restoration before migration 021.
- Configure `BACKEND_HEALTH_URL` and `CPANEL_NODE_BIN` GitHub secrets.
- Configure production `.env` with HTTPS origins, secure cookies, a strong JWT secret, correct MySQL/SMTP values, persistent upload paths, and the correct `TRUST_PROXY_HOPS`.
- Do not deploy the stale checked-in `dist` folders. The workflow builds new artifacts from source.

## Verification commands

```bash
npm ci
npm run db:migrate:dry
npm run lint
npm run typecheck
npm run test
npm run build

# Against a disposable MySQL database only:
npm run db:migrate
npm run db:verify-schema
```

No package installation or production database mutation was performed in the supplied workspace. Runtime build/test execution requires `npm ci`; static import, route wiring, obsolete-module, and secret-pattern checks were performed before packaging.
