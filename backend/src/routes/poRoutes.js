const express = require('express');
const router = express.Router();
const poController = require('../controllers/poController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

router.use(checkModule('MOD_COMMERCIAL'));

router.get('/purchase-orders', checkPermission('MOD_COMMERCIAL', 'READ'), poController.getAll);
router.get('/purchase-orders/:id', checkPermission('MOD_COMMERCIAL', 'READ'), poController.getById);
router.post('/purchase-orders', checkPermission('MOD_COMMERCIAL', 'CREATE'), poController.create);
router.put('/purchase-orders/:id/status', checkPermission('MOD_COMMERCIAL', 'UPDATE'), poController.updateStatus);
router.delete('/purchase-orders/:id', checkPermission('MOD_COMMERCIAL', 'DELETE'), poController.remove);

module.exports = router;

