# BidMyLot

BidMyLot is a React and Express marketplace for private negotiated offers and multi-unit allocations. MySQL is the source of truth. Updates are delivered through persisted notifications and normal HTTP refreshes.

## Workspaces

- `frontend`: React 19, Vite, Tailwind CSS and Axios.
- `backend`: Express 5, TypeScript, Zod, mysql2 and Nodemailer.

## Required configuration

Copy `backend/.env.example` to `backend/.env` and replace every placeholder. Required production values include the MySQL connection, `CLIENT_ORIGIN`, a unique JWT secret, SMTP configuration, `UPLOAD_DIR`, and `PRIVATE_UPLOAD_DIR`. Never expose the private upload directory through Apache or Express static hosting.

The frontend normally uses `VITE_API_URL=/api`. In production, route `/api` and `/uploads/listings` to the backend; no other upload path is public.

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run db:migrate:dry
npm run db:migrate
```

Run migrations only after a database backup and after reviewing the duplicate/orphan preflight queries. `npm run jobs:run-once --workspace @bidmylot/backend` runs maintenance from source; production cron must run `npm run jobs:run-once:compiled --workspace @bidmylot/backend`. The standalone server also schedules maintenance while it is alive; Passenger does not. The deployment workflow configures a one-minute locked cron and requires `CPANEL_NODE_BIN` to point to the cPanel Node 20 executable.

## Application routes

Public pages include marketplace listings, detail pages, registration, password recovery, terms, privacy, about and support. Authenticated pages include buyer/seller/admin dashboards, profiles, orders, notifications and reviews.

## Deployment

`backend/app.js` exports the Express app for Passenger and does not bind a port. `backend/src/server.ts` is the standalone entry point. Runtime uploads, secrets and database files must remain outside release replacement and version control. Set the `BACKEND_HEALTH_URL` and `CPANEL_NODE_BIN` repository secrets before a manual production deployment.

## Important boundaries

- Access tokens are bearer tokens held in memory; rotating refresh tokens use secure HTTP-only cookies.
- Identity and support documents are stored privately and streamed only after authorization.
- Offer confirmation and order creation are atomic.
- Allocation rows and listing rows are locked during reservation and confirmation.
- A confirmed offer creates a deal and exposes contact cards only to that buyer, seller, and authorized administrators.
- BidMyLot does not process payment or delivery; confirmed parties coordinate directly.
- Admin employees require the exact permission for each administrative action.
