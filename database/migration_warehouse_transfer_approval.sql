-- ============================================================================
-- MIGRATION: WAREHOUSE TRANSFER APPROVAL & MULTI-TIER UNITS
-- ============================================================================

-- 1. Update status ENUM and add approval tracking columns on warehouse_transfers
ALTER TABLE warehouse_transfers
  MODIFY COLUMN status ENUM('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'DRAFT', 'CANCELLED') DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS approved_by INT NULL AFTER created_by,
  ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL AFTER approved_by,
  ADD COLUMN IF NOT EXISTS rejected_reason VARCHAR(255) NULL AFTER approved_at;

-- 2. Add unit conversion columns on warehouse_transfer_details
ALTER TABLE warehouse_transfer_details
  ADD COLUMN IF NOT EXISTS satuan_transfer VARCHAR(20) NULL AFTER qty,
  ADD COLUMN IF NOT EXISTS qty_input DECIMAL(15,2) NULL AFTER satuan_transfer,
  ADD COLUMN IF NOT EXISTS rasio_pcs DECIMAL(15,2) NULL AFTER qty_input;
