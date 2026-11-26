const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

// Seluruh modul Akuntansi & Keuangan membutuhkan lisensi MOD_ACCOUNTING
router.use(checkModule('MOD_ACCOUNTING'));

// 1. Chart of Accounts (COA)
router.get('/accounts', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getAccounts);
router.get('/accounts/:id', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getAccountById);
router.post('/accounts', checkPermission('MOD_ACCOUNTING', 'CREATE'), accountingController.createAccount);
router.put('/accounts/:id', checkPermission('MOD_ACCOUNTING', 'UPDATE'), accountingController.updateAccount);
router.delete('/accounts/:id', checkPermission('MOD_ACCOUNTING', 'DELETE'), accountingController.deleteAccount);

// 2. Jurnal Umum
router.get('/journals', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getJournals);
router.get('/journals/:id', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getJournalById);
router.post('/journals', checkPermission('MOD_ACCOUNTING', 'CREATE'), accountingController.createManualJournal);
router.delete('/journals/:id', checkPermission('MOD_ACCOUNTING', 'DELETE'), accountingController.deleteJournal);

// 3. Kas & Bank (Beban & Kas Masuk/Keluar) & Transfer Dana
router.get('/cash-transactions', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getCashTransactions);
router.post('/cash-transactions', checkPermission('MOD_ACCOUNTING', 'CREATE'), accountingController.createCashTransaction);
router.delete('/cash-transactions/:id', checkPermission('MOD_ACCOUNTING', 'DELETE'), accountingController.deleteCashTransaction);
router.get('/cash-summary', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getCashSummary);
router.post('/fund-transfer', checkPermission('MOD_ACCOUNTING', 'CREATE'), accountingController.createFundTransfer);

// 4. Laporan Keuangan (Laba Rugi, Neraca, Buku Besar, Neraca Saldo, Arus Kas)
router.get('/reports/profit-and-loss', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getProfitAndLoss);
router.get('/reports/balance-sheet', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getBalanceSheet);
router.get('/reports/general-ledger', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getGeneralLedger);
router.get('/reports/trial-balance', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getTrialBalance);
router.get('/reports/cash-flow', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getCashFlow);

// 5. Rekonsiliasi & Analisis Aging
router.get('/reports/gl-reconciliation', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getGLReconciliation);
router.get('/reports/aging-ap', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getAgingAP);
router.get('/reports/aging-ar', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getAgingAR);

// 6. Tutup Buku (Period-End Closing)
router.get('/periods', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getPeriods);
router.post('/periods/close', checkPermission('MOD_ACCOUNTING', 'UPDATE'), accountingController.closePeriod);
router.post('/periods/:id/reopen', checkPermission('MOD_ACCOUNTING', 'UPDATE'), accountingController.reopenPeriod);

// 7. Fixed Assets (Aset Tetap & Depresiasi)
router.get('/fixed-assets', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getFixedAssets);
router.post('/fixed-assets', checkPermission('MOD_ACCOUNTING', 'CREATE'), accountingController.createFixedAsset);
router.post('/fixed-assets/depreciate', checkPermission('MOD_ACCOUNTING', 'UPDATE'), accountingController.processDepreciation);
router.delete('/fixed-assets/:id', checkPermission('MOD_ACCOUNTING', 'DELETE'), accountingController.deleteFixedAsset);

// 8. Budgeting & Budget Control
router.get('/budgets', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getBudgets);
router.post('/budgets', checkPermission('MOD_ACCOUNTING', 'CREATE'), accountingController.saveBudget);
router.get('/budgets/vs-actual', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getBudgetVsActual);

// 9. Tax Management (Perpajakan PPN & PPh)
router.get('/tax', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getTaxRecords);
router.post('/tax', checkPermission('MOD_ACCOUNTING', 'CREATE'), accountingController.createTaxRecord);
router.put('/tax/:id/status', checkPermission('MOD_ACCOUNTING', 'UPDATE'), accountingController.updateTaxStatus);
router.get('/tax/summary', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getTaxSummary);

// 10. Multi-Currency
router.get('/currencies', checkPermission('MOD_ACCOUNTING', 'READ'), accountingController.getCurrencies);
router.put('/currencies/:kode', checkPermission('MOD_ACCOUNTING', 'UPDATE'), accountingController.updateCurrency);

// 11. Sinkronisasi Data Historis ERP
router.post('/sync', checkPermission('MOD_ACCOUNTING', 'UPDATE'), accountingController.syncHistorical);

module.exports = router;
