const productModel = require('../models/productModel');
const rackModel = require('../models/rackModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const MAX_LEN = { kode: 50, nama: 150, satuan: 20 };

// GET /api/products?search=&warehouse_id=&kategori=
const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const search = (req.query.search || '').trim() || null;
  const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
  const kategori = (req.query.kategori || '').trim() || null;
  const data = await productModel.findAll(tenantId, search, warehouseId, kategori);
  res.json({ success: true, data });
});

// GET /api/products/:kode
const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const product = await productModel.findByKode(tenantId, req.params.kode);
  if (!product) throw new ApiError(404, `Produk "${req.params.kode}" tidak ditemukan`);
  res.json({ success: true, data: product });
});

// GET /api/products/:kode/lots
const getLots = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const metodeOverride = req.query.metode ? String(req.query.metode).toUpperCase() : null;
  const product = await productModel.findByKode(tenantId, req.params.kode);
  if (!product) throw new ApiError(404, `Produk "${req.params.kode}" tidak ditemukan`);
  const lots = await productModel.findLotsByKode(tenantId, req.params.kode, metodeOverride);
  res.json({ success: true, data: { product, lots } });
});

// POST /api/products
const create = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const kodeProduk = (req.body.kode_produk || '').trim();
  const namaProduk = (req.body.nama_produk || '').trim();
  const kategoriProduk = (req.body.kategori_produk || 'BARANG_JADI').trim().toUpperCase();
  const satuan = (req.body.satuan || '').trim();
  const satuanBesar = (req.body.satuan_besar || '').trim() || 'BOX';
  const satuanMenengah = (req.body.satuan_menengah || '').trim() || 'PACK';
  const isiPackPcs = req.body.isi_pack_pcs != null && Number(req.body.isi_pack_pcs) > 0 ? Number(req.body.isi_pack_pcs) : 1;
  const isiBoxPack = req.body.isi_box_pack != null && Number(req.body.isi_box_pack) > 0 ? Number(req.body.isi_box_pack) : 1;
  const isiBoxPcs = req.body.isi_box_pcs != null && Number(req.body.isi_box_pcs) > 0 ? Number(req.body.isi_box_pcs) : (isiBoxPack * isiPackPcs);
  const isiPerKemasan = isiBoxPcs;
  const barcodeKemasan = (req.body.barcode_kemasan || '').trim() || null;
  const jenisIzin = (req.body.jenis_izin || '').trim() || null;
  const nomorIzin = (req.body.nomor_izin || '').trim() || null;
  const harga = Number(req.body.harga);
  const rackId = req.body.rack_id ? Number(req.body.rack_id) : null;
  const metodeStok = (req.body.metode_stok || 'FIFO').toUpperCase() === 'FEFO' ? 'FEFO' : 'FIFO';

  if (!kodeProduk || !namaProduk || !satuan) {
    throw new ApiError(400, 'Kode produk, nama produk, dan satuan wajib diisi');
  }
  if (kodeProduk.length > MAX_LEN.kode || namaProduk.length > MAX_LEN.nama || satuan.length > MAX_LEN.satuan) {
    throw new ApiError(400, 'Panjang melebihi batas (kode 50, nama 150, satuan 20 karakter)');
  }
  if (!Number.isFinite(harga) || harga < 0) {
    throw new ApiError(400, 'Harga wajib diisi berupa angka >= 0');
  }
  if (harga > 99999999999.99) {
    throw new ApiError(400, 'Harga melebihi batas maksimal');
  }
  if (rackId !== null) {
    const rack = await rackModel.findById(userTenantId, rackId);
    if (!rack) throw new ApiError(400, 'Rak tidak ditemukan atau bukan milik PT yang dipilih');
  }
  if (await productModel.findByKode(userTenantId, kodeProduk)) {
    throw new ApiError(409, `Produk "${kodeProduk}" sudah terdaftar`);
  }

  await productModel.create({
    tenantId: userTenantId,
    kodeProduk,
    namaProduk,
    kategoriProduk,
    satuan,
    satuanBesar,
    satuanMenengah,
    isiPackPcs,
    isiBoxPack,
    isiBoxPcs,
    isiPerKemasan,
    barcodeKemasan,
    jenisIzin,
    nomorIzin,
    harga,
    rackId,
    metodeStok,
  });
  const data = await productModel.findByKode(userTenantId, kodeProduk);
  res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan', data });
});

