const router = require('express').Router();

const transactionController = require('../controllers/transactionController');
const { checkPermission } = require('../middleware/rbac');

// --- Transaksi Masuk / Keluar (MOD_INVENTORY) ---
router.post('/transactions/inbound', checkPermission('MOD_INVENTORY', 'CREATE'), transactionController.createInbound);
router.post('/transactions/outbound', checkPermission('MOD_INVENTORY', 'CREATE'), transactionController.createOutbound);
router.get('/transactions', checkPermission('MOD_INVENTORY', 'READ'), transactionController.list);
router.get('/transactions/:kode', checkPermission('MOD_INVENTORY', 'READ'), transactionController.getById);

// --- Laporan Kartu Stok ---
router.get('/stock-card/:kode_produk', checkPermission('MOD_INVENTORY', 'READ'), transactionController.stockCard);

module.exports = router;
