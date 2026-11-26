-- ============================================================
-- DATA CONTOH untuk demo Inventory App
-- PERHATIAN: Script ini mengosongkan seluruh data pada tabel!
-- Jalankan setelah inventory.sql (struktur tabel) dibuat.
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `transaction_details`;
TRUNCATE TABLE `transactions`;
TRUNCATE TABLE `stock_mutations`;
TRUNCATE TABLE `product_lots`;
TRUNCATE TABLE `products`;
TRUNCATE TABLE `racks`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- User login (password sudah ter-hash bcrypt): admin/admin123 & gudang01/gudang123
INSERT INTO `users` (`id`, `nama_lengkap`, `username`, `password`, `role`) VALUES
(1, 'Kurniawan Saepudin', 'admin', '$2b$10$sqzNUQsxv9veySFCiBj8CuFL.4ywnu2stseYWz0CyNPAJmZ8Tdxa6', 'ADMINISTRATOR'),
(2, 'Budi Santoso', 'gudang01', '$2b$10$P0F4zZ0J9iP7/2Hf6EpbceWs1FrXk.aNzNweDU/oyVpQTybzRVziS', 'ADMIN_GUDANG');

INSERT INTO `racks` (`kode_rak`, `keterangan`) VALUES
('RACK-A1', 'Aisle A baris 1 - barang jadi'),
('RACK-A2', 'Aisle A baris 2 - barang jadi'),
('RACK-B1', 'Aisle B baris 1 - bahan baku'),
('RACK-B2', 'Aisle B baris 2 - bahan baku'),
('RACK-C1', 'Aisle C baris 1 - bahan penolong');

INSERT INTO `products` (`kode_produk`, `nama_produk`, `satuan`, `harga`, `rack_id`) VALUES
('PRD-001', 'Tepung Terigu Cakra', 'KG', 14500.00, 3),
('PRD-002', 'Gula Pasir Gulaku', 'KG', 17500.00, 3),
('PRD-003', 'Minyak Goreng 1L', 'PCS', 24900.00, 1),
('PRD-004', 'Susu Bubuk 500g', 'BOX', 68500.00, 2),
('PRD-005', 'Cokelat Batangan 1kg', 'KG', 95000.00, 4),
('PRD-006', 'Margarine 200g', 'PCS', 8500.00, 5),
('PRD-007', 'Roti Tawar Gandum', 'PCS', 18000.00, 1),
('PRD-008', 'Keju Cheddar Block', 'KG', 112000.00, 4);

INSERT INTO `product_lots` (`kode_produk`, `nomor_lot`, `tanggal_produksi`, `shift`, `stok_qty`) VALUES
('PRD-001', 'LOT-TRG-2601', '2026-09-28', 1, 1200),
('PRD-001', 'LOT-TRG-2602', '2026-10-03', 2, 800),
('PRD-002', 'LOT-GLA-2601', '2026-09-30', 1, 450),
('PRD-003', 'LOT-MYG-2601', '2026-10-01', 3, 300),
('PRD-004', 'LOT-SSU-2601', '2026-10-02', 1, 120),
('PRD-005', 'LOT-COK-2601', '2026-10-04', 2, 60),
('PRD-006', 'LOT-MRG-2601', '2026-10-05', 1, 15),
('PRD-007', 'LOT-RTW-2601', '2026-10-06', 1, 0),
('PRD-008', 'LOT-CHD-2601', '2026-10-05', 3, 90);

-- Mutasi stok tersebar 7 hari terakhir agar grafik dashboard terisi
INSERT INTO `stock_mutations` (`tanggal_mutasi`, `kode_produk`, `nomor_lot`, `tipe`, `qty_perubahan`, `qty_sisa`, `referensi`) VALUES
(DATE_SUB(NOW(), INTERVAL 6 DAY), 'PRD-001', 'LOT-TRG-2601', 'MASUK', 1200, 1200, 'PROD-BATCH-001'),
(DATE_SUB(NOW(), INTERVAL 5 DAY), 'PRD-002', 'LOT-GLA-2601', 'MASUK', 450, 450, 'PO-2602'),
(DATE_SUB(NOW(), INTERVAL 3 DAY), 'PRD-003', 'LOT-MYG-2601', 'MASUK', 350, 350, 'PO-2603'),
(DATE_SUB(NOW(), INTERVAL 3 DAY), 'PRD-003', 'LOT-MYG-2601', 'KELUAR', 50, 300, 'SJ-2601'),
(DATE_SUB(NOW(), INTERVAL 2 DAY), 'PRD-001', 'LOT-TRG-2602', 'MASUK', 800, 800, 'PO-2604'),
(DATE_SUB(NOW(), INTERVAL 2 DAY), 'PRD-005', 'LOT-COK-2601', 'MASUK', 100, 100, 'PO-2606'),
(DATE_SUB(NOW(), INTERVAL 1 DAY), 'PRD-004', 'LOT-SSU-2601', 'MASUK', 120, 120, 'PROD-BATCH-005'),
(DATE_SUB(NOW(), INTERVAL 1 DAY), 'PRD-005', 'LOT-COK-2601', 'KELUAR', 40, 60, 'SJ-2602'),
(NOW(), 'PRD-006', 'LOT-MRG-2601', 'MASUK', 15, 15, 'PO-2607'),
(NOW(), 'PRD-007', 'LOT-RTW-2601', 'MASUK', 40, 40, 'PO-2608'),
(NOW(), 'PRD-007', 'LOT-RTW-2601', 'KELUAR', 40, 0, 'SJ-2026-001'),
(NOW(), 'PRD-008', 'LOT-CHD-2601', 'MASUK', 90, 90, 'PO-2609');

INSERT INTO `transactions` (`id`, `kode_transaksi`, `tipe_transaksi`, `referensi`, `tanggal_transaksi`, `keterangan`, `user_id`) VALUES
(1, 'IN-20261001-001', 'MASUK', 'PROD-BATCH-001', '2026-10-01 08:00:00', 'Hasil produksi shift 1', 2),
(2, 'IN-20261005-001', 'MASUK', 'PROD-BATCH-005', '2026-10-05 14:00:00', 'Hasil produksi shift 2', 2),
(3, 'OUT-20261006-001', 'KELUAR', 'SJ-2026-001', '2026-10-06 10:30:00', 'Pengiriman ke Customer A', 2);

INSERT INTO `transaction_details` (`transaction_id`, `nomor_lot`, `qty`) VALUES
(1, 'LOT-TRG-2601', 1200),
(2, 'LOT-SSU-2601', 120),
(3, 'LOT-RTW-2601', 40);
