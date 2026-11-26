const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const userModel = require('../models/userModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const MIN_PASSWORD = 6;

// GET /api/users  (khusus ADMINISTRATOR)
const getAll = asyncHandler(async (req, res) => {
  const tenantId = req.query.tenant_id ? Number(req.query.tenant_id) : ((req.user && req.user.tenant_id !== 1) ? req.user.tenant_id : null);
  const data = await userModel.findAll(tenantId);
  res.json({ success: true, data });
});

// POST /api/users
const create = asyncHandler(async (req, res) => {
  const namaLengkap = (req.body.nama_lengkap || '').trim();
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const role = (req.body.role || '').trim();
  const warehouseId = req.body.warehouse_id ? Number(req.body.warehouse_id) : null;

  let tenantId = req.user ? req.user.tenant_id : 1;
  if (req.user && req.user.tenant_id === 1 && req.body.tenant_id) {
    tenantId = Number(req.body.tenant_id);
  }

  if (!namaLengkap || !username || !password || !role) {
    throw new ApiError(400, 'Nama lengkap, username, password, dan role wajib diisi');
  }
  if (username.length < 3 || /\s/.test(username)) {
    throw new ApiError(400, 'Username minimal 3 karakter dan tanpa spasi');
  }
  if (password.length < MIN_PASSWORD) {
    throw new ApiError(400, `Password minimal ${MIN_PASSWORD} karakter`);
  }
  if (!userModel.ROLES.includes(role)) {
    throw new ApiError(400, `Role tidak valid (${userModel.ROLES.join(' / ')})`);
  }
  if (await userModel.findByUsername(username)) {
    throw new ApiError(409, `Username "${username}" sudah digunakan`);
  }
  if (warehouseId) {
    const [whRows] = await pool.query('SELECT id, tenant_id, nama_gudang FROM warehouses WHERE id = ? LIMIT 1', [warehouseId]);
    if (whRows.length === 0) throw new ApiError(404, 'Gudang penugasan tidak ditemukan');
    if (Number(whRows[0].tenant_id) !== Number(tenantId)) {
      throw new ApiError(400, `Gudang "${whRows[0].nama_gudang}" bukan milik perusahaan yang dipilih.`);
    }
  }

  const id = await userModel.create({
    tenantId,
    namaLengkap,
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    warehouseId,
  });
  const data = await userModel.findById(id);
  res.status(201).json({ success: true, message: 'User berhasil ditambahkan', data });
});

// PUT /api/users/:id  (password dikirim = ganti, kosong = tetap)
const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'ID user tidak valid');
  const existing = await userModel.findById(id);
  if (!existing) throw new ApiError(404, 'User tidak ditemukan');

  if (req.user && req.user.tenant_id !== 1 && existing.tenant_id !== req.user.tenant_id) {
    throw new ApiError(403, 'Akses ditolak: User tidak berada di bawah perusahaan/tenant Anda');
  }

  const namaLengkap = (req.body.nama_lengkap || '').trim();
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const role = (req.body.role || '').trim();
  const warehouseId = req.body.warehouse_id !== undefined
    ? (req.body.warehouse_id ? Number(req.body.warehouse_id) : null)
    : undefined;

  let tenantId = null;
  if (req.user && req.user.tenant_id === 1 && req.body.tenant_id) {
    tenantId = Number(req.body.tenant_id);
  }

  if (!namaLengkap || !username || !role) {
    throw new ApiError(400, 'Nama lengkap, username, dan role wajib diisi');
  }
  if (username.length < 3 || /\s/.test(username)) {
    throw new ApiError(400, 'Username minimal 3 karakter dan tanpa spasi');
  }
  if (!userModel.ROLES.includes(role)) {
    throw new ApiError(400, `Role tidak valid (${userModel.ROLES.join(' / ')})`);
  }
  if (password && password.length < MIN_PASSWORD) {
    throw new ApiError(400, `Password minimal ${MIN_PASSWORD} karakter`);
  }

  const duplikat = await userModel.findByUsername(username);
  if (duplikat && duplikat.id !== id) {
    throw new ApiError(409, `Username "${username}" sudah digunakan`);
  }

  const effectiveTenantId = tenantId || existing.tenant_id;
  const effectiveWarehouseId = warehouseId !== undefined ? warehouseId : existing.warehouse_id;
  if (effectiveWarehouseId) {
    const [whRows] = await pool.query('SELECT id, tenant_id, nama_gudang FROM warehouses WHERE id = ? LIMIT 1', [effectiveWarehouseId]);
    if (whRows.length === 0) throw new ApiError(404, 'Gudang penugasan tidak ditemukan');
    if (Number(whRows[0].tenant_id) !== Number(effectiveTenantId)) {
      throw new ApiError(400, `Gudang "${whRows[0].nama_gudang}" bukan milik perusahaan user yang dipilih. Pilih ulang gudang penugasan yang sesuai.`);
    }
  }

  await userModel.update(id, {
    tenantId,
    namaLengkap,
    username,
    role,
    warehouseId,
    passwordHash: password ? bcrypt.hashSync(password, 10) : null,
  });
  const data = await userModel.findById(id);
  res.json({ success: true, message: 'User berhasil diperbarui', data });
});

// DELETE /api/users/:id  (dilarang menghapus akun sendiri)
const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'ID user tidak valid');
  if (req.user.id === id) {
    throw new ApiError(400, 'Tidak dapat menghapus akun yang sedang login');
  }
  const existing = await userModel.findById(id);
  if (!existing) throw new ApiError(404, 'User tidak ditemukan');

  if (req.user && req.user.tenant_id !== 1 && existing.tenant_id !== req.user.tenant_id) {
    throw new ApiError(403, 'Akses ditolak: User tidak berada di bawah perusahaan/tenant Anda');
  }

  await userModel.remove(id);
  res.json({ success: true, message: 'User berhasil dihapus' });
});

module.exports = { getAll, create, update, remove };
