const pool = require('../config/db');

const findAll = async ({ tenantId = null, status, supplierId, search, dateFrom, dateTo } = {}) => {
  let sql = `
    SELECT 
      ap.*,
      s.nama_supplier,
      s.kode_supplier,
      s.telepon AS supplier_telepon,
      po.no_po,
      DATEDIFF(CURRENT_DATE(), ap.jatuh_tempo) AS hari_terlewat
    FROM accounts_payable ap
    LEFT JOIN suppliers s ON ap.supplier_id = s.id
    LEFT JOIN purchase_orders po ON ap.po_id = po.id
    WHERE (? IS NULL OR ap.tenant_id = ?)
  `;
  const params = [tenantId, tenantId];

  if (status) {
    const st = status.toUpperCase();
    if (st === 'OVERDUE') {
      sql += ` AND ap.status != 'LUNAS' AND ap.jatuh_tempo < CURRENT_DATE()`;
    } else if (st === 'DUE_SOON') {
      sql += ` AND ap.status != 'LUNAS' AND ap.jatuh_tempo BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)`;
    } else if (st === 'UNPAID') {
      sql += ` AND ap.status IN ('BELUM_LUNAS', 'SEBAGIAN')`;
    } else {
      sql += ` AND ap.status = ?`;
      params.push(st);
    }
  }

  if (supplierId) {
    sql += ` AND ap.supplier_id = ?`;
    params.push(Number(supplierId));
  }

  if (search) {
    sql += ` AND (ap.no_tagihan LIKE ? OR po.no_po LIKE ? OR s.nama_supplier LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  if (dateFrom) {
    sql += ` AND ap.tanggal >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND ap.tanggal <= ?`;
    params.push(dateTo);
  }

  sql += `
    ORDER BY 
      CASE 
        WHEN ap.status != 'LUNAS' AND ap.jatuh_tempo < CURRENT_DATE() THEN 0 
        WHEN ap.status != 'LUNAS' THEN 1 
        ELSE 2 
      END,
      ap.jatuh_tempo ASC, 
      ap.id DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (tenantId = null, id, conn = pool) => {
  let tId = tenantId;
  let apId = id;
  if (typeof tenantId === 'number' && id === undefined) {
    apId = tenantId;
    tId = null;
  }

  const [rows] = await conn.query(
    `
    SELECT 
      ap.*,
      s.nama_supplier,
      s.kode_supplier,
      s.telepon AS supplier_telepon,
      s.alamat AS supplier_alamat,
      po.no_po,
      po.status AS po_status,
      DATEDIFF(CURRENT_DATE(), ap.jatuh_tempo) AS hari_terlewat
    FROM accounts_payable ap
    LEFT JOIN suppliers s ON ap.supplier_id = s.id
    LEFT JOIN purchase_orders po ON ap.po_id = po.id
    WHERE (? IS NULL OR ap.tenant_id = ?) AND ap.id = ?
    `,
    [tId, tId, apId]
  );
  return rows[0] || null;
};

const findByPoId = async (poId, conn = pool) => {
  const [rows] = await conn.query(`SELECT * FROM accounts_payable WHERE po_id = ?`, [poId]);
  return rows[0] || null;
};

const findPaymentsByPayableId = async (payableId, conn = pool) => {
  const [rows] = await conn.query(
    `SELECT * FROM payable_payments WHERE payable_id = ? ORDER BY tanggal_bayar DESC, id DESC`,
    [payableId]
  );
  return rows;
};

const findPaymentById = async (paymentId, conn = pool) => {
  const [rows] = await conn.query(`SELECT * FROM payable_payments WHERE id = ?`, [paymentId]);
  return rows[0] || null;
};

const create = async (
  { tenantId = 1, noTagihan, poId, supplierId, tanggal, jatuhTempo, totalTagihan, keterangan },
  conn = pool
) => {
  const total = Number(totalTagihan) || 0;
  const status = total <= 0 ? 'LUNAS' : 'BELUM_LUNAS';
  const [res] = await conn.query(
    `
    INSERT INTO accounts_payable 
      (tenant_id, no_tagihan, po_id, supplier_id, tanggal, jatuh_tempo, total_tagihan, total_dibayar, sisa_utang, status, keterangan)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?)
    `,
    [tenantId || 1, noTagihan, poId || null, supplierId || null, tanggal, jatuhTempo, total, total, status, keterangan || null]
  );
  return res.insertId;
};

const updateAmountAndDue = async (
  id,
  { totalTagihan, jatuhTempo, keterangan, supplierId },
  conn = pool
) => {
  await conn.query(
    `
    UPDATE accounts_payable 
    SET 
      total_tagihan = COALESCE(?, total_tagihan),
      jatuh_tempo = COALESCE(?, jatuh_tempo),
      keterangan = COALESCE(?, keterangan),
      supplier_id = COALESCE(?, supplier_id)
    WHERE id = ?
    `,
    [totalTagihan !== undefined ? totalTagihan : null, jatuhTempo || null, keterangan || null, supplierId || null, id]
  );
  await recalculateStatus(id, conn);
};

const recalculateStatus = async (id, conn = pool) => {
  const [sumRows] = await conn.query(
    `SELECT COALESCE(SUM(jumlah_bayar), 0) AS total_paid FROM payable_payments WHERE payable_id = ?`,
    [id]
  );
  const totalPaid = Number(sumRows[0]?.total_paid) || 0;

  const [apRows] = await conn.query(`SELECT total_tagihan FROM accounts_payable WHERE id = ?`, [id]);
  if (!apRows[0]) return;

  const totalTagihan = Number(apRows[0].total_tagihan) || 0;
  const sisa = Math.max(0, totalTagihan - totalPaid);
  let status = 'BELUM_LUNAS';
  if (sisa <= 0) {
    status = 'LUNAS';
  } else if (totalPaid > 0) {
    status = 'SEBAGIAN';
  }

  await conn.query(
    `
    UPDATE accounts_payable 
    SET total_dibayar = ?, sisa_utang = ?, status = ?
    WHERE id = ?
    `,
    [totalPaid, sisa, status, id]
  );
};

const createPayment = async (
  { tenantId = 1, payableId, noPembayaran, tanggalBayar, jumlahBayar, metodePembayaran, referensiBayar, catatan },
  conn = pool
) => {
  const [res] = await conn.query(
    `
    INSERT INTO payable_payments 
      (tenant_id, payable_id, no_pembayaran, tanggal_bayar, jumlah_bayar, metode_pembayaran, referensi_bayar, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId || 1,
      payableId,
      noPembayaran,
      tanggalBayar,
      jumlahBayar,
      metodePembayaran || 'Transfer Bank',
      referensiBayar || null,
      catatan || null,
    ]
  );
  await recalculateStatus(payableId, conn);
  return res.insertId;
};

const removePayment = async (paymentId, conn = pool) => {
  const payment = await findPaymentById(paymentId, conn);
  if (!payment) return null;
  await conn.query(`DELETE FROM payable_payments WHERE id = ?`, [paymentId]);
  await recalculateStatus(payment.payable_id, conn);
  return payment;
};

const remove = async (id, conn = pool) => {
  const [res] = await conn.query(`DELETE FROM accounts_payable WHERE id = ?`, [id]);
  return res.affectedRows;
};

const getSummary = async (tenantId = null, conn = pool) => {
  const [rows] = await conn.query(`
    SELECT 
      COUNT(*) AS total_faktur,
      COALESCE(SUM(total_tagihan), 0) AS total_tagihan,
      COALESCE(SUM(total_dibayar), 0) AS total_dibayar,
      COALESCE(SUM(sisa_utang), 0) AS sisa_utang,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo < CURRENT_DATE() THEN sisa_utang ELSE 0 END), 0) AS utang_overdue,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo < CURRENT_DATE() THEN 1 ELSE 0 END), 0) AS count_overdue,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) THEN sisa_utang ELSE 0 END), 0) AS utang_due_soon,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END), 0) AS count_due_soon,
      COALESCE(SUM(CASE WHEN status = 'LUNAS' THEN 1 ELSE 0 END), 0) AS count_lunas,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' THEN 1 ELSE 0 END), 0) AS count_belum_lunas
    FROM accounts_payable
    WHERE (? IS NULL OR tenant_id = ?)
  `, [tenantId, tenantId]);
  return rows[0];
};

module.exports = {
  findAll,
  findById,
  findByPoId,
  findPaymentsByPayableId,
  findPaymentById,
  create,
  updateAmountAndDue,
  recalculateStatus,
  createPayment,
  removePayment,
  remove,
  getSummary,
};
