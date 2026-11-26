const customerModel = require('../models/customerModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const search = req.query.search || '';
  const data = await customerModel.findAll(tenantId, search);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const data = await customerModel.findById(id, tenantId);
  if (!data) throw new ApiError(404, 'Customer tidak ditemukan');
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const tenantId = getTargetTenantId(req);
  const kodeCustomer = (req.body.kode_customer || '').trim();
  const namaCustomer = (req.body.nama_customer || '').trim();
  const jenisCustomer = (req.body.jenis_customer || 'PT').trim().toUpperCase();
  const nomorHp = (req.body.nomor_hp || req.body.no_hp || '').trim() || null;
  const telepon = (req.body.telepon || nomorHp || '').trim() || null;
  const email = (req.body.email || '').trim() || null;
  const npwp = (req.body.npwp || '').trim() || null;
  const alamatPengiriman = (req.body.alamat_pengiriman || '').trim() || null;
  const alamatKantor = (req.body.alamat_kantor || '').trim() || null;

  if (!kodeCustomer || !namaCustomer) {
    throw new ApiError(400, 'Kode customer dan nama customer wajib diisi');
  }

  const existing = await customerModel.findByKode(kodeCustomer, tenantId);
  if (existing) {
    throw new ApiError(409, `Kode customer "${kodeCustomer}" sudah digunakan`);
  }

  const id = await customerModel.create({
    tenantId,
    kodeCustomer,
    namaCustomer,
    jenisCustomer: jenisCustomer || 'PT',
    telepon,
    nomorHp: nomorHp || telepon,
    email,
    npwp,
    alamatPengiriman,
    alamatKantor,
  });
  const data = await customerModel.findById(id, tenantId);
  res.status(201).json({ success: true, message: 'Customer berhasil ditambahkan', data });
});

const update = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const existing = await customerModel.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Customer tidak ditemukan');

  const kodeCustomer = (req.body.kode_customer || '').trim();
  const namaCustomer = (req.body.nama_customer || '').trim();
  const jenisCustomer = (req.body.jenis_customer !== undefined ? req.body.jenis_customer : (existing.jenis_customer || 'PT')).trim().toUpperCase();
  const nomorHp = (req.body.nomor_hp !== undefined ? req.body.nomor_hp : req.body.no_hp !== undefined ? req.body.no_hp : (existing.nomor_hp || '')).trim() || null;
  const telepon = (req.body.telepon !== undefined ? req.body.telepon : (existing.telepon || nomorHp || '')).trim() || null;
  const email = (req.body.email !== undefined ? req.body.email : (existing.email || '')).trim() || null;
  const npwp = (req.body.npwp !== undefined ? req.body.npwp : (existing.npwp || '')).trim() || null;
  const alamatPengiriman = (req.body.alamat_pengiriman !== undefined ? req.body.alamat_pengiriman : (existing.alamat_pengiriman || '')).trim() || null;
  const alamatKantor = (req.body.alamat_kantor !== undefined ? req.body.alamat_kantor : (existing.alamat_kantor || '')).trim() || null;

  if (!kodeCustomer || !namaCustomer) {
    throw new ApiError(400, 'Kode customer dan nama customer wajib diisi');
  }

  const checkKode = await customerModel.findByKode(kodeCustomer, tenantId);
  if (checkKode && checkKode.id !== id) {
    throw new ApiError(409, `Kode customer "${kodeCustomer}" sudah digunakan oleh customer lain`);
  }

  await customerModel.update(id, tenantId, {
    kodeCustomer,
    namaCustomer,
    jenisCustomer: jenisCustomer || 'PT',
    telepon,
    nomorHp: nomorHp || telepon,
    email,
    npwp,
    alamatPengiriman,
    alamatKantor,
  });
  const data = await customerModel.findById(id, tenantId);
  res.json({ success: true, message: 'Customer berhasil diperbarui', data });
});

const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const existing = await customerModel.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Customer tidak ditemukan');

  await customerModel.remove(id, tenantId);
  res.json({ success: true, message: 'Customer berhasil dihapus' });
});

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};

