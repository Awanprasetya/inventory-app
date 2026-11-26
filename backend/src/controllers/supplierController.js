const supplierModel = require('../models/supplierModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const search = req.query.search || '';
  const data = await supplierModel.findAll(tenantId, search);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const data = await supplierModel.findById(id, tenantId);
  if (!data) throw new ApiError(404, 'Supplier tidak ditemukan');
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const tenantId = getTargetTenantId(req);
  const kodeSupplier = (req.body.kode_supplier || '').trim();
  const namaSupplier = (req.body.nama_supplier || '').trim();
  const nomorHp = (req.body.nomor_hp || req.body.no_hp || '').trim() || null;
  const telepon = (req.body.telepon || nomorHp || '').trim() || null;
  const email = (req.body.email || '').trim() || null;
  const npwp = (req.body.npwp || '').trim() || null;
  const alamatKantor = (req.body.alamat_kantor || req.body.alamat || '').trim() || null;
  const alamatPengiriman = (req.body.alamat_pengiriman || '').trim() || null;
  const alamat = (req.body.alamat || alamatKantor || alamatPengiriman || '').trim() || null;

  if (!kodeSupplier || !namaSupplier) {
    throw new ApiError(400, 'Kode supplier dan nama supplier wajib diisi');
  }

  const existing = await supplierModel.findByKode(kodeSupplier, tenantId);
  if (existing) {
    throw new ApiError(409, `Kode supplier "${kodeSupplier}" sudah digunakan`);
  }

  const id = await supplierModel.create({
    tenantId,
    kodeSupplier,
    namaSupplier,
    telepon,
    nomorHp: nomorHp || telepon,
    email,
    npwp,
    alamat,
    alamatKantor,
    alamatPengiriman,
  });
  const data = await supplierModel.findById(id, tenantId);
  res.status(201).json({ success: true, message: 'Supplier berhasil ditambahkan', data });
});

const update = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const existing = await supplierModel.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Supplier tidak ditemukan');

  const kodeSupplier = (req.body.kode_supplier || '').trim();
  const namaSupplier = (req.body.nama_supplier || '').trim();
  const nomorHp = (req.body.nomor_hp !== undefined ? req.body.nomor_hp : req.body.no_hp !== undefined ? req.body.no_hp : (existing.nomor_hp || '')).trim() || null;
  const telepon = (req.body.telepon !== undefined ? req.body.telepon : (existing.telepon || nomorHp || '')).trim() || null;
  const email = (req.body.email !== undefined ? req.body.email : (existing.email || '')).trim() || null;
  const npwp = (req.body.npwp !== undefined ? req.body.npwp : (existing.npwp || '')).trim() || null;
  const alamatKantor = (req.body.alamat_kantor !== undefined ? req.body.alamat_kantor : (existing.alamat_kantor || existing.alamat || '')).trim() || null;
  const alamatPengiriman = (req.body.alamat_pengiriman !== undefined ? req.body.alamat_pengiriman : (existing.alamat_pengiriman || '')).trim() || null;
  const alamat = (req.body.alamat !== undefined ? req.body.alamat : (alamatKantor || alamatPengiriman || existing.alamat || '')).trim() || null;

  if (!kodeSupplier || !namaSupplier) {
    throw new ApiError(400, 'Kode supplier dan nama supplier wajib diisi');
  }

  const checkKode = await supplierModel.findByKode(kodeSupplier, tenantId);
  if (checkKode && checkKode.id !== id) {
    throw new ApiError(409, `Kode supplier "${kodeSupplier}" sudah digunakan oleh supplier lain`);
  }

  await supplierModel.update(id, tenantId, {
    kodeSupplier,
    namaSupplier,
    telepon,
    nomorHp: nomorHp || telepon,
    email,
    npwp,
    alamat,
    alamatKantor,
    alamatPengiriman,
  });
  const data = await supplierModel.findById(id, tenantId);
  res.json({ success: true, message: 'Supplier berhasil diperbarui', data });
});

const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const existing = await supplierModel.findById(id, tenantId);
  if (!existing) throw new ApiError(404, 'Supplier tidak ditemukan');

  await supplierModel.remove(id, tenantId);
  res.json({ success: true, message: 'Supplier berhasil dihapus' });
});

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};

