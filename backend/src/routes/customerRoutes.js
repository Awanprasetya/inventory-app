const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

router.use(checkModule('MOD_COMMERCIAL'));

router.get('/customers', checkPermission('MOD_COMMERCIAL', 'READ'), customerController.getAll);
router.get('/customers/:id', checkPermission('MOD_COMMERCIAL', 'READ'), customerController.getById);
router.post('/customers', checkPermission('MOD_COMMERCIAL', 'CREATE'), customerController.create);
router.put('/customers/:id', checkPermission('MOD_COMMERCIAL', 'UPDATE'), customerController.update);
router.delete('/customers/:id', checkPermission('MOD_COMMERCIAL', 'DELETE'), customerController.remove);

module.exports = router;

