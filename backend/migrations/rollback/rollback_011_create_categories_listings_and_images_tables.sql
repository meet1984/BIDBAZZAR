-- Rollback Migration 011: Safely revert categories, subcategories, listings, and listing_images tables

DROP TABLE IF EXISTS listing_images;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS subcategories;
DROP TABLE IF EXISTS categories;
