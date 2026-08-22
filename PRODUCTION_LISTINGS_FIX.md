# Production listings 500 fix

## Confirmed cause

The public listings repository depends on `listing_watchlists`, `multi_unit_allocations`, and the expanded `listings`/`seller_profiles` schema introduced through migrations 010, 016, and 018. Production installs omit development dependencies, but the previous `db:migrate`, `db:migrate:dry`, and `db:verify-schema` scripts invoked `tsx`, which is a development dependency. As a result, the production migration runner could not execute and the API returned a generic 500 while `/api/health` still passed its shallow `SELECT 1` check.

Migration 018 is especially relevant because it creates `listing_watchlists` and repairs account foreign keys. It was also designed to resume after MySQL partially committed its DDL.

## Corrections included

- Production database commands now execute compiled JavaScript from `dist/` and do not require `tsx`.
- `db:migrate:dry` now connects read-only and reports applied and pending migrations.
- Migration 018 preflight now detects duplicate active disputes before adding its unique index.
- Migration 018 repair now finishes the seller `distributor` enum change.
- The missing final semicolon in migration 018 was corrected.
- Schema verification now checks migration status and the runtime tables/columns required by public listings, watchlists, multi-unit allocations, profiles, and direct-deal orders.
- Health responses now report `services.schema` and return `503` when core listing tables are missing instead of reporting a false healthy state after only `SELECT 1`.
- The frontend SPA fallback explicitly excludes `/api` and the missing Vite favicon reference now uses the existing BidMyLot logo.

## Production deployment procedure

Back up the production database before applying schema changes. Deploy the corrected application first so `dist/database/migrate.js` and the corrected `package.json` are present. Then run:

```bash
source /home/dcgixwyd/nodevenv/bidmylot.backend/20/bin/activate
cd /home/dcgixwyd/bidmylot.backend
npm run db:migrate:dry
npm run db:migrate
npm run db:verify-schema
mkdir -p tmp
touch tmp/restart.txt
```

Do not run `node dist/server.js` or kill LiteSpeed processes manually. Passenger owns the production process.

## Verification

```bash
curl -i "https://bidmylot.com/api/health"
curl -i "https://bidmylot.com/api/listings?featured=true&pageSize=6"
curl -i "https://bidmylot.com/api/listings?pageSize=5&status=live"
```

Expected results:

- Health returns `200` with database `ok`.
- Both listing requests return `200` with an items array and pagination metadata.
- `npm run db:migrate:dry` reports `Pending: none` after migration.
- `npm run db:verify-schema` reports that all migrations and runtime schema requirements pass.
