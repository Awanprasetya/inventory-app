const pool = require('../config/db');

// Ringkasan dashboard: produk, stok, mutasi, serta utang & piutang
const getSummary = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM products WHERE (? IS NULL OR tenant_id = ?)) AS total_produk,
       (SELECT COALESCE(SUM(stok_qty), 0) FROM product_lots WHERE (? IS NULL OR tenant_id = ?)) AS total_stok,
       (SELECT COALESCE(SUM(qty_perubahan), 0) FROM stock_mutations
         WHERE (? IS NULL OR tenant_id = ?) AND tipe = 'MASUK' AND DATE(tanggal_mutasi) = CURDATE()) AS masuk_hari_ini,
       (SELECT COALESCE(SUM(qty_perubahan), 0) FROM stock_mutations
         WHERE (? IS NULL OR tenant_id = ?) AND tipe = 'KELUAR' AND DATE(tanggal_mutasi) = CURDATE()) AS keluar_hari_ini,
       (SELECT COUNT(*) FROM product_lots WHERE (? IS NULL OR tenant_id = ?) AND stok_qty = 0) AS stok_habis,
       (SELECT COALESCE(SUM(sisa_utang), 0) FROM accounts_payable WHERE (? IS NULL OR tenant_id = ?) AND status != 'LUNAS') AS total_utang_aktif,
       (SELECT COALESCE(SUM(sisa_utang), 0) FROM accounts_payable WHERE (? IS NULL OR tenant_id = ?) AND status != 'LUNAS' AND jatuh_tempo < CURDATE()) AS total_utang_overdue,
       (SELECT COUNT(*) FROM accounts_payable WHERE (? IS NULL OR tenant_id = ?) AND status != 'LUNAS' AND jatuh_tempo < CURDATE()) AS count_utang_overdue,
       (SELECT COALESCE(SUM(sisa_piutang), 0) FROM accounts_receivable WHERE (? IS NULL OR tenant_id = ?) AND status != 'LUNAS') AS total_piutang_aktif,
       (SELECT COALESCE(SUM(sisa_piutang), 0) FROM accounts_receivable WHERE (? IS NULL OR tenant_id = ?) AND status != 'LUNAS' AND jatuh_tempo < CURDATE()) AS total_piutang_overdue,
       (SELECT COUNT(*) FROM accounts_receivable WHERE (? IS NULL OR tenant_id = ?) AND status != 'LUNAS' AND jatuh_tempo < CURDATE()) AS count_piutang_overdue`,
    [
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId,
      tenantId, tenantId
    ]
  );
  return rows[0];
};

// Daftar lot dengan stok menipis (<= batas)
const getLowStock = async (tenantId = null, threshold = 10, limit = 8) => {
  const [rows] = await pool.query(
    `SELECT pl.nomor_lot, pl.kode_produk, pl.stok_qty,
            p.nama_produk, p.satuan
     FROM product_lots pl
     JOIN products p ON p.kode_produk = pl.kode_produk AND p.tenant_id = pl.tenant_id
     WHERE (? IS NULL OR pl.tenant_id = ?) AND pl.stok_qty <= ?
     ORDER BY pl.stok_qty ASC, p.nama_produk ASC
     LIMIT ?`,
    [tenantId, tenantId, Number(threshold), Number(limit)]
  );
  return rows;
};

// Pengingat tagihan utang & piutang yang mendekati atau telah lewat jatuh tempo
const getUpcomingDueDates = async (tenantId = null, limit = 10) => {
  const [rows] = await pool.query(
    `
    SELECT * FROM (
      (
        SELECT 
          'UTANG' AS tipe,
          ap.id,
          ap.no_tagihan,
          s.nama_supplier AS pihak,
          ap.jatuh_tempo,
          ap.sisa_utang AS nominal_sisa,
          DATEDIFF(CURDATE(), ap.jatuh_tempo) AS hari_terlewat
        FROM accounts_payable ap
        LEFT JOIN suppliers s ON s.id = ap.supplier_id
        WHERE (? IS NULL OR ap.tenant_id = ?) AND ap.status != 'LUNAS'
      )
      UNION ALL
      (
        SELECT 
          'PIUTANG' AS tipe,
          ar.id,
          ar.no_tagihan,
          c.nama_customer AS pihak,
          ar.jatuh_tempo,
          ar.sisa_piutang AS nominal_sisa,
          DATEDIFF(CURDATE(), ar.jatuh_tempo) AS hari_terlewat
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE (? IS NULL OR ar.tenant_id = ?) AND ar.status != 'LUNAS'
      )
    ) AS gabungan
    ORDER BY 
      CASE WHEN hari_terlewat > 0 THEN 0 ELSE 1 END,
      hari_terlewat DESC,
      jatuh_tempo ASC
    LIMIT ?
    `,
    [tenantId, tenantId, tenantId, tenantId, Number(limit)]
  );
  return rows;
};

// Grafik mutasi 7 hari terakhir (MASUK & KELUAR per hari)
const getChart = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT DATE(tanggal_mutasi) AS tanggal, tipe,
            COALESCE(SUM(qty_perubahan), 0) AS total
     FROM stock_mutations
     WHERE (? IS NULL OR tenant_id = ?) AND tanggal_mutasi >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(tanggal_mutasi), tipe
     ORDER BY tanggal ASC`,
    [tenantId, tenantId]
  );
  return rows;
};

module.exports = { getSummary, getLowStock, getUpcomingDueDates, getChart };
