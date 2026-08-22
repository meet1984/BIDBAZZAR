-- Rollback Migration 017: Drop orders, order_deliveries, payment_events, disputes, reviews, review_reports, admin_permissions, audit_log, and notifications tables in safe reverse foreign-key dependency order.

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS admin_permissions;
DROP TABLE IF EXISTS review_reports;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS disputes;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS order_deliveries;
DROP TABLE IF EXISTS orders;
