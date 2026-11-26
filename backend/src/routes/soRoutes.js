const express = require('express');
const router = express.Router();
const soController = require('../controllers/soController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

router.use(checkModule('MOD_COMMERCIAL'));

router.get('/sales-orders', checkPermission('MOD_COMMERCIAL', 'READ'), soController.getAll);
router.get('/sales-orders/:id', checkPermission('MOD_COMMERCIAL', 'READ'), soController.getById);
router.post('/sales-orders', checkPermission('MOD_COMMERCIAL', 'CREATE'), soController.create);
router.post('/sales-orders/:id/invoice', checkPermission('MOD_COMMERCIAL', 'UPDATE'), soController.createInvoice);
router.put('/sales-orders/:id/status', checkPermission('MOD_COMMERCIAL', 'UPDATE'), soController.updateStatus);
router.delete('/sales-orders/:id', checkPermission('MOD_COMMERCIAL', 'DELETE'), soController.remove);

module.exports = router;

