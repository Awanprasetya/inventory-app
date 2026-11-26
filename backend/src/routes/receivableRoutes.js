const express = require('express');
const router = express.Router();
const receivableController = require('../controllers/receivableController');
const checkModule = require('../middleware/checkModule');
const { checkPermission } = require('../middleware/rbac');

router.use(checkModule('MOD_ACCOUNTING'));

router.get('/receivables/summary', checkPermission('MOD_ACCOUNTING', 'READ'), receivableController.getSummary);
router.get('/receivables', checkPermission('MOD_ACCOUNTING', 'READ'), receivableController.getAll);
router.get('/receivables/:id', checkPermission('MOD_ACCOUNTING', 'READ'), receivableController.getById);
router.post('/receivables', checkPermission('MOD_ACCOUNTING', 'CREATE'), receivableController.create);
router.post('/receivables/:id/payments', checkPermission('MOD_ACCOUNTING', 'CREATE'), receivableController.addPayment);
router.delete('/receivables/payments/:paymentId', checkPermission('MOD_ACCOUNTING', 'DELETE'), receivableController.deletePayment);
router.delete('/receivables/:id', checkPermission('MOD_ACCOUNTING', 'DELETE'), receivableController.remove);

module.exports = router;

