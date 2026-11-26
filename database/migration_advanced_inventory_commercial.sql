-- ============================================================================
-- MIGRATION: ADVANCED INVENTORY & COMMERCIAL MODULES
-- 1. Multi-Gudang & Transfer Antar Gudang
-- 2. Manajemen Batch / Lot & Expired Date
-- 3. Stok Opname / Stock Adjustment Fisik
-- 4. Penawaran Harga (Sales Quotation)
-- 5. Retur Pembelian (Purchase Return) & Retur Penjualan (Sales Return)
-- ============================================================================

-- 1. Tabel Multi-Gudang (Warehouses)
CREATE TABLE IF NOT EXISTS warehouses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_gudang VARCHAR(50) UNIQUE NOT NULL,
    nama_gudang VARCHAR(100) NOT NULL,
    tipe_gudang VARCHAR(50) DEFAULT 'UTAMA',
    alamat TEXT NULL,
    penanggung_jawab VARCHAR(100) NULL,
    telepon VARCHAR(50) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data Gudang Medis PT JARUM PATAH MEDICAL
INSERT IGNORE INTO warehouses (id, kode_gudang, nama_gudang, tipe_gudang, alamat, penanggung_jawab, telepon, is_active) VALUES
(1, 'GDG-01', 'Gudang Pusat Logistik & Alkes', 'UTAMA', 'Kawasan Industri Cikarang Blok B-12', 'Budi Santoso, S.T.', '021-8983011', 1),
(2, 'GDG-02', 'Gudang Distribusi Farmasi & Obat', 'FARMASI', 'Kawasan Industri Cikarang Blok B-14', 'Apt. Siti Rahma, S.Farm', '021-8983012', 1),
(3, 'GDG-03', 'Gudang Karantina & Retur Medis', 'KARANTINA', 'Kawasan Industri Cikarang Blok C-01', 'Hendra Wijaya', '021-8983015', 1),
(4, 'GDG-04', 'Gudang Cabang Rumah Sakit Surabaya', 'CABANG', 'Jl. Mayjen Sungkono No. 88, Surabaya', 'dr. Anton Pratama', '031-5678901', 1);

-- 2. Tabel Transfer Antar Gudang (Warehouse Transfers)
CREATE TABLE IF NOT EXISTS warehouse_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_transfer VARCHAR(50) UNIQUE NOT NULL,
    from_warehouse_id INT NOT NULL,
    to_warehouse_id INT NOT NULL,
    tanggal DATE NOT NULL,
    status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') DEFAULT 'COMPLETED',
    catatan TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wt_from (from_warehouse_id),
    INDEX idx_wt_to (to_warehouse_id),
    INDEX idx_wt_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_transfer_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transfer_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    catatan VARCHAR(255) NULL,
    INDEX idx_wtd_transfer (transfer_id),
    INDEX idx_wtd_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Stok Opname / Stock Adjustment
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_adjustment VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id INT NOT NULL,
    tanggal DATE NOT NULL,
    tipe_adjustment ENUM('OPNAME_FISIK', 'RUSAK_KEDALUWARSA', 'SELISIH_HILANG', 'KOREKSI_TAMBAH') NOT NULL,
    status ENUM('APPROVED', 'DRAFT', 'CANCELLED') DEFAULT 'APPROVED',
    total_selisih_nominal DECIMAL(15,2) DEFAULT 0,
    journal_id INT NULL,
    catatan TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_adj_wh (warehouse_id),
    INDEX idx_adj_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_adjustment_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    adjustment_id INT NOT NULL,
    product_id INT NOT NULL,
    stok_sistem INT NOT NULL,
    stok_fisik INT NOT NULL,
    selisih_qty INT NOT NULL,
    harga_satuan DECIMAL(15,2) DEFAULT 0,
    selisih_nominal DECIMAL(15,2) DEFAULT 0,
    catatan VARCHAR(255) NULL,
    INDEX idx_adjd_adj (adjustment_id),
    INDEX idx_adjd_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Penawaran Harga (Sales Quotation / SQ)
CREATE TABLE IF NOT EXISTS sales_quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_quotation VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    tanggal DATE NOT NULL,
    berlaku_sampai DATE NOT NULL,
    termin_pembayaran VARCHAR(50) DEFAULT 'NET 30',
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    diskon_nominal DECIMAL(15,2) NOT NULL DEFAULT 0,
    pajak_persen DECIMAL(5,2) NOT NULL DEFAULT 11,
    pajak_nominal DECIMAL(15,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    status ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED_TO_SO') DEFAULT 'DRAFT',
    so_id INT NULL,
    catatan TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sq_customer (customer_id),
    INDEX idx_sq_tanggal (tanggal),
    INDEX idx_sq_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_quotation_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    harga_satuan DECIMAL(15,2) NOT NULL DEFAULT 0,
    diskon_nominal DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    catatan VARCHAR(255) NULL,
    INDEX idx_sqd_quotation (quotation_id),
    INDEX idx_sqd_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Retur Pembelian (Purchase Return)
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_return VARCHAR(50) UNIQUE NOT NULL,
    po_id INT NULL,
    supplier_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    tanggal DATE NOT NULL,
    total_nominal DECIMAL(15,2) NOT NULL DEFAULT 0,
    alasan_retur TEXT NULL,
    tipe_penyelesaian ENUM('POTONG_UTANG', 'PENGEMBALIAN_KAS', 'GANTI_BARANG') DEFAULT 'POTONG_UTANG',
    status ENUM('COMPLETED', 'DRAFT', 'CANCELLED') DEFAULT 'COMPLETED',
    journal_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pr_supplier (supplier_id),
    INDEX idx_pr_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_return_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    harga_satuan DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    catatan VARCHAR(255) NULL,
    INDEX idx_prd_return (return_id),
    INDEX idx_prd_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Retur Penjualan (Sales Return)
CREATE TABLE IF NOT EXISTS sales_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_return VARCHAR(50) UNIQUE NOT NULL,
    so_id INT NULL,
    customer_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    tanggal DATE NOT NULL,
    total_nominal DECIMAL(15,2) NOT NULL DEFAULT 0,
    alasan_retur TEXT NULL,
    tipe_penyelesaian ENUM('POTONG_PIUTANG', 'PENGEMBALIAN_KAS', 'GANTI_BARANG') DEFAULT 'POTONG_PIUTANG',
    kembali_ke_stok BOOLEAN DEFAULT TRUE,
    status ENUM('COMPLETED', 'DRAFT', 'CANCELLED') DEFAULT 'COMPLETED',
    journal_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sr_customer (customer_id),
    INDEX idx_sr_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_return_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    harga_satuan DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    catatan VARCHAR(255) NULL,
    INDEX idx_srd_return (return_id),
    INDEX idx_srd_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Seed Akun COA Baru untuk Retur & Penyesuaian Persediaan
INSERT IGNORE INTO accounts (kode_akun, nama_akun, kategori, subkategori, saldo_normal, is_kas_bank) VALUES
('4-1003', 'Retur Penjualan (Sales Return)', 'REVENUE', 'PENJUALAN', 'DEBIT', 0),
('6-1030', 'Beban Kerusakan & Selisih Stok (Inventory Adjustment)', 'EXPENSE', 'BEBAN_OPERASIONAL', 'DEBIT', 0);

