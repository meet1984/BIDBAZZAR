-- Detect refresh-token replay and revoke every descendant in the session family.
ALTER TABLE refresh_tokens
  ADD COLUMN family_id CHAR(36) NULL AFTER id,
  ADD COLUMN parent_token_id CHAR(36) NULL AFTER family_id;

UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL;

ALTER TABLE refresh_tokens
  MODIFY family_id CHAR(36) NOT NULL,
  ADD KEY idx_refresh_tokens_family (family_id, revoked_at),
  ADD KEY idx_refresh_tokens_parent (parent_token_id),
  ADD CONSTRAINT fk_refresh_tokens_parent
    FOREIGN KEY (parent_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL;
