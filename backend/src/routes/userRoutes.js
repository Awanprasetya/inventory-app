const router = require('express').Router();

const userController = require('../controllers/userController');
const { checkPermission } = require('../middleware/rbac');

// Manajemen user: MOD_USERS
router.get('/users', checkPermission('MOD_USERS', 'READ'), userController.getAll);
router.post('/users', checkPermission('MOD_USERS', 'CREATE'), userController.create);
router.put('/users/:id', checkPermission('MOD_USERS', 'UPDATE'), userController.update);
router.delete('/users/:id', checkPermission('MOD_USERS', 'DELETE'), userController.remove);

module.exports = router;
