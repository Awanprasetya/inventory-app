const pool = require('../config/db');

const findAll = async ({ tenantId = null, status, customerId, search, dateFrom, dateTo } = {}) => {
  let sql = `
    SELECT 
      ar.*,
      c.nama_customer,
      c.kode_customer,
      c.telepon AS customer_telepon,
      so.no_so,
      DATEDIFF(CURRENT_DATE(), ar.jatuh_tempo) AS hari_terlewat
    FROM accounts_receivable ar
    LEFT JOIN customers c ON ar.customer_id = c.id
    LEFT JOIN sales_orders so ON ar.so_id = so.id
    WHERE (? IS NULL OR ar.tenant_id = ?)
  `;
  const params = [tenantId, tenantId];

  if (status) {
    const st = status.toUpperCase();
    if (st === 'OVERDUE') {
      sql += ` AND ar.status != 'LUNAS' AND ar.jatuh_tempo < CURRENT_DATE()`;
    } else if (st === 'DUE_SOON') {
      sql += ` AND ar.status != 'LUNAS' AND ar.jatuh_tempo BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)`;
    } else if (st === 'UNPAID') {
      sql += ` AND ar.status IN ('BELUM_LUNAS', 'SEBAGIAN')`;
    } else {
      sql += ` AND ar.status = ?`;
      params.push(st);
    }
  }

  if (customerId) {
    sql += ` AND ar.customer_id = ?`;
    params.push(Number(customerId));
  }

  if (search) {
    sql += ` AND (ar.no_tagihan LIKE ? OR so.no_so LIKE ? OR c.nama_customer LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  if (dateFrom) {
    sql += ` AND ar.tanggal >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND ar.tanggal <= ?`;
    params.push(dateTo);
  }

  sql += `
    ORDER BY 
      CASE 
        WHEN ar.status != 'LUNAS' AND ar.jatuh_tempo < CURRENT_DATE() THEN 0 
        WHEN ar.status != 'LUNAS' THEN 1 
        ELSE 2 
      END,
      ar.jatuh_tempo ASC, 
      ar.id DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (tenantId = null, id, conn = pool) => {
  let tId = tenantId;
  let arId = id;
  if (typeof tenantId === 'number' && id === undefined) {
    arId = tenantId;
    tId = null;
  }

  const [rows] = await conn.query(
    `
    SELECT 
      ar.*,
      c.nama_customer,
      c.kode_customer,
      c.telepon AS customer_telepon,
      c.alamat_pengiriman AS customer_alamat,
      so.no_so,
      so.status AS so_status,
      DATEDIFF(CURRENT_DATE(), ar.jatuh_tempo) AS hari_terlewat
    FROM accounts_receivable ar
    LEFT JOIN customers c ON ar.customer_id = c.id
    LEFT JOIN sales_orders so ON ar.so_id = so.id
    WHERE (? IS NULL OR ar.tenant_id = ?) AND ar.id = ?
    `,
    [tId, tId, arId]
  );
  return rows[0] || null;
};

const findBySoId = async (soId, conn = pool) => {
  const [rows] = await conn.query(`SELECT * FROM accounts_receivable WHERE so_id = ?`, [soId]);
  return rows[0] || null;
};

const findPaymentsByReceivableId = async (receivableId, conn = pool) => {
  const [rows] = await conn.query(
    `SELECT * FROM receivable_payments WHERE receivable_id = ? ORDER BY tanggal_bayar DESC, id DESC`,
    [receivableId]
  );
  return rows;
};

const findPaymentById = async (paymentId, conn = pool) => {
  const [rows] = await conn.query(`SELECT * FROM receivable_payments WHERE id = ?`, [paymentId]);
  return rows[0] || null;
};

const create = async (
  { tenantId = 1, noTagihan, soId, customerId, tanggal, jatuhTempo, totalTagihan, keterangan },
  conn = pool
) => {
  const total = Number(totalTagihan) || 0;
  const status = total <= 0 ? 'LUNAS' : 'BELUM_LUNAS';
  const [res] = await conn.query(
    `
    INSERT INTO accounts_receivable 
      (tenant_id, no_tagihan, so_id, customer_id, tanggal, jatuh_tempo, total_tagihan, total_dibayar, sisa_piutang, status, keterangan)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?)
    `,
    [tenantId || 1, noTagihan, soId || null, customerId || null, tanggal, jatuhTempo, total, total, status, keterangan || null]
  );
  return res.insertId;
};

const updateAmountAndDue = async (
  id,
  { totalTagihan, jatuhTempo, keterangan, customerId },
  conn = pool
) => {
  await conn.query(
    `
    UPDATE accounts_receivable 
    SET 
      total_tagihan = COALESCE(?, total_tagihan),
      jatuh_tempo = COALESCE(?, jatuh_tempo),
      keterangan = COALESCE(?, keterangan),
      customer_id = COALESCE(?, customer_id)
    WHERE id = ?
    `,
    [totalTagihan !== undefined ? totalTagihan : null, jatuhTempo || null, keterangan || null, customerId || null, id]
  );
  await recalculateStatus(id, conn);
};

const recalculateStatus = async (id, conn = pool) => {
  const [sumRows] = await conn.query(
    `SELECT COALESCE(SUM(jumlah_bayar), 0) AS total_paid FROM receivable_payments WHERE receivable_id = ?`,
    [id]
  );
  const totalPaid = Number(sumRows[0]?.total_paid) || 0;

  const [arRows] = await conn.query(`SELECT total_tagihan FROM accounts_receivable WHERE id = ?`, [id]);
  if (!arRows[0]) return;

  const totalTagihan = Number(arRows[0].total_tagihan) || 0;
  const sisa = Math.max(0, totalTagihan - totalPaid);
  let status = 'BELUM_LUNAS';
  if (sisa <= 0) {
    status = 'LUNAS';
  } else if (totalPaid > 0) {
    status = 'SEBAGIAN';
  }

  await conn.query(
    `
    UPDATE accounts_receivable 
    SET total_dibayar = ?, sisa_piutang = ?, status = ?
    WHERE id = ?
    `,
    [totalPaid, sisa, status, id]
  );
};

const createPayment = async (
  { tenantId = 1, receivableId, noPembayaran, tanggalBayar, jumlahBayar, metodePembayaran, referensiBayar, catatan },
  conn = pool
) => {
  const [res] = await conn.query(
    `
    INSERT INTO receivable_payments 
      (tenant_id, receivable_id, no_pembayaran, tanggal_bayar, jumlah_bayar, metode_pembayaran, referensi_bayar, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      tenantId || 1,
      receivableId,
      noPembayaran,
      tanggalBayar,
      jumlahBayar,
      metodePembayaran || 'Transfer Bank',
      referensiBayar || null,
      catatan || null,
    ]
  );
  await recalculateStatus(receivableId, conn);
  return res.insertId;
};

const removePayment = async (paymentId, conn = pool) => {
  const payment = await findPaymentById(paymentId, conn);
  if (!payment) return null;
  await conn.query(`DELETE FROM receivable_payments WHERE id = ?`, [paymentId]);
  await recalculateStatus(payment.receivable_id, conn);
  return payment;
};

const remove = async (id, conn = pool) => {
  const [res] = await conn.query(`DELETE FROM accounts_receivable WHERE id = ?`, [id]);
  return res.affectedRows;
};

const getSummary = async (tenantId = null, conn = pool) => {
  const [rows] = await conn.query(`
    SELECT 
      COUNT(*) AS total_faktur,
      COALESCE(SUM(total_tagihan), 0) AS total_tagihan,
      COALESCE(SUM(total_dibayar), 0) AS total_dibayar,
      COALESCE(SUM(sisa_piutang), 0) AS sisa_piutang,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo < CURRENT_DATE() THEN sisa_piutang ELSE 0 END), 0) AS piutang_overdue,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo < CURRENT_DATE() THEN 1 ELSE 0 END), 0) AS count_overdue,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) THEN sisa_piutang ELSE 0 END), 0) AS piutang_due_soon,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' AND jatuh_tempo BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END), 0) AS count_due_soon,
      COALESCE(SUM(CASE WHEN status = 'LUNAS' THEN 1 ELSE 0 END), 0) AS count_lunas,
      COALESCE(SUM(CASE WHEN status != 'LUNAS' THEN 1 ELSE 0 END), 0) AS count_belum_lunas
    FROM accounts_receivable
    WHERE (? IS NULL OR tenant_id = ?)
  `, [tenantId, tenantId]);
  return rows[0];
};

module.exports = {
  findAll,
  findById,
  findBySoId,
  findPaymentsByReceivableId,
  findPaymentById,
  create,
  updateAmountAndDue,
  recalculateStatus,
  createPayment,
  removePayment,
  remove,
  getSummary,
};
