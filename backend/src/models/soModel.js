const pool = require('../config/db');

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const findAll = async (tenantId = null, status = null, search = '') => {
  const q = search.trim();
  const [rows] = await exec(
    `SELECT 
       so.*, 
       c.nama_customer, 
       c.kode_customer,
       ar.id AS ar_id,
       ar.no_tagihan,
       CASE 
         WHEN ar.id IS NULL THEN 'BELUM_DITAGIH'
         ELSE ar.status 
       END AS status_pembayaran,
       COALESCE(ar.total_dibayar, 0.00) AS total_dibayar,
       COALESCE(ar.sisa_piutang, so.total_harga) AS sisa_piutang,
       DATEDIFF(CURRENT_DATE(), COALESCE(so.jatuh_tempo, ar.jatuh_tempo)) AS hari_terlewat_tempo
     FROM sales_orders so
     LEFT JOIN customers c ON c.id = so.customer_id
     LEFT JOIN accounts_receivable ar ON ar.so_id = so.id
     WHERE (? IS NULL OR so.tenant_id = ?)
       AND (? IS NULL OR so.status = ?)
       AND (? = '' OR so.no_so LIKE ? OR c.nama_customer LIKE ?)
     ORDER BY so.id DESC`,
    [tenantId, tenantId, status, status, q, `%${q}%`, `%${q}%`]
  );
  return rows;
};

const findById = async (tenantId = null, id, conn = null) => {
  let tId = tenantId;
  let soId = id;
  if (typeof tenantId === 'number' && id === undefined) {
    soId = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT 
       so.*, 
       c.nama_customer, 
       c.kode_customer, 
       c.telepon AS customer_telepon, 
       c.nomor_hp AS customer_hp,
       c.email AS customer_email,
       c.npwp AS customer_npwp,
       c.alamat_pengiriman,
       c.alamat_kantor AS customer_alamat_kantor,
       ar.id AS ar_id,
       ar.no_tagihan,
       CASE 
         WHEN ar.id IS NULL THEN 'BELUM_DITAGIH'
         ELSE ar.status 
       END AS status_pembayaran,
       COALESCE(ar.total_dibayar, 0.00) AS total_dibayar,
       COALESCE(ar.sisa_piutang, so.total_harga) AS sisa_piutang,
       DATEDIFF(CURRENT_DATE(), COALESCE(so.jatuh_tempo, ar.jatuh_tempo)) AS hari_terlewat_tempo
     FROM sales_orders so
     LEFT JOIN customers c ON c.id = so.customer_id
     LEFT JOIN accounts_receivable ar ON ar.so_id = so.id
     WHERE (? IS NULL OR so.tenant_id = ?) AND so.id = ? LIMIT 1`,
    [tId, tId, soId],
    conn
  );
  return rows[0] || null;
};

const findByNoSo = async (tenantId = null, noSo) => {
  let tId = tenantId;
  let code = noSo;
  if (typeof tenantId === 'string' && noSo === undefined) {
    code = tenantId;
    tId = null;
  }

  const [rows] = await exec(`SELECT * FROM sales_orders WHERE (? IS NULL OR tenant_id = ?) AND no_so = ? LIMIT 1`, [tId, tId, code]);
  return rows[0] || null;
};

const findDetailsBySoId = async (soId) => {
  const [rows] = await exec(
    `SELECT sod.*, p.nama_produk, p.satuan, p.satuan_besar, p.satuan_menengah,
            p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan, p.harga AS master_harga
     FROM sales_order_details sod
     LEFT JOIN products p ON p.kode_produk = sod.kode_produk AND p.tenant_id = sod.tenant_id
     WHERE sod.so_id = ?
     ORDER BY sod.id ASC`,
    [soId]
  );
  return rows;
};

const create = async (
  {
    tenantId = 1,
    noSo,
    customerId,
    tanggalSo,
    terminHari = 30,
    jatuhTempo = null,
    status = 'OPEN',
    keterangan = null,
    subtotal = 0,
    diskonPersen = 0,
    diskonNominal = 0,
    pajakPersen = 0,
    pajakNominal = 0,
    totalHarga = 0,
  },
  conn
) => {
  const [result] = await exec(
    `INSERT INTO sales_orders (
       tenant_id, no_so, customer_id, tanggal_so, termin_hari, jatuh_tempo, status, keterangan,
       subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total_harga
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId || 1,
      noSo,
      customerId,
      tanggalSo,
      terminHari,
      jatuhTempo,
      status,
      keterangan,
      subtotal,
      diskonPersen,
      diskonNominal,
      pajakPersen,
      pajakNominal,
      totalHarga,
    ],
    conn
  );
  return result.insertId;
};

const createDetail = async (
  { tenantId = 1, soId, kodeProduk, qtyPesanan, hargaSatuan = 0, diskon = 0, diskonPersen = 0, subtotal = 0, qtyTerkirim = 0, satuanOrder = 'PCS', qtyOrder = null, rasioPcs = 1 },
  conn
) => {
  const [result] = await exec(
    `INSERT INTO sales_order_details (
       tenant_id, so_id, kode_produk, qty_pesanan, harga_satuan, diskon, diskon_persen, subtotal, qty_terkirim, satuan_order, qty_order, rasio_pcs
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, soId, kodeProduk, qtyPesanan, hargaSatuan, diskon, Number(diskonPersen) || 0, subtotal, qtyTerkirim, satuanOrder || 'PCS', qtyOrder, Number(rasioPcs) || 1],
    conn
  );
  return result.insertId;
};

const updateStatus = async (id, status, conn) => {
  await exec(`UPDATE sales_orders SET status = ? WHERE id = ?`, [status, id], conn);
};

const updateDetailQtyTerkirim = async (detailId, addQty, conn) => {
  await exec(
    `UPDATE sales_order_details SET qty_terkirim = qty_terkirim + ? WHERE id = ?`,
    [addQty, detailId],
    conn
  );
};

const remove = async (id, conn) => {
  await exec(`DELETE FROM sales_orders WHERE id = ?`, [id], conn);
};

module.exports = {
  findAll,
  findById,
  findByNoSo,
  findDetailsBySoId,
  create,
  createDetail,
  updateStatus,
  updateDetailQtyTerkirim,
  remove,
};
