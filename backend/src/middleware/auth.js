const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const pool = require('../config/db');
const { ApiError } = require('./errorHandler');
const { normalizeRole } = require('./rbac');

// Verifikasi Bearer token JWT, lalu isi req.user dengan data pengguna & informasi lisensi SaaS tenant
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
      throw new ApiError(401, 'Silakan login terlebih dahulu');
    }

    let payload;
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'inventory-jwt-secret-key-syntesia-2026';
      payload = jwt.verify(token, JWT_SECRET);
    } catch (_) {
      throw new ApiError(401, 'Sesi tidak valid atau sudah kadaluarsa, silakan login ulang');
    }

    const user = await userModel.findById(payload.id);
    if (!user) {
      throw new ApiError(401, 'Akun tidak ditemukan atau sudah dihapus');
    }

    const tenantId = user.tenant_id || 1;
    const [tenantRows] = await pool.query(
      'SELECT id, kode_tenant, nama_perusahaan, status, expired_at FROM tenants WHERE id = ?',
      [tenantId]
    );
    const tenant = tenantRows[0] || {
      id: 1,
      kode_tenant: 'TENANT-DEFAULT',
      nama_perusahaan: 'PT JARUM PATAH MEDICAL',
      status: 'ACTIVE',
      expired_at: '2030-12-31',
    };

    const [moduleRows] = await pool.query(
      'SELECT kode_modul FROM tenant_modules WHERE tenant_id = ? AND is_active = 1',
      [tenantId]
    );
    let modules = moduleRows.map((m) => m.kode_modul);
    const activeRole = normalizeRole(user.role, tenantId, user.username);
    if (modules.length === 0 || activeRole === 'PENGEMBANG' || activeRole === 'ADMINISTRATOR') {
      modules = ['MOD_INVENTORY', 'MOD_COMMERCIAL', 'MOD_ACCOUNTING', 'MOD_USERS'];
    }

    req.user = {
      ...user,
      tenant_id: tenantId,
      tenant_name: tenant.nama_perusahaan,
      tenant_status: tenant.status,
      tenant_expired_at: tenant.expired_at,
      modules,
    };

    next();
  } catch (err) {
    next(err);
  }
};

// Batasi akses berdasarkan role (dipakai setelah authenticate)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Silakan login terlebih dahulu'));
  }

  const userRoleNorm = normalizeRole(req.user.role, req.user.tenant_id, req.user.username);
  
  // SuperAdmin / Pengembang selalu diizinkan
  if (userRoleNorm === 'PENGEMBANG') return next();

  // Normalize roles parameter
  const allowedNorm = roles.map((r) => normalizeRole(r, 0, ''));
  if (!allowedNorm.includes(userRoleNorm)) {
    return next(new ApiError(403, `Akses ditolak: Fitur ini membutuhkan role ${roles.join(' / ')}`));
  }
  next();
};

// Batasi akses khusus untuk Pengembang / SuperAdmin Aplikasi (username = admin atau role = PENGEMBANG)
const requireSuperAdmin = (req, res, next) => {
  const isSuper = req.user && (
    req.user.username === 'admin' || 
    normalizeRole(req.user.role) === 'PENGEMBANG'
  );
  if (!isSuper) {
    return next(new ApiError(403, 'Akses ditolak: Fitur ini khusus untuk Pengembang / SuperAdmin Aplikasi'));
  }
  next();
};

module.exports = { authenticate, requireRole, requireSuperAdmin };
