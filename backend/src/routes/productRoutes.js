const router = require('express').Router();

const productController = require('../controllers/productController');
const inventoryCommercialController = require('../controllers/inventoryCommercialController');
const rackController = require('../controllers/rackController');
const { checkPermission } = require('../middleware/rbac');

// --- Master Produk (MOD_INVENTORY) ---
router.get('/products', checkPermission('MOD_INVENTORY', 'READ'), productController.getAll);
router.get('/products/:kode/lots', checkPermission('MOD_INVENTORY', 'READ'), productController.getLots);
router.get('/products/:kode', checkPermission('MOD_INVENTORY', 'READ'), productController.getById);
router.post('/products', checkPermission('MOD_INVENTORY', 'CREATE'), productController.create);
router.put('/products/:kode', checkPermission('MOD_INVENTORY', 'UPDATE'), productController.update);
router.delete('/products/:kode', checkPermission('MOD_INVENTORY', 'DELETE'), productController.remove);

// --- Lot Produk (scan barcode) ---
router.get('/lots', checkPermission('MOD_INVENTORY', 'READ'), productController.getAllLots);
// Pastikan /lots/recommend berada sebelum /lots/:nomor agar tidak tertangkap sebagai nomor lot "recommend"
router.get('/lots/recommend', checkPermission('MOD_INVENTORY', 'READ'), inventoryCommercialController.getRecommendedLots);
router.get('/lots/:nomor', checkPermission('MOD_INVENTORY', 'READ'), productController.getLot);

// --- Lokasi Rak ---
router.get('/racks', checkPermission('MOD_INVENTORY', 'READ'), rackController.getAll);
router.post('/racks', checkPermission('MOD_INVENTORY', 'CREATE'), rackController.create);
router.put('/racks/:id', checkPermission('MOD_INVENTORY', 'UPDATE'), rackController.update);
router.delete('/racks/:id', checkPermission('MOD_INVENTORY', 'DELETE'), rackController.remove);

module.exports = router;
