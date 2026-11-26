const pool = require('../src/config/db');

async function runMigration() {
  console.log('Migrating role_permissions table into database...');
  try {
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ Table role_permissions successfully created/verified!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();

