-- ============================================================
-- MIGRASI ERP ACCOUNTING LENGKAP: 10 PILAR UTAMA AKUNTANSI
-- ============================================================

-- Tambah akun baru untuk Fixed Assets, Akumulasi Penyusutan, Pajak PPh, dan Laba/Rugi Kurs
INSERT INTO accounts (kode_akun, nama_akun, kategori, subkategori, saldo_normal, is_kas_bank, deskripsi)
VALUES
('1-2001', 'Aset Tetap - Kendaraan & Logistik', 'ASSET', 'Aset Tetap', 'DEBIT', FALSE, 'Kendaraan operasional dan pengiriman'),
('1-2002', 'Aset Tetap - Peralatan Gudang & Kantor', 'ASSET', 'Aset Tetap', 'DEBIT', FALSE, 'Peralatan gudang, barcode scanner, komputer, rak aset'),
('1-2009', 'Akumulasi Penyusutan Aset Tetap', 'ASSET', 'Kontra Aset Tetap', 'KREDIT', FALSE, 'Kontra aset: total akumulasi depresiasi aset tetap'),
('2-1004', 'Utang Pajak PPh (PPh 21/23/4(2))', 'LIABILITY', 'Kewajiban Lancar', 'KREDIT', FALSE, 'Titipan pemotongan pajak PPh yang harus disetor ke kas negara'),
('4-2002', 'Keuntungan Selisih Kurs (Forex Gain)', 'REVENUE', 'Pendapatan Non-Usaha', 'KREDIT', FALSE, 'Laba atas selisih kurs mata uang asing'),
('6-1020', 'Beban Penyusutan Aset Tetap (Depreciation)', 'EXPENSE', 'Beban Penyusutan', 'DEBIT', FALSE, 'Depresiasi aset tetap bulanan'),
('6-1021', 'Kerugian Selisih Kurs (Forex Loss)', 'EXPENSE', 'Beban Lainnya', 'DEBIT', FALSE, 'Rugi akibat selisih kurs mata uang asing'),
('6-1022', 'Beban Pajak Penghasilan', 'EXPENSE', 'Beban Pajak', 'DEBIT', FALSE, 'Beban pajak PPh badan / operasional')
ON DUPLICATE KEY UPDATE nama_akun = VALUES(nama_akun);

