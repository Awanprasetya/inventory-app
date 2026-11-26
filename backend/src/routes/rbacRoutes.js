const router = require('express').Router();
const rbacController = require('../controllers/rbacController');

// Ambil matriks hak akses per menu
router.get('/rbac/permissions', rbacController.getPermissions);

// Update matriks hak akses per menu (Hanya Administrator / Pengembang)
router.put('/rbac/permissions', rbacController.updatePermissions);

module.exports = router;

