const accountingModel = require('../models/accountingModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

// ============================================================
// 1. BAGAN AKUN (COA) CONTROLLERS
// ============================================================
const getAccounts = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { kategori, is_kas_bank, search, is_active } = req.query;
  const accounts = await accountingModel.findAllAccounts({ tenantId, kategori, is_kas_bank, search, is_active });
  res.json({ success: true, data: accounts });
});

const getAccountById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const account = await accountingModel.findAccountById(tenantId, id);
  if (!account) throw new ApiError(404, 'Akun tidak ditemukan');
  res.json({ success: true, data: account });
});

const createAccount = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const { kode_akun, nama_akun, kategori, subkategori, saldo_normal, is_kas_bank, deskripsi } = req.body;

  if (!kode_akun || !kode_akun.trim()) throw new ApiError(400, 'Kode akun wajib diisi');
  if (!nama_akun || !nama_akun.trim()) throw new ApiError(400, 'Nama akun wajib diisi');
  if (!kategori) throw new ApiError(400, 'Kategori akun wajib dipilih');
  if (!saldo_normal) throw new ApiError(400, 'Saldo normal (DEBIT/KREDIT) wajib dipilih');

  const validKategori = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'];
  if (!validKategori.includes(kategori)) {
    throw new ApiError(400, `Kategori tidak valid. Pilihan: ${validKategori.join(', ')}`);
  }

  try {
    const id = await accountingModel.createAccount({
      tenantId: userTenantId,
      kode_akun,
      nama_akun,
      kategori,
      subkategori,
      saldo_normal,
      is_kas_bank,
      deskripsi,
    });
    const created = await accountingModel.findAccountById(userTenantId, id);
    res.status(201).json({
      success: true,
      message: `Akun "${nama_akun}" (${kode_akun}) berhasil ditambahkan`,
      data: created,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, `Kode akun "${kode_akun}" sudah digunakan`);
    }
    throw err;
  }
});

const updateAccount = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const { nama_akun, subkategori, is_kas_bank, deskripsi, is_active } = req.body;

  const existing = await accountingModel.findAccountById(tenantId, id);
  if (!existing) throw new ApiError(404, 'Akun tidak ditemukan');
  if (!nama_akun || !nama_akun.trim()) throw new ApiError(400, 'Nama akun wajib diisi');

  await accountingModel.updateAccount(id, {
    nama_akun,
    subkategori,
    is_kas_bank,
    deskripsi,
    is_active,
  });

  const updated = await accountingModel.findAccountById(tenantId, id);
  res.json({
    success: true,
    message: `Akun "${nama_akun}" berhasil diperbarui`,
    data: updated,
  });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const existing = await accountingModel.findAccountById(tenantId, id);
  if (!existing) throw new ApiError(404, 'Akun tidak ditemukan');

  try {
    await accountingModel.deleteAccount(id);
    res.json({
      success: true,
      message: `Akun "${existing.nama_akun}" (${existing.kode_akun}) berhasil dihapus`,
    });
  } catch (err) {
    throw new ApiError(400, err.message);
  }
});

// ============================================================
// 2. JURNAL UMUM (JOURNAL ENTRIES) CONTROLLERS
// ============================================================
const getJournals = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { startDate, endDate, tipeReferensi, search } = req.query;
  const journals = await accountingModel.findAllJournals({ tenantId, startDate, endDate, tipeReferensi, search });
  res.json({ success: true, data: journals });
});

const getJournalById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const journal = await accountingModel.findJournalById(tenantId, id);
  if (!journal) throw new ApiError(404, 'Data jurnal tidak ditemukan');
  res.json({ success: true, data: journal });
});

