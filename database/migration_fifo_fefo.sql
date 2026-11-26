-- ============================================================================
-- MIGRASI: MANAJEMEN METODE PENGELUARAN STOK FIFO & FEFO
-- Mendukung penentuan metode per produk (FIFO / FEFO)
-- FIFO: First In, First Out (Didasarkan tanggal produksi/masuk paling awal)
-- FEFO: First Expired, First Out (Didasarkan tanggal kadaluarsa paling awal)
-- ============================================================================

ALTER TABLE `products`
  ADD COLUMN `metode_stok` VARCHAR(10) NOT NULL DEFAULT 'FIFO' AFTER `rack_id`;

-- Set default produk Makanan/Obat/Perishable ke FEFO (misal: Obat, Susu, Tepung, Minyak)
UPDATE `products`
SET `metode_stok` = 'FEFO'
WHERE `kode_produk` IN ('MSK-01', 'PRD-001', 'PRD-003', 'PRD-004', 'PRD-TUYUL-808')
   OR `nama_produk` LIKE '%Obat%'
   OR `nama_produk` LIKE '%Susu%'
   OR `nama_produk` LIKE '%Tepung%'
   OR `nama_produk` LIKE '%Minyak%'
   OR `nama_produk` LIKE '%Makanan%';

