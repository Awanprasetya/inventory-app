const express = require('express');
const router = express.Router();
const payableController = require('../controllers/payableController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

router.use(checkModule('MOD_ACCOUNTING'));

router.get('/payables/summary', checkPermission('MOD_ACCOUNTING', 'READ'), payableController.getSummary);
router.get('/payables', checkPermission('MOD_ACCOUNTING', 'READ'), payableController.getAll);
router.get('/payables/:id', checkPermission('MOD_ACCOUNTING', 'READ'), payableController.getById);
router.post('/payables', checkPermission('MOD_ACCOUNTING', 'CREATE'), payableController.create);
router.post('/payables/:id/payments', checkPermission('MOD_ACCOUNTING', 'CREATE'), payableController.addPayment);
router.delete('/payables/payments/:paymentId', checkPermission('MOD_ACCOUNTING', 'DELETE'), payableController.deletePayment);
router.delete('/payables/:id', checkPermission('MOD_ACCOUNTING', 'DELETE'), payableController.remove);

module.exports = router;

