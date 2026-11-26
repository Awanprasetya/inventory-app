const pool = require('../config/db');

const ROLES = [
  'PENGEMBANG',
  'DEVELOPER',
  'SUPERADMIN',
  'ADMINISTRATOR',
  'ADMIN',
  'ADMIN_KEUANGAN',
  'ADMIN_AKUNTANSI',
  'FINANCE',
  'ADMIN_GUDANG',
  'WAREHOUSE',
  'ADMIN_OPERASIONAL',
  'ADMIN_OPERATIONAL',
  'OPERATIONAL',
];

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

// Daftar user tanpa kolom password (filtered by tenantId)
const findAll = async (tenantId = null) => {
  let sql = `SELECT u.id, u.tenant_id, u.nama_lengkap, u.username, u.role, u.warehouse_id, u.created_at,
                    t.nama_perusahaan, w.nama_gudang, w.kode_gudang
             FROM users u
             LEFT JOIN tenants t ON u.tenant_id = t.id
             LEFT JOIN warehouses w ON u.warehouse_id = w.id`;
  const params = [];
  if (tenantId) {
    sql += ` WHERE u.tenant_id = ?`;
    params.push(tenantId);
  }
  sql += ` ORDER BY FIELD(u.role, 'ADMINISTRATOR', 'ADMIN_GUDANG'), u.nama_lengkap ASC`;
  const [rows] = await exec(sql, params);
  return rows;
};

// Untuk login & auth: sertakan kolom password, tenant_id, dan nama_perusahaan + gudang
const findByUsername = async (username) => {
  const [rows] = await exec(
    `SELECT u.*, t.nama_perusahaan, t.status AS tenant_status, w.nama_gudang, w.kode_gudang
     FROM users u
     LEFT JOIN tenants t ON u.tenant_id = t.id
     LEFT JOIN warehouses w ON u.warehouse_id = w.id
     WHERE u.username = ? LIMIT 1`,
    [username]
  );
  return rows[0] || null;
};

const findById = async (id) => {
  const [rows] = await exec(
    `SELECT u.id, u.tenant_id, u.nama_lengkap, u.username, u.role, u.warehouse_id, u.created_at,
            t.nama_perusahaan, w.nama_gudang, w.kode_gudang
     FROM users u
     LEFT JOIN tenants t ON u.tenant_id = t.id
     LEFT JOIN warehouses w ON u.warehouse_id = w.id
     WHERE u.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const create = async ({ tenantId = 1, namaLengkap, username, passwordHash, role, warehouseId = null }) => {
  const [result] = await exec(
    `INSERT INTO users (tenant_id, nama_lengkap, username, password, role, warehouse_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, namaLengkap, username, passwordHash, role, warehouseId || null]
  );
  return result.insertId;
};

// Perbarui hanya field yang dikirim; passwordHash null = tidak diganti
const update = async (id, { tenantId = null, namaLengkap, username, role, warehouseId = undefined, passwordHash = null }) => {
  const fields = ['nama_lengkap = ?', 'username = ?', 'role = ?'];
  const values = [namaLengkap, username, role];
  if (tenantId) {
    fields.push('tenant_id = ?');
    values.push(tenantId);
  }
  if (warehouseId !== undefined) {
    fields.push('warehouse_id = ?');
    values.push(warehouseId || null);
  }
  if (passwordHash) {
    fields.push('password = ?');
    values.push(passwordHash);
  }
  values.push(id);
  const [result] = await exec(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return result.affectedRows;
};

const remove = async (id) => {
  const [result] = await exec(`DELETE FROM users WHERE id = ?`, [id]);
  return result.affectedRows;
};

module.exports = { ROLES, findAll, findByUsername, findById, create, update, remove };
