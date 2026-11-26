-- Migration: Fix Multi-Warehouse Lots Unique Constraint
-- Memperbaiki constraint product_lots agar nomor_lot dapat berada di multi-gudang (unique per gudang)

SET @exist_fk_dod = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_order_details' AND CONSTRAINT_NAME = 'delivery_order_details_ibfk_2'
);
SET @sql_dod = IF(@exist_fk_dod > 0, 'ALTER TABLE delivery_order_details DROP FOREIGN KEY delivery_order_details_ibfk_2', 'SELECT 1');
PREPARE stmt_dod FROM @sql_dod;
EXECUTE stmt_dod;
DEALLOCATE PREPARE stmt_dod;

SET @exist_fk_td = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction_details' AND CONSTRAINT_NAME = 'transaction_details_ibfk_2'
);
SET @sql_td = IF(@exist_fk_td > 0, 'ALTER TABLE transaction_details DROP FOREIGN KEY transaction_details_ibfk_2', 'SELECT 1');
PREPARE stmt_td FROM @sql_td;
EXECUTE stmt_td;
DEALLOCATE PREPARE stmt_td;

-- Drop nomor_lot unique index jika masih ada
SET @exist_idx_nl = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_lots' AND INDEX_NAME = 'nomor_lot' AND NON_UNIQUE = 0
);
SET @sql_idx_nl = IF(@exist_idx_nl > 0, 'ALTER TABLE product_lots DROP INDEX nomor_lot', 'SELECT 1');
PREPARE stmt_idx_nl FROM @sql_idx_nl;
EXECUTE stmt_idx_nl;
DEALLOCATE PREPARE stmt_idx_nl;

-- Tambahkan unique constraint per gudang
SET @exist_uq_wh = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_lots' AND INDEX_NAME = 'uq_lot_warehouse'
);
SET @sql_uq_wh = IF(@exist_uq_wh = 0, 'ALTER TABLE product_lots ADD UNIQUE KEY uq_lot_warehouse (tenant_id, nomor_lot, warehouse_id)', 'SELECT 1');
PREPARE stmt_uq_wh FROM @sql_uq_wh;
EXECUTE stmt_uq_wh;
DEALLOCATE PREPARE stmt_uq_wh;

-- Tambahkan index biasa untuk nomor_lot
SET @exist_idx_nl2 = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_lots' AND INDEX_NAME = 'idx_nomor_lot'
);
SET @sql_idx_nl2 = IF(@exist_idx_nl2 = 0, 'ALTER TABLE product_lots ADD INDEX idx_nomor_lot (nomor_lot)', 'SELECT 1');
PREPARE stmt_idx_nl2 FROM @sql_idx_nl2;
EXECUTE stmt_idx_nl2;
DEALLOCATE PREPARE stmt_idx_nl2;

