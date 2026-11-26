-- ============================================================
-- MIGRASI: Kolom Harga, Diskon, dan Pajak pada PO & SO
-- Aman dijalankan berulang di MySQL 8+ / MariaDB.
-- ============================================================

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS add_col_if_not_exists(
    IN tbl_name VARCHAR(64),
    IN col_name VARCHAR(64),
    IN col_def TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl_name AND COLUMN_NAME = col_name
    ) THEN
        SET @query = CONCAT('ALTER TABLE `', tbl_name, '` ADD COLUMN `', col_name, '` ', col_def);
        PREPARE stmt FROM @query;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- 1. Detail PO
CALL add_col_if_not_exists('purchase_order_details', 'harga_satuan', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER qty_pesan');
CALL add_col_if_not_exists('purchase_order_details', 'diskon', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER harga_satuan');
CALL add_col_if_not_exists('purchase_order_details', 'subtotal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER diskon');

-- 2. Header PO
CALL add_col_if_not_exists('purchase_orders', 'subtotal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER keterangan');
CALL add_col_if_not_exists('purchase_orders', 'diskon_persen', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER subtotal');
CALL add_col_if_not_exists('purchase_orders', 'diskon_nominal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER diskon_persen');
CALL add_col_if_not_exists('purchase_orders', 'pajak_persen', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER diskon_nominal');
CALL add_col_if_not_exists('purchase_orders', 'pajak_nominal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER pajak_persen');
CALL add_col_if_not_exists('purchase_orders', 'total_harga', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER pajak_nominal');

-- 3. Detail SO
CALL add_col_if_not_exists('sales_order_details', 'harga_satuan', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER qty_pesanan');
CALL add_col_if_not_exists('sales_order_details', 'diskon', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER harga_satuan');
CALL add_col_if_not_exists('sales_order_details', 'subtotal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER diskon');

-- 4. Header SO
CALL add_col_if_not_exists('sales_orders', 'subtotal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER keterangan');
CALL add_col_if_not_exists('sales_orders', 'diskon_persen', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER subtotal');
CALL add_col_if_not_exists('sales_orders', 'diskon_nominal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER diskon_persen');
CALL add_col_if_not_exists('sales_orders', 'pajak_persen', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER diskon_nominal');
CALL add_col_if_not_exists('sales_orders', 'pajak_nominal', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER pajak_persen');
CALL add_col_if_not_exists('sales_orders', 'total_harga', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER pajak_nominal');

DROP PROCEDURE IF EXISTS add_col_if_not_exists;

