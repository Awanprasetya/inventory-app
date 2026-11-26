const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

router.use(checkModule('MOD_COMMERCIAL'));

router.get('/suppliers', checkPermission('MOD_COMMERCIAL', 'READ'), supplierController.getAll);
router.get('/suppliers/:id', checkPermission('MOD_COMMERCIAL', 'READ'), supplierController.getById);
router.post('/suppliers', checkPermission('MOD_COMMERCIAL', 'CREATE'), supplierController.create);
router.put('/suppliers/:id', checkPermission('MOD_COMMERCIAL', 'UPDATE'), supplierController.update);
router.delete('/suppliers/:id', checkPermission('MOD_COMMERCIAL', 'DELETE'), supplierController.remove);

module.exports = router;

