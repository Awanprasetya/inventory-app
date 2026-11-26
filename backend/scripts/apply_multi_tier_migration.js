require('dotenv').config();
const pool = require('../src/config/db');

async function addColumnIfNotExists(table, column, definition) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (cols.length === 0) {
    console.log(`Adding column ${column} to ${table}...`);
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`✓ Column ${column} added to ${table}`);
  } else {
    console.log(`- Column ${column} already exists on ${table}`);
  }
}

async function run() {
  try {
    console.log('--- Applying Multi-Tier Unit Migration ---');
    // 1. products
    await addColumnIfNotExists('products', 'satuan_menengah', "VARCHAR(50) DEFAULT 'PACK' AFTER `satuan_besar`");
    await addColumnIfNotExists('products', 'isi_pack_pcs', "DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `satuan_menengah`");
    await addColumnIfNotExists('products', 'isi_box_pack', "DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `isi_pack_pcs`");
    await addColumnIfNotExists('products', 'isi_box_pcs', "DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER `isi_box_pack`");

    // Sync products data
    await pool.query(`
      UPDATE products 
      SET isi_box_pcs = COALESCE(isi_per_kemasan, 1.00),
          isi_box_pack = COALESCE(isi_per_kemasan, 1.00),
          isi_pack_pcs = 1.00,
          satuan_menengah = COALESCE(satuan_menengah, 'PACK')
      WHERE (isi_box_pcs = 1.00 OR isi_box_pcs IS NULL) AND isi_per_kemasan > 1.00
    `);
    console.log('✓ Products initial unit ratios synced');

    // 2. purchase_order_details
    await addColumnIfNotExists('purchase_order_details', 'satuan_order', "VARCHAR(20) DEFAULT 'PCS'");
    await addColumnIfNotExists('purchase_order_details', 'qty_order', "DECIMAL(10,2) DEFAULT NULL");
    await addColumnIfNotExists('purchase_order_details', 'rasio_pcs', "DECIMAL(10,2) DEFAULT 1.00");

    // 3. sales_order_details
    await addColumnIfNotExists('sales_order_details', 'satuan_order', "VARCHAR(20) DEFAULT 'PCS'");
    await addColumnIfNotExists('sales_order_details', 'qty_order', "DECIMAL(10,2) DEFAULT NULL");
    await addColumnIfNotExists('sales_order_details', 'rasio_pcs', "DECIMAL(10,2) DEFAULT 1.00");

    // 4. sales_quotation_details
    await addColumnIfNotExists('sales_quotation_details', 'satuan_order', "VARCHAR(20) DEFAULT 'PCS'");
    await addColumnIfNotExists('sales_quotation_details', 'qty_order', "DECIMAL(10,2) DEFAULT NULL");
    await addColumnIfNotExists('sales_quotation_details', 'rasio_pcs', "DECIMAL(10,2) DEFAULT 1.00");

    // 5. delivery_order_details
    await addColumnIfNotExists('delivery_order_details', 'satuan_order', "VARCHAR(20) DEFAULT NULL");
    await addColumnIfNotExists('delivery_order_details', 'qty_order', "DECIMAL(10,2) DEFAULT NULL");
    await addColumnIfNotExists('delivery_order_details', 'rasio_pcs', "DECIMAL(10,2) DEFAULT 1.00");

    console.log('\n--- Migration applied successfully! ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();

