-- Rollback Migration 015: Remove Migrated Legacy Offers
DELETE FROM offers WHERE buyer_message = 'Migrated from legacy bid';
