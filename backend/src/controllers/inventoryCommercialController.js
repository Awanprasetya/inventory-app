const inventoryCommercialModel = require('../models/inventoryCommercialModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');
const { normalizeRole } = require('../middleware/rbac');

const getRestrictedWarehouse = (req) => {
  if (!req.user) return null;
  const role = normalizeRole(req.user.role, req.user.tenant_id, req.user.username);
  if (role === 'ADMIN_GUDANG' && req.user.warehouse_id) {
    return {
      id: Number(req.user.warehouse_id),
      nama: req.user.nama_gudang || 'Gudang Tugas Anda',
    };
  }
  return null;
};

// ============================================================================
// 1. WAREHOUSES & TRANSFERS
// ============================================================================
const getWarehouses = asyncHandler(async (req, res) => {
  const includeAllTenants = req.query.include_other_tenants === '1' || req.query.scope === 'all_tenants';
  const tenantId = includeAllTenants ? null : getTenantId(req);
  const data = await inventoryCommercialModel.findAllWarehouses(tenantId);
  res.json({ success: true, data });
});

const createWarehouse = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const { kode_gudang, nama_gudang } = req.body;
  if (!kode_gudang || !nama_gudang) throw new ApiError(400, 'Kode gudang dan nama gudang wajib diisi.');
  
  const kodeClean = String(kode_gudang).trim();
  const existing = await inventoryCommercialModel.findWarehouseByKode(userTenantId, kodeClean);
  if (existing) {
    throw new ApiError(409, `Kode gudang "${kodeClean}" sudah terdaftar di perusahaan Anda.`);
  }

  const id = await inventoryCommercialModel.createWarehouse({
    tenantId: userTenantId,
    ...req.body,
    kode_gudang: kodeClean,
  });
  res.status(201).json({ success: true, message: 'Gudang baru berhasil ditambahkan.', data: { id } });
});

const updateWarehouse = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await inventoryCommercialModel.updateWarehouse(id, req.body);
  res.json({ success: true, message: 'Informasi gudang berhasil diperbarui.' });
});

const deleteWarehouse = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await inventoryCommercialModel.deleteWarehouse(id);
  res.json({ success: true, message: 'Gudang berhasil dihapus.' });
});

const getWarehouseTransfers = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await inventoryCommercialModel.findAllWarehouseTransfers(tenantId);
  res.json({ success: true, data });
});

const createWarehouseTransfer = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const userId = req.user ? req.user.id : null;
  const result = await inventoryCommercialModel.createWarehouseTransfer(req.body, userId, userTenantId, req.user);
  res.status(201).json({
    success: true,
    message: `Pengajuan transfer stok ${result.noTransfer} berhasil dibuat (Menunggu Approval).`,
    data: result,
  });
});

const approveWarehouseTransfer = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const userId = req.user ? req.user.id : null;
  const result = await inventoryCommercialModel.approveWarehouseTransfer(id, userId, tenantId, req.user);
  const extraMsg = result.isIntercompany
    ? ` Dokumen otomatis terbit: ${result.noSo}, ${result.noDo}, dan ${result.noPo} (beserta Utang/Piutang & Jurnal Antar-PT).`
    : '';
  res.json({
    success: true,
    message: `Transfer stok ${result.noTransfer} disetujui dan stok antar gudang telah berhasil dipindahkan.${extraMsg}`,
    data: result,
  });
});

const rejectWarehouseTransfer = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const userId = req.user ? req.user.id : null;
  const { reason } = req.body || {};
  const result = await inventoryCommercialModel.rejectWarehouseTransfer(id, reason, userId, tenantId, req.user);
  res.json({
    success: true,
    message: `Pengajuan transfer ${result.noTransfer} ditolak.`,
    data: result,
  });
});

// ============================================================================
// 2. LOTS & EXPIRED DATES
// ============================================================================
const getLots = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { search, status, warehouseId, expiringWithinDays } = req.query;
  const data = await inventoryCommercialModel.findAllLotsWithExpiry({
    tenantId,
    search,
    status,
    warehouseId,
    expiringWithinDays,
  });
  res.json({ success: true, data });
});

const createLot = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const { kode_produk, nomor_lot, tanggal_produksi, expired_date } = req.body;
  if (!kode_produk || !nomor_lot || !tanggal_produksi || !expired_date) {
    throw new ApiError(400, 'Kode produk, nomor lot, tanggal produksi, dan expired date wajib diisi.');
  }
  const id = await inventoryCommercialModel.createLot(req.body, userTenantId);
  res.status(201).json({ success: true, message: `Batch ${nomor_lot} berhasil didaftarkan.`, data: { id } });
});

const updateLotStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!status) throw new ApiError(400, 'Status lot wajib ditentukan.');
  await inventoryCommercialModel.updateLotStatus(id, status);
  res.json({ success: true, message: `Status lot berhasil diperbarui ke ${status}.` });
});

