-- Rollback Migration 010: Revert buyer/seller verification tables safely

DROP TABLE IF EXISTS verification_audit_log, verification_decisions, verification_documents, buyer_profiles;

ALTER TABLE seller_profiles
  RENAME COLUMN account_id TO user_id,
  DROP COLUMN rejection_reason,
  DROP COLUMN verification_reviewed_at,
  DROP COLUMN verification_submitted_at,
  DROP COLUMN verification_status,
  DROP COLUMN payout_provider_ref,
  DROP COLUMN delivery_return_info,
  DROP COLUMN profile_logo,
  DROP COLUMN public_business_description,
  DROP COLUMN product_categories,
  DROP COLUMN business_registration_info,
  DROP COLUMN pan_gst_ref,
  DROP COLUMN country,
  DROP COLUMN pin_code,
  DROP COLUMN state,
  DROP COLUMN city,
  DROP COLUMN registered_address_line2,
  DROP COLUMN registered_address_line1,
  DROP COLUMN verified_phone,
  DROP COLUMN verified_email,
  DROP COLUMN business_name,
  DROP COLUMN legal_name;