const createManualJournal = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const { tanggal, no_referensi, keterangan, lines } = req.body;

  if (!tanggal) throw new ApiError(400, 'Tanggal jurnal wajib diisi');
  if (!keterangan || !keterangan.trim()) throw new ApiError(400, 'Keterangan jurnal wajib diisi');
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new ApiError(400, 'Jurnal wajib memiliki minimal 2 baris akun (debit dan kredit)');
  }

  const formattedLines = lines.map((l, idx) => {
    const accountId = Number(l.account_id || l.accountId);
    if (!accountId) throw new ApiError(400, `Baris ${idx + 1}: Akun wajib dipilih`);
    const debit = Number(l.debit || 0);
    const credit = Number(l.credit || 0);
    if (debit <= 0 && credit <= 0) {
      throw new ApiError(400, `Baris ${idx + 1}: Nominal debit atau kredit wajib lebih dari 0`);
    }
    return {
      accountId,
      debit,
      credit,
      keterangan: (l.keterangan || '').trim() || null,
    };
  });

  try {
    const journalId = await accountingModel.postJournal({
      tenantId: userTenantId,
      tanggal,
      tipeReferensi: 'MANUAL',
      noReferensi: no_referensi ? no_referensi.trim() : null,
      keterangan: keterangan.trim(),
      createdBy: req.user ? req.user.id : null,
      lines: formattedLines,
    });

    const created = await accountingModel.findJournalById(userTenantId, journalId);
    res.status(201).json({
      success: true,
      message: `Jurnal ${created.no_jurnal} berhasil disimpan dan seimbang`,
      data: created,
    });
  } catch (err) {
    throw new ApiError(400, err.message);
  }
});

const deleteJournal = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const existing = await accountingModel.findJournalById(tenantId, id);
  if (!existing) throw new ApiError(404, 'Jurnal tidak ditemukan');

  await accountingModel.deleteJournal(id);
  res.json({
    success: true,
    message: `Jurnal ${existing.no_jurnal} berhasil dihapus`,
  });
});

// ============================================================
// 3. TRANSAKSI KAS & BANK (BIAYA & KAS MASUK) CONTROLLERS
// ============================================================
const getCashTransactions = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { tipe, startDate, endDate, accountKasId, search } = req.query;
  const transactions = await accountingModel.findAllCashTransactions({
    tenantId,
    tipe,
    startDate,
    endDate,
    accountKasId: accountKasId ? Number(accountKasId) : undefined,
    search,
  });
  res.json({ success: true, data: transactions });
});

const createCashTransaction = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const {
    tipe,
    tanggal,
    account_kas_id,
    account_lawan_id,
    nominal,
    penerima_penyetor,
    metode_pembayaran,
    referensi,
    keterangan,
  } = req.body;

  if (!tipe || !['KELUAR', 'MASUK'].includes(tipe)) {
    throw new ApiError(400, 'Tipe transaksi wajib KELUAR (Biaya/Pengeluaran) atau MASUK (Penerimaan)');
  }
  if (!tanggal) throw new ApiError(400, 'Tanggal transaksi wajib diisi');
  if (!account_kas_id) throw new ApiError(400, 'Akun Kas / Bank wajib dipilih');
  if (!account_lawan_id) throw new ApiError(400, 'Akun Kategori Beban / Pendapatan wajib dipilih');

  const numNominal = Number(nominal);
  if (!Number.isFinite(numNominal) || numNominal <= 0) {
    throw new ApiError(400, 'Nominal transaksi harus berupa angka lebih dari 0');
  }
  if (!keterangan || !keterangan.trim()) {
    throw new ApiError(400, 'Keterangan transaksi wajib diisi');
  }

  try {
    const result = await accountingModel.createCashTransaction({
      tenantId: userTenantId,
      tipe,
      tanggal,
      accountKasId: Number(account_kas_id),
      accountLawanId: Number(account_lawan_id),
      nominal: numNominal,
      penerimaPenyetor: penerima_penyetor,
      metodePembayaran: metode_pembayaran || 'Kas Tunai',
      referensi,
      keterangan,
      userId: req.user ? req.user.id : null,
    });

    res.status(201).json({
      success: true,
      message: `Transaksi ${result.noTransaksi} berhasil dicatat & jurnal otomatis terbit`,
      data: result,
    });
  } catch (err) {
    throw new ApiError(400, err.message);
  }
});

