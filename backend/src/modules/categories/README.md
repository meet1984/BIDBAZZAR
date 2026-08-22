# Categories & Subcategories Module

## Purpose
Provides dynamic hierarchical category and subcategory management for the BidMyLot marketplace. Replaces legacy hardcoded category lists with database-backed records, enabling admins to create, edit, reorder, activate/deactivate, move subcategories, and monitor listing usage counts.

## Files
* `category.schemas.ts`: Zod validation schemas for query parameters, creation, updates, reordering, and subcategory moves.
* `category.repository.ts`: MySQL pool queries for categories and subcategories with listing count aggregations.
* `category.service.ts`: Business logic, slug generation, parent validation, and permanent deletion guards.
* `category.controller.ts`: Express request handlers for public and admin operations.
* `category.routes.ts`: Router mounting public (`/api/categories`) and admin-only (`/api/admin/categories` & `/api/admin/subcategories`) routes.

## Database Tables
* `categories`: `id`, `name`, `slug`, `description`, `image_url`, `display_order`, `is_active`, `created_at`, `updated_at`.
* `subcategories`: `id`, `category_id`, `name`, `slug`, `description`, `display_order`, `is_active`, `created_at`, `updated_at`.
* Referenced by `listings.category_id` and `listings.subcategory_id`.

## Endpoints

### Public Endpoints
* `GET /api/categories` — List active categories and their subcategories.
* `GET /api/categories/:identifier` — Fetch details and subcategories for a category by slug or ID.

### Admin Endpoints (`requireRole("admin")`)
* `GET /api/admin/categories` — List all categories and subcategories (including inactive) with listing counts.
* `POST /api/admin/categories` — Create a new category.
* `PATCH /api/admin/categories/:id` — Edit an existing category.
* `PATCH /api/admin/categories/:id/active` — Toggle category active status.
* `PATCH /api/admin/categories/reorder` — Update display order across categories.
* `DELETE /api/admin/categories/:id` — Delete a category (blocked if used by any listing).
* `POST /api/admin/subcategories` — Create a subcategory under a parent category.
* `PATCH /api/admin/subcategories/:id` — Edit an existing subcategory.
* `PATCH /api/admin/subcategories/:id/active` — Toggle subcategory active status.
* `POST /api/admin/subcategories/:id/move` — Move a subcategory to a different parent category.
* `PATCH /api/admin/subcategories/reorder` — Update display order across subcategories.
* `DELETE /api/admin/subcategories/:id` — Delete a subcategory (blocked if used by any listing).

## Permissions & Deletion Rules
* Public endpoints are accessible to visitors and authenticated users.
* Management endpoints require `admin` account type.
* **Deletion Guard Rule**: Any category or subcategory in use by one or more listings (`listing_count > 0`) CANNOT be deleted permanently. Delete requests return `409 CATEGORY_IN_USE` or `409 SUBCATEGORY_IN_USE`. Administrators must mark the item inactive (`is_active = false`) instead.

## Validation
* Category & subcategory names sanitized, min 2 chars, max 100 chars.
* Slugs auto-generated from name if omitted, must be unique lowercase alphanumeric with hyphens.

## Tests
* Unit & integration tests located in `backend/tests/categories.test.ts`.

## Extension Instructions
* To add icon metadata or custom banner assets, extend the `image_url` or add a `metadata` JSON column to `categories`.
