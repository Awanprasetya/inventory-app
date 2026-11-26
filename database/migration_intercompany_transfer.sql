-- ============================================================================
-- MIGRATION: INTERCOMPANY WAREHOUSE TRANSFER + AUTO SO / DO / PO LINKING
-- ============================================================================

ALTER TABLE `warehouse_transfers`
  ADD COLUMN `to_tenant_id` INT NULL AFTER `to_warehouse_id`,
  ADD COLUMN `is_intercompany` TINYINT(1) NOT NULL DEFAULT 0 AFTER `to_tenant_id`,
  ADD COLUMN `so_id` INT NULL AFTER `rejected_reason`,
  ADD COLUMN `do_id` INT NULL AFTER `so_id`,
  ADD COLUMN `po_id` INT NULL AFTER `do_id`;