const deleteCashTransaction = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await accountingModel.deleteCashTransaction(id);
  if (!deleted) throw new ApiError(404, 'Transaksi kas tidak ditemukan');

  res.json({
    success: true,
    message: `Transaksi kas ${deleted.no_transaksi} berhasil dibatalkan`,
  });
});

const getCashSummary = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const summary = await accountingModel.getCashAndBankSummary(tenantId);
  res.json({ success: true, data: summary });
});

// ============================================================
// 4. LAPORAN KEUANGAN CONTROLLERS
// ============================================================
const getProfitAndLoss = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { startDate, endDate } = req.query;
  const data = await accountingModel.getProfitAndLoss({ tenantId, startDate, endDate });
  res.json({ success: true, data });
});

const getBalanceSheet = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { asOfDate } = req.query;
  const data = await accountingModel.getBalanceSheet({ tenantId, asOfDate });
  res.json({ success: true, data });
});

const getGeneralLedger = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const accountId = Number(req.query.accountId);
  if (!accountId) throw new ApiError(400, 'Akun wajib dipilih untuk melihat buku besar');
  const { startDate, endDate } = req.query;
  const data = await accountingModel.getGeneralLedger({ tenantId, accountId, startDate, endDate });
  res.json({ success: true, data });
});

const getTrialBalance = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { startDate, endDate } = req.query;
  const data = await accountingModel.getTrialBalance({ tenantId, startDate, endDate });
  res.json({ success: true, data });
});

const syncHistorical = asyncHandler(async (req, res) => {
  const result = await accountingModel.syncAllHistoricalTransactions();
  res.json({
    success: true,
    message: 'Sinkronisasi seluruh transaksi historis ke jurnal akuntansi berhasil',
    data: result,
  });
});

// ============================================================
// 6. LAPORAN ARUS KAS & REKONSILIASI
// ============================================================
const getCashFlow = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { startDate, endDate } = req.query;
  const data = await accountingModel.getCashFlowStatement({ tenantId, startDate, endDate });
  res.json({ success: true, data });
});

const getGLReconciliation = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await accountingModel.getGLReconciliation(tenantId);
  res.json({ success: true, data });
});

const getAgingAP = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await accountingModel.getAgingAP(tenantId);
  res.json({ success: true, data });
});

const getAgingAR = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await accountingModel.getAgingAR(tenantId);
  res.json({ success: true, data });
});

const createFundTransfer = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const { tanggal, from_account_id, to_account_id, nominal, referensi, keterangan } = req.body;
  if (!tanggal) throw new ApiError(400, 'Tanggal transfer wajib diisi');
  if (!from_account_id || !to_account_id) throw new ApiError(400, 'Akun asal dan akun tujuan wajib dipilih');
  if (from_account_id === to_account_id) throw new ApiError(400, 'Akun asal dan tujuan tidak boleh sama');

  const amount = Number(nominal);
  if (!amount || amount <= 0) throw new ApiError(400, 'Nominal transfer harus lebih dari 0');

  const result = await accountingModel.createFundTransfer({
    tenantId: userTenantId,
    tanggal,
    fromAccountId: Number(from_account_id),
    toAccountId: Number(to_account_id),
    nominal: amount,
    referensi,
    keterangan,
    userId: req.user ? req.user.id : null,
  });

  res.status(201).json({
    success: true,
    message: `Transfer dana sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat & jurnal diposting`,
    data: result,
  });
});

// ============================================================
// 7. TUTUP BUKU (PERIOD-END CLOSING)
// ============================================================
const getPeriods = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const periods = await accountingModel.findAllPeriods(tenantId);
  res.json({ success: true, data: periods });
});

