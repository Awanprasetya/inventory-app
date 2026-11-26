const router = require('express').Router();

const { login, me, getTenants } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Login publik, /me dan /tenants dilindungi token
router.post('/login', login);
router.get('/me', authenticate, me);
router.get('/tenants', authenticate, getTenants);

module.exports = router;
