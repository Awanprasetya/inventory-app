-- Migration: Warehouse Operations Enhancement
-- Meningkatkan akurasi, integrasi antar modul operasional gudang, multi-warehouse, dan medical expired tracking

-- 1. Mengubah tipe di stock_mutations menjadi VARCHAR(50) untuk mendukung mutasi komprehensif
ALTER TABLE stock_mutations MODIFY COLUMN tipe VARCHAR(50) NOT NULL;

-- 2. Menambahkan warehouse_id ke stock_mutations (jika belum ada)
SET @exist_sm_wh = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_mutations' AND COLUMN_NAME = 'warehouse_id'
);
SET @sql_sm_wh = IF(@exist_sm_wh = 0, 'ALTER TABLE stock_mutations ADD COLUMN warehouse_id INT NULL AFTER nomor_lot', 'SELECT 1');
PREPARE stmt FROM @sql_sm_wh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Menambahkan warehouse_id ke transactions (jika belum ada)
SET @exist_trx_wh = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'warehouse_id'
);
SET @sql_trx_wh = IF(@exist_trx_wh = 0, 'ALTER TABLE transactions ADD COLUMN warehouse_id INT NULL AFTER user_id', 'SELECT 1');
PREPARE stmt FROM @sql_trx_wh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Menambahkan warehouse_id, expired_date, status, dan keterangan ke product_lots (jika belum ada)
SET @exist_pl_wh = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_lots' AND COLUMN_NAME = 'warehouse_id'
);
SET @sql_pl_wh = IF(@exist_pl_wh = 0, 'ALTER TABLE product_lots ADD COLUMN warehouse_id INT NULL DEFAULT 1 AFTER shift', 'SELECT 1');
PREPARE stmt FROM @sql_pl_wh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist_pl_exp = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_lots' AND COLUMN_NAME = 'expired_date'
);
SET @sql_pl_exp = IF(@exist_pl_exp = 0, 'ALTER TABLE product_lots ADD COLUMN expired_date DATE NULL AFTER tanggal_produksi', 'SELECT 1');
PREPARE stmt FROM @sql_pl_exp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist_pl_st = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_lots' AND COLUMN_NAME = 'status'
);
SET @sql_pl_st = IF(@exist_pl_st = 0, 'ALTER TABLE product_lots ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT \'AVAILABLE\' AFTER stok_qty', 'SELECT 1');
PREPARE stmt FROM @sql_pl_st;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist_pl_ket = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_lots' AND COLUMN_NAME = 'keterangan'
);
SET @sql_pl_ket = IF(@exist_pl_ket = 0, 'ALTER TABLE product_lots ADD COLUMN keterangan TEXT NULL AFTER status', 'SELECT 1');
PREPARE stmt FROM @sql_pl_ket;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Set default warehouse_id = 1 untuk record lama yang masih NULL
UPDATE transactions SET warehouse_id = 1 WHERE warehouse_id IS NULL;
UPDATE stock_mutations SET warehouse_id = 1 WHERE warehouse_id IS NULL;
UPDATE product_lots SET warehouse_id = 1 WHERE warehouse_id IS NULL;
