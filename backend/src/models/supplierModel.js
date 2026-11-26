const pool = require('../config/db');

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const findAll = async (tenantId = null, search = '') => {
  const q = search.trim();
  const [rows] = await exec(
    `SELECT 
       s.*,
       t.nama_perusahaan, t.kode_tenant,
       COALESCE(SUM(ap.sisa_utang), 0) AS total_sisa_utang,
       COALESCE(SUM(CASE WHEN ap.status != 'LUNAS' AND ap.jatuh_tempo < CURRENT_DATE() THEN ap.sisa_utang ELSE 0 END), 0) AS total_utang_overdue,
       COUNT(CASE WHEN ap.status != 'LUNAS' THEN 1 END) AS count_faktur_belum_lunas
     FROM suppliers s
     LEFT JOIN accounts_payable ap ON ap.supplier_id = s.id
     LEFT JOIN tenants t ON t.id = s.tenant_id
     WHERE (? IS NULL OR s.tenant_id = ?)
       AND (? = '' OR s.kode_supplier LIKE ? OR s.nama_supplier LIKE ?)
     GROUP BY s.id
     ORDER BY s.id DESC`,
    [tenantId, tenantId, q, `%${q}%`, `%${q}%`]
  );
  return rows;
};

const findById = async (id, tenantId = null) => {
  const [rows] = await exec(
    `SELECT 
       s.*,
       COALESCE(SUM(ap.sisa_utang), 0) AS total_sisa_utang,
       COALESCE(SUM(CASE WHEN ap.status != 'LUNAS' AND ap.jatuh_tempo < CURRENT_DATE() THEN ap.sisa_utang ELSE 0 END), 0) AS total_utang_overdue,
       COUNT(CASE WHEN ap.status != 'LUNAS' THEN 1 END) AS count_faktur_belum_lunas
     FROM suppliers s
     LEFT JOIN accounts_payable ap ON ap.supplier_id = s.id
     WHERE s.id = ? AND (? IS NULL OR s.tenant_id = ?)
     GROUP BY s.id
     LIMIT 1`,
    [id, tenantId, tenantId]
  );
  if (rows[0]) return rows[0];

  // Fallback jika argumen terbalik (tenantId, id)
  if (tenantId !== null && typeof tenantId === 'number') {
    const [fallback] = await exec(
      `SELECT 
         s.*,
         COALESCE(SUM(ap.sisa_utang), 0) AS total_sisa_utang,
         COALESCE(SUM(CASE WHEN ap.status != 'LUNAS' AND ap.jatuh_tempo < CURRENT_DATE() THEN ap.sisa_utang ELSE 0 END), 0) AS total_utang_overdue,
         COUNT(CASE WHEN ap.status != 'LUNAS' THEN 1 END) AS count_faktur_belum_lunas
       FROM suppliers s
       LEFT JOIN accounts_payable ap ON ap.supplier_id = s.id
       WHERE s.id = ? AND s.tenant_id = ?
       GROUP BY s.id
       LIMIT 1`,
      [tenantId, id]
    );
    if (fallback[0]) return fallback[0];
  }
  return null;
};

const findByKode = async (kodeSupplier, tenantId = null) => {
  const [rows] = await exec(
    `SELECT * FROM suppliers WHERE kode_supplier = ? AND (? IS NULL OR tenant_id = ?) LIMIT 1`,
    [kodeSupplier, tenantId, tenantId]
  );
  return rows[0] || null;
};

const create = async (
  {
    tenantId = 1,
    kodeSupplier,
    namaSupplier,
    telepon = null,
    nomorHp = null,
    email = null,
    npwp = null,
    alamat = null,
    alamatKantor = null,
    alamatPengiriman = null,
  },
  conn
) => {
  const legacyAlamat = alamat || alamatKantor || alamatPengiriman || null;
  const [result] = await exec(
    `INSERT INTO suppliers (tenant_id, kode_supplier, nama_supplier, telepon, nomor_hp, email, npwp, alamat, alamat_kantor, alamat_pengiriman) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, kodeSupplier, namaSupplier, telepon, nomorHp, email, npwp, legacyAlamat, alamatKantor, alamatPengiriman],
    conn
  );
  return result.insertId;
};

const update = async (
  id,
  tenantId,
  {
    kodeSupplier,
    namaSupplier,
    telepon = null,
    nomorHp = null,
    email = null,
    npwp = null,
    alamat = null,
    alamatKantor = null,
    alamatPengiriman = null,
  },
  conn
) => {
  const legacyAlamat = alamat || alamatKantor || alamatPengiriman || null;
  await exec(
    `UPDATE suppliers 
     SET kode_supplier = ?, nama_supplier = ?, telepon = ?, nomor_hp = ?, email = ?, npwp = ?, alamat = ?, alamat_kantor = ?, alamat_pengiriman = ? 
     WHERE id = ? AND (? IS NULL OR tenant_id = ?)`,
    [kodeSupplier, namaSupplier, telepon, nomorHp, email, npwp, legacyAlamat, alamatKantor, alamatPengiriman, id, tenantId, tenantId],
    conn
  );
};

const remove = async (id, tenantId, conn) => {
  await exec(`DELETE FROM suppliers WHERE id = ? AND (? IS NULL OR tenant_id = ?)`, [id, tenantId, tenantId], conn);
};

module.exports = {
  findAll,
  findById,
  findByKode,
  create,
  update,
  remove,
};