-- 1. PERIOD-END CLOSING (Tutup Buku Bulanan & Tahunan)
CREATE TABLE IF NOT EXISTS accounting_periods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tahun INT NOT NULL,
    bulan INT NOT NULL, -- 1-12 (atau 13 untuk tutup tahun)
    tanggal_tutup DATE NOT NULL,
    status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    total_pendapatan DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_beban DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    laba_bersih DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    closing_journal_id INT NULL,
    closed_by INT NULL,
    catatan TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_periode (tahun, bulan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. FIXED ASSETS & DEPRECIATION (Aset Tetap & Penyusutan Otomatis)
CREATE TABLE IF NOT EXISTS fixed_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_aset VARCHAR(50) NOT NULL UNIQUE,
    nama_aset VARCHAR(150) NOT NULL,
    kategori_aset VARCHAR(100) NOT NULL DEFAULT 'Peralatan',
    account_asset_id INT NOT NULL,
    account_accum_id INT NOT NULL,
    account_expense_id INT NOT NULL,
    tanggal_perolehan DATE NOT NULL,
    harga_perolehan DECIMAL(15,2) NOT NULL,
    nilai_residu DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    masa_manfaat_bulan INT NOT NULL DEFAULT 48, -- contoh 4 tahun = 48 bulan
    metode_penyusutan ENUM('GARIS_LURUS', 'SALDO_MENURUN') NOT NULL DEFAULT 'GARIS_LURUS',
    akumulasi_penyusutan DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    nilai_buku DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    lokasi VARCHAR(100) NULL,
    status ENUM('AKTIF', 'DIJUAL', 'DIHAPUS') NOT NULL DEFAULT 'AKTIF',
    keterangan TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_asset_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (account_accum_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (account_expense_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS asset_depreciations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    periode_bulan VARCHAR(7) NOT NULL, -- Format YYYY-MM
    tanggal_proses DATE NOT NULL,
    nominal_penyusutan DECIMAL(15,2) NOT NULL,
    nilai_buku_setelahnya DECIMAL(15,2) NOT NULL,
    journal_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES fixed_assets(id) ON DELETE CASCADE,
    UNIQUE KEY uk_asset_periode (asset_id, periode_bulan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. BANK RECONCILIATION (Rekonsiliasi Rekening Koran Bank)
CREATE TABLE IF NOT EXISTS bank_reconciliations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_rekonsiliasi VARCHAR(50) NOT NULL UNIQUE,
    account_bank_id INT NOT NULL,
    periode_bulan VARCHAR(7) NOT NULL, -- YYYY-MM
    tanggal_rekon DATE NOT NULL,
    saldo_buku DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    saldo_bank DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    selisih DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status ENUM('DRAFT', 'RECONCILED') NOT NULL DEFAULT 'DRAFT',
    catatan TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_bank_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bank_statement_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reconciliation_id INT NOT NULL,
    tanggal DATE NOT NULL,
    keterangan VARCHAR(255) NOT NULL,
    tipe ENUM('MASUK', 'KELUAR') NOT NULL,
    nominal DECIMAL(15,2) NOT NULL,
    is_matched BOOLEAN NOT NULL DEFAULT FALSE,
    matched_journal_line_id INT NULL,
    catatan VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. BUDGETING & BUDGET CONTROL (Anggaran vs Realisasi)
CREATE TABLE IF NOT EXISTS budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tahun INT NOT NULL,
    judul_anggaran VARCHAR(150) NOT NULL,
    divisi VARCHAR(100) NOT NULL DEFAULT 'Gudang & Operasional',
    catatan TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_budget_tahun_divisi (tahun, divisi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS budget_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    budget_id INT NOT NULL,
    account_id INT NOT NULL,
    nominal_anggaran DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    catatan VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_budget_acc (budget_id, account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. TAX MANAGEMENT (Manajemen Pajak PPN & PPh)
CREATE TABLE IF NOT EXISTS tax_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_transaksi VARCHAR(50) NOT NULL UNIQUE,
    tipe_pajak ENUM('PPN_MASUKAN', 'PPN_KELUARAN', 'PPH_21', 'PPH_23', 'PPH_4_2') NOT NULL,
    tanggal DATE NOT NULL,
    no_faktur_pajak VARCHAR(50) NULL,
    pihak_terkait VARCHAR(150) NOT NULL, -- Nama Supplier / Customer / Vendor
    dpp DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tarif_persen DECIMAL(5,2) NOT NULL DEFAULT 11.00,
    nominal_pajak DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    referensi VARCHAR(100) NULL, -- No PO / SO / Invoice
    status_spt ENUM('BELUM_LAPOR', 'SIAP_LAPOR', 'SUDAH_LAPOR') NOT NULL DEFAULT 'BELUM_LAPOR',
    journal_id INT NULL,
    catatan TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. MULTI-CURRENCY & KURS
CREATE TABLE IF NOT EXISTS currencies (
    kode VARCHAR(5) PRIMARY KEY, -- USD, SGD, EUR, JPY, IDR
    nama VARCHAR(50) NOT NULL,
    simbol VARCHAR(5) NOT NULL,
    kurs_ke_idr DECIMAL(15,2) NOT NULL DEFAULT 1.00,
    tanggal_kurs DATE NOT NULL,
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO currencies (kode, nama, simbol, kurs_ke_idr, tanggal_kurs, is_base)
VALUES
('IDR', 'Rupiah Indonesia', 'Rp', 1.00, CURRENT_DATE(), TRUE),
('USD', 'US Dollar', '$', 15800.00, CURRENT_DATE(), FALSE),
('SGD', 'Singapore Dollar', 'S$', 12100.00, CURRENT_DATE(), FALSE),
('EUR', 'Euro', '€', 17200.00, CURRENT_DATE(), FALSE)
ON DUPLICATE KEY UPDATE kurs_ke_idr = VALUES(kurs_ke_idr), tanggal_kurs = VALUES(tanggal_kurs);