const closePeriod = asyncHandler(async (req, res) => {
  const tenantId = getTargetTenantId(req);
  const { tahun, bulan, tanggal_tutup, catatan } = req.body;
  if (!tahun || !bulan) throw new ApiError(400, 'Tahun dan bulan periode wajib diisi');

  const result = await accountingModel.closePeriod({
    tenantId,
    tahun,
    bulan,
    tanggalTutup: tanggal_tutup,
    catatan,
    userId: req.user ? req.user.id : null,
  });

  res.json({
    success: true,
    message: `Tutup buku periode ${tahun}-${String(bulan).padStart(2, '0')} berhasil. Laba bersih ditransfer ke Laba Ditahan.`,
    data: result,
  });
});

const reopenPeriod = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const result = await accountingModel.reopenPeriod(tenantId, id);
  res.json({
    success: true,
    message: `Periode berhasil dibuka kembali. Jurnal penutup telah dibatalkan.`,
    data: result,
  });
});

// ============================================================
// 8. FIXED ASSETS & DEPRECIATION
// ============================================================
const getFixedAssets = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const assets = await accountingModel.findAllFixedAssets(tenantId);
  res.json({ success: true, data: assets });
});

const createFixedAsset = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const {
    kode_aset,
    nama_aset,
    kategori_aset,
    account_asset_id,
    account_accum_id,
    account_expense_id,
    tanggal_perolehan,
    harga_perolehan,
    nilai_residu,
    masa_manfaat_bulan,
    metode_penyusutan,
    lokasi,
    keterangan,
    post_purchase_journal,
    credit_account_id,
  } = req.body;

  if (!kode_aset || !nama_aset) throw new ApiError(400, 'Kode aset dan nama aset wajib diisi');
  if (!account_asset_id || !account_accum_id || !account_expense_id) {
    throw new ApiError(400, 'Akun aset, akumulasi penyusutan, dan beban penyusutan wajib dipilih');
  }
  if (!harga_perolehan || Number(harga_perolehan) <= 0) {
    throw new ApiError(400, 'Harga perolehan harus lebih dari 0');
  }

  const assetId = await accountingModel.createFixedAsset(
    {
      tenantId: userTenantId,
      kode_aset,
      nama_aset,
      kategori_aset,
      account_asset_id: Number(account_asset_id),
      account_accum_id: Number(account_accum_id),
      account_expense_id: Number(account_expense_id),
      tanggal_perolehan: tanggal_perolehan || new Date().toISOString().split('T')[0],
      harga_perolehan: Number(harga_perolehan),
      nilai_residu: Number(nilai_residu || 0),
      masa_manfaat_bulan: Number(masa_manfaat_bulan || 48),
      metode_penyusutan: metode_penyusutan || 'GARIS_LURUS',
      lokasi,
      keterangan,
      post_purchase_journal: Boolean(post_purchase_journal),
      credit_account_id: credit_account_id ? Number(credit_account_id) : null,
    },
    req.user ? req.user.id : null
  );

  res.status(201).json({
    success: true,
    message: `Aset tetap "${nama_aset}" (${kode_aset}) berhasil didaftarkan`,
    data: { id: assetId },
  });
});

const processDepreciation = asyncHandler(async (req, res) => {
  const { asset_id, periode_bulan } = req.body;
  if (!asset_id || !periode_bulan) throw new ApiError(400, 'Aset dan periode bulan (YYYY-MM) wajib dipilih');

  const result = await accountingModel.processMonthlyDepreciation({
    assetId: Number(asset_id),
    periodeBulan: periode_bulan,
    userId: req.user ? req.user.id : null,
  });

  res.json({
    success: true,
    message: `Penyusutan periode ${periode_bulan} berhasil dihitung & jurnal penyusutan diterbitkan`,
    data: result,
  });
});

const deleteFixedAsset = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const deleted = await accountingModel.deleteFixedAsset(tenantId, id);
  if (!deleted) throw new ApiError(404, 'Aset tetap tidak ditemukan');
  res.json({ success: true, message: `Aset tetap ${deleted.nama_aset} berhasil dihapus` });
});

