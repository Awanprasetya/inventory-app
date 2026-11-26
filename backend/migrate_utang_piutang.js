const pool = require('./src/config/db');

async function migrate() {
  console.log('Running Utang & Piutang migration...');

  // 1. Check purchase_orders columns
  const [poCols] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders'"
  );
  const poColNames = poCols.map((c) => c.COLUMN_NAME);

  if (!poColNames.includes('termin_hari')) {
    console.log('Adding purchase_orders.termin_hari...');
    await pool.query(
      'ALTER TABLE purchase_orders ADD COLUMN termin_hari INT NOT NULL DEFAULT 30 AFTER tanggal_po'
    );
  }
  if (!poColNames.includes('jatuh_tempo')) {
    console.log('Adding purchase_orders.jatuh_tempo...');
    await pool.query(
      'ALTER TABLE purchase_orders ADD COLUMN jatuh_tempo DATE NULL AFTER termin_hari'
    );
  }

  // 2. Check sales_orders columns
  const [soCols] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_orders'"
  );
  const soColNames = soCols.map((c) => c.COLUMN_NAME);

  if (!soColNames.includes('termin_hari')) {
    console.log('Adding sales_orders.termin_hari...');
    await pool.query(
      'ALTER TABLE sales_orders ADD COLUMN termin_hari INT NOT NULL DEFAULT 30 AFTER tanggal_so'
    );
  }
  if (!soColNames.includes('jatuh_tempo')) {
    console.log('Adding sales_orders.jatuh_tempo...');
    await pool.query(
      'ALTER TABLE sales_orders ADD COLUMN jatuh_tempo DATE NULL AFTER termin_hari'
    );
  }

  // 3. Update default jatuh_tempo if null
  await pool.query(
    'UPDATE purchase_orders SET jatuh_tempo = DATE_ADD(tanggal_po, INTERVAL termin_hari DAY) WHERE jatuh_tempo IS NULL'
  );
  await pool.query(
    'UPDATE sales_orders SET jatuh_tempo = DATE_ADD(tanggal_so, INTERVAL termin_hari DAY) WHERE jatuh_tempo IS NULL'
  );

  // 4. Create accounts_payable
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts_payable (
      id INT AUTO_INCREMENT PRIMARY KEY,
      no_tagihan VARCHAR(50) NOT NULL UNIQUE,
      po_id INT NULL,
      supplier_id INT NULL,
      tanggal DATE NOT NULL,
      jatuh_tempo DATE NOT NULL,
      total_tagihan DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      total_dibayar DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      sisa_utang DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      status ENUM('BELUM_LUNAS', 'SEBAGIAN', 'LUNAS') NOT NULL DEFAULT 'BELUM_LUNAS',
      keterangan TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      INDEX idx_ap_po (po_id),
      INDEX idx_ap_supplier (supplier_id),
      INDEX idx_ap_jatuh_tempo (jatuh_tempo),
      INDEX idx_ap_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // 5. Create payable_payments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payable_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      payable_id INT NOT NULL,
      no_pembayaran VARCHAR(50) NOT NULL UNIQUE,
      tanggal_bayar DATE NOT NULL,
      jumlah_bayar DECIMAL(15,2) NOT NULL,
      metode_pembayaran VARCHAR(50) NOT NULL DEFAULT 'Transfer Bank',
      referensi_bayar VARCHAR(100) NULL,
      catatan TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payable_id) REFERENCES accounts_payable(id) ON DELETE CASCADE,
      INDEX idx_pay_ap (payable_id),
      INDEX idx_pay_ap_tgl (tanggal_bayar)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // 6. Create accounts_receivable
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts_receivable (
      id INT AUTO_INCREMENT PRIMARY KEY,
      no_tagihan VARCHAR(50) NOT NULL UNIQUE,
      so_id INT NULL,
      customer_id INT NULL,
      tanggal DATE NOT NULL,
      jatuh_tempo DATE NOT NULL,
      total_tagihan DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      total_dibayar DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      sisa_piutang DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      status ENUM('BELUM_LUNAS', 'SEBAGIAN', 'LUNAS') NOT NULL DEFAULT 'BELUM_LUNAS',
      keterangan TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      INDEX idx_ar_so (so_id),
      INDEX idx_ar_customer (customer_id),
      INDEX idx_ar_jatuh_tempo (jatuh_tempo),
      INDEX idx_ar_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // 7. Create receivable_payments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receivable_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receivable_id INT NOT NULL,
      no_pembayaran VARCHAR(50) NOT NULL UNIQUE,
      tanggal_bayar DATE NOT NULL,
      jumlah_bayar DECIMAL(15,2) NOT NULL,
      metode_pembayaran VARCHAR(50) NOT NULL DEFAULT 'Transfer Bank',
      referensi_bayar VARCHAR(100) NULL,
      catatan TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (receivable_id) REFERENCES accounts_receivable(id) ON DELETE CASCADE,
      INDEX idx_pay_ar (receivable_id),
      INDEX idx_pay_ar_tgl (tanggal_bayar)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);

  // 8. Synchronize existing PO to accounts_payable
  await pool.query(`
    INSERT INTO accounts_payable (no_tagihan, po_id, supplier_id, tanggal, jatuh_tempo, total_tagihan, total_dibayar, sisa_utang, status, keterangan)
    SELECT 
      CONCAT('AP-', po.no_po) AS no_tagihan,
      po.id AS po_id,
      po.supplier_id,
      po.tanggal_po AS tanggal,
      COALESCE(po.jatuh_tempo, DATE_ADD(po.tanggal_po, INTERVAL 30 DAY)) AS jatuh_tempo,
      po.total_harga AS total_tagihan,
      0.00 AS total_dibayar,
      po.total_harga AS sisa_utang,
      IF(po.total_harga <= 0, 'LUNAS', 'BELUM_LUNAS') AS status,
      CONCAT('Otomatis dari PO: ', po.no_po) AS keterangan
    FROM purchase_orders po
    WHERE NOT EXISTS (
      SELECT 1 FROM accounts_payable ap WHERE ap.po_id = po.id
    );
  `);

  // 9. Synchronize existing SO to accounts_receivable
  await pool.query(`
    INSERT INTO accounts_receivable (no_tagihan, so_id, customer_id, tanggal, jatuh_tempo, total_tagihan, total_dibayar, sisa_piutang, status, keterangan)
    SELECT 
      CONCAT('AR-', so.no_so) AS no_tagihan,
      so.id AS so_id,
      so.customer_id,
      so.tanggal_so AS tanggal,
      COALESCE(so.jatuh_tempo, DATE_ADD(so.tanggal_so, INTERVAL 30 DAY)) AS jatuh_tempo,
      so.total_harga AS total_tagihan,
      0.00 AS total_dibayar,
      so.total_harga AS sisa_piutang,
      IF(so.total_harga <= 0, 'LUNAS', 'BELUM_LUNAS') AS status,
      CONCAT('Otomatis dari SO: ', so.no_so) AS keterangan
    FROM sales_orders so
    WHERE NOT EXISTS (
      SELECT 1 FROM accounts_receivable ar WHERE ar.so_id = so.id
    );
  `);

  console.log('Utang & Piutang migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