// PUT /api/products/:kode
const update = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const kodeProduk = req.params.kode;
  const existing = await productModel.findByKode(tenantId, kodeProduk);
  if (!existing) throw new ApiError(404, `Produk "${kodeProduk}" tidak ditemukan`);

  let targetTenantId = existing.tenant_id;
  if ((req.user?.tenant_id === 1 || req.user?.username === 'admin') && req.body.tenant_id) {
    targetTenantId = Number(req.body.tenant_id);
  }

  const namaProduk =
    req.body.nama_produk !== undefined ? (req.body.nama_produk || '').trim() : existing.nama_produk;
  const kategoriProduk =
    req.body.kategori_produk !== undefined
      ? (req.body.kategori_produk || 'BARANG_JADI').trim().toUpperCase()
      : existing.kategori_produk;
  const satuan =
    req.body.satuan !== undefined ? (req.body.satuan || '').trim() : existing.satuan;
  const satuanBesar =
    req.body.satuan_besar !== undefined ? (req.body.satuan_besar || '').trim() || 'BOX' : (existing.satuan_besar || 'BOX');
  const satuanMenengah =
    req.body.satuan_menengah !== undefined ? (req.body.satuan_menengah || '').trim() || 'PACK' : (existing.satuan_menengah || 'PACK');
  const isiPackPcs =
    req.body.isi_pack_pcs !== undefined
      ? Number(req.body.isi_pack_pcs) > 0 ? Number(req.body.isi_pack_pcs) : 1
      : Number(existing.isi_pack_pcs || 1);
  const isiBoxPack =
    req.body.isi_box_pack !== undefined
      ? Number(req.body.isi_box_pack) > 0 ? Number(req.body.isi_box_pack) : 1
      : Number(existing.isi_box_pack || 1);
  const isiBoxPcs =
    req.body.isi_box_pcs !== undefined
      ? Number(req.body.isi_box_pcs) > 0 ? Number(req.body.isi_box_pcs) : (isiBoxPack * isiPackPcs)
      : (Number(existing.isi_box_pcs) || (isiBoxPack * isiPackPcs));
  const isiPerKemasan = isiBoxPcs;
  const barcodeKemasan =
    req.body.barcode_kemasan !== undefined ? (req.body.barcode_kemasan || '').trim() || null : existing.barcode_kemasan;
  const jenisIzin =
    req.body.jenis_izin !== undefined ? (req.body.jenis_izin || '').trim() || null : existing.jenis_izin;
  const nomorIzin =
    req.body.nomor_izin !== undefined ? (req.body.nomor_izin || '').trim() || null : existing.nomor_izin;
  const harga =
    req.body.harga !== undefined ? Number(req.body.harga) : Number(existing.harga);
  const rackId =
    req.body.rack_id !== undefined
      ? req.body.rack_id
        ? Number(req.body.rack_id)
        : null
      : existing.rack_id;
  const metodeStok =
    req.body.metode_stok !== undefined
      ? (req.body.metode_stok || '').toUpperCase() === 'FEFO' ? 'FEFO' : 'FIFO'
      : existing.metode_stok;

  if (!namaProduk || !satuan) {
    throw new ApiError(400, 'Nama produk dan satuan wajib diisi');
  }
  if (!Number.isFinite(harga) || harga < 0) {
    throw new ApiError(400, 'Harga wajib diisi berupa angka >= 0');
  }
  if (harga > 99999999999.99) {
    throw new ApiError(400, 'Harga melebihi batas maksimal');
  }
  if (rackId !== null) {
    const rack = await rackModel.findById(targetTenantId, rackId);
    if (!rack) throw new ApiError(400, 'Rak tidak ditemukan atau bukan milik PT terkait');
  }

  await productModel.update(tenantId, kodeProduk, {
    namaProduk,
    kategoriProduk,
    satuan,
    satuanBesar,
    satuanMenengah,
    isiPackPcs,
    isiBoxPack,
    isiBoxPcs,
    isiPerKemasan,
    barcodeKemasan,
    jenisIzin,
    nomorIzin,
    harga,
    rackId,
    metodeStok,
    tenantId: targetTenantId,
  });
  const data = await productModel.findByKode(targetTenantId, kodeProduk);
  res.json({ success: true, message: 'Produk berhasil diperbarui', data });
});

// DELETE /api/products/:kode
const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const kodeProduk = req.params.kode;
  const existing = await productModel.findByKode(tenantId, kodeProduk);
  if (!existing) throw new ApiError(404, `Produk "${kodeProduk}" tidak ditemukan`);

  await productModel.remove(tenantId, kodeProduk);
  res.json({ success: true, message: 'Produk berhasil dihapus' });
});

const inventoryCommercialModel = require('../models/inventoryCommercialModel');

// GET /api/lots?kode_produk=&search=&status=&warehouseId=&expiringWithinDays=
const getAllLots = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { search, status, warehouseId, expiringWithinDays, kode_produk } = req.query;
  const data = await inventoryCommercialModel.findAllLotsWithExpiry({
    tenantId,
    search,
    status,
    warehouseId,
    expiringWithinDays,
    kode_produk: (kode_produk || '').trim() || null,
  });
  res.json({ success: true, data });
});

// GET /api/lots/:nomor?warehouse_id=
const getLot = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
  const lot = await productModel.findLotByNomor(tenantId, req.params.nomor, null, warehouseId);
  if (!lot) throw new ApiError(404, `Lot "${req.params.nomor}" tidak ditemukan`);
  const priorityWarning = await productModel.findLotPriorityInfo(tenantId, lot);
  res.json({ success: true, data: { ...lot, priority_warning: priorityWarning } });
});

module.exports = { getAll, getById, getLots, create, update, remove, getAllLots, getLot };
