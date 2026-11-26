-- ============================================================
-- MIGRASI: Modul Akuntansi ERP Lengkap (COA, Jurnal Umum, Kas & Bank, Laporan)
-- ============================================================

-- 1. Tabel Master Akun (Chart of Accounts / Bagan Akun)
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_akun VARCHAR(20) NOT NULL UNIQUE,
    nama_akun VARCHAR(150) NOT NULL,
    kategori ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE') NOT NULL,
    subkategori VARCHAR(100) NULL,
    saldo_normal ENUM('DEBIT', 'KREDIT') NOT NULL,
    is_kas_bank BOOLEAN NOT NULL DEFAULT FALSE,
    deskripsi TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_acc_kategori (kategori),
    INDEX idx_acc_kode (kode_akun),
    INDEX idx_acc_kas_bank (is_kas_bank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Seed Master Bagan Akun Standar (Standard Chart of Accounts)
INSERT INTO accounts (kode_akun, nama_akun, kategori, subkategori, saldo_normal, is_kas_bank, deskripsi)
VALUES
-- ASSET
('1-1001', 'Kas Operasional Gudang', 'ASSET', 'Kas & Bank', 'DEBIT', TRUE, 'Kas tunai operasional gudang dan kantor'),
('1-1002', 'Bank BCA - Rekening Utama', 'ASSET', 'Kas & Bank', 'DEBIT', TRUE, 'Rekening giro/operasional Bank BCA'),
('1-1003', 'Bank Mandiri - Rekening Operasional', 'ASSET', 'Kas & Bank', 'DEBIT', TRUE, 'Rekening operasional Bank Mandiri'),
('1-1010', 'Piutang Usaha (AR)', 'ASSET', 'Piutang', 'DEBIT', FALSE, 'Tagihan piutang dagang kepada pelanggan'),
('1-1020', 'Persediaan Barang Dagang', 'ASSET', 'Persediaan', 'DEBIT', FALSE, 'Nilai persediaan barang di gudang'),
('1-1030', 'Pajak Dibayar di Muka (PPN Masukan)', 'ASSET', 'Pajak Dibayar di Muka', 'DEBIT', FALSE, 'PPN masukan dari transaksi pembelian'),

-- LIABILITY
('2-1001', 'Utang Usaha (AP)', 'LIABILITY', 'Kewajiban Lancar', 'KREDIT', FALSE, 'Kewajiban utang dagang kepada supplier'),
('2-1002', 'Utang Pajak (PPN Keluaran)', 'LIABILITY', 'Kewajiban Lancar', 'KREDIT', FALSE, 'PPN keluaran dari transaksi penjualan'),
('2-1003', 'Utang Biaya & Operasional', 'LIABILITY', 'Kewajiban Lancar', 'KREDIT', FALSE, 'Beban operasional yang masih harus dibayar'),

-- EQUITY
('3-1001', 'Modal Pemilik / Disetor', 'EQUITY', 'Modal', 'KREDIT', FALSE, 'Modal awal dan setoran pemilik perusahaan'),
('3-2001', 'Laba Ditahan', 'EQUITY', 'Laba Ditahan', 'KREDIT', FALSE, 'Akumulasi laba ditahan periode sebelumnya'),
('3-3001', 'Laba Periode Berjalan', 'EQUITY', 'Ekuitas Periode Berjalan', 'KREDIT', FALSE, 'Laba bersih operasional tahun/bulan berjalan'),

-- REVENUE
('4-1001', 'Pendapatan Penjualan Produk', 'REVENUE', 'Pendapatan Usaha', 'KREDIT', FALSE, 'Hasil penjualan barang dagang kepada customer'),
('4-1002', 'Diskon Penjualan', 'REVENUE', 'Kontra Pendapatan', 'DEBIT', FALSE, 'Potongan harga / diskon yang diberikan ke customer'),
('4-2001', 'Pendapatan Lain-lain & Jasa', 'REVENUE', 'Pendapatan Non-Usaha', 'KREDIT', FALSE, 'Pendapatan di luar operasional utama'),

-- COGS
('5-1001', 'Beban Pokok Penjualan (HPP)', 'COGS', 'Beban Pokok', 'DEBIT', FALSE, 'Harga pokok barang dagang yang terjual / keluar'),

-- EXPENSE
('6-1001', 'Beban Gaji & Upah Karyawan', 'EXPENSE', 'Beban Karyawan', 'DEBIT', FALSE, 'Gaji staf gudang, operasional, dan administrasi'),
('6-1002', 'Beban Sewa Gedung & Gudang', 'EXPENSE', 'Beban Fasilitas', 'DEBIT', FALSE, 'Biaya sewa ruang gudang dan kantor'),
('6-1003', 'Beban Listrik, Air & Internet', 'EXPENSE', 'Beban Utilitas', 'DEBIT', FALSE, 'Tagihan utilitas PLN, PAM, dan internet kantor'),
('6-1004', 'Beban Logistik & Pengiriman', 'EXPENSE', 'Beban Operasional', 'DEBIT', FALSE, 'Biaya kurir, bensin, dan armada kirim'),
('6-1005', 'Beban Pemasaran & Promosi', 'EXPENSE', 'Beban Pemasaran', 'DEBIT', FALSE, 'Biaya periklanan dan promosi penjualan'),
('6-1006', 'Beban Perlengkapan & ATK', 'EXPENSE', 'Beban Administrasi', 'DEBIT', FALSE, 'Biaya pembelian alat tulis, lakban, packaging'),
('6-1007', 'Beban Administrasi Bank', 'EXPENSE', 'Beban Keuangan', 'DEBIT', FALSE, 'Biaya transfer bank dan administrasi rekening'),
('6-1099', 'Beban Operasional Lainnya', 'EXPENSE', 'Beban Operasional', 'DEBIT', FALSE, 'Pengeluaran operasional lain yang belum terinci')
ON DUPLICATE KEY UPDATE nama_akun = VALUES(nama_akun);

-- 3. Tabel Jurnal Umum (Journal Entries / General Journal)
CREATE TABLE IF NOT EXISTS journal_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_jurnal VARCHAR(50) NOT NULL UNIQUE,
    tanggal DATE NOT NULL,
    tipe_referensi ENUM('MANUAL', 'PO', 'SO', 'DO', 'INBOUND', 'OUTBOUND', 'AP_PAYMENT', 'AR_PAYMENT', 'EXPENSE', 'CASH_IN') NOT NULL DEFAULT 'MANUAL',
    referensi_id INT NULL,
    no_referensi VARCHAR(100) NULL,
    keterangan TEXT NOT NULL,
    total_debit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_kredit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_je_tanggal (tanggal),
    INDEX idx_je_tipe_ref (tipe_referensi),
    INDEX idx_je_no_ref (no_referensi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Tabel Baris Jurnal (Journal Lines / Double-entry Lines)
CREATE TABLE IF NOT EXISTS journal_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    journal_id INT NOT NULL,
    account_id INT NOT NULL,
    debit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    credit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    keterangan VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    INDEX idx_jl_journal (journal_id),
    INDEX idx_jl_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Tabel Kas & Bank (Beban Operasional & Kas Masuk / Keluar)
CREATE TABLE IF NOT EXISTS cash_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_transaksi VARCHAR(50) NOT NULL UNIQUE,
    tipe ENUM('KELUAR', 'MASUK') NOT NULL,
    tanggal DATE NOT NULL,
    account_kas_id INT NOT NULL,
    account_lawan_id INT NOT NULL,
    nominal DECIMAL(15,2) NOT NULL,
    penerima_penyetor VARCHAR(150) NULL,
    metode_pembayaran VARCHAR(50) NOT NULL DEFAULT 'Kas Tunai',
    referensi VARCHAR(100) NULL,
    keterangan TEXT NOT NULL,
    journal_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_kas_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (account_lawan_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (journal_id) REFERENCES journal_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cash_tipe (tipe),
    INDEX idx_cash_tanggal (tanggal),
    INDEX idx_cash_account_kas (account_kas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

