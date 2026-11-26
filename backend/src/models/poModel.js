const pool = require('../config/db');

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const findAll = async (tenantId = null, status = null, search = '') => {
  const q = search.trim();
  const [rows] = await exec(
    `SELECT 
       po.*, 
       s.nama_supplier, 
       s.kode_supplier,
       ap.id AS ap_id,
       ap.no_tagihan,
       COALESCE(ap.status, IF(po.total_harga <= 0, 'LUNAS', 'BELUM_LUNAS')) AS status_pembayaran,
       COALESCE(ap.total_dibayar, 0.00) AS total_dibayar,
       COALESCE(ap.sisa_utang, po.total_harga) AS sisa_utang,
       DATEDIFF(CURRENT_DATE(), COALESCE(po.jatuh_tempo, ap.jatuh_tempo)) AS hari_terlewat_tempo
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN accounts_payable ap ON ap.po_id = po.id
     WHERE (? IS NULL OR po.tenant_id = ?)
       AND (? IS NULL OR po.status = ?)
       AND (? = '' OR po.no_po LIKE ? OR s.nama_supplier LIKE ?)
     ORDER BY po.id DESC`,
    [tenantId, tenantId, status, status, q, `%${q}%`, `%${q}%`]
  );
  return rows;
};

const findById = async (tenantId = null, id, conn = null) => {
  let tId = tenantId;
  let poId = id;
  if (typeof tenantId === 'number' && id === undefined) {
    poId = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT 
       po.*, 
       s.nama_supplier, 
       s.kode_supplier, 
       s.telepon AS supplier_telepon, 
       s.nomor_hp AS supplier_hp,
       s.email AS supplier_email,
       s.npwp AS supplier_npwp,
       COALESCE(s.alamat_kantor, s.alamat) AS supplier_alamat,
       s.alamat_kantor AS supplier_alamat_kantor,
       s.alamat_pengiriman AS supplier_alamat_pengiriman,
       ap.id AS ap_id,
       ap.no_tagihan,
       COALESCE(ap.status, IF(po.total_harga <= 0, 'LUNAS', 'BELUM_LUNAS')) AS status_pembayaran,
       COALESCE(ap.total_dibayar, 0.00) AS total_dibayar,
       COALESCE(ap.sisa_utang, po.total_harga) AS sisa_utang,
       DATEDIFF(CURRENT_DATE(), COALESCE(po.jatuh_tempo, ap.jatuh_tempo)) AS hari_terlewat_tempo
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN accounts_payable ap ON ap.po_id = po.id
     WHERE (? IS NULL OR po.tenant_id = ?) AND po.id = ? LIMIT 1`,
    [tId, tId, poId],
    conn
  );
  return rows[0] || null;
};

const findByNoPo = async (tenantId = null, noPo) => {
  let tId = tenantId;
  let code = noPo;
  if (typeof tenantId === 'string' && noPo === undefined) {
    code = tenantId;
    tId = null;
  }

  const [rows] = await exec(`SELECT * FROM purchase_orders WHERE (? IS NULL OR tenant_id = ?) AND no_po = ? LIMIT 1`, [tId, tId, code]);
  return rows[0] || null;
};

const findDetailsByPoId = async (poId) => {
  const [rows] = await exec(
    `SELECT pod.*, p.nama_produk, p.satuan, p.satuan_besar, p.satuan_menengah, 
            p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan, p.harga AS master_harga
     FROM purchase_order_details pod
     LEFT JOIN products p ON p.kode_produk = pod.kode_produk AND p.tenant_id = pod.tenant_id
     WHERE pod.po_id = ?
     ORDER BY pod.id ASC`,
    [poId]
  );
  return rows;
};

const create = async (
  {
    tenantId = 1,
    noPo,
    supplierId,
    tanggalPo,
    terminHari = 30,
    jatuhTempo = null,
    status = 'PENDING',
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
    `INSERT INTO purchase_orders (
       tenant_id, no_po, supplier_id, tanggal_po, termin_hari, jatuh_tempo, status, keterangan,
       subtotal, diskon_persen, diskon_nominal, pajak_persen, pajak_nominal, total_harga
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId || 1,
      noPo,
      supplierId,
      tanggalPo,
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
  { tenantId = 1, poId, kodeProduk, qtyPesan, hargaSatuan = 0, diskon = 0, diskonPersen = 0, subtotal = 0, qtyDiterima = 0, satuanOrder = 'PCS', qtyOrder = null, rasioPcs = 1 },
  conn
) => {
  const [result] = await exec(
    `INSERT INTO purchase_order_details (
       tenant_id, po_id, kode_produk, qty_pesan, harga_satuan, diskon, diskon_persen, subtotal, qty_diterima, satuan_order, qty_order, rasio_pcs
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, poId, kodeProduk, qtyPesan, hargaSatuan, diskon, Number(diskonPersen) || 0, subtotal, qtyDiterima, satuanOrder || 'PCS', qtyOrder, Number(rasioPcs) || 1],
    conn
  );
  return result.insertId;
};

const updateStatus = async (id, status, conn) => {
  await exec(`UPDATE purchase_orders SET status = ? WHERE id = ?`, [status, id], conn);
};

const updateDetailQtyDiterima = async (detailId, addQty, conn) => {
  await exec(
    `UPDATE purchase_order_details SET qty_diterima = qty_diterima + ? WHERE id = ?`,
    [addQty, detailId],
    conn
  );
};

const remove = async (id, conn) => {
  await exec(`DELETE FROM purchase_orders WHERE id = ?`, [id], conn);
};

module.exports = {
  findAll,
  findById,
  findByNoPo,
  findDetailsByPoId,
  create,
  createDetail,
  updateStatus,
  updateDetailQtyDiterima,
  remove,
};
