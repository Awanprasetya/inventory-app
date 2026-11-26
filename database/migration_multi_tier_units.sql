-- Migration: Multi-Tier Units (3 Parameters: 1 Box = X Pack = Y Pcs)
-- Standard Base Unit is PCS

-- 1. Tabel products: Tambahkan satuan menengah dan rasio konversi 3 parameter
ALTER TABLE `products` 
  ADD COLUMN `satuan_menengah` VARCHAR(50) DEFAULT 'PACK' AFTER `satuan_besar`,
  ADD COLUMN `isi_pack_pcs` DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `satuan_menengah`,
  ADD COLUMN `isi_box_pack` DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `isi_pack_pcs`,
  ADD COLUMN `isi_box_pcs` DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `isi_box_pack`;

-- Sinkronisasi data awal: jika isi_per_kemasan sudah ada, pasang ke isi_box_pcs & isi_box_pack
UPDATE `products` 
SET `isi_box_pcs` = COALESCE(isi_per_kemasan, 1.00),
    `isi_box_pack` = COALESCE(isi_per_kemasan, 1.00),
    `satuan_menengah` = COALESCE(satuan_menengah, 'PACK')
WHERE `isi_box_pcs` = 1.00 AND `isi_per_kemasan` > 1.00;

-- 2. Tabel purchase_order_details: Simpan satuan yang dipilih saat order
ALTER TABLE `purchase_order_details`
  ADD COLUMN `satuan_order` VARCHAR(20) DEFAULT 'PCS',
  ADD COLUMN `qty_order` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN `rasio_pcs` DECIMAL(10,2) DEFAULT 1.00;

-- 3. Tabel sales_order_details: Simpan satuan yang dipilih saat order
ALTER TABLE `sales_order_details`
  ADD COLUMN `satuan_order` VARCHAR(20) DEFAULT 'PCS',
  ADD COLUMN `qty_order` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN `rasio_pcs` DECIMAL(10,2) DEFAULT 1.00;

-- 4. Tabel sales_quotation_details (opsional untuk Quotation)
ALTER TABLE `sales_quotation_details`
  ADD COLUMN `satuan_order` VARCHAR(20) DEFAULT 'PCS',
  ADD COLUMN `qty_order` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN `rasio_pcs` DECIMAL(10,2) DEFAULT 1.00;

-- 5. Tabel delivery_order_details: Simpan satuan yang dipilih saat kirim DO
ALTER TABLE `delivery_order_details`
  ADD COLUMN `satuan_order` VARCHAR(20) DEFAULT NULL,
  ADD COLUMN `qty_order` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN `rasio_pcs` DECIMAL(10,2) DEFAULT 1.00;


