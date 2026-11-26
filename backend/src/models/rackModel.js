const pool = require('../config/db');

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const findAll = async (tenantId = null) => {
  const [rows] = await exec(
    `SELECT r.id, r.tenant_id, r.kode_rak, r.keterangan, r.created_at,
            t.nama_perusahaan, t.kode_tenant,
            (SELECT COUNT(*) FROM products p WHERE p.rack_id = r.id) AS jumlah_produk
     FROM racks r
     LEFT JOIN tenants t ON t.id = r.tenant_id
     WHERE (? IS NULL OR r.tenant_id = ?)
     ORDER BY r.kode_rak ASC`,
    [tenantId, tenantId]
  );
  return rows;
};

const findById = async (tenantId = null, id) => {
  let tId = tenantId;
  let rackId = id;
  if (typeof tenantId === 'number' && id === undefined) {
    rackId = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT r.id, r.tenant_id, r.kode_rak, r.keterangan, r.created_at,
            t.nama_perusahaan, t.kode_tenant
     FROM racks r
     LEFT JOIN tenants t ON t.id = r.tenant_id
     WHERE (? IS NULL OR r.tenant_id = ?) AND r.id = ?
     LIMIT 1`,
    [tId, tId, rackId]
  );
  return rows[0] || null;
};

const create = async ({ tenantId = 1, kodeRak, keterangan = null }) => {
  const [result] = await exec(
    `INSERT INTO racks (tenant_id, kode_rak, keterangan) VALUES (?, ?, ?)`,
    [tenantId || 1, kodeRak, keterangan]
  );
  return result.insertId;
};

const update = async (tenantId = null, id, { kodeRak, keterangan = null, tenantId: newTenantId = null }) => {
  const [result] = await exec(
    `UPDATE racks
     SET kode_rak = ?, keterangan = ?, tenant_id = COALESCE(?, tenant_id)
     WHERE (? IS NULL OR tenant_id = ?) AND id = ?`,
    [kodeRak, keterangan, newTenantId, tenantId, tenantId, id]
  );
  return result.affectedRows;
};

const remove = async (tenantId = null, id) => {
  const [result] = await exec(`DELETE FROM racks WHERE (? IS NULL OR tenant_id = ?) AND id = ?`, [tenantId, tenantId, id]);
  return result.affectedRows;
};

module.exports = { findAll, findById, create, update, remove };
