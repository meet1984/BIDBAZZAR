# Seller Profile Module

## Purpose
Manages seller business profiles, public store descriptions, and verification data in complete isolation from buyer profiles.

## Files & Responsibilities
- `seller-profile.schemas.ts`: Zod validation schemas for seller profile updates and param IDs.
- `seller-profile.repository.ts`: MySQL queries targeting `seller_profiles` table, masking PAN/GST references.
- `seller-profile.service.ts`: Business logic and DTO redaction filters for own and public store views.
- `seller-profile.controller.ts`: Express request handlers.
- `seller-profile.routes.ts`: Endpoint definitions with role middleware.

## Database Tables
- `seller_profiles`

## API Endpoints
- `GET /api/seller/profile`: Read own seller profile (`seller` role required).
- `PATCH /api/seller/profile`: Update draft seller profile (`seller` role required).
- `GET /api/seller/profile/public/:id`: Public safe seller store lookup (Public).

## Permissions & Security Rules
- Only accounts with `account_type = 'seller'` can access own profile endpoints.
- Public responses strictly redact PAN/GST references, registered street address, phone, email, and internal notes.
- Financial account details are not stored by this application.

## Testing Instructions
- Run unit/integration tests with `npm test tests/seller-profile.test.ts`.
