const pool = require('../config/db');

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const findAll = async (tenantId = null, status = null, search = '') => {
  const q = search.trim();
  const [rows] = await exec(
    `SELECT do_tbl.*, c.nama_customer, c.kode_customer, so.no_so,
            (SELECT kode_transaksi FROM transactions WHERE delivery_order_id = do_tbl.id AND tipe_transaksi = 'KELUAR' LIMIT 1) AS kode_transaksi_out
     FROM delivery_orders do_tbl
     LEFT JOIN customers c ON c.id = do_tbl.customer_id
     LEFT JOIN sales_orders so ON so.id = do_tbl.so_id
     WHERE (? IS NULL OR do_tbl.tenant_id = ?)
       AND (? IS NULL OR do_tbl.status = ?)
       AND (? = '' OR do_tbl.no_do LIKE ? OR c.nama_customer LIKE ? OR so.no_so LIKE ?)
     ORDER BY do_tbl.id DESC`,
    [tenantId, tenantId, status, status, q, `%${q}%`, `%${q}%`, `%${q}%`]
  );
  return rows;
};

const findById = async (tenantId = null, id, conn = null) => {
  let tId = tenantId;
  let doId = id;
  if (typeof tenantId === 'number' && id === undefined) {
    doId = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT do_tbl.*, c.nama_customer, c.kode_customer, c.telepon AS customer_telepon, c.nomor_hp AS customer_hp, c.email AS customer_email, c.npwp AS customer_npwp, c.alamat_pengiriman, c.alamat_kantor AS customer_alamat_kantor,
            so.no_so,
            (SELECT kode_transaksi FROM transactions WHERE delivery_order_id = do_tbl.id AND tipe_transaksi = 'KELUAR' LIMIT 1) AS kode_transaksi_out
     FROM delivery_orders do_tbl
     LEFT JOIN customers c ON c.id = do_tbl.customer_id
     LEFT JOIN sales_orders so ON so.id = do_tbl.so_id
     WHERE (? IS NULL OR do_tbl.tenant_id = ?) AND do_tbl.id = ? LIMIT 1`,
    [tId, tId, doId],
    conn
  );
  return rows[0] || null;
};

const findByNoDo = async (tenantId = null, noDo) => {
  let tId = tenantId;
  let code = noDo;
  if (typeof tenantId === 'string' && noDo === undefined) {
    code = tenantId;
    tId = null;
  }

  const [rows] = await exec(`SELECT * FROM delivery_orders WHERE (? IS NULL OR tenant_id = ?) AND no_do = ? LIMIT 1`, [tId, tId, code]);
  return rows[0] || null;
};

const findDetailsByDoId = async (doId, conn = null) => {
  const [rows] = await exec(
    `SELECT dod.*, pl.kode_produk, pl.expired_date, pl.warehouse_id, pl.stok_qty,
            p.nama_produk, p.satuan, p.satuan_besar, p.satuan_menengah, 
            p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan, p.harga
     FROM delivery_order_details dod
     LEFT JOIN product_lots pl ON pl.nomor_lot = dod.nomor_lot AND pl.tenant_id = dod.tenant_id
     LEFT JOIN products p ON p.kode_produk = pl.kode_produk AND p.tenant_id = pl.tenant_id
     WHERE dod.do_id = ?
     ORDER BY dod.id ASC`,
    [doId],
    conn
  );
  return rows;
};

const create = async ({ tenantId = 1, noDo, soId = null, customerId = null, tanggalDo, status = 'DRAFT' }, conn) => {
  const [result] = await exec(
    `INSERT INTO delivery_orders (tenant_id, no_do, so_id, customer_id, tanggal_do, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, noDo, soId, customerId, tanggalDo, status],
    conn
  );
  return result.insertId;
};

const createDetail = async ({ tenantId = 1, doId, nomorLot, qtyKirim, qtyOrder = null, satuanOrder = null, rasioPcs = 1.00 }, conn) => {
  const [result] = await exec(
    `INSERT INTO delivery_order_details (tenant_id, do_id, nomor_lot, qty_kirim, qty_order, satuan_order, rasio_pcs)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, doId, nomorLot, qtyKirim, qtyOrder !== undefined ? qtyOrder : null, satuanOrder || null, rasioPcs || 1.00],
    conn
  );
  return result.insertId;
};

const updateStatus = async (id, status, conn) => {
  await exec(`UPDATE delivery_orders SET status = ? WHERE id = ?`, [status, id], conn);
};

const remove = async (id, conn) => {
  await exec(`DELETE FROM delivery_orders WHERE id = ?`, [id], conn);
};

module.exports = {
  findAll,
  findById,
  findByNoDo,
  findDetailsByDoId,
  create,
  createDetail,
  updateStatus,
  remove,
};
