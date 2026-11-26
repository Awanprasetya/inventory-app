-- ============================================================================
-- MIGRATION: PRODUCT CATEGORY (MATERIAL / BARANG_JADI)
-- ============================================================================

ALTER TABLE `products`
  ADD COLUMN `kategori_produk` VARCHAR(30) NOT NULL DEFAULT 'BARANG_JADI' AFTER `nama_produk`;
