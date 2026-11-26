const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'inventory-jwt-secret-key-syntesia-2026';

const signToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (!username || !password) {
    throw new ApiError(400, 'Username dan password wajib diisi');
  }

  const user = await userModel.findByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw new ApiError(401, 'Username atau password salah');
  }

  const token = signToken(user);
  const userPayload = {
    id: user.id,
    tenant_id: user.tenant_id || 1,
    tenant_name: user.nama_perusahaan || 'SyntesiaERP',
    nama_lengkap: user.nama_lengkap,
    username: user.username,
    role: user.role,
    warehouse_id: user.warehouse_id || null,
    nama_gudang: user.nama_gudang || null,
    kode_gudang: user.kode_gudang || null,
  };

  // Sertakan baik top-level maupun nested di 'data' demi fleksibilitas klien
  res.json({
    success: true,
    message: 'Login berhasil',
    token,
    user: userPayload,
    data: {
      token,
      user: userPayload,
    },
  });
});

const pool = require('../config/db');

// GET /api/auth/me  (dilindungi middleware authenticate)
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user, data: req.user });
});

// GET /api/auth/tenants (daftar tenant yang bisa diakses user)
const getTenants = asyncHandler(async (req, res) => {
  const isSuper = req.user && (req.user.username === 'admin' || ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes((req.user.role || '').toUpperCase()));
  if (isSuper) {
    const [rows] = await pool.query('SELECT id, kode_tenant, nama_perusahaan, status FROM tenants ORDER BY id ASC');
    return res.json({ success: true, data: rows });
  }
  const [rows] = await pool.query('SELECT id, kode_tenant, nama_perusahaan, status FROM tenants WHERE id = ?', [
    req.user.tenant_id || 1,
  ]);
  return res.json({ success: true, data: rows });
});

module.exports = { login, me, getTenants };
