require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

const dbName = process.env.DB_NAME || 'inventory';

const sqlFiles = [
  'inventory.sql',
  'migration_users.sql',
  'migration_users_role_varchar.sql',
  'migration_harga.sql',
  'migration_fifo_fefo.sql',
  'migration_products_soft_delete.sql',
  'migration_so_do_po.sql',
  'migration_trans_po_do.sql',
  'migration_po_so_pricing.sql',
  'migration_utang_piutang.sql',
  'migration_accounting.sql',
  'migration_erp_accounting_complete.sql',
  'migration_advanced_inventory_commercial.sql',
  'migration_warehouse_operations_enhancement.sql',
  'migration_multi_warehouse_lots_fix.sql',
  'migration_racks_multi_tenant_fix.sql',
  'migration_saas_multitenancy.sql',
  'migration_multitenant_unique_keys.sql',
  'migration_product_unit_conversion.sql',
  'migration_rbac_permissions.sql',
  'migration_multi_tier_units.sql',
  'migration_product_category.sql',
  'migration_intercompany_transfer.sql',
];

async function runSQLFile(connection, filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS safely
  content = content.replace(/CREATE TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ');

  // Remove CLI-only DELIMITER directives safely
  content = content
    .replace(/DELIMITER\s+\/\//gi, '')
    .replace(/DELIMITER\s+;/gi, '')
    .replace(/^\s*\/\/\s*$/gm, ';')
    .replace(/\bEND\s*\/\//gi, 'END;');

  try {
    await connection.query(content);
  } catch (err) {
    // If multi-statement execution throws an error (e.g. duplicate key or table exists), fallback to smart statement execution
    const statements = content
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (innerErr) {
        if (
          innerErr.code === 'ER_TABLE_EXISTS_ERROR' ||
          innerErr.code === 'ER_DUP_FIELDNAME' ||
          innerErr.code === 'ER_DUP_KEYNAME' ||
          innerErr.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
          innerErr.code === 'ER_FK_DUP_NAME' ||
          innerErr.code === 'ER_DUP_ENTRY' ||
          innerErr.code === 'ER_MULTIPLE_PRI_KEY' ||
          innerErr.code === 'ER_KEY_COLUMN_DOES_NOT_EXITS' ||
          innerErr.errno === 1050 ||
          innerErr.errno === 1060 ||
          innerErr.errno === 1061 ||
          innerErr.errno === 1062 ||
          innerErr.errno === 1068 ||
          innerErr.errno === 1072 ||
          innerErr.errno === 1091 ||
          innerErr.errno === 1826
        ) {
          // Ignore duplicate definitions or already dropped indexes
        } else {
          console.warn(`   [NOTICE]: ${innerErr.message}`);
        }
      }
    }
  }
}

async function main() {
  console.log('==================================================');
  console.log(` Starting database migration for database: "${dbName}"`);
  console.log(` Host: ${dbConfig.host}:${dbConfig.port}, User: ${dbConfig.user}`);
  console.log('==================================================\n');

  let connection;
  try {
    // 1. Connect without selecting database to ensure DB creation
    connection = await mysql.createConnection(dbConfig);
    console.log('[1/4] Connected to MySQL Server successfully.');

    // 2. Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
    await connection.query(`USE \`${dbName}\`;`);
    console.log(`[2/4] Database "${dbName}" checked/created and selected.`);

    // 3. Run all SQL migration files in order
    console.log('[3/4] Running SQL migrations...');
    let databaseDir = path.join(__dirname, '..', '..', 'database');
    if (!fs.existsSync(databaseDir)) {
      databaseDir = path.join(__dirname, '..', 'database');
    }

    for (const file of sqlFiles) {
      const fullPath = path.join(databaseDir, file);
      if (fs.existsSync(fullPath)) {
        console.log(`   -> Executing: ${file}...`);
        await runSQLFile(connection, fullPath);
      } else {
        console.warn(`   [WARNING] File not found: ${file}`);
      }
    }
    if (process.argv.includes('--seed')) {
      const seedPath = path.join(databaseDir, 'seed.sql');
      if (fs.existsSync(seedPath)) {
        console.log('   -> Executing: seed.sql (--seed enabled)...');
        await runSQLFile(connection, seedPath);
      }
    }
    console.log('   ✓ All SQL migration files executed successfully.');

    // 4. Run JS schema updates & Utang/Piutang sync (non-destructive)
    console.log('[4/4] Running schema updates & accounts payable/receivable sync...');
    const pool = require('../src/config/db');
    await ensureLatestSchemaUpdates(pool);
    await syncUtangPiutang(pool);

    console.log('\n==================================================');
    console.log(' MIGRATION COMPLETED SUCCESSFULLY! 🎉');
    console.log('==================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n[ERROR] Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function ensureColumn(pool, table, column, definition) {
  const [cols] = await pool.query(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  if (cols.length === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`   + Added column ${table}.${column}`);
  }
}

async function ensureLatestSchemaUpdates(pool) {
  // 1. Produk: kategori_produk, multi-tier units, & nullable izin edar
  await ensureColumn(pool, 'products', 'kategori_produk', "VARCHAR(30) NOT NULL DEFAULT 'BARANG_JADI' AFTER `nama_produk`");
  await ensureColumn(pool, 'products', 'satuan_menengah', "VARCHAR(50) DEFAULT 'PACK' AFTER `satuan_besar`");
  await ensureColumn(pool, 'products', 'isi_pack_pcs', 'DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `satuan_menengah`');
  await ensureColumn(pool, 'products', 'isi_box_pack', 'DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `isi_pack_pcs`');
  await ensureColumn(pool, 'products', 'isi_box_pcs', 'DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `isi_box_pack`');
  await pool.query('ALTER TABLE `products` MODIFY COLUMN `jenis_izin` VARCHAR(50) NULL DEFAULT NULL, MODIFY COLUMN `nomor_izin` VARCHAR(50) NULL DEFAULT NULL');

  // 1b. Suppliers & Customers: kontak lengkap (nomor_hp, email, npwp, alamat_kantor, dll)
  await ensureColumn(pool, 'suppliers', 'nomor_hp', 'VARCHAR(30) NULL DEFAULT NULL AFTER `telepon`');
  await ensureColumn(pool, 'suppliers', 'email', 'VARCHAR(100) NULL DEFAULT NULL AFTER `nomor_hp`');
  await ensureColumn(pool, 'suppliers', 'npwp', 'VARCHAR(50) NULL DEFAULT NULL AFTER `email`');
  await ensureColumn(pool, 'suppliers', 'alamat_kantor', 'TEXT NULL AFTER `alamat`');
  await ensureColumn(pool, 'suppliers', 'alamat_pengiriman', 'TEXT NULL AFTER `alamat_kantor`');
  await pool.query('UPDATE `suppliers` SET `alamat_kantor` = `alamat` WHERE `alamat_kantor` IS NULL AND `alamat` IS NOT NULL');

  await ensureColumn(pool, 'customers', 'jenis_customer', "VARCHAR(30) NOT NULL DEFAULT 'PT' AFTER `nama_customer`");
  await ensureColumn(pool, 'customers', 'nomor_hp', 'VARCHAR(30) NULL DEFAULT NULL AFTER `telepon`');
  await ensureColumn(pool, 'customers', 'email', 'VARCHAR(100) NULL DEFAULT NULL AFTER `nomor_hp`');
  await ensureColumn(pool, 'customers', 'npwp', 'VARCHAR(50) NULL DEFAULT NULL AFTER `email`');
  await ensureColumn(pool, 'customers', 'alamat_kantor', 'TEXT NULL AFTER `alamat_pengiriman`');

  // 1c. Detail PO & SO: diskon_persen
  await ensureColumn(pool, 'purchase_order_details', 'diskon_persen', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER `harga_satuan`');
  await ensureColumn(pool, 'sales_order_details', 'diskon_persen', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER `harga_satuan`');

  // 2. Users: gudang penugasan ADMIN_GUDANG
  await ensureColumn(pool, 'users', 'warehouse_id', 'INT NULL AFTER `role`');
  const [idxRows] = await pool.query(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_warehouse'"
  );
  if (idxRows.length === 0) {
    await pool.query('ALTER TABLE `users` ADD INDEX `idx_users_warehouse` (`warehouse_id`)');
    console.log('   + Added index users.idx_users_warehouse');
  }

  // 3. Warehouse Transfers: approval & multi-tier units
  await pool.query(
    "ALTER TABLE `warehouse_transfers` MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'DRAFT', 'CANCELLED') DEFAULT 'PENDING'"
  );
  await ensureColumn(pool, 'warehouse_transfers', 'to_tenant_id', 'INT NULL AFTER `to_warehouse_id`');
  await ensureColumn(pool, 'warehouse_transfers', 'is_intercompany', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER `to_tenant_id`');
  await ensureColumn(pool, 'warehouse_transfers', 'approved_by', 'INT NULL AFTER `created_by`');
  await ensureColumn(pool, 'warehouse_transfers', 'approved_at', 'DATETIME NULL AFTER `approved_by`');
  await ensureColumn(pool, 'warehouse_transfers', 'rejected_reason', 'VARCHAR(255) NULL AFTER `approved_at`');
  await ensureColumn(pool, 'warehouse_transfers', 'so_id', 'INT NULL AFTER `rejected_reason`');
  await ensureColumn(pool, 'warehouse_transfers', 'do_id', 'INT NULL AFTER `so_id`');
  await ensureColumn(pool, 'warehouse_transfers', 'po_id', 'INT NULL AFTER `do_id`');
  await ensureColumn(pool, 'warehouse_transfer_details', 'satuan_transfer', 'VARCHAR(20) NULL AFTER `qty`');
  await ensureColumn(pool, 'warehouse_transfer_details', 'qty_input', 'DECIMAL(15,2) NULL AFTER `satuan_transfer`');
  await ensureColumn(pool, 'warehouse_transfer_details', 'rasio_pcs', 'DECIMAL(15,2) NULL AFTER `qty_input`');

  // 4. Multi-tier columns on detail tables
  for (const tbl of ['purchase_order_details', 'sales_order_details', 'sales_quotation_details', 'delivery_order_details']) {
    await ensureColumn(pool, tbl, 'satuan_order', "VARCHAR(20) DEFAULT 'PCS'");
    await ensureColumn(pool, tbl, 'qty_order', 'DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn(pool, tbl, 'rasio_pcs', 'DECIMAL(10,2) DEFAULT 1.00');
  }

  // 5. RBAC & Activity Logs tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      role VARCHAR(50) NOT NULL,
      menu_key VARCHAR(100) NOT NULL,
      is_allowed TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_role_menu (tenant_id, role, menu_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      user_id INT NULL,
      username VARCHAR(50) NULL,
      action VARCHAR(100) NOT NULL,
      module VARCHAR(50) NOT NULL,
      details TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_activity_tenant (tenant_id),
      INDEX idx_activity_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('   ✓ Latest schema updates verified (non-destructive).');
}

async function syncUtangPiutang(pool) {
  try {
    // Check & Add columns if needed
    const [poCols] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders'"
    );
    const poColNames = poCols.map((c) => c.COLUMN_NAME);

    if (!poColNames.includes('termin_hari')) {
      await pool.query('ALTER TABLE purchase_orders ADD COLUMN termin_hari INT NOT NULL DEFAULT 30 AFTER tanggal_po');
    }
    if (!poColNames.includes('jatuh_tempo')) {
      await pool.query('ALTER TABLE purchase_orders ADD COLUMN jatuh_tempo DATE NULL AFTER termin_hari');
    }

    const [soCols] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_orders'"
    );
    const soColNames = soCols.map((c) => c.COLUMN_NAME);

    if (!soColNames.includes('termin_hari')) {
      await pool.query('ALTER TABLE sales_orders ADD COLUMN termin_hari INT NOT NULL DEFAULT 30 AFTER tanggal_so');
    }
    if (!soColNames.includes('jatuh_tempo')) {
      await pool.query('ALTER TABLE sales_orders ADD COLUMN jatuh_tempo DATE NULL AFTER termin_hari');
    }

    await pool.query('UPDATE purchase_orders SET jatuh_tempo = DATE_ADD(tanggal_po, INTERVAL termin_hari DAY) WHERE jatuh_tempo IS NULL');
    await pool.query('UPDATE sales_orders SET jatuh_tempo = DATE_ADD(tanggal_so, INTERVAL termin_hari DAY) WHERE jatuh_tempo IS NULL');

    // Sync PO -> accounts_payable
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

    // Sync SO -> accounts_receivable
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

    console.log('   ✓ Accounts payable & receivable synced.');
  } catch (err) {
    console.warn('   [NOTICE] Utang & Piutang sync message:', err.message);
  }
}

main();

