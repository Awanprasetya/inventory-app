const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { requireSuperAdmin } = require('../middleware/auth');

// Manajemen Tenant & Lisensi Modul SaaS (Khusus Pengembang / SuperAdmin)
router.use(requireSuperAdmin);

router.get('/tenants', superadminController.getTenants);
router.post('/tenants', superadminController.createTenant);
router.put('/tenants/:id', superadminController.updateTenant);
router.delete('/tenants/:id', superadminController.deleteTenant);

module.exports = router;

