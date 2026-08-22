# Buyer Profile Module

## Purpose
Manages buyer-specific profile data, verification draft details, contact information, and public buyer trust views in complete isolation from seller profiles.

## Files & Responsibilities
- `buyer-profile.schemas.ts`: Zod validation schemas for buyer profile updates and param IDs.
- `buyer-profile.repository.ts`: MySQL queries targeting `buyer_profiles` table, masking government ID references.
- `buyer-profile.service.ts`: Business logic and DTO redaction filters for own and public views.
- `buyer-profile.controller.ts`: Express request handlers.
- `buyer-profile.routes.ts`: Endpoint definitions with role middleware.

## Database Tables
- `buyer_profiles`

## API Endpoints
- `GET /api/buyer/profile`: Read own buyer profile (`buyer` role required).
- `PATCH /api/buyer/profile`: Update draft buyer profile (`buyer` role required).
- `GET /api/buyer/profile/public/:id`: Public safe buyer lookup (Public).

## Permissions & Security Rules
- Only accounts with `account_type = 'buyer'` can access own profile endpoints.
- Public responses strictly redact government ID references, private address, phone, email, and internal fields.
- Raw government ID numbers are automatically masked (`XXXX-XXXX-1234`) upon saving; unencrypted raw numbers are never stored or returned.

## Testing Instructions
- Run unit/integration tests with `npm test tests/buyer-profile.test.ts`.
