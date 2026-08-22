# Verification Module

## Purpose
Coordinates verification submission, admin review queues (buyers and sellers), verification decision actions (approve, reject, request-changes, suspend), and immutable audit logging.

## Files & Responsibilities
- `verification.schemas.ts`: Zod validation schemas for queues, target parameters, and admin decision reason inputs.
- `verification.repository.ts`: Database operations targeting `buyer_profiles`, `seller_profiles`, `verification_decisions`, and `verification_audit_log`.
- `verification.service.ts`: Verification status reading, submission workflow, and admin decision transactions.
- `verification.controller.ts`: Express request handlers for user status/submission and admin queue/action routes.
- `verification.routes.ts`: Express routers for `/api/verification` and `/api/admin/verification`.

## Database Tables
- `verification_decisions`
- `verification_audit_log`
- `buyer_profiles`
- `seller_profiles`

## API Endpoints
- `GET /api/verification/status`: View own verification status (Authenticated).
- `POST /api/verification/submit`: Submit profile for verification (Authenticated).
- `GET /api/admin/verification/buyers`: Admin buyer verification review queue (`admin` role required).
- `GET /api/admin/verification/sellers`: Admin seller verification review queue (`admin` role required).
- `POST /api/admin/verification/:type/:id/approve`: Approve verification (`admin` role required).
- `POST /api/admin/verification/:type/:id/reject`: Reject verification with reason (`admin` role required).
- `POST /api/admin/verification/:type/:id/request-changes`: Request profile corrections with reason (`admin` role required).
- `POST /api/admin/verification/:type/:id/suspend`: Suspend account (`admin` role required).

## Permissions & Security Rules
- User submission routes are strictly separated by `account_type`.
- Admin queues and decisions require strict `admin` role authentication.
- Rejection and request-changes actions require non-empty explanation reason strings.
- All verification decisions create audit records in `verification_audit_log` and `verification_decisions`.

## Testing Instructions
- Run unit/integration tests with `npm test tests/verification-redaction.test.ts`.