// ============================================================
// 9. BUDGETING & BUDGET CONTROL
// ============================================================
const getBudgets = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { tahun } = req.query;
  const budgets = await accountingModel.findAllBudgets({ tenantId, tahun });
  res.json({ success: true, data: budgets });
});

const saveBudget = asyncHandler(async (req, res) => {
  const tenantId = getTargetTenantId(req);
  const { tahun, judul_anggaran, divisi, catatan, details } = req.body;
  if (!tahun || !judul_anggaran) throw new ApiError(400, 'Tahun dan judul anggaran wajib diisi');

  const budgetId = await accountingModel.createOrUpdateBudget(
    { tenantId, tahun, judul_anggaran, divisi: divisi || 'Operasional', catatan, details },
    req.user ? req.user.id : null
  );

  res.json({
    success: true,
    message: `Rencana anggaran tahun ${tahun} berhasil disimpan`,
    data: { id: budgetId },
  });
});

const getBudgetVsActual = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { tahun, divisi } = req.query;
  const data = await accountingModel.getBudgetVsActual({ tenantId, tahun, divisi });
  res.json({ success: true, data });
});

// ============================================================
// 10. TAX MANAGEMENT (PPN & PPH)
// ============================================================
const getTaxRecords = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { tipePajak, startDate, endDate, statusSpt } = req.query;
  const records = await accountingModel.findAllTaxRecords({ tenantId, tipePajak, startDate, endDate, statusSpt });
  res.json({ success: true, data: records });
});

const createTaxRecord = asyncHandler(async (req, res) => {
  const tenantId = getTargetTenantId(req);
  const id = await accountingModel.createTaxRecord({ ...req.body, tenantId }, req.user ? req.user.id : null);
  res.status(201).json({
    success: true,
    message: 'Data pencatatan pajak berhasil disimpan',
    data: { id },
  });
});

const updateTaxStatus = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const { status_spt } = req.body;
  if (!status_spt) throw new ApiError(400, 'Status SPT wajib diisi');
  await accountingModel.updateTaxStatus(tenantId, id, status_spt);
  res.json({ success: true, message: `Status SPT berhasil diperbarui ke ${status_spt}` });
});

const getTaxSummary = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { startDate, endDate } = req.query;
  const data = await accountingModel.getTaxSummary({ tenantId, startDate, endDate });
  res.json({ success: true, data });
});

// ============================================================
// 11. MULTI-CURRENCY
// ============================================================
const getCurrencies = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const currencies = await accountingModel.findAllCurrencies(tenantId);
  res.json({ success: true, data: currencies });
});

const updateCurrency = asyncHandler(async (req, res) => {
  const tenantId = getTargetTenantId(req);
  const { kode } = req.params;
  const { kurs_ke_idr, tanggal_kurs } = req.body;
  await accountingModel.updateCurrencyRate({ tenantId, kode, kursKeIdr: kurs_ke_idr, tanggalKurs: tanggal_kurs });
  res.json({ success: true, message: `Kurs mata uang ${kode} berhasil diperbarui` });
});

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  getJournals,
  getJournalById,
  createManualJournal,
  deleteJournal,
  getCashTransactions,
  createCashTransaction,
  deleteCashTransaction,
  getCashSummary,
  getProfitAndLoss,
  getBalanceSheet,
  getGeneralLedger,
  getTrialBalance,
  syncHistorical,
  getCashFlow,
  getGLReconciliation,
  getAgingAP,
  getAgingAR,
  createFundTransfer,
  getPeriods,
  closePeriod,
  reopenPeriod,
  getFixedAssets,
  createFixedAsset,
  processDepreciation,
  deleteFixedAsset,
  getBudgets,
  saveBudget,
  getBudgetVsActual,
  getTaxRecords,
  createTaxRecord,
  updateTaxStatus,
  getTaxSummary,
  getCurrencies,
  updateCurrency,
};
