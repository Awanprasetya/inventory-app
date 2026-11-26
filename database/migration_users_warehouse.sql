-- ============================================================================
-- MIGRATION: ASSIGN WAREHOUSE TO USERS (MULTI-WAREHOUSE PIC & TRANSFER APPROVAL)
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS warehouse_id INT NULL AFTER role;

ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_users_warehouse (warehouse_id);