// ============================================================================
// 3. STOK OPNAME & ADJUSTMENT
// ============================================================================
const getStockAdjustments = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const restrictedWh = getRestrictedWarehouse(req);
  const warehouseId = restrictedWh
    ? restrictedWh.id
    : (req.query.warehouse_id ? Number(req.query.warehouse_id) : null);
  const data = await inventoryCommercialModel.findAllStockAdjustments(tenantId, warehouseId);
  res.json({ success: true, data });
});

const createStockAdjustment = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const userId = req.user ? req.user.id : null;
  const restrictedWh = getRestrictedWarehouse(req);
  const requestedWhId = req.body.warehouse_id ? Number(req.body.warehouse_id) : null;

  if (restrictedWh && requestedWhId && requestedWhId !== restrictedWh.id) {
    throw new ApiError(
      403,
      `Akses ditolak: Anda hanya diizinkan melakukan stok opname pada gudang tugas Anda (${restrictedWh.nama}).`
    );
  }

  const finalWhId = restrictedWh ? restrictedWh.id : requestedWhId;
  if (!finalWhId) {
    throw new ApiError(400, 'Lokasi gudang stok opname wajib dipilih.');
  }

  const payload = {
    ...req.body,
    warehouse_id: finalWhId,
  };
  const result = await inventoryCommercialModel.createStockAdjustment(payload, userId, userTenantId);
  res.status(201).json({
    success: true,
    message: `Stok opname ${result.noAdj} berhasil diproses dan jurnal penyesuaian persediaan telah terbit.`,
    data: result,
  });
});

// ============================================================================
// 4. PENAWARAN HARGA (SALES QUOTATION)
// ============================================================================
const getSalesQuotations = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await inventoryCommercialModel.findAllQuotations(tenantId);
  res.json({ success: true, data });
});

const createSalesQuotation = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const userId = req.user ? req.user.id : null;
  const result = await inventoryCommercialModel.createQuotation(req.body, userId, userTenantId);
  res.status(201).json({
    success: true,
    message: `Surat Penawaran Harga ${result.noQuotation} berhasil diterbitkan.`,
    data: result,
  });
});

const updateQuotationStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!status) throw new ApiError(400, 'Status penawaran wajib diisi.');
  await inventoryCommercialModel.updateQuotationStatus(id, status);
  res.json({ success: true, message: `Status penawaran berhasil diubah ke ${status}.` });
});

const convertQuotationToSO = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const id = Number(req.params.id);
  const userId = req.user ? req.user.id : null;
  const result = await inventoryCommercialModel.convertQuotationToSO(id, userId, userTenantId);
  res.json({
    success: true,
    message: `Penawaran ${result.noQuotation} berhasil dikonversi menjadi Sales Order ${result.noSO}!`,
    data: result,
  });
});

// ============================================================================
// 5. RETUR PEMBELIAN & PENJUALAN
// ============================================================================
const getPurchaseReturns = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await inventoryCommercialModel.findAllPurchaseReturns(tenantId);
  res.json({ success: true, data });
});

const createPurchaseReturn = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const userId = req.user ? req.user.id : null;
  const result = await inventoryCommercialModel.createPurchaseReturn(req.body, userId, userTenantId);
  res.status(201).json({
    success: true,
    message: `Retur pembelian ${result.noReturn} berhasil dicatat & jurnal pemotongan utang/persediaan diterbitkan.`,
    data: result,
  });
});

const getSalesReturns = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await inventoryCommercialModel.findAllSalesReturns(tenantId);
  res.json({ success: true, data });
});

const createSalesReturn = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const userId = req.user ? req.user.id : null;
  const result = await inventoryCommercialModel.createSalesReturn(req.body, userId, userTenantId);
  res.status(201).json({
    success: true,
    message: `Retur penjualan ${result.noReturn} berhasil dicatat & kredit nota/jurnal terbit.`,
    data: result,
  });
});

const getRecommendedLots = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { kode_produk, warehouse_id, qty, metode } = req.query;
  if (!kode_produk) throw new ApiError(400, 'Parameter kode_produk wajib diisi');
  const data = await inventoryCommercialModel.getRecommendedLots({
    tenantId,
    kodeProduk: String(kode_produk).trim(),
    warehouseId: warehouse_id ? Number(warehouse_id) : null,
    requestedQty: qty ? Number(qty) : 1,
    metodeOverride: metode ? String(metode).toUpperCase() : null,
  });
  res.json({ success: true, data });
});

module.exports = {
  // Warehouses
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseTransfers,
  createWarehouseTransfer,
  approveWarehouseTransfer,
  rejectWarehouseTransfer,
  // Lots
  getLots,
  createLot,
  updateLotStatus,
  getRecommendedLots,
  // Adjustments
  getStockAdjustments,
  createStockAdjustment,
  // Quotations
  getSalesQuotations,
  createSalesQuotation,
  updateQuotationStatus,
  convertQuotationToSO,
  // Returns
  getPurchaseReturns,
  createPurchaseReturn,
  getSalesReturns,
  createSalesReturn,
};
