-- Automatic rollback is intentionally disabled: removing family metadata
-- weakens replay detection. Restore a verified backup or apply a forward fix.
SELECT 'No automatic rollback: retain refresh-token replay protection.' AS guidance;
