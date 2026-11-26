-- ============================================================
-- MIGRASI: Kolom harga pada master produk
-- Aman dijalankan berulang (cek kolom dulu via INFORMATION_SCHEMA).
-- Jalankan pada database `inventory` yang SUDAH ADA.
-- ============================================================
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'harga'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `products` ADD COLUMN `harga` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `satuan`',
  'SELECT ''Kolom harga sudah ada, migrasi dilewati'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
