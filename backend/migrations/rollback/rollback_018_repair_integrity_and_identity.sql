-- This repair migration intentionally has no automatic destructive rollback.
-- Reverting account foreign keys or dropping modern watchlists/invariants can lose
-- new data. Restore a verified pre-migration backup or apply a reviewed forward fix.
SELECT 'No automatic rollback: restore a verified backup or use a reviewed forward fix.' AS guidance;
