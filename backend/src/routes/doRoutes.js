const express = require('express');
const router = express.Router();
const doController = require('../controllers/doController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

router.use(checkModule('MOD_COMMERCIAL'));

router.get('/delivery-orders', checkPermission('MOD_COMMERCIAL', 'READ'), doController.getAll);
router.get('/delivery-orders/:id', checkPermission('MOD_COMMERCIAL', 'READ'), doController.getById);
router.post('/delivery-orders', checkPermission('MOD_COMMERCIAL', 'CREATE'), doController.create);
router.put('/delivery-orders/:id/status', checkPermission('MOD_COMMERCIAL', 'UPDATE'), doController.updateStatus);
router.patch('/delivery-orders/:id/status', checkPermission('MOD_COMMERCIAL', 'UPDATE'), doController.updateStatus);
router.post('/delivery-orders/:id/ship', checkPermission('MOD_COMMERCIAL', 'UPDATE'), doController.shipOrder);
router.delete('/delivery-orders/:id', checkPermission('MOD_COMMERCIAL', 'DELETE'), doController.remove);

module.exports = router;

