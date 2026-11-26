-- ============================================================
-- MIGRASI: Tabel users untuk fitur Login + RBAC
-- Aman dijalankan berulang (IF NOT EXISTS + UPSERT).
-- Jalankan pada database `inventory` yang SUDAH ADA.
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nama_lengkap` varchar(150) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('ADMINISTRATOR','ADMIN_GUDANG') NOT NULL DEFAULT 'ADMIN_GUDANG',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- User default (password asli ter-hash bcrypt, lihat README):
--   admin    / admin123    -> ADMINISTRATOR
--   gudang01 / gudang123   -> ADMIN_GUDANG
INSERT INTO `users` (`id`, `nama_lengkap`, `username`, `password`, `role`) VALUES
(1, 'Kurniawan Saepudin', 'admin', '$2b$10$sqzNUQsxv9veySFCiBj8CuFL.4ywnu2stseYWz0CyNPAJmZ8Tdxa6', 'ADMINISTRATOR'),
(2, 'Budi Santoso', 'gudang01', '$2b$10$P0F4zZ0J9iP7/2Hf6EpbceWs1FrXk.aNzNweDU/oyVpQTybzRVziS', 'ADMIN_GUDANG')
ON DUPLICATE KEY UPDATE
  `nama_lengkap` = VALUES(`nama_lengkap`),
  `password` = VALUES(`password`),
  `role` = VALUES(`role`);

-- Backfill: transaksi demo yang belum punya user diinput oleh Admin Gudang
UPDATE `transactions` SET `user_id` = 2 WHERE `user_id` IS NULL;
