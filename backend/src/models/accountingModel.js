const pool = require('../config/db');

// Helper: ambil id akun berdasarkan kode_akun
const getAccountIdByKode = async (kode, conn = pool, tenantId = null) => {
  let sql = 'SELECT id, kode_akun, nama_akun, kategori, saldo_normal FROM accounts WHERE kode_akun = ?';
  const params = [kode];
  if (tenantId) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  const [rows] = await conn.query(sql, params);
  return rows[0] || null;
};

// ============================================================
// 1. BAGAN AKUN (CHART OF ACCOUNTS)
// ============================================================
const findAllAccounts = async ({ tenantId = null, kategori, is_kas_bank, search, is_active } = {}) => {
  let sql = 'SELECT * FROM accounts WHERE (? IS NULL OR tenant_id = ?)';
  const params = [tenantId, tenantId];

  if (kategori) {
    sql += ' AND kategori = ?';
    params.push(kategori);
  }
  if (is_kas_bank !== undefined && is_kas_bank !== '') {
    sql += ' AND is_kas_bank = ?';
    params.push(is_kas_bank === 'true' || is_kas_bank === true || is_kas_bank === 1 ? 1 : 0);
  }
  if (is_active !== undefined && is_active !== '') {
    sql += ' AND is_active = ?';
    params.push(is_active === 'true' || is_active === true || is_active === 1 ? 1 : 0);
  }
  if (search) {
    sql += ' AND (kode_akun LIKE ? OR nama_akun LIKE ? OR subkategori LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY kode_akun ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const findAccountById = async (idOrTenant, idOrConn = pool, conn = pool) => {
  let tenantId = null;
  let id = null;
  let connection = pool;

  if (typeof idOrConn === 'number' || (typeof idOrConn === 'string' && /^\d+$/.test(idOrConn))) {
    tenantId = idOrTenant;
    id = Number(idOrConn);
    connection = (conn && conn.query) ? conn : pool;
  } else {
    id = Number(idOrTenant);
    connection = (idOrConn && idOrConn.query) ? idOrConn : pool;
  }

  let sql = 'SELECT * FROM accounts WHERE id = ?';
  const params = [id];
  if (tenantId) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  const [rows] = await connection.query(sql, params);
  return rows[0] || null;
};

const createAccount = async (data, conn = pool) => {
  const { kode_akun, nama_akun, kategori, subkategori, saldo_normal, is_kas_bank, deskripsi } = data;
  const tenantId = data.tenantId || data.tenant_id || 1;
  const [res] = await conn.query(
    `INSERT INTO accounts (tenant_id, kode_akun, nama_akun, kategori, subkategori, saldo_normal, is_kas_bank, deskripsi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      kode_akun.trim(),
      nama_akun.trim(),
      kategori,
      subkategori ? subkategori.trim() : null,
      saldo_normal,
      Boolean(is_kas_bank),
      deskripsi ? deskripsi.trim() : null,
    ]
  );
  return res.insertId;
};

const updateAccount = async (id, data, conn = pool) => {
  const { nama_akun, subkategori, is_kas_bank, deskripsi, is_active } = data;
  await conn.query(
    `UPDATE accounts 
     SET nama_akun = ?, subkategori = ?, is_kas_bank = ?, deskripsi = ?, is_active = ?
     WHERE id = ?`,
    [
      nama_akun.trim(),
      subkategori ? subkategori.trim() : null,
      Boolean(is_kas_bank),
      deskripsi ? deskripsi.trim() : null,
      is_active !== undefined ? Boolean(is_active) : true,
      id,
    ]
  );
};

const deleteAccount = async (id, conn = pool) => {
  // Cek apakah akun sudah dipakai di baris jurnal
  const [[{ count }]] = await conn.query('SELECT COUNT(*) as count FROM journal_lines WHERE account_id = ?', [id]);
  if (count > 0) {
    throw new Error('Akun ini tidak dapat dihapus karena sudah memiliki riwayat transaksi jurnal');
  }
  await conn.query('DELETE FROM accounts WHERE id = ?', [id]);
};

// ============================================================
// 2. JURNAL UMUM (DOUBLE-ENTRY POSTING ENGINE)
// ============================================================

// Generate nomor jurnal otomatis: JU-YYYYMM-XXXX
const generateNoJurnal = async (conn = pool, tenantId = null) => {
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `JU-${yyyymm}-`;

  const [rows] = await conn.query(
    'SELECT no_jurnal FROM journal_entries WHERE (? IS NULL OR tenant_id = ?) AND no_jurnal LIKE ? ORDER BY id DESC LIMIT 1',
    [tenantId, tenantId, `${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const last = rows[0].no_jurnal.replace(prefix, '');
    seq = parseInt(last, 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

/**
 * Mencatat transaksi jurnal lengkap (Double Entry Balanced Guarantee)
 */
const postJournal = async (entryData, conn = pool) => {
  const {
    tenantId = 1,
    tanggal,
    tipeReferensi = 'MANUAL',
    referensiId = null,
    noReferensi = null,
    keterangan,
    createdBy = null,
    lines = [],
  } = entryData;

  if (!lines || lines.length < 2) {
    throw new Error('Jurnal umum minimal membutuhkan 2 baris akun (debit dan kredit)');
  }

  // Hitung total debit dan total kredit
  let totalDebit = 0;
  let totalKredit = 0;

  for (const line of lines) {
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    if (debit < 0 || credit < 0) {
      throw new Error('Nilai debit dan kredit tidak boleh negatif');
    }
    if (debit > 0 && credit > 0) {
      throw new Error('Satu baris jurnal hanya boleh berisi debit ATAU kredit');
    }
    totalDebit += debit;
    totalKredit += credit;
  }

  // Toleransi pembulatan desimal 0.01
  if (Math.abs(totalDebit - totalKredit) > 0.01) {
    throw new Error(
      `Jurnal tidak seimbang! Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) != Total Kredit (Rp ${totalKredit.toLocaleString('id-ID')})`
    );
  }

  const noJurnal = entryData.noJurnal || (await generateNoJurnal(conn, tenantId));

  // Simpan header jurnal
  const [resHeader] = await conn.query(
    `INSERT INTO journal_entries (tenant_id, no_jurnal, tanggal, tipe_referensi, referensi_id, no_referensi, keterangan, total_debit, total_kredit, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, noJurnal, tanggal, tipeReferensi, referensiId, noReferensi, keterangan, totalDebit, totalKredit, createdBy]
  );

  const journalId = resHeader.insertId;

  // Simpan baris-baris jurnal
  for (const line of lines) {
    await conn.query(
      `INSERT INTO journal_lines (tenant_id, journal_id, account_id, debit, credit, keterangan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId || 1, journalId, line.accountId, Number(line.debit || 0), Number(line.credit || 0), line.keterangan || keterangan]
    );
  }

  return journalId;
};

// Cari Jurnal dengan Filter
const findAllJournals = async ({ tenantId = null, startDate, endDate, tipeReferensi, search } = {}) => {
  let sql = `
    SELECT j.*, u.nama_lengkap AS user_name 
    FROM journal_entries j
    LEFT JOIN users u ON j.created_by = u.id
    WHERE (? IS NULL OR j.tenant_id = ?)
  `;
  const params = [tenantId, tenantId];

  if (startDate) {
    sql += ' AND j.tanggal >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND j.tanggal <= ?';
    params.push(endDate);
  }
  if (tipeReferensi && tipeReferensi !== 'ALL') {
    sql += ' AND j.tipe_referensi = ?';
    params.push(tipeReferensi);
  }
  if (search) {
    sql += ' AND (j.no_jurnal LIKE ? OR j.no_referensi LIKE ? OR j.keterangan LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY j.tanggal DESC, j.id DESC';
  const [rows] = await pool.query(sql, params);

  if (rows.length === 0) return [];

  // Ambil baris jurnal
  const journalIds = rows.map((r) => r.id);
  const [lines] = await pool.query(
    `SELECT l.*, a.kode_akun, a.nama_akun, a.kategori 
     FROM journal_lines l
     JOIN accounts a ON l.account_id = a.id
     WHERE l.journal_id IN (?)
     ORDER BY l.id ASC`,
    [journalIds]
  );

  const lineMap = new Map();
  for (const l of lines) {
    if (!lineMap.has(l.journal_id)) lineMap.set(l.journal_id, []);
    lineMap.get(l.journal_id).push(l);
  }

  return rows.map((r) => ({
    ...r,
    lines: lineMap.get(r.id) || [],
  }));
};

const findJournalById = async (idOrTenant, idOrConn = pool, conn = pool) => {
  let tenantId = null;
  let id = null;
  let connection = pool;
  if (typeof idOrConn === 'number' || (typeof idOrConn === 'string' && /^\d+$/.test(idOrConn))) {
    tenantId = idOrTenant;
    id = Number(idOrConn);
    connection = (conn && conn.query) ? conn : pool;
  } else {
    id = Number(idOrTenant);
    connection = (idOrConn && idOrConn.query) ? idOrConn : pool;
  }

  let sql = `SELECT j.*, u.nama_lengkap AS user_name 
     FROM journal_entries j
     LEFT JOIN users u ON j.created_by = u.id
     WHERE j.id = ?`;
  const params = [id];
  if (tenantId) {
    sql += ' AND j.tenant_id = ?';
    params.push(tenantId);
  }

  const [rows] = await connection.query(sql, params);
  if (rows.length === 0) return null;

  const [lines] = await connection.query(
    `SELECT l.*, a.kode_akun, a.nama_akun, a.kategori 
     FROM journal_lines l
     JOIN accounts a ON l.account_id = a.id
     WHERE l.journal_id = ?
     ORDER BY l.id ASC`,
    [id]
  );

  return { ...rows[0], lines };
};

const deleteJournal = async (id, conn = pool) => {
  const journal = await findJournalById(id, conn);
  if (!journal) return null;

  // Jika terhubung dengan cash transaction, batalkan transaksi kas
  await conn.query('DELETE FROM cash_transactions WHERE journal_id = ?', [id]);
  await conn.query('DELETE FROM journal_entries WHERE id = ?', [id]);
  return journal;
};

// ============================================================
// 3. TRANSAKSI KAS & BANK (BIAYA OPERASIONAL & PENERIMAAN LAIN)
// ============================================================

const generateNoKas = async (tipe, conn = pool, tenantId = null) => {
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const prefix = tipe === 'KELUAR' ? `BKK-${yyyymm}-` : `BKM-${yyyymm}-`;

  const [rows] = await conn.query(
    'SELECT no_transaksi FROM cash_transactions WHERE (? IS NULL OR tenant_id = ?) AND no_transaksi LIKE ? ORDER BY id DESC LIMIT 1',
    [tenantId, tenantId, `${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const last = rows[0].no_transaksi.replace(prefix, '');
    seq = parseInt(last, 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const createCashTransaction = async (data, conn = pool) => {
  const {
    tipe, // 'KELUAR' | 'MASUK'
    tanggal,
    accountKasId,
    accountLawanId,
    nominal,
    penerimaPenyetor,
    metodePembayaran = 'Kas Tunai',
    referensi,
    keterangan,
    userId,
  } = data;
  const tenantId = data.tenantId || data.tenant_id || 1;

  const noTransaksi = data.noTransaksi || (await generateNoKas(tipe, conn, tenantId));

  // Ambil info akun kas & lawan
  const accKas = await findAccountById(tenantId, accountKasId, conn);
  const accLawan = await findAccountById(tenantId, accountLawanId, conn);

  if (!accKas || !accLawan) {
    throw new Error('Akun kas atau akun lawan tidak ditemukan');
  }

  // Otomatis buat Jurnal Umum Double-Entry
  const lines = [];
  if (tipe === 'KELUAR') {
    // Pengeluaran Kas (Beban di DEBIT, Kas di KREDIT)
    lines.push({
      accountId: accLawan.id,
      debit: Number(nominal),
      credit: 0,
      keterangan: `${accLawan.nama_akun} - ${keterangan}`,
    });
    lines.push({
      accountId: accKas.id,
      debit: 0,
      credit: Number(nominal),
      keterangan: `${accKas.nama_akun} (${metodePembayaran})`,
    });
  } else {
    // Penerimaan Kas (Kas di DEBIT, Akun Lawan di KREDIT)
    lines.push({
      accountId: accKas.id,
      debit: Number(nominal),
      credit: 0,
      keterangan: `${accKas.nama_akun} (${metodePembayaran})`,
    });
    lines.push({
      accountId: accLawan.id,
      debit: 0,
      credit: Number(nominal),
      keterangan: `${accLawan.nama_akun} - ${keterangan}`,
    });
  }

  const journalId = await postJournal(
    {
      tenantId,
      tanggal,
      tipeReferensi: tipe === 'KELUAR' ? 'EXPENSE' : 'CASH_IN',
      noReferensi: noTransaksi,
      keterangan: `[${noTransaksi}] ${keterangan}`,
      createdBy: userId,
      lines,
    },
    conn
  );

  const [res] = await conn.query(
    `INSERT INTO cash_transactions (tenant_id, no_transaksi, tipe, tanggal, account_kas_id, account_lawan_id, nominal, penerima_penyetor, metode_pembayaran, referensi, keterangan, journal_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      noTransaksi,
      tipe,
      tanggal,
      accountKasId,
      accountLawanId,
      nominal,
      penerimaPenyetor ? penerimaPenyetor.trim() : null,
      metodePembayaran,
      referensi ? referensi.trim() : null,
      keterangan.trim(),
      journalId,
      userId,
    ]
  );

  return { id: res.insertId, noTransaksi, journalId };
};

const findAllCashTransactions = async ({ tenantId = null, tipe, startDate, endDate, accountKasId, search } = {}) => {
  let sql = `
    SELECT c.*, 
           ak.kode_akun AS kode_kas, ak.nama_akun AS nama_kas,
           al.kode_akun AS kode_lawan, al.nama_akun AS nama_lawan,
           u.nama_lengkap AS user_name
    FROM cash_transactions c
    JOIN accounts ak ON c.account_kas_id = ak.id
    JOIN accounts al ON c.account_lawan_id = al.id
    LEFT JOIN users u ON c.created_by = u.id
    WHERE (? IS NULL OR c.tenant_id = ?)
  `;
  const params = [tenantId, tenantId];

  if (tipe && tipe !== 'ALL') {
    sql += ' AND c.tipe = ?';
    params.push(tipe);
  }
  if (startDate) {
    sql += ' AND c.tanggal >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND c.tanggal <= ?';
    params.push(endDate);
  }
  if (accountKasId) {
    sql += ' AND c.account_kas_id = ?';
    params.push(accountKasId);
  }
  if (search) {
    sql += ' AND (c.no_transaksi LIKE ? OR c.keterangan LIKE ? OR c.penerima_penyetor LIKE ? OR c.referensi LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY c.tanggal DESC, c.id DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const deleteCashTransaction = async (id, conn = pool) => {
  const [rows] = await conn.query('SELECT * FROM cash_transactions WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const cash = rows[0];

  // Hapus baris kas
  await conn.query('DELETE FROM cash_transactions WHERE id = ?', [id]);

  // Hapus jurnal terkait
  if (cash.journal_id) {
    await conn.query('DELETE FROM journal_entries WHERE id = ?', [cash.journal_id]);
  }

  return cash;
};

// ============================================================
// 4. LAPORAN KEUANGAN ERP (FINANCIAL STATEMENTS)
// ============================================================

/**
 * 4.1 BUKU BESAR (GENERAL LEDGER)
 */
const getGeneralLedger = async ({ tenantId = null, accountId, startDate, endDate }) => {
  const acc = await findAccountById(tenantId, accountId);
  if (!acc) throw new Error('Akun tidak ditemukan');

  // 1. Saldo Awal (transaksi sebelum startDate)
  let initialBalance = 0;
  if (startDate) {
    const [initRows] = await pool.query(
      `SELECT SUM(l.debit) AS total_debit, SUM(l.credit) AS total_credit
       FROM journal_lines l
       JOIN journal_entries j ON l.journal_id = j.id
       WHERE l.account_id = ? AND (? IS NULL OR j.tenant_id = ?) AND j.tanggal < ?`,
      [accountId, tenantId, tenantId, startDate]
    );
    const d = Number(initRows[0].total_debit || 0);
    const c = Number(initRows[0].total_credit || 0);
    initialBalance = acc.saldo_normal === 'DEBIT' ? d - c : c - d;
  }

  // 2. Mutasi dalam periode
  let sql = `
    SELECT l.id, j.tanggal, j.no_jurnal, j.tipe_referensi, j.no_referensi, 
           l.keterangan, l.debit, l.credit
    FROM journal_lines l
    JOIN journal_entries j ON l.journal_id = j.id
    WHERE l.account_id = ? AND (? IS NULL OR j.tenant_id = ?)
  `;
  const params = [accountId, tenantId, tenantId];

  if (startDate) {
    sql += ' AND j.tanggal >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND j.tanggal <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY j.tanggal ASC, j.id ASC, l.id ASC';
  const [mutationRows] = await pool.query(sql, params);

  // 3. Hitung running balance
  let runningBalance = initialBalance;
  let totalDebitPeriode = 0;
  let totalCreditPeriode = 0;

  const entries = mutationRows.map((row) => {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    totalDebitPeriode += debit;
    totalCreditPeriode += credit;

    if (acc.saldo_normal === 'DEBIT') {
      runningBalance += debit - credit;
    } else {
      runningBalance += credit - debit;
    }

    return {
      ...row,
      saldo_akhir: runningBalance,
    };
  });

  return {
    account: acc,
    startDate,
    endDate,
    saldoAwal: initialBalance,
    totalDebit: totalDebitPeriode,
    totalKredit: totalCreditPeriode,
    saldoAkhir: runningBalance,
    entries,
  };
};

/**
 * 4.2 NERACA SALDO (TRIAL BALANCE)
 */
const getTrialBalance = async ({ tenantId = null, startDate, endDate } = {}) => {
  const accounts = await findAllAccounts({ tenantId });

  // Query mutasi dan saldo
  const [lines] = await pool.query(
    `SELECT l.account_id,
            SUM(CASE WHEN j.tanggal < ? THEN l.debit ELSE 0 END) AS init_debit,
            SUM(CASE WHEN j.tanggal < ? THEN l.credit ELSE 0 END) AS init_credit,
            SUM(CASE WHEN (j.tanggal >= ? OR ? IS NULL) AND (j.tanggal <= ? OR ? IS NULL) THEN l.debit ELSE 0 END) AS period_debit,
            SUM(CASE WHEN (j.tanggal >= ? OR ? IS NULL) AND (j.tanggal <= ? OR ? IS NULL) THEN l.credit ELSE 0 END) AS period_credit
     FROM journal_lines l
     JOIN journal_entries j ON l.journal_id = j.id
     WHERE (? IS NULL OR j.tenant_id = ?)
     GROUP BY l.account_id`,
    [
      startDate || '1970-01-01',
      startDate || '1970-01-01',
      startDate, startDate,
      endDate, endDate,
      startDate, startDate,
      endDate, endDate,
      tenantId, tenantId,
    ]
  );

  const dataMap = new Map();
  for (const l of lines) {
    dataMap.set(l.account_id, l);
  }

  let totalDebitAkhir = 0;
  let totalKreditAkhir = 0;
  let totalMutasiDebit = 0;
  let totalMutasiKredit = 0;

  const rows = accounts.map((acc) => {
    const l = dataMap.get(acc.id) || { init_debit: 0, init_credit: 0, period_debit: 0, period_credit: 0 };
    const pDebit = Number(l.period_debit || 0);
    const pCredit = Number(l.period_credit || 0);
    totalMutasiDebit += pDebit;
    totalMutasiKredit += pCredit;

    // Hitung saldo kumulatif sampai endDate
    let totalD = Number(l.init_debit || 0) + pDebit;
    let totalC = Number(l.init_credit || 0) + pCredit;
    let endingBalance = acc.saldo_normal === 'DEBIT' ? totalD - totalC : totalC - totalD;

    let debitEnding = 0;
    let creditEnding = 0;
    if (acc.saldo_normal === 'DEBIT') {
      if (endingBalance >= 0) debitEnding = endingBalance;
      else creditEnding = Math.abs(endingBalance);
    } else {
      if (endingBalance >= 0) creditEnding = endingBalance;
      else debitEnding = Math.abs(endingBalance);
    }

    totalDebitAkhir += debitEnding;
    totalKreditAkhir += creditEnding;

    return {
      id: acc.id,
      kode_akun: acc.kode_akun,
      nama_akun: acc.nama_akun,
      kategori: acc.kategori,
      subkategori: acc.subkategori,
      saldo_normal: acc.saldo_normal,
      debit_mutasi: pDebit,
      kredit_mutasi: pCredit,
      debit_akhir: debitEnding,
      kredit_akhir: creditEnding,
    };
  });

  return {
    rows,
    totalMutasiDebit,
    totalMutasiKredit,
    totalDebitAkhir,
    totalKreditAkhir,
    isBalanced: Math.abs(totalDebitAkhir - totalKreditAkhir) < 0.01,
  };
};

/**
 * 4.3 LAPORAN LABA RUGI (INCOME STATEMENT / PROFIT & LOSS)
 */
const getProfitAndLoss = async ({ tenantId = null, startDate, endDate } = {}) => {
  let dateFilter = '';
  const params = [tenantId, tenantId, tenantId, tenantId];
  if (startDate) {
    dateFilter += ' AND j.tanggal >= ?';
    params.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND j.tanggal <= ?';
    params.push(endDate);
  }

  const [rows] = await pool.query(
    `SELECT a.id, a.kode_akun, a.nama_akun, a.kategori, a.subkategori, a.saldo_normal,
            SUM(l.debit) AS total_debit, SUM(l.credit) AS total_credit
     FROM accounts a
     JOIN journal_lines l ON a.id = l.account_id
     JOIN journal_entries j ON l.journal_id = j.id
     WHERE a.kategori IN ('REVENUE', 'COGS', 'EXPENSE')
       AND (? IS NULL OR a.tenant_id = ?)
       AND (? IS NULL OR j.tenant_id = ?) ${dateFilter}
     GROUP BY a.id
     ORDER BY a.kode_akun ASC`,
    params
  );

  const revenueItems = [];
  let totalRevenue = 0;

  const cogsItems = [];
  let totalCogs = 0;

  const expenseItems = [];
  let totalExpense = 0;

  for (const r of rows) {
    const debit = Number(r.total_debit || 0);
    const credit = Number(r.total_credit || 0);

    if (r.kategori === 'REVENUE') {
      // Saldo normal kredit (kredit - debit)
      const nominal = r.saldo_normal === 'KREDIT' ? credit - debit : debit - credit;
      totalRevenue += nominal;
      revenueItems.push({ ...r, nominal });
    } else if (r.kategori === 'COGS') {
      // Saldo normal debit (debit - credit)
      const nominal = debit - credit;
      totalCogs += nominal;
      cogsItems.push({ ...r, nominal });
    } else if (r.kategori === 'EXPENSE') {
      // Saldo normal debit (debit - credit)
      const nominal = debit - credit;
      totalExpense += nominal;
      expenseItems.push({ ...r, nominal });
    }
  }

  const grossProfit = totalRevenue - totalCogs;
  const netIncome = grossProfit - totalExpense;

  return {
    startDate,
    endDate,
    revenue: { items: revenueItems, total: totalRevenue },
    cogs: { items: cogsItems, total: totalCogs },
    grossProfit,
    expenses: { items: expenseItems, total: totalExpense },
    netIncome,
  };
};

/**
 * 4.4 LAPORAN NERACA (BALANCE SHEET)
 */
const getBalanceSheet = async ({ tenantId = null, asOfDate } = {}) => {
  const targetDate = asOfDate || new Date().toISOString().split('T')[0];

  // 1. Ambil mutasi seluruh akun sampai tanggal target
  const [rows] = await pool.query(
    `SELECT a.id, a.kode_akun, a.nama_akun, a.kategori, a.subkategori, a.saldo_normal,
            SUM(l.debit) AS total_debit, SUM(l.credit) AS total_credit
     FROM accounts a
     LEFT JOIN journal_lines l ON a.id = l.account_id
     LEFT JOIN journal_entries j ON l.journal_id = j.id AND j.tanggal <= ? AND (? IS NULL OR j.tenant_id = ?)
     WHERE a.kategori IN ('ASSET', 'LIABILITY', 'EQUITY')
       AND (? IS NULL OR a.tenant_id = ?)
     GROUP BY a.id
     ORDER BY a.kode_akun ASC`,
    [targetDate, tenantId, tenantId, tenantId, tenantId]
  );

  const assetItems = [];
  let totalAsset = 0;

  const liabilityItems = [];
  let totalLiability = 0;

  const equityItems = [];
  let totalEquity = 0;

  for (const r of rows) {
    const debit = Number(r.total_debit || 0);
    const credit = Number(r.total_credit || 0);

    let balance = 0;
    if (r.kategori === 'ASSET') {
      balance = r.saldo_normal === 'DEBIT' ? debit - credit : credit - debit;
      totalAsset += balance;
      assetItems.push({ ...r, balance });
    } else if (r.kategori === 'LIABILITY') {
      balance = r.saldo_normal === 'KREDIT' ? credit - debit : debit - credit;
      totalLiability += balance;
      liabilityItems.push({ ...r, balance });
    } else if (r.kategori === 'EQUITY') {
      balance = r.saldo_normal === 'KREDIT' ? credit - debit : debit - credit;
      totalEquity += balance;
      equityItems.push({ ...r, balance });
    }
  }

  // 2. Hitung Laba Bersih Kumulatif Berjalan (untuk melengkapi Ekuitas agar Neraca Balance)
  const [pnlRows] = await pool.query(
    `SELECT a.kategori, SUM(l.debit) AS total_debit, SUM(l.credit) AS total_credit
     FROM accounts a
     JOIN journal_lines l ON a.id = l.account_id
     JOIN journal_entries j ON l.journal_id = j.id
     WHERE a.kategori IN ('REVENUE', 'COGS', 'EXPENSE')
       AND (? IS NULL OR a.tenant_id = ?)
       AND (? IS NULL OR j.tenant_id = ?)
       AND j.tanggal <= ?
     GROUP BY a.kategori`,
    [tenantId, tenantId, tenantId, tenantId, targetDate]
  );

  let pnlRevenue = 0;
  let pnlCogs = 0;
  let pnlExpense = 0;

  for (const p of pnlRows) {
    const d = Number(p.total_debit || 0);
    const c = Number(p.total_credit || 0);
    if (p.kategori === 'REVENUE') pnlRevenue = c - d;
    else if (p.kategori === 'COGS') pnlCogs = d - c;
    else if (p.kategori === 'EXPENSE') pnlExpense = d - c;
  }

  const currentYearNetIncome = pnlRevenue - pnlCogs - pnlExpense;
  const totalEquityWithEarnings = totalEquity + currentYearNetIncome;
  const totalLiabilityAndEquity = totalLiability + totalEquityWithEarnings;

  return {
    asOfDate: targetDate,
    assets: { items: assetItems, total: totalAsset },
    liabilities: { items: liabilityItems, total: totalLiability },
    equity: {
      items: equityItems,
      currentYearEarnings: currentYearNetIncome,
      total: totalEquityWithEarnings,
    },
    totalLiabilityAndEquity,
    isBalanced: Math.abs(totalAsset - totalLiabilityAndEquity) < 0.01,
  };
};

/**
 * 4.5 RINGKASAN SALDO KAS & BANK
 */
const getCashAndBankSummary = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.kode_akun, a.nama_akun,
            COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS saldo
     FROM accounts a
     LEFT JOIN journal_lines l ON a.id = l.account_id AND (? IS NULL OR l.tenant_id = ?)
     WHERE a.is_kas_bank = TRUE AND (? IS NULL OR a.tenant_id = ?)
     GROUP BY a.id
     ORDER BY a.kode_akun ASC`,
    [tenantId, tenantId, tenantId, tenantId]
  );

  const total = rows.reduce((sum, r) => sum + Number(r.saldo || 0), 0);
  return { accounts: rows, total };
};

// ============================================================
// 5. AUTO-SYNC & BACKFILL TRANSAKSI HISTORIS (HISTORICAL SYNC)
// ============================================================
const syncAllHistoricalTransactions = async () => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const accKas = await getAccountIdByKode('1-1001', conn);
    const accBank = await getAccountIdByKode('1-1002', conn);
    const accAr = await getAccountIdByKode('1-1010', conn);
    const accInv = await getAccountIdByKode('1-1020', conn);
    const accPpnIn = await getAccountIdByKode('1-1030', conn);
    const accAp = await getAccountIdByKode('2-1001', conn);
    const accPpnOut = await getAccountIdByKode('2-1002', conn);
    const accSales = await getAccountIdByKode('4-1001', conn);
    const accCogs = await getAccountIdByKode('5-1001', conn);

    let syncedPoCount = 0;
    let syncedSoCount = 0;
    let syncedApPayCount = 0;
    let syncedArPayCount = 0;
    let syncedOutboundCount = 0;

    // 1. Sinkronisasi PO
    const [pos] = await conn.query('SELECT * FROM purchase_orders');
    for (const po of pos) {
      const [existing] = await conn.query(
        'SELECT id FROM journal_entries WHERE tipe_referensi = "PO" AND referensi_id = ?',
        [po.id]
      );
      if (existing.length === 0 && Number(po.total_harga) > 0) {
        const subtotal = Number(po.subtotal || 0);
        const diskon = Number(po.diskon_nominal || 0);
        const dpp = Math.max(0, subtotal - diskon);
        const pajak = Number(po.pajak_nominal || 0);
        const total = Number(po.total_harga || 0);

        const lines = [
          { accountId: accInv.id, debit: dpp, credit: 0, keterangan: `Persediaan Pembelian ${po.no_po}` },
        ];
        if (pajak > 0) {
          lines.push({ accountId: accPpnIn.id, debit: pajak, credit: 0, keterangan: `PPN Masukan ${po.no_po}` });
        }
        lines.push({ accountId: accAp.id, debit: 0, credit: total, keterangan: `Hutang Dagang ${po.no_po}` });

        await postJournal(
          {
            tanggal: po.tanggal_po,
            tipeReferensi: 'PO',
            referensiId: po.id,
            noReferensi: po.no_po,
            keterangan: `Faktur Pembelian ${po.no_po}`,
            lines,
          },
          conn
        );
        syncedPoCount++;
      }
    }

    // 2. Sinkronisasi SO
    const [sos] = await conn.query('SELECT * FROM sales_orders');
    for (const so of sos) {
      const [existing] = await conn.query(
        'SELECT id FROM journal_entries WHERE tipe_referensi = "SO" AND referensi_id = ?',
        [so.id]
      );
      if (existing.length === 0 && Number(so.total_harga) > 0) {
        const subtotal = Number(so.subtotal || 0);
        const diskon = Number(so.diskon_nominal || 0);
        const dpp = Math.max(0, subtotal - diskon);
        const pajak = Number(so.pajak_nominal || 0);
        const total = Number(so.total_harga || 0);

        const lines = [
          { accountId: accAr.id, debit: total, credit: 0, keterangan: `Piutang Dagang ${so.no_so}` },
          { accountId: accSales.id, debit: 0, credit: dpp, keterangan: `Pendapatan Penjualan ${so.no_so}` },
        ];
        if (pajak > 0) {
          lines.push({ accountId: accPpnOut.id, debit: 0, credit: pajak, keterangan: `PPN Keluaran ${so.no_so}` });
        }

        await postJournal(
          {
            tanggal: so.tanggal_so,
            tipeReferensi: 'SO',
            referensiId: so.id,
            noReferensi: so.no_so,
            keterangan: `Faktur Penjualan ${so.no_so}`,
            lines,
          },
          conn
        );
        syncedSoCount++;
      }
    }

    // 3. Sinkronisasi AP Payments
    const [apPays] = await conn.query(
      `SELECT p.*, ap.no_tagihan 
       FROM payable_payments p 
       JOIN accounts_payable ap ON p.payable_id = ap.id`
    );
    for (const pay of apPays) {
      const [existing] = await conn.query(
        'SELECT id FROM journal_entries WHERE tipe_referensi = "AP_PAYMENT" AND referensi_id = ?',
        [pay.id]
      );
      if (existing.length === 0 && Number(pay.jumlah_bayar) > 0) {
        const kasAccount = pay.metode_pembayaran === 'Kas Tunai' ? accKas : accBank;
        const amount = Number(pay.jumlah_bayar);

        const lines = [
          { accountId: accAp.id, debit: amount, credit: 0, keterangan: `Pelunasan Utang ${pay.no_tagihan}` },
          { accountId: kasAccount.id, debit: 0, credit: amount, keterangan: `Pembayaran ${pay.no_pembayaran}` },
        ];

        await postJournal(
          {
            tanggal: pay.tanggal_bayar,
            tipeReferensi: 'AP_PAYMENT',
            referensiId: pay.id,
            noReferensi: pay.no_pembayaran,
            keterangan: `Bayar Utang: ${pay.no_tagihan} (${pay.no_pembayaran})`,
          lines,
          },
          conn
        );
        syncedApPayCount++;
      }
    }

    // 4. Sinkronisasi AR Payments
    const [arPays] = await conn.query(
      `SELECT p.*, ar.no_tagihan 
       FROM receivable_payments p 
       JOIN accounts_receivable ar ON p.receivable_id = ar.id`
    );
    for (const pay of arPays) {
      const [existing] = await conn.query(
        'SELECT id FROM journal_entries WHERE tipe_referensi = "AR_PAYMENT" AND referensi_id = ?',
        [pay.id]
      );
      if (existing.length === 0 && Number(pay.jumlah_bayar) > 0) {
        const kasAccount = pay.metode_pembayaran === 'Kas Tunai' ? accKas : accBank;
        const amount = Number(pay.jumlah_bayar);

        const lines = [
          { accountId: kasAccount.id, debit: amount, credit: 0, keterangan: `Penerimaan ${pay.no_pembayaran}` },
          { accountId: accAr.id, debit: 0, credit: amount, keterangan: `Pelunasan Piutang ${pay.no_tagihan}` },
        ];

        await postJournal(
          {
            tanggal: pay.tanggal_bayar,
            tipeReferensi: 'AR_PAYMENT',
            referensiId: pay.id,
            noReferensi: pay.no_pembayaran,
            keterangan: `Terima Bayar: ${pay.no_tagihan} (${pay.no_pembayaran})`,
            lines,
          },
          conn
        );
        syncedArPayCount++;
      }
    }

    // 5. Sinkronisasi Outbound (HPP & Persediaan)
    const [outbounds] = await conn.query(
      `SELECT t.id, t.kode_transaksi, DATE(t.created_at) as tanggal,
              SUM(td.qty * COALESCE(p.harga, 0)) as total_hpp
       FROM transactions t
       JOIN transaction_details td ON t.id = td.transaction_id
       JOIN product_lots pl ON td.nomor_lot = pl.nomor_lot
       JOIN products p ON pl.kode_produk = p.kode_produk
       WHERE t.tipe_transaksi = 'KELUAR'
       GROUP BY t.id`
    );
    for (const out of outbounds) {
      const [existing] = await conn.query(
        'SELECT id FROM journal_entries WHERE tipe_referensi = "OUTBOUND" AND referensi_id = ?',
        [out.id]
      );
      const hppVal = Number(out.total_hpp || 0);
      if (existing.length === 0 && hppVal > 0) {
        const lines = [
          { accountId: accCogs.id, debit: hppVal, credit: 0, keterangan: `HPP Barang Keluar ${out.kode_transaksi}` },
          { accountId: accInv.id, debit: 0, credit: hppVal, keterangan: `Pengurangan Persediaan ${out.kode_transaksi}` },
        ];

        await postJournal(
          {
            tanggal: out.tanggal,
            tipeReferensi: 'OUTBOUND',
            referensiId: out.id,
            noReferensi: out.kode_transaksi,
            keterangan: `HPP Pengeluaran Barang ${out.kode_transaksi}`,
            lines,
          },
          conn
        );
        syncedOutboundCount++;
      }
    }

    await conn.commit();
    return {
      syncedPoCount,
      syncedSoCount,
      syncedApPayCount,
      syncedArPayCount,
      syncedOutboundCount,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ============================================================
// 6. LAPORAN ARUS KAS (CASH FLOW STATEMENT - METODE LANGSUNG)
// ============================================================
const getCashFlowStatement = async ({ tenantId = null, startDate, endDate } = {}) => {
  const [kasAccs] = await pool.query(
    'SELECT id FROM accounts WHERE is_kas_bank = TRUE AND (? IS NULL OR tenant_id = ?)',
    [tenantId, tenantId]
  );
  const kasIds = kasAccs.map((a) => a.id);
  if (kasIds.length === 0) {
    return {
      operating: { totalMasuk: 0, totalKeluar: 0, net: 0 },
      investing: { total: 0 },
      financing: { total: 0 },
      netCashFlow: 0,
      beginningCash: 0,
      endingCash: 0,
    };
  }

  let beginningCash = 0;
  if (startDate) {
    const [initRows] = await pool.query(
      `SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS init_cash
       FROM journal_lines l
       JOIN journal_entries j ON l.journal_id = j.id
       WHERE l.account_id IN (?) AND (? IS NULL OR j.tenant_id = ?) AND j.tanggal < ?`,
      [kasIds, tenantId, tenantId, startDate]
    );
    beginningCash = Number(initRows[0]?.init_cash || 0);
  }

  let dateFilter = '';
  const params = [kasIds, tenantId, tenantId];
  if (startDate) {
    dateFilter += ' AND j.tanggal >= ?';
    params.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND j.tanggal <= ?';
    params.push(endDate);
  }

  const [flowRows] = await pool.query(
    `SELECT j.tipe_referensi,
            SUM(l.debit) as total_masuk,
            SUM(l.credit) as total_keluar
     FROM journal_lines l
     JOIN journal_entries j ON l.journal_id = j.id
     WHERE l.account_id IN (?) AND (? IS NULL OR j.tenant_id = ?) ${dateFilter}
     GROUP BY j.tipe_referensi`,
    params
  );

  let penerimaanPelanggan = 0;
  let penerimaanLain = 0;
  let pembayaranPemasok = 0;
  let pembayaranOperasional = 0;
  let investasiAset = 0;
  let pendanaanModal = 0;

  for (const row of flowRows) {
    const masuk = Number(row.total_masuk || 0);
    const keluar = Number(row.total_keluar || 0);

    if (row.tipe_referensi === 'AR_PAYMENT' || row.tipe_referensi === 'SO') {
      penerimaanPelanggan += masuk;
    } else if (row.tipe_referensi === 'AP_PAYMENT' || row.tipe_referensi === 'PO') {
      pembayaranPemasok += keluar;
    } else if (row.tipe_referensi === 'EXPENSE') {
      pembayaranOperasional += keluar;
    } else if (row.tipe_referensi === 'CASH_IN') {
      penerimaanLain += masuk;
    } else {
      if (masuk > keluar) penerimaanLain += masuk - keluar;
      else pembayaranOperasional += keluar - masuk;
    }
  }

  const totalOperatingIn = penerimaanPelanggan + penerimaanLain;
  const totalOperatingOut = pembayaranPemasok + pembayaranOperasional;
  const netOperating = totalOperatingIn - totalOperatingOut;
  const netCashFlow = netOperating + investasiAset + pendanaanModal;
  const endingCash = beginningCash + netCashFlow;

  return {
    startDate,
    endDate,
    operating: {
      penerimaanPelanggan,
      penerimaanLain,
      totalMasuk: totalOperatingIn,
      pembayaranPemasok,
      pembayaranOperasional,
      totalKeluar: totalOperatingOut,
      net: netOperating,
    },
    investing: { total: investasiAset },
    financing: { total: pendanaanModal },
    netCashFlow,
    beginningCash,
    endingCash,
  };
};

// ============================================================
// 7. GL RECONCILIATION (REKONSILIASI KONTROL GL VS SUB-LEDGER)
// ============================================================
const getGLReconciliation = async (tenantId = null) => {
  const [arGlRows] = await pool.query(
    `SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS gl_balance
     FROM journal_lines l
     JOIN accounts a ON l.account_id = a.id
     WHERE a.kode_akun = '1-1010' AND (? IS NULL OR a.tenant_id = ?) AND (? IS NULL OR l.tenant_id = ?)`,
    [tenantId, tenantId, tenantId, tenantId]
  );
  const [arSubRows] = await pool.query(
    `SELECT COALESCE(SUM(sisa_piutang), 0) as sub_balance, COUNT(*) as doc_count 
     FROM accounts_receivable 
     WHERE status != 'LUNAS' AND (? IS NULL OR tenant_id = ?)`,
    [tenantId, tenantId]
  );
  const arGl = Number(arGlRows[0]?.gl_balance || 0);
  const arSub = Number(arSubRows[0]?.sub_balance || 0);

  const [apGlRows] = await pool.query(
    `SELECT COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) AS gl_balance
     FROM journal_lines l
     JOIN accounts a ON l.account_id = a.id
     WHERE a.kode_akun = '2-1001' AND (? IS NULL OR a.tenant_id = ?) AND (? IS NULL OR l.tenant_id = ?)`,
    [tenantId, tenantId, tenantId, tenantId]
  );
  const [apSubRows] = await pool.query(
    `SELECT COALESCE(SUM(sisa_utang), 0) as sub_balance, COUNT(*) as doc_count 
     FROM accounts_payable 
     WHERE status != 'LUNAS' AND (? IS NULL OR tenant_id = ?)`,
    [tenantId, tenantId]
  );
  const apGl = Number(apGlRows[0]?.gl_balance || 0);
  const apSub = Number(apSubRows[0]?.sub_balance || 0);

  const [invGlRows] = await pool.query(
    `SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS gl_balance
     FROM journal_lines l
     JOIN accounts a ON l.account_id = a.id
     WHERE a.kode_akun = '1-1020' AND (? IS NULL OR a.tenant_id = ?) AND (? IS NULL OR l.tenant_id = ?)`,
    [tenantId, tenantId, tenantId, tenantId]
  );
  const [invSubRows] = await pool.query(
    `SELECT COALESCE(SUM(pl.stok_qty * COALESCE(p.harga, 0)), 0) as sub_balance,
            COALESCE(SUM(pl.stok_qty), 0) as total_units
     FROM product_lots pl
     JOIN products p ON pl.kode_produk = p.kode_produk AND pl.tenant_id = p.tenant_id
     WHERE (? IS NULL OR pl.tenant_id = ?)`,
    [tenantId, tenantId]
  );
  const invGl = Number(invGlRows[0]?.gl_balance || 0);
  const invSub = Number(invSubRows[0]?.sub_balance || 0);

  const [cashGlRows] = await pool.query(
    `SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS gl_balance
     FROM journal_lines l
     JOIN accounts a ON l.account_id = a.id
     WHERE a.is_kas_bank = TRUE AND (? IS NULL OR a.tenant_id = ?) AND (? IS NULL OR l.tenant_id = ?)`,
    [tenantId, tenantId, tenantId, tenantId]
  );
  const cashSummary = await getCashAndBankSummary(tenantId);
  const cashGl = Number(cashGlRows[0]?.gl_balance || 0);
  const cashSub = Number(cashSummary.total || 0);

  return [
    {
      kategori: 'Piutang Usaha (AR)',
      kodeAkun: '1-1010',
      namaAkun: 'Piutang Usaha',
      glBalance: arGl,
      subledgerBalance: arSub,
      selisih: arGl - arSub,
      isMatched: Math.abs(arGl - arSub) < 0.01,
      catatan: `${arSubRows[0]?.doc_count || 0} invoice terbuka di modul AR`,
    },
    {
      kategori: 'Utang Usaha (AP)',
      kodeAkun: '2-1001',
      namaAkun: 'Utang Usaha',
      glBalance: apGl,
      subledgerBalance: apSub,
      selisih: apGl - apSub,
      isMatched: Math.abs(apGl - apSub) < 0.01,
      catatan: `${apSubRows[0]?.doc_count || 0} tagihan terbuka di modul AP`,
    },
    {
      kategori: 'Persediaan Barang Dagang',
      kodeAkun: '1-1020',
      namaAkun: 'Persediaan Barang Dagang',
      glBalance: invGl,
      subledgerBalance: invSub,
      selisih: invGl - invSub,
      isMatched: Math.abs(invGl - invSub) < 0.01,
      catatan: `${invSubRows[0]?.total_units || 0} unit stok fisik di gudang`,
    },
    {
      kategori: 'Kas & Rekening Bank',
      kodeAkun: '1-1001/1-1002',
      namaAkun: 'Kas & Setara Kas',
      glBalance: cashGl,
      subledgerBalance: cashSub,
      selisih: cashGl - cashSub,
      isMatched: Math.abs(cashGl - cashSub) < 0.01,
      catatan: `${cashSummary.accounts.length} rekening kas & bank aktif`,
    },
  ];
};

// ============================================================
// 8. AGING REPORTS (UMUR PIUTANG AR & UMUR HUTANG AP)
// ============================================================
const getAgingAP = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT ap.*, s.nama_supplier, s.kode_supplier,
            DATEDIFF(CURRENT_DATE, ap.jatuh_tempo) AS days_overdue
     FROM accounts_payable ap
     LEFT JOIN suppliers s ON ap.supplier_id = s.id
     WHERE ap.status != 'LUNAS' AND ap.sisa_utang > 0 AND (? IS NULL OR ap.tenant_id = ?)
     ORDER BY ap.jatuh_tempo ASC`,
    [tenantId, tenantId]
  );

  let currentTotal = 0;
  let d30Total = 0;
  let d60Total = 0;
  let d90Total = 0;
  let dOver90Total = 0;
  let grandTotal = 0;

  const items = rows.map((r) => {
    const sisa = Number(r.sisa_utang);
    grandTotal += sisa;
    const days = Number(r.days_overdue || 0);

    let bucket = 'CURRENT';
    if (days <= 0) {
      currentTotal += sisa;
      bucket = 'CURRENT';
    } else if (days <= 30) {
      d30Total += sisa;
      bucket = '1_30';
    } else if (days <= 60) {
      d60Total += sisa;
      bucket = '31_60';
    } else if (days <= 90) {
      d90Total += sisa;
      bucket = '61_90';
    } else {
      dOver90Total += sisa;
      bucket = 'OVER_90';
    }

    return { ...r, bucket };
  });

  return {
    items,
    summary: {
      current: currentTotal,
      overdue30: d30Total,
      overdue60: d60Total,
      overdue90: d90Total,
      overdueAbove90: dOver90Total,
      total: grandTotal,
    },
  };
};

const getAgingAR = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT ar.*, c.nama_customer, c.kode_customer,
            DATEDIFF(CURRENT_DATE, ar.jatuh_tempo) AS days_overdue
     FROM accounts_receivable ar
     LEFT JOIN customers c ON ar.customer_id = c.id
     WHERE ar.status != 'LUNAS' AND ar.sisa_piutang > 0 AND (? IS NULL OR ar.tenant_id = ?)
     ORDER BY ar.jatuh_tempo ASC`,
    [tenantId, tenantId]
  );

  let currentTotal = 0;
  let d30Total = 0;
  let d60Total = 0;
  let d90Total = 0;
  let dOver90Total = 0;
  let grandTotal = 0;

  const items = rows.map((r) => {
    const sisa = Number(r.sisa_piutang);
    grandTotal += sisa;
    const days = Number(r.days_overdue || 0);

    let bucket = 'CURRENT';
    if (days <= 0) {
      currentTotal += sisa;
      bucket = 'CURRENT';
    } else if (days <= 30) {
      d30Total += sisa;
      bucket = '1_30';
    } else if (days <= 60) {
      d60Total += sisa;
      bucket = '31_60';
    } else if (days <= 90) {
      d90Total += sisa;
      bucket = '61_90';
    } else {
      dOver90Total += sisa;
      bucket = 'OVER_90';
    }

    return { ...r, bucket };
  });

  return {
    items,
    summary: {
      current: currentTotal,
      overdue30: d30Total,
      overdue60: d60Total,
      overdue90: d90Total,
      overdueAbove90: dOver90Total,
      total: grandTotal,
    },
  };
};

// ============================================================
// 9. TRANSFER DANA ANTAR KAS & BANK
// ============================================================
const createFundTransfer = async ({ tenantId = 1, tanggal, fromAccountId, toAccountId, nominal, referensi, keterangan, userId }) => {
  const fromAcc = await findAccountById(tenantId, fromAccountId);
  const toAcc = await findAccountById(tenantId, toAccountId);
  if (!fromAcc || !toAcc) throw new Error('Akun asal atau akun tujuan tidak ditemukan');
  if (fromAccountId === toAccountId) throw new Error('Akun asal dan akun tujuan tidak boleh sama');

  const amount = Number(nominal);
  if (!amount || amount <= 0) throw new Error('Nominal transfer harus lebih dari 0');

  const lines = [
    { accountId: toAcc.id, debit: amount, credit: 0, keterangan: `Terima transfer dari ${fromAcc.nama_akun}` },
    { accountId: fromAcc.id, debit: 0, credit: amount, keterangan: `Transfer keluar ke ${toAcc.nama_akun}` },
  ];

  const journalId = await postJournal({
    tenantId,
    tanggal,
    tipeReferensi: 'MANUAL',
    noReferensi: referensi || 'TRANSFER-DANA',
    keterangan: keterangan || `Transfer dana internal dari ${fromAcc.nama_akun} ke ${toAcc.nama_akun}`,
    createdBy: userId,
    lines,
  });

  return { journalId, amount, fromAcc, toAcc };
};

// ============================================================
// 10. TUTUP BUKU (PERIOD-END CLOSING)
// ============================================================
const findAllPeriods = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT ap.*, u.nama_lengkap AS closed_by_name 
     FROM accounting_periods ap
     LEFT JOIN users u ON ap.closed_by = u.id
     WHERE (? IS NULL OR ap.tenant_id = ?)
     ORDER BY ap.tahun DESC, ap.bulan DESC`,
    [tenantId, tenantId]
  );
  return rows;
};

const closePeriod = async ({ tenantId = 1, tahun, bulan, tanggalTutup, catatan, userId }) => {
  const y = Number(tahun);
  const m = Number(bulan);

  const [existing] = await pool.query(
    'SELECT * FROM accounting_periods WHERE tahun = ? AND bulan = ? AND tenant_id = ?',
    [y, m, tenantId]
  );
  if (existing.length > 0 && existing[0].status === 'CLOSED') {
    throw new Error(`Periode ${y}-${String(m).padStart(2, '0')} sudah ditutup sebelumnya.`);
  }

  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const pnl = await getProfitAndLoss({ tenantId, startDate, endDate });
  const totalRevenue = pnl.revenue.total;
  const totalExpense = pnl.cogs.total + pnl.expenses.total;
  const netIncome = pnl.netIncome;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    let closingJournalId = null;

    if (totalRevenue > 0 || totalExpense > 0) {
      const accRetained = await getAccountIdByKode('3-2001', conn, tenantId);
      const closingLines = [];

      for (const rev of pnl.revenue.items) {
        if (rev.nominal > 0) {
          closingLines.push({
            accountId: rev.id,
            debit: rev.nominal,
            credit: 0,
            keterangan: `Penutupan Pendapatan ${rev.nama_akun} Periode ${y}-${m}`,
          });
        }
      }

      for (const cogs of pnl.cogs.items) {
        if (cogs.nominal > 0) {
          closingLines.push({
            accountId: cogs.id,
            debit: 0,
            credit: cogs.nominal,
            keterangan: `Penutupan HPP ${cogs.nama_akun} Periode ${y}-${m}`,
          });
        }
      }
      for (const exp of pnl.expenses.items) {
        if (exp.nominal > 0) {
          closingLines.push({
            accountId: exp.id,
            debit: 0,
            credit: exp.nominal,
            keterangan: `Penutupan Beban ${exp.nama_akun} Periode ${y}-${m}`,
          });
        }
      }

      if (netIncome >= 0) {
        closingLines.push({
          accountId: accRetained.id,
          debit: 0,
          credit: netIncome,
          keterangan: `Transfer Laba Bersih ke Laba Ditahan Periode ${y}-${m}`,
        });
      } else {
        closingLines.push({
          accountId: accRetained.id,
          debit: Math.abs(netIncome),
          credit: 0,
          keterangan: `Transfer Rugi Bersih ke Laba Ditahan Periode ${y}-${m}`,
        });
      }

      closingJournalId = await postJournal(
        {
          tenantId,
          tanggal: tanggalTutup || endDate,
          tipeReferensi: 'MANUAL',
          noReferensi: `CLOSE-${y}${String(m).padStart(2, '0')}`,
          keterangan: `Jurnal Penutup Periode ${y}-${String(m).padStart(2, '0')}`,
          createdBy: userId,
          lines: closingLines,
        },
        conn
      );
    }

    if (existing.length > 0) {
      await conn.query(
        `UPDATE accounting_periods 
         SET status = 'CLOSED', tanggal_tutup = ?, total_pendapatan = ?, total_beban = ?, laba_bersih = ?, closing_journal_id = ?, closed_by = ?, catatan = ?
         WHERE id = ? AND tenant_id = ?`,
        [tanggalTutup || endDate, totalRevenue, totalExpense, netIncome, closingJournalId, userId, catatan, existing[0].id, tenantId]
      );
    } else {
      await conn.query(
        `INSERT INTO accounting_periods (tenant_id, tahun, bulan, tanggal_tutup, status, total_pendapatan, total_beban, laba_bersih, closing_journal_id, closed_by, catatan)
         VALUES (?, ?, ?, ?, 'CLOSED', ?, ?, ?, ?, ?, ?)`,
        [tenantId, y, m, tanggalTutup || endDate, totalRevenue, totalExpense, netIncome, closingJournalId, userId, catatan]
      );
    }

    await conn.commit();
    return { tahun: y, bulan: m, netIncome, closingJournalId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const reopenPeriod = async (tenantId = null, id) => {
  const [rows] = await pool.query(
    'SELECT * FROM accounting_periods WHERE id = ? AND (? IS NULL OR tenant_id = ?)',
    [id, tenantId, tenantId]
  );
  if (rows.length === 0) throw new Error('Periode tidak ditemukan');
  const period = rows[0];

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    if (period.closing_journal_id) {
      await conn.query('DELETE FROM journal_entries WHERE id = ?', [period.closing_journal_id]);
    }
    await conn.query('UPDATE accounting_periods SET status = "OPEN", closing_journal_id = NULL WHERE id = ?', [id]);
    await conn.commit();
    return period;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ============================================================
// 11. FIXED ASSETS & DEPRECIATION
// ============================================================
const findAllFixedAssets = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT fa.*,
            aa.kode_akun AS kode_asset, aa.nama_akun AS nama_asset_acc,
            ad.kode_akun AS kode_accum, ad.nama_akun AS nama_accum_acc,
            ae.kode_akun AS kode_expense, ae.nama_akun AS nama_expense_acc
     FROM fixed_assets fa
     JOIN accounts aa ON fa.account_asset_id = aa.id
     JOIN accounts ad ON fa.account_accum_id = ad.id
     JOIN accounts ae ON fa.account_expense_id = ae.id
     WHERE (? IS NULL OR fa.tenant_id = ?)
     ORDER BY fa.id DESC`,
    [tenantId, tenantId]
  );
  return rows;
};

const createFixedAsset = async (data, userId) => {
  const {
    tenantId = 1,
    kode_aset,
    nama_aset,
    kategori_aset,
    account_asset_id,
    account_accum_id,
    account_expense_id,
    tanggal_perolehan,
    harga_perolehan,
    nilai_residu = 0,
    masa_manfaat_bulan = 48,
    metode_penyusutan = 'GARIS_LURUS',
    lokasi,
    keterangan,
    post_purchase_journal = false,
    credit_account_id,
  } = data;

  const harga = Number(harga_perolehan);
  const residu = Number(nilai_residu || 0);

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [res] = await conn.query(
      `INSERT INTO fixed_assets (tenant_id, kode_aset, nama_aset, kategori_aset, account_asset_id, account_accum_id, account_expense_id, tanggal_perolehan, harga_perolehan, nilai_residu, masa_manfaat_bulan, metode_penyusutan, akumulasi_penyusutan, nilai_buku, lokasi, status, keterangan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, 'AKTIF', ?)`,
      [
        tenantId,
        kode_aset.trim(),
        nama_aset.trim(),
        kategori_aset || 'Peralatan',
        account_asset_id,
        account_accum_id,
        account_expense_id,
        tanggal_perolehan,
        harga,
        residu,
        masa_manfaat_bulan,
        metode_penyusutan,
        harga,
        lokasi || null,
        keterangan || null,
      ]
    );

    const assetId = res.insertId;

    if (post_purchase_journal && credit_account_id) {
      await postJournal(
        {
          tenantId,
          tanggal: tanggal_perolehan,
          tipeReferensi: 'MANUAL',
          noReferensi: `ASSET-${kode_aset}`,
          keterangan: `Pembelian Aset Tetap: ${nama_aset} (${kode_aset})`,
          createdBy: userId,
          lines: [
            { accountId: account_asset_id, debit: harga, credit: 0, keterangan: `Perolehan Aset ${nama_aset}` },
            { accountId: credit_account_id, debit: 0, credit: harga, keterangan: `Pembayaran Aset ${nama_aset}` },
          ],
        },
        conn
      );
    }

    await conn.commit();
    return assetId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const processMonthlyDepreciation = async ({ assetId, periodeBulan, userId }) => {
  const [rows] = await pool.query('SELECT * FROM fixed_assets WHERE id = ?', [assetId]);
  if (rows.length === 0) throw new Error('Aset tetap tidak ditemukan');
  const asset = rows[0];
  const tenantId = asset.tenant_id;

  if (asset.status !== 'AKTIF') throw new Error('Aset tidak dalam status aktif');

  const [deprRows] = await pool.query('SELECT * FROM asset_depreciations WHERE asset_id = ? AND periode_bulan = ?', [
    assetId,
    periodeBulan,
  ]);
  if (deprRows.length > 0) throw new Error(`Penyusutan periode ${periodeBulan} untuk aset ini sudah pernah diproses.`);

  const harga = Number(asset.harga_perolehan);
  const residu = Number(asset.nilai_residu);
  const bulan = Math.max(1, Number(asset.masa_manfaat_bulan));
  const deprPerBulan = Math.round(((harga - residu) / bulan) * 100) / 100;

  const akumulasiBaru = Math.min(harga - residu, Number(asset.akumulasi_penyusutan) + deprPerBulan);
  const nilaiBukuBaru = Math.max(residu, harga - akumulasiBaru);

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const tanggalProses = `${periodeBulan}-28`;
    const journalId = await postJournal(
      {
        tenantId,
        tanggal: tanggalProses,
        tipeReferensi: 'MANUAL',
        noReferensi: `DEPR-${asset.kode_aset}-${periodeBulan}`,
        keterangan: `Penyusutan Aset ${asset.nama_aset} (${asset.kode_aset}) Periode ${periodeBulan}`,
        createdBy: userId,
        lines: [
          { accountId: asset.account_expense_id, debit: deprPerBulan, credit: 0, keterangan: `Beban Penyusutan ${asset.nama_aset}` },
          { accountId: asset.account_accum_id, debit: 0, credit: deprPerBulan, keterangan: `Akumulasi Penyusutan ${asset.nama_aset}` },
        ],
      },
      conn
    );

    await conn.query(
      `INSERT INTO asset_depreciations (tenant_id, asset_id, periode_bulan, tanggal_proses, nominal_penyusutan, nilai_buku_setelahnya, journal_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, assetId, periodeBulan, tanggalProses, deprPerBulan, nilaiBukuBaru, journalId, userId]
    );

    await conn.query(
      `UPDATE fixed_assets SET akumulasi_penyusutan = ?, nilai_buku = ? WHERE id = ?`,
      [akumulasiBaru, nilaiBukuBaru, assetId]
    );

    await conn.commit();
    return { assetId, periodeBulan, deprPerBulan, nilaiBukuBaru, journalId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const deleteFixedAsset = async (tenantId = null, id) => {
  const [rows] = await pool.query(
    'SELECT * FROM fixed_assets WHERE id = ? AND (? IS NULL OR tenant_id = ?)',
    [id, tenantId, tenantId]
  );
  if (rows.length === 0) return null;
  await pool.query('DELETE FROM fixed_assets WHERE id = ? AND (? IS NULL OR tenant_id = ?)', [id, tenantId, tenantId]);
  return rows[0];
};

// ============================================================
// 12. BUDGETING & BUDGET CONTROL
// ============================================================
const findAllBudgets = async ({ tenantId = null, tahun } = {}) => {
  let sql = 'SELECT * FROM budgets WHERE 1=1';
  const params = [];
  if (tenantId) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  if (tahun) {
    sql += ' AND tahun = ?';
    params.push(tahun);
  }
  sql += ' ORDER BY tahun DESC, id DESC';
  const [rows] = await pool.query(sql, params);

  if (rows.length === 0) return [];
  const budgetIds = rows.map((r) => r.id);
  const [details] = await pool.query(
    `SELECT bd.*, a.kode_akun, a.nama_akun, a.kategori 
     FROM budget_details bd
     JOIN accounts a ON bd.account_id = a.id
     WHERE bd.budget_id IN (?)`,
    [budgetIds]
  );

  const detailMap = new Map();
  for (const d of details) {
    if (!detailMap.has(d.budget_id)) detailMap.set(d.budget_id, []);
    detailMap.get(d.budget_id).push(d);
  }

  return rows.map((r) => ({
    ...r,
    details: detailMap.get(r.id) || [],
  }));
};

const createOrUpdateBudget = async (data, userId) => {
  const { tenantId = 1, tahun, judul_anggaran, divisi, catatan, details = [] } = data;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [exist] = await conn.query(
      'SELECT id FROM budgets WHERE tahun = ? AND divisi = ? AND tenant_id = ?',
      [tahun, divisi, tenantId]
    );
    let budgetId;

    if (exist.length > 0) {
      budgetId = exist[0].id;
      await conn.query(
        'UPDATE budgets SET judul_anggaran = ?, catatan = ? WHERE id = ? AND tenant_id = ?',
        [judul_anggaran, catatan, budgetId, tenantId]
      );
      await conn.query('DELETE FROM budget_details WHERE budget_id = ?', [budgetId]);
    } else {
      const [res] = await conn.query(
        'INSERT INTO budgets (tenant_id, tahun, judul_anggaran, divisi, catatan, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [tenantId, tahun, judul_anggaran, divisi, catatan, userId]
      );
      budgetId = res.insertId;
    }

    for (const d of details) {
      const nominal = Number(d.nominal_anggaran || 0);
      if (d.account_id && nominal > 0) {
        await conn.query(
          'INSERT INTO budget_details (tenant_id, budget_id, account_id, nominal_anggaran, catatan) VALUES (?, ?, ?, ?, ?)',
          [tenantId, budgetId, d.account_id, nominal, d.catatan || null]
        );
      }
    }

    await conn.commit();
    return budgetId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getBudgetVsActual = async ({ tenantId = null, tahun, divisi }) => {
  const targetYear = Number(tahun || new Date().getFullYear());

  const [budgets] = await pool.query(
    'SELECT * FROM budgets WHERE tahun = ? AND (divisi = ? OR ? IS NULL) AND (? IS NULL OR tenant_id = ?)',
    [targetYear, divisi || null, divisi || null, tenantId, tenantId]
  );
  if (budgets.length === 0) {
    return {
      tahun: targetYear,
      budget: null,
      items: [],
      totalBudget: 0,
      totalActual: 0,
      totalVariance: 0,
      overallPercentage: 0,
    };
  }

  const budget = budgets[0];
  const [details] = await pool.query(
    `SELECT bd.*, a.kode_akun, a.nama_akun, a.kategori 
     FROM budget_details bd
     JOIN accounts a ON bd.account_id = a.id
     WHERE bd.budget_id = ?`,
    [budget.id]
  );

  const [actuals] = await pool.query(
    `SELECT l.account_id, SUM(l.debit) as total_debit, SUM(l.credit) as total_credit
     FROM journal_lines l
     JOIN journal_entries j ON l.journal_id = j.id
     WHERE YEAR(j.tanggal) = ? AND (? IS NULL OR j.tenant_id = ?)
     GROUP BY l.account_id`,
    [targetYear, tenantId, tenantId]
  );

  const actMap = new Map();
  for (const a of actuals) {
    actMap.set(a.account_id, Number(a.total_debit || 0) - Number(a.total_credit || 0));
  }

  let totalBudget = 0;
  let totalActual = 0;

  const items = details.map((d) => {
    const budgetVal = Number(d.nominal_anggaran || 0);
    const actualVal = Math.max(0, actMap.get(d.account_id) || 0);
    const variance = budgetVal - actualVal;
    const percentage = budgetVal > 0 ? Math.round((actualVal / budgetVal) * 100) : 0;

    totalBudget += budgetVal;
    totalActual += actualVal;

    return {
      accountId: d.account_id,
      kodeAkun: d.kode_akun,
      namaAkun: d.nama_akun,
      kategori: d.kategori,
      budget: budgetVal,
      actual: actualVal,
      variance,
      percentage,
      isOverBudget: actualVal > budgetVal,
    };
  });

  return {
    tahun: targetYear,
    budget,
    items,
    totalBudget,
    totalActual,
    totalVariance: totalBudget - totalActual,
    overallPercentage: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0,
  };
};

// ============================================================
// 13. TAX MANAGEMENT (MANAJEMEN PPN & PPH)
// ============================================================
const findAllTaxRecords = async ({ tenantId = null, tipePajak, startDate, endDate, statusSpt } = {}) => {
  let sql = 'SELECT * FROM tax_records WHERE 1=1';
  const params = [];

  if (tenantId) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  if (tipePajak && tipePajak !== 'ALL') {
    sql += ' AND tipe_pajak = ?';
    params.push(tipePajak);
  }
  if (startDate) {
    sql += ' AND tanggal >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND tanggal <= ?';
    params.push(endDate);
  }
  if (statusSpt && statusSpt !== 'ALL') {
    sql += ' AND status_spt = ?';
    params.push(statusSpt);
  }

  sql += ' ORDER BY tanggal DESC, id DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const createTaxRecord = async (data, userId) => {
  const {
    tenantId = 1,
    tipe_pajak,
    tanggal,
    no_faktur_pajak,
    pihak_terkait,
    dpp,
    tarif_persen = 11,
    nominal_pajak,
    referensi,
    status_spt = 'BELUM_LAPOR',
    catatan,
  } = data;

  const noTransaksi = `TAX-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const numDpp = Number(dpp || 0);
  const numPajak = Number(nominal_pajak) || Math.round((numDpp * Number(tarif_persen)) / 100);

  const [res] = await pool.query(
    `INSERT INTO tax_records (tenant_id, no_transaksi, tipe_pajak, tanggal, no_faktur_pajak, pihak_terkait, dpp, tarif_persen, nominal_pajak, referensi, status_spt, catatan, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      noTransaksi,
      tipe_pajak,
      tanggal,
      no_faktur_pajak || null,
      pihak_terkait.trim(),
      numDpp,
      tarif_persen,
      numPajak,
      referensi || null,
      status_spt,
      catatan || null,
      userId,
    ]
  );
  return res.insertId;
};

const updateTaxStatus = async (tenantId = null, id, statusSpt) => {
  await pool.query(
    'UPDATE tax_records SET status_spt = ? WHERE id = ? AND (? IS NULL OR tenant_id = ?)',
    [statusSpt, id, tenantId, tenantId]
  );
};

const getTaxSummary = async ({ tenantId = null, startDate, endDate } = {}) => {
  let dateFilter = '';
  const params = [];
  if (tenantId) {
    dateFilter += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  if (startDate) {
    dateFilter += ' AND tanggal >= ?';
    params.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND tanggal <= ?';
    params.push(endDate);
  }

  const [rows] = await pool.query(
    `SELECT tipe_pajak, SUM(dpp) as total_dpp, SUM(nominal_pajak) as total_pajak, COUNT(*) as count
     FROM tax_records
     WHERE 1=1 ${dateFilter}
     GROUP BY tipe_pajak`,
    params
  );

  let ppnMasukan = 0;
  let ppnKeluaran = 0;
  let pph21 = 0;
  let pph23 = 0;
  let pph42 = 0;

  for (const r of rows) {
    const val = Number(r.total_pajak || 0);
    if (r.tipe_pajak === 'PPN_MASUKAN') ppnMasukan = val;
    else if (r.tipe_pajak === 'PPN_KELUARAN') ppnKeluaran = val;
    else if (r.tipe_pajak === 'PPH_21') pph21 = val;
    else if (r.tipe_pajak === 'PPH_23') pph23 = val;
    else if (r.tipe_pajak === 'PPH_4_2') pph42 = val;
  }

  const ppnNet = ppnKeluaran - ppnMasukan;

  return {
    ppnMasukan,
    ppnKeluaran,
    ppnNet,
    ppnStatus: ppnNet >= 0 ? 'KURANG_BAYAR' : 'LEBIH_BAYAR',
    pph21,
    pph23,
    pph42,
    totalPph: pph21 + pph23 + pph42,
  };
};

// ============================================================
// 14. MULTI-CURRENCY & KURS
// ============================================================
const findAllCurrencies = async (tenantId = null) => {
  const [rows] = await pool.query(
    'SELECT * FROM currencies WHERE (? IS NULL OR tenant_id = ?) ORDER BY is_base DESC, kode ASC',
    [tenantId, tenantId]
  );
  return rows;
};

const updateCurrencyRate = async ({ tenantId = null, kode, kursKeIdr, tanggalKurs }) => {
  await pool.query(
    'UPDATE currencies SET kurs_ke_idr = ?, tanggal_kurs = ? WHERE kode = ? AND (? IS NULL OR tenant_id = ?)',
    [Number(kursKeIdr), tanggalKurs || new Date().toISOString().split('T')[0], kode, tenantId, tenantId]
  );
};

module.exports = {
  getAccountIdByKode,
  findAllAccounts,
  findAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  generateNoJurnal,
  postJournal,
  findAllJournals,
  findJournalById,
  deleteJournal,
  createCashTransaction,
  findAllCashTransactions,
  deleteCashTransaction,
  getGeneralLedger,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashAndBankSummary,
  syncAllHistoricalTransactions,
  getCashFlowStatement,
  getGLReconciliation,
  getAgingAP,
  getAgingAR,
  createFundTransfer,
  findAllPeriods,
  closePeriod,
  reopenPeriod,
  findAllFixedAssets,
  createFixedAsset,
  processMonthlyDepreciation,
  deleteFixedAsset,
  findAllBudgets,
  createOrUpdateBudget,
  getBudgetVsActual,
  findAllTaxRecords,
  createTaxRecord,
  updateTaxStatus,
  getTaxSummary,
  findAllCurrencies,
  updateCurrencyRate,
};

