ALTER TABLE login_otp_challenges
  ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT FALSE AFTER attempt_count;

ALTER TABLE refresh_tokens
  ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT FALSE AFTER expires_at;
