const pool = require('../config/db');

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const findAll = async (tenantId = null, search = '') => {
  const q = search.trim();
  const [rows] = await exec(
    `SELECT 
       c.*,
       t.nama_perusahaan, t.kode_tenant,
       COALESCE(SUM(ar.sisa_piutang), 0) AS total_sisa_piutang,
       COALESCE(SUM(CASE WHEN ar.status != 'LUNAS' AND ar.jatuh_tempo < CURRENT_DATE() THEN ar.sisa_piutang ELSE 0 END), 0) AS total_piutang_overdue,
       COUNT(CASE WHEN ar.status != 'LUNAS' THEN 1 END) AS count_faktur_belum_lunas
     FROM customers c
     LEFT JOIN accounts_receivable ar ON ar.customer_id = c.id
     LEFT JOIN tenants t ON t.id = c.tenant_id
     WHERE (? IS NULL OR c.tenant_id = ?)
       AND (? = '' OR c.kode_customer LIKE ? OR c.nama_customer LIKE ?)
     GROUP BY c.id
     ORDER BY c.id DESC`,
    [tenantId, tenantId, q, `%${q}%`, `%${q}%`]
  );
  return rows;
};

const findById = async (id, tenantId = null) => {
  const [rows] = await exec(
    `SELECT 
       c.*,
       COALESCE(SUM(ar.sisa_piutang), 0) AS total_sisa_piutang,
       COALESCE(SUM(CASE WHEN ar.status != 'LUNAS' AND ar.jatuh_tempo < CURRENT_DATE() THEN ar.sisa_piutang ELSE 0 END), 0) AS total_piutang_overdue,
       COUNT(CASE WHEN ar.status != 'LUNAS' THEN 1 END) AS count_faktur_belum_lunas
     FROM customers c
     LEFT JOIN accounts_receivable ar ON ar.customer_id = c.id
     WHERE c.id = ? AND (? IS NULL OR c.tenant_id = ?)
     GROUP BY c.id
     LIMIT 1`,
    [id, tenantId, tenantId]
  );
  if (rows[0]) return rows[0];

  // Fallback jika argumen terbalik (tenantId, id)
  if (tenantId !== null && typeof tenantId === 'number') {
    const [fallback] = await exec(
      `SELECT 
         c.*,
         COALESCE(SUM(ar.sisa_piutang), 0) AS total_sisa_piutang,
         COALESCE(SUM(CASE WHEN ar.status != 'LUNAS' AND ar.jatuh_tempo < CURRENT_DATE() THEN ar.sisa_piutang ELSE 0 END), 0) AS total_piutang_overdue,
         COUNT(CASE WHEN ar.status != 'LUNAS' THEN 1 END) AS count_faktur_belum_lunas
       FROM customers c
       LEFT JOIN accounts_receivable ar ON ar.customer_id = c.id
       WHERE c.id = ? AND c.tenant_id = ?
       GROUP BY c.id
       LIMIT 1`,
      [tenantId, id]
    );
    if (fallback[0]) return fallback[0];
  }
  return null;
};

const findByKode = async (kodeCustomer, tenantId = null) => {
  const [rows] = await exec(
    `SELECT * FROM customers WHERE kode_customer = ? AND (? IS NULL OR tenant_id = ?) LIMIT 1`,
    [kodeCustomer, tenantId, tenantId]
  );
  return rows[0] || null;
};

const create = async (
  {
    tenantId = 1,
    kodeCustomer,
    namaCustomer,
    jenisCustomer = 'PT',
    telepon = null,
    nomorHp = null,
    email = null,
    npwp = null,
    alamatPengiriman = null,
    alamatKantor = null,
  },
  conn
) => {
  const [result] = await exec(
    `INSERT INTO customers (tenant_id, kode_customer, nama_customer, jenis_customer, telepon, nomor_hp, email, npwp, alamat_pengiriman, alamat_kantor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, kodeCustomer, namaCustomer, jenisCustomer || 'PT', telepon, nomorHp, email, npwp, alamatPengiriman, alamatKantor],
    conn
  );
  return result.insertId;
};

const update = async (
  id,
  tenantId,
  {
    kodeCustomer,
    namaCustomer,
    jenisCustomer = 'PT',
    telepon = null,
    nomorHp = null,
    email = null,
    npwp = null,
    alamatPengiriman = null,
    alamatKantor = null,
  },
  conn
) => {
  await exec(
    `UPDATE customers 
     SET kode_customer = ?, nama_customer = ?, jenis_customer = ?, telepon = ?, nomor_hp = ?, email = ?, npwp = ?, alamat_pengiriman = ?, alamat_kantor = ? 
     WHERE id = ? AND (? IS NULL OR tenant_id = ?)`,
    [kodeCustomer, namaCustomer, jenisCustomer || 'PT', telepon, nomorHp, email, npwp, alamatPengiriman, alamatKantor, id, tenantId, tenantId],
    conn
  );
};

const remove = async (id, tenantId, conn) => {
  await exec(`DELETE FROM customers WHERE id = ? AND (? IS NULL OR tenant_id = ?)`, [id, tenantId, tenantId], conn);
};

module.exports = {
  findAll,
  findById,
  findByKode,
  create,
  update,
  remove,
};
