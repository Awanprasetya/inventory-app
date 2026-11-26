-- ============================================================================
-- MIGRASI: MULTI-SATUAN & KONVERSI KEMASAN PRODUK (PACKAGING CONVERSION)
-- Mendukung: 1 Box = X Pcs, scan barcode kemasan otomatis mengisi Qty Inbound
-- ============================================================================

ALTER TABLE `products`
  ADD COLUMN `satuan_besar` VARCHAR(50) NULL DEFAULT 'BOX' AFTER `satuan`,
  ADD COLUMN `isi_per_kemasan` DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `satuan_besar`,
  ADD COLUMN `barcode_kemasan` VARCHAR(100) NULL DEFAULT NULL AFTER `isi_per_kemasan`,
  ADD INDEX `idx_products_barcode_kemasan` (`tenant_id`, `barcode_kemasan`);

CREATE TABLE IF NOT EXISTS `product_units` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL DEFAULT 1,
  `product_id` INT NOT NULL,
  `kode_produk` VARCHAR(50) NOT NULL,
  `nama_satuan` VARCHAR(50) NOT NULL,
  `isi_satuan_dasar` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `barcode_satuan` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_prod_unit` (`tenant_id`, `kode_produk`),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Contoh data produk: Masker 1 Box = 50 Pcs
UPDATE `products` 
SET `satuan` = 'PCS', `satuan_besar` = 'BOX', `isi_per_kemasan` = 50.00, `barcode_kemasan` = 'BOX-MSK-01'
WHERE `kode_produk` = 'MSK-01';

-- Tepung Terigu 1 Dus = 12 KG
UPDATE `products` 
SET `satuan_besar` = 'DUS', `isi_per_kemasan` = 12.00, `barcode_kemasan` = 'DUS-PRD-001'
WHERE `kode_produk` = 'PRD-001';

-- Minyak Goreng 1 Karton = 12 PCS
UPDATE `products` 
SET `satuan_besar` = 'KARTON', `isi_per_kemasan` = 12.00, `barcode_kemasan` = 'KRT-PRD-003'
WHERE `kode_produk` = 'PRD-003';

-- Susu Bubuk 1 Karton = 24 BOX
UPDATE `products` 
SET `satuan` = 'BOX', `satuan_besar` = 'KARTON', `isi_per_kemasan` = 24.00, `barcode_kemasan` = 'KRT-PRD-004'
WHERE `kode_produk` = 'PRD-004';

-- Obat Anti Tuyul 1 Box = 24 BOTOL
UPDATE `products` 
SET `satuan` = 'BOTOL', `satuan_besar` = 'BOX', `isi_per_kemasan` = 24.00, `barcode_kemasan` = 'BOX-TUYUL-808'
WHERE `kode_produk` = 'PRD-TUYUL-808';

