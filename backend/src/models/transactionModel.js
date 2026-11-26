const pool = require('../config/db');

const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const create = async (
  {
    tenantId = 1,
    kodeTransaksi,
    tipeTransaksi,
    referensi = null,
    keterangan = null,
    userId = null,
    warehouseId = 1,
    purchaseOrderId = null,
    deliveryOrderId = null,
  },
  conn
) => {
  const [result] = await exec(
    `INSERT INTO transactions
       (tenant_id, kode_transaksi, tipe_transaksi, referensi, tanggal_transaksi, keterangan, user_id, warehouse_id, purchase_order_id, delivery_order_id)
     VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
    [tenantId || 1, kodeTransaksi, tipeTransaksi, referensi, keterangan, userId, warehouseId || 1, purchaseOrderId, deliveryOrderId],
    conn
  );
  return result.insertId;
};

const createDetail = async ({ tenantId = 1, transactionId, nomorLot, qty }, conn) => {
  const [result] = await exec(
    `INSERT INTO transaction_details (tenant_id, transaction_id, nomor_lot, qty) VALUES (?, ?, ?, ?)`,
    [tenantId || 1, transactionId, nomorLot, qty],
    conn
  );
  return result.insertId;
};

const insertMutation = async ({ tenantId = 1, kodeProduk, nomorLot, warehouseId = 1, tipe, qtyPerubahan, qtySisa, referensi = null }, conn) => {
  const [result] = await exec(
    `INSERT INTO stock_mutations
       (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
     VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, kodeProduk, nomorLot, warehouseId || 1, tipe, qtyPerubahan, qtySisa, referensi],
    conn
  );
  return result.insertId;
};

const findMany = async (tenantId = null, tipe = null, limit = 20) => {
  const [rows] = await exec(
    `SELECT t.*, u.nama_lengkap AS user_nama, u.username AS user_username,
            w.nama_gudang, w.kode_gudang,
            po.no_po, do_tbl.no_do
     FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN warehouses w ON w.id = t.warehouse_id
     LEFT JOIN purchase_orders po ON po.id = t.purchase_order_id
     LEFT JOIN delivery_orders do_tbl ON do_tbl.id = t.delivery_order_id
     WHERE (? IS NULL OR t.tenant_id = ?)
       AND (? IS NULL OR t.tipe_transaksi = ?)
     ORDER BY t.id DESC
     LIMIT ?`,
    [tenantId, tenantId, tipe, tipe, Number(limit)]
  );
  return rows;
};

const findDetailsByTransactionIds = async (ids) => {
  if (!ids.length) return [];
  const [rows] = await exec(
    `SELECT td.transaction_id, td.nomor_lot, td.qty,
            pl.kode_produk, pl.expired_date, pl.status AS status_lot,
            p.nama_produk, p.satuan, p.satuan_besar, p.satuan_menengah, 
            p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan
     FROM transaction_details td
     LEFT JOIN product_lots pl ON pl.nomor_lot = td.nomor_lot AND pl.tenant_id = td.tenant_id
     LEFT JOIN products p ON p.kode_produk = pl.kode_produk AND p.tenant_id = pl.tenant_id
     WHERE td.transaction_id IN (?)
     ORDER BY td.id ASC`,
    [ids]
  );
  return rows;
};

const findByKode = async (tenantId = null, kodeTransaksi) => {
  let tId = tenantId;
  let code = kodeTransaksi;
  if (typeof tenantId === 'string' && kodeTransaksi === undefined) {
    code = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT t.*, u.nama_lengkap AS user_nama, u.username AS user_username,
            w.nama_gudang, w.kode_gudang,
            po.no_po, do_tbl.no_do
     FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN warehouses w ON w.id = t.warehouse_id
     LEFT JOIN purchase_orders po ON po.id = t.purchase_order_id
     LEFT JOIN delivery_orders do_tbl ON do_tbl.id = t.delivery_order_id
     WHERE (? IS NULL OR t.tenant_id = ?) AND t.kode_transaksi = ?
     LIMIT 1`,
    [tId, tId, code]
  );
  return rows[0] || null;
};

const findMutations = async (tenantId = null, kodeProduk = null, tanggalMulai = null, tanggalAkhir = null, warehouseId = null) => {
  let tId = tenantId;
  let kProduk = kodeProduk;
  if (typeof tenantId === 'string' && kodeProduk === null) {
    kProduk = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT sm.id, sm.tenant_id, sm.tanggal_mutasi, sm.kode_produk, sm.nomor_lot, sm.warehouse_id, sm.tipe,
            sm.qty_perubahan, sm.qty_sisa, sm.referensi, sm.created_at,
            w.nama_gudang, w.kode_gudang
     FROM stock_mutations sm
     LEFT JOIN warehouses w ON w.id = sm.warehouse_id
     WHERE (? IS NULL OR sm.tenant_id = ?)
       AND (? IS NULL OR sm.kode_produk = ?)
       AND (? IS NULL OR DATE(sm.tanggal_mutasi) >= ?)
       AND (? IS NULL OR DATE(sm.tanggal_mutasi) <= ?)
       AND (? IS NULL OR sm.warehouse_id = ?)
     ORDER BY sm.tanggal_mutasi ASC, sm.id ASC`,
    [tId, tId, kProduk, kProduk, tanggalMulai, tanggalMulai, tanggalAkhir, tanggalAkhir, warehouseId, warehouseId]
  );
  return rows;
};

const getOpeningStock = async (tenantId = null, kodeProduk = null, tanggalMulai = null, warehouseId = null) => {
  if (!tanggalMulai) return 0;
  let tId = tenantId;
  let kProduk = kodeProduk;
  if (typeof tenantId === 'string' && kodeProduk === null) {
    kProduk = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT 
       COALESCE(SUM(CASE WHEN sm.tipe IN ('MASUK', 'ADJUSTMENT_MASUK', 'TRANSFER_MASUK', 'RETUR_JUAL') THEN sm.qty_perubahan ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN sm.tipe IN ('KELUAR', 'ADJUSTMENT_KELUAR', 'TRANSFER_KELUAR', 'RETUR_BELI') THEN sm.qty_perubahan ELSE 0 END), 0) AS saldo_awal
     FROM stock_mutations sm
     WHERE (? IS NULL OR sm.tenant_id = ?)
       AND sm.kode_produk = ?
       AND DATE(sm.tanggal_mutasi) < ?
       AND (? IS NULL OR sm.warehouse_id = ?)`,
    [tId, tId, kProduk, tanggalMulai, warehouseId, warehouseId]
  );
  return Number(rows[0]?.saldo_awal || 0);
};

module.exports = {
  create,
  createDetail,
  insertMutation,
  findMany,
  findDetailsByTransactionIds,
  findByKode,
  findMutations,
  getOpeningStock,
};
