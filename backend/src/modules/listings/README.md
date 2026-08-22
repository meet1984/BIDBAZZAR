# Listings Module

## Purpose
Provides the core marketplace listing engine supporting negotiated offers (`sale_mode = negotiated_offer`) and multi-unit quantity offers (`sale_mode = multi_unit_offer`). Manages the full listing lifecycle state machine, seller verification requirements, admin review workflow with mandatory rejection reasons, audit trail logging, and public DTO payload sanitization.

## Files
* `listing-image.repository.ts`: SQL repository for `listing_images` table.
* `listing-image.service.ts`: Listing image management (max 6 images limit, primary image promotion, pluggable storage integration).
* `listing-image.controller.ts`: Express handlers for listing image upload, reordering, and removal.
* `listing.schemas.ts`: Zod schemas validating public search queries, negotiated and multi-unit creation/updates, and admin review inputs.
* `listing.repository.ts`: MySQL pool queries for listings, joining categories, subcategories, seller profiles, and public display status calculation.
* `listing-audit.repository.ts`: Audit trail repository logging every admin review decision and listing update.
* `listing.service.ts`: Business logic, seller verification checks, state machine transitions, schedule validations, and public DTO sanitization.
* `listing.controller.ts`: Express request handlers for public, seller, and admin endpoints.
* `listing.routes.ts`: Express router mounting `/api/listings`, `/api/seller/listings`, and `/api/admin/listings`.

## Database Tables
* `listings`: `id`, `seller_id`, `category_id`, `subcategory_id`, `sale_mode`, `title`, `description`, `condition`, `location`, `asking_price`, `currency`, `start_time`, `end_time`, `offer_selection_deadline`, `public_slug`, `listing_reference`, `review_status`, `review_notes`, `version`, `total_quantity`, `unit_name`, `asking_price_per_unit`, `min_order_quantity`, `max_order_quantity`, `quantity_increment`, `allow_partial_allocation`, `created_at`, `updated_at`, `deleted_at`.
* `listing_images`: `id`, `listing_id`, `image_url`, `display_order`, `is_primary`, `created_at`, `updated_at`.
* `listing_audit_log`: `id`, `actor_account_id`, `listing_id`, `action`, `reason`, `metadata`, `created_at`.

## Endpoints

### Public Endpoints (`/api/listings`)
* `GET /api/listings` — Public listing search & filtering (sanitized DTO, excludes review notes & internal status).
* `GET /api/listings/:identifier` — Public listing detail by slug or reference.

### Seller Endpoints (`/api/seller/listings`)
* `GET /api/seller/listings` — List seller's own listings.
* `POST /api/seller/listings` — Create a new listing draft (requires verified seller profile).
* `PATCH /api/seller/listings/:id` — Update draft or rejected listing details.
* `POST /api/seller/listings/:id/submit` — Submit listing for admin review (requires 48h advance start time).
* `POST /api/seller/listings/:id/confirm` — Confirm admin-requested changes to publish listing.
* `DELETE /api/seller/listings/:id` — Soft-delete draft or rejected listing.
* `GET /api/seller/listings/:id/images` — Fetch image records for listing.
* `POST /api/seller/listings/:id/images` — Upload image files (max 6 total per listing, 5MB size limit).
* `PATCH /api/seller/listings/:id/images/reorder` — Reorder listing images and set primary image.
* `DELETE /api/seller/listings/:id/images/:imageId` — Delete image file from storage and database.

### Admin Endpoints (`/api/admin/listings`)
* `GET /api/admin/listings` — List all listings with filter by `reviewStatus` or `saleMode`.
* `PATCH /api/admin/listings/:id/review` — Review submission (`approve`, `reject`, or `request_changes`). Reason mandatory for `reject` and `request_changes`.
* `PATCH /api/admin/listings/:id` — Admin edit listing details. Material changes on draft/submitted listings set status to `changes_requested` requiring seller confirmation.
* `DELETE /api/admin/listings/:id` — Delete a non-live listing with audit log.

## Lifecycle State Machine
```
draft -> submitted -> under_review -> approved -> scheduled -> open -> offer_selection -> sold / partially_sold / unsold -> completed
                                   -> changes_requested -> approved
                                   -> rejected
                                   -> cancelled / suspended / expired
```

## Security & Sanitization Rules
1. **Verified Seller Check**: Unverified sellers cannot create or submit listings (returns `403 VERIFICATION_REQUIRED`).
2. **Submitted Lock**: Submitted listings are locked from seller edits.
3. **Live Listing Lock**: Commercially important fields (price, quantity, sale mode) on live/open listings cannot be silently modified.
4. **Mandatory Admin Reason**: Every reject or request_changes decision requires a reason $\ge 4$ characters.
5. **Public Sanitization**: `publicListingDto` strips `review_notes`, internal status values, and admin notes from API responses.

## Tests
* Unit & integration tests located in `backend/tests/listings_phase3.test.ts`.

## Extension Instructions
* When implementing offer submission or multi-unit allocation in later phases, reference `listings.sale_mode`, `listings.asking_price_per_unit`, and `listings.allow_partial_allocation`.
