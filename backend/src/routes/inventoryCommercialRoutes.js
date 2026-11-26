const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventoryCommercialController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');
const { requireRole } = require('../middleware/auth');

// Seluruh rute komersial & operasional gudang membutuhkan lisensi MOD_COMMERCIAL
router.use(checkModule('MOD_COMMERCIAL'));

// 1. Multi-Gudang & Transfer Antar Gudang (MOD_INVENTORY)
// Tambah, edit, dan hapus master gudang hanya untuk role ADMINISTRATOR & PENGEMBANG
router.get('/warehouses', checkPermission('MOD_INVENTORY', 'READ'), controller.getWarehouses);
router.post('/warehouses', requireRole('ADMINISTRATOR', 'PENGEMBANG'), controller.createWarehouse);
router.put('/warehouses/:id', requireRole('ADMINISTRATOR', 'PENGEMBANG'), controller.updateWarehouse);
router.delete('/warehouses/:id', requireRole('ADMINISTRATOR', 'PENGEMBANG'), controller.deleteWarehouse);
router.get('/warehouses/transfers', checkPermission('MOD_INVENTORY', 'READ'), controller.getWarehouseTransfers);
router.post('/warehouses/transfers', checkPermission('MOD_INVENTORY', 'CREATE'), controller.createWarehouseTransfer);
router.put('/warehouses/transfers/:id/approve', checkPermission('MOD_INVENTORY', 'UPDATE'), controller.approveWarehouseTransfer);
router.put('/warehouses/transfers/:id/reject', checkPermission('MOD_INVENTORY', 'UPDATE'), controller.rejectWarehouseTransfer);

// 2. Batch / Lot Number & Expired Date Tracking (MOD_INVENTORY)
router.get('/lots', checkPermission('MOD_INVENTORY', 'READ'), controller.getLots);
router.get('/lots/recommend', checkPermission('MOD_INVENTORY', 'READ'), controller.getRecommendedLots);
router.post('/lots', checkPermission('MOD_INVENTORY', 'CREATE'), controller.createLot);
router.put('/lots/:id/status', checkPermission('MOD_INVENTORY', 'UPDATE'), controller.updateLotStatus);

// 3. Stok Opname & Stock Adjustment (MOD_INVENTORY)
router.get('/stock-adjustments', checkPermission('MOD_INVENTORY', 'READ'), controller.getStockAdjustments);
router.post('/stock-adjustments', checkPermission('MOD_INVENTORY', 'CREATE'), controller.createStockAdjustment);

// 4. Penawaran Harga (Sales Quotation - MOD_COMMERCIAL)
router.get('/sales-quotations', checkPermission('MOD_COMMERCIAL', 'READ'), controller.getSalesQuotations);
router.post('/sales-quotations', checkPermission('MOD_COMMERCIAL', 'CREATE'), controller.createSalesQuotation);
router.put('/sales-quotations/:id/status', checkPermission('MOD_COMMERCIAL', 'UPDATE'), controller.updateQuotationStatus);
router.post('/sales-quotations/:id/convert-to-so', checkPermission('MOD_COMMERCIAL', 'UPDATE'), controller.convertQuotationToSO);

// 5. Retur Pembelian & Retur Penjualan (MOD_COMMERCIAL)
router.get('/returns/purchase', checkPermission('MOD_COMMERCIAL', 'READ'), controller.getPurchaseReturns);
router.post('/returns/purchase', checkPermission('MOD_COMMERCIAL', 'CREATE'), controller.createPurchaseReturn);
router.get('/returns/sales', checkPermission('MOD_COMMERCIAL', 'READ'), controller.getSalesReturns);
router.post('/returns/sales', checkPermission('MOD_COMMERCIAL', 'CREATE'), controller.createSalesReturn);

module.exports = router;

