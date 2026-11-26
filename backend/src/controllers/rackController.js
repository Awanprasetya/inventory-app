const rackModel = require('../models/rackModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

// GET /api/racks
const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await rackModel.findAll(tenantId);
  res.json({ success: true, data });
});

// POST /api/racks
const create = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const kodeRak = (req.body.kode_rak || '').trim();
  const keterangan = (req.body.keterangan || '').trim() || null;

  if (!kodeRak) throw new ApiError(400, 'Kode rak wajib diisi');
  if (kodeRak.length > 50) throw new ApiError(400, 'Kode rak maksimal 50 karakter');

  const existing = await rackModel.findAll(userTenantId);
  if (existing.some((r) => r.kode_rak.toLowerCase() === kodeRak.toLowerCase())) {
    throw new ApiError(409, `Rak "${kodeRak}" sudah terdaftar untuk PT ini`);
  }

  const id = await rackModel.create({ tenantId: userTenantId, kodeRak, keterangan });
  const data = await rackModel.findById(userTenantId, id);
  res.status(201).json({ success: true, message: 'Rak berhasil ditambahkan', data });
});

// PUT /api/racks/:id
const update = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'ID rak tidak valid');
  const existing = await rackModel.findById(tenantId, id);
  if (!existing) throw new ApiError(404, 'Rak tidak ditemukan');

  let targetTenantId = existing.tenant_id;
  if ((req.user?.tenant_id === 1 || req.user?.username === 'admin') && req.body.tenant_id) {
    targetTenantId = Number(req.body.tenant_id);
  }

  const kodeRak = (req.body.kode_rak || '').trim();
  const keterangan = (req.body.keterangan || '').trim() || null;
  if (!kodeRak) throw new ApiError(400, 'Kode rak wajib diisi');

  const existingList = await rackModel.findAll(targetTenantId);
  if (existingList.some((r) => r.id !== id && r.kode_rak.toLowerCase() === kodeRak.toLowerCase())) {
    throw new ApiError(409, `Rak "${kodeRak}" sudah terdaftar untuk PT ini`);
  }

  await rackModel.update(tenantId, id, { kodeRak, keterangan, tenantId: targetTenantId });
  const data = await rackModel.findById(targetTenantId, id);
  res.json({ success: true, message: 'Rak berhasil diperbarui', data });
});

// DELETE /api/racks/:id
const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ApiError(400, 'ID rak tidak valid');
  const existing = await rackModel.findById(tenantId, id);
  if (!existing) throw new ApiError(404, 'Rak tidak ditemukan');

  await rackModel.remove(tenantId, id);
  res.json({ success: true, message: 'Rak berhasil dihapus' });
});

module.exports = { getAll, create, update, remove };
