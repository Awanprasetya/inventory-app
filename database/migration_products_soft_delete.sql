-- ============================================================================
-- MIGRASI: SOFT DELETE FLAG UNTUK PRODUK
-- ============================================================================

ALTER TABLE `products`
  ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `created_at`;

