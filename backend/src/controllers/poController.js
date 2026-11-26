const pool = require('../config/db');
const poModel = require('../models/poModel');
const supplierModel = require('../models/supplierModel');
const productModel = require('../models/productModel');
const payableModel = require('../models/payableModel');
const accountingModel = require('../models/accountingModel');
const { deletePurchaseOrderCascade } = require('../utils/cascadeDeleteHelper');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const generateNoPo = async (tenantId, tanggalPo) => {
  const d = new Date(tanggalPo || new Date());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const prefix = `JPM/PO/${mm}/`;

  try {
    const [rows] = await pool.query(
      `SELECT no_po FROM purchase_orders WHERE (? IS NULL OR tenant_id = ?) AND no_po LIKE ? ORDER BY id DESC LIMIT 50`,
      [tenantId, tenantId, `${prefix}%`]
    );

    let maxNum = 0;
    for (const r of rows) {
      const numPart = (r.no_po || '').replace(prefix, '').trim();
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
    const nextNum = String(maxNum + 1).padStart(4, '0');
    return `${prefix}${nextNum}`;
  } catch (_) {
    return `${prefix}0001`;
  }
};

const calculateDueDate = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
};

const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const status = req.query.status || null;
  const search = req.query.search || '';
  const data = await poModel.findAll(tenantId, status, search);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const po = await poModel.findById(tenantId, id);
  if (!po) throw new ApiError(404, 'Purchase Order tidak ditemukan');
  const details = await poModel.findDetailsByPoId(id);
  let apDetails = null;
  if (po.ap_id) {
    const payments = await payableModel.findPaymentsByPayableId(po.ap_id);
    apDetails = { payments };
  }
  res.json({ success: true, data: { ...po, details, items: details, apDetails } });
});

