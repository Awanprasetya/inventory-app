-- ============================================================
-- MIGRASI: Tabel Master Supplier, Customer, PO, SO, dan DO
-- Aman dijalankan berulang (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_supplier VARCHAR(50) NOT NULL UNIQUE,
    nama_supplier VARCHAR(150) NOT NULL,
    telepon VARCHAR(30),
    alamat TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_customer VARCHAR(50) NOT NULL UNIQUE,
    nama_customer VARCHAR(150) NOT NULL,
    telepon VARCHAR(30),
    alamat_pengiriman TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_po VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INT,
    tanggal_po DATE NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS purchase_order_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    kode_produk VARCHAR(50) NOT NULL,
    qty_pesan INT NOT NULL,
    qty_diterima INT DEFAULT 0,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (kode_produk) REFERENCES products(kode_produk) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sales_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_so VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT,
    tanggal_so DATE NOT NULL,
    status ENUM('OPEN', 'PROCESSING', 'CLOSED', 'CANCELLED') DEFAULT 'OPEN',
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sales_order_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    so_id INT NOT NULL,
    kode_produk VARCHAR(50) NOT NULL,
    qty_pesanan INT NOT NULL,
    qty_terkirim INT DEFAULT 0,
    FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (kode_produk) REFERENCES products(kode_produk) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS delivery_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    no_do VARCHAR(50) NOT NULL UNIQUE,
    so_id INT,
    customer_id INT,
    tanggal_do DATE NOT NULL,
    status ENUM('DRAFT', 'SHIPPED', 'DELIVERED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS delivery_order_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    do_id INT NOT NULL,
    nomor_lot VARCHAR(100) NOT NULL,
    qty_kirim INT NOT NULL,
    FOREIGN KEY (do_id) REFERENCES delivery_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (nomor_lot) REFERENCES product_lots(nomor_lot) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