const create = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const supplierId = req.body.supplier_id ? Number(req.body.supplier_id) : null;
  const tanggalPo = req.body.tanggal_po || new Date().toISOString().split('T')[0];
  let noPo = (req.body.no_po || '').trim();
  if (!noPo) {
    noPo = await generateNoPo(userTenantId, tanggalPo);
  }
  const terminHari = req.body.termin_hari !== undefined ? Math.max(0, Number(req.body.termin_hari)) : 30;
  const jatuhTempo = req.body.jatuh_tempo || calculateDueDate(tanggalPo, terminHari);
  const keterangan = (req.body.keterangan || '').trim() || null;
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  const diskonPersen = Math.max(0, Number(req.body.diskon_persen) || 0);
  const pajakPersen = Math.max(0, Number(req.body.pajak_persen) || 0);

  if (!noPo) throw new ApiError(400, 'Nomor PO wajib diisi');
  if (items.length === 0) throw new ApiError(400, 'Minimal 1 detail produk pesanan dalam PO');

  if (supplierId) {
    const supplier = await supplierModel.findById(supplierId, userTenantId);
    if (!supplier) throw new ApiError(404, 'Supplier tidak ditemukan');
  }

  const existing = await poModel.findByNoPo(userTenantId, noPo);
  if (existing) throw new ApiError(409, `Nomor PO "${noPo}" sudah ada`);

  const validatedItems = [];
  let calculatedSubtotal = 0;

  for (const item of items) {
    const kodeProduk = (item.kode_produk || '').trim();
    const qtyPesan = Number(item.qty_pesan);
    if (!kodeProduk || !Number.isInteger(qtyPesan) || qtyPesan <= 0) {
      throw new ApiError(400, `Item produk ${kodeProduk} atau Qty Pesan ${qtyPesan} tidak valid`);
    }
    const product = await productModel.findByKode(userTenantId, kodeProduk);
    if (!product) throw new ApiError(404, `Produk "${kodeProduk}" tidak ditemukan`);

    const satuanOrder = (item.satuan_order || 'PCS').toUpperCase();
    let rasio = 1;
    if (satuanOrder === (product.satuan_besar || 'BOX').toUpperCase()) {
      rasio = Number(product.isi_box_pcs) || Number(product.isi_per_kemasan) || 1;
    } else if (satuanOrder === (product.satuan_menengah || 'PACK').toUpperCase()) {
      rasio = Number(product.isi_pack_pcs) || 1;
    }
    const qtyOrder = item.qty_order != null ? Number(item.qty_order) : (qtyPesan / rasio);

    const hargaSatuan =
      item.harga_satuan !== undefined && item.harga_satuan !== ''
        ? Math.max(0, Number(item.harga_satuan))
        : Math.max(0, Number(product.harga || 0));

    const lineQty = item.qty_order != null ? Number(item.qty_order) : qtyPesan;
    const lineGross = lineQty * hargaSatuan;
    const itemDiskonPersen = Math.min(100, Math.max(0, Number(item.diskon_persen !== undefined ? item.diskon_persen : 0)));
    let itemDiskon = Math.max(0, Number(item.diskon) || 0);
    if (item.diskon_persen !== undefined && itemDiskonPersen > 0) {
      itemDiskon = Math.round((lineGross * itemDiskonPersen) / 100);
    }
    const itemSubtotal = item.subtotal !== undefined ? Math.max(0, Number(item.subtotal)) : Math.max(0, lineGross - itemDiskon);
    calculatedSubtotal += itemSubtotal;

    validatedItems.push({
      kodeProduk,
      qtyPesan,
      hargaSatuan,
      diskon: itemDiskon,
      diskonPersen: itemDiskonPersen,
      subtotal: itemSubtotal,
      satuanOrder,
      qtyOrder,
      rasioPcs: rasio,
    });
  }

  const subtotal = calculatedSubtotal;
  let diskonNominal =
    req.body.diskon_nominal !== undefined && req.body.diskon_nominal !== ''
      ? Math.max(0, Number(req.body.diskon_nominal))
      : Math.round((subtotal * diskonPersen) / 100);

  if (diskonNominal > subtotal) diskonNominal = subtotal;

  const dpp = Math.max(0, subtotal - diskonNominal);
  const pajakNominal =
    req.body.pajak_nominal !== undefined && req.body.pajak_nominal !== ''
      ? Math.max(0, Number(req.body.pajak_nominal))
      : Math.round((dpp * pajakPersen) / 100);

  const totalHarga = dpp + pajakNominal;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const poId = await poModel.create(
      {
        tenantId: userTenantId,
        noPo,
        supplierId,
        tanggalPo,
        terminHari,
        jatuhTempo,
        status: 'PENDING',
        keterangan,
        subtotal,
        diskonPersen,
        diskonNominal,
        pajakPersen,
        pajakNominal,
        totalHarga,
      },
      conn
    );

    for (const item of validatedItems) {
      await poModel.createDetail(
        {
          tenantId: userTenantId,
          poId,
          kodeProduk: item.kodeProduk,
          qtyPesan: item.qtyPesan,
          hargaSatuan: item.hargaSatuan,
          diskon: item.diskon,
          diskonPersen: item.diskonPersen,
          subtotal: item.subtotal,
          qtyDiterima: 0,
          satuanOrder: item.satuanOrder,
          qtyOrder: item.qtyOrder,
          rasioPcs: item.rasioPcs,
        },
        conn
      );
    }

    await conn.commit();
    const data = await poModel.findById(userTenantId, poId);
    const details = await poModel.findDetailsByPoId(poId);
    res.status(201).json({
      success: true,
      message: 'Purchase Order berhasil dibuat (Status: PENDING)',
      data: { ...data, details },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

const updateStatus = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const status = (req.body.status || '').trim().toUpperCase();
  const validStatuses = ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'];

  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Status tidak valid. Pilihan: ${validStatuses.join(', ')}`);
  }

  const po = await poModel.findById(tenantId, id);
  if (!po) throw new ApiError(404, 'Purchase Order tidak ditemukan');

  await poModel.updateStatus(id, status);
  const data = await poModel.findById(tenantId, id);
  res.json({ success: true, message: `Status PO diubah menjadi ${status}`, data });
});

const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const po = await poModel.findById(tenantId, id);
  if (!po) throw new ApiError(404, 'Purchase Order tidak ditemukan');

  await deletePurchaseOrderCascade(id, tenantId);
  res.json({
    success: true,
    message: `Purchase Order "${po.no_po}" berhasil dihapus, barang masuk telah dibatalkan, dan stok fisik serta kartu stok telah disesuaikan.`
  });
});

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  remove,
};
