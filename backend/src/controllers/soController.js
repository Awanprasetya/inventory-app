const pool = require('../config/db');
const soModel = require('../models/soModel');
const customerModel = require('../models/customerModel');
const productModel = require('../models/productModel');
const receivableModel = require('../models/receivableModel');
const accountingModel = require('../models/accountingModel');
const { deleteSalesOrderCascade } = require('../utils/cascadeDeleteHelper');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const generateNoSo = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SO/${yyyy}/${mm}/${rand}`;
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
  const data = await soModel.findAll(tenantId, status, search);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const so = await soModel.findById(tenantId, id);
  if (!so) throw new ApiError(404, 'Sales Order tidak ditemukan');
  const details = await soModel.findDetailsBySoId(id);
  let arDetails = null;
  if (so.ar_id) {
    const payments = await receivableModel.findPaymentsByReceivableId(so.ar_id);
    arDetails = { payments };
  }
  res.json({ success: true, data: { ...so, details, arDetails } });
});

const create = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const customerId = req.body.customer_id ? Number(req.body.customer_id) : null;
  const noSo = (req.body.no_so || generateNoSo()).trim();
  const tanggalSo = req.body.tanggal_so || new Date().toISOString().split('T')[0];
  const terminHari = req.body.termin_hari !== undefined ? Math.max(0, Number(req.body.termin_hari)) : 30;
  const jatuhTempo = req.body.jatuh_tempo || calculateDueDate(tanggalSo, terminHari);
  const keterangan = (req.body.keterangan || '').trim() || null;
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  const diskonPersen = Math.max(0, Number(req.body.diskon_persen) || 0);
  const pajakPersen = Math.max(0, Number(req.body.pajak_persen) || 0);

  if (!noSo) throw new ApiError(400, 'Nomor SO wajib diisi');
  if (items.length === 0) throw new ApiError(400, 'Minimal 1 detail produk pesanan dalam SO');

  if (customerId) {
    const customer = await customerModel.findById(customerId, userTenantId);
    if (!customer) throw new ApiError(404, 'Customer tidak ditemukan');
  }

  const existing = await soModel.findByNoSo(userTenantId, noSo);
  if (existing) throw new ApiError(409, `Nomor SO "${noSo}" sudah ada`);

  const validatedItems = [];
  let calculatedSubtotal = 0;

  for (const item of items) {
    const kodeProduk = (item.kode_produk || '').trim();
    const qtyPesanan = Number(item.qty_pesanan);
    if (!kodeProduk || !Number.isInteger(qtyPesanan) || qtyPesanan <= 0) {
      throw new ApiError(400, `Item produk ${kodeProduk} atau Qty Pesanan ${qtyPesanan} tidak valid`);
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
    const qtyOrder = item.qty_order != null ? Number(item.qty_order) : (qtyPesanan / rasio);

    const hargaSatuan =
      item.harga_satuan !== undefined && item.harga_satuan !== ''
        ? Math.max(0, Number(item.harga_satuan))
        : Math.max(0, Number(product.harga || 0));

    const lineQty = item.qty_order != null ? Number(item.qty_order) : qtyPesanan;
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
      qtyPesanan,
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
    const soId = await soModel.create(
      {
        tenantId: userTenantId,
        noSo,
        customerId,
        tanggalSo,
        terminHari,
        jatuhTempo,
        status: 'OPEN',
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
      await soModel.createDetail(
        {
          tenantId: userTenantId,
          soId,
          kodeProduk: item.kodeProduk,
          qtyPesanan: item.qtyPesanan,
          hargaSatuan: item.hargaSatuan,
          diskon: item.diskon,
          diskonPersen: item.diskonPersen,
          subtotal: item.subtotal,
          qtyTerkirim: 0,
          satuanOrder: item.satuanOrder,
          qtyOrder: item.qtyOrder,
          rasioPcs: item.rasioPcs,
        },
        conn
      );
    }

    await conn.commit();
    const data = await soModel.findById(userTenantId, soId);
    const details = await soModel.findDetailsBySoId(soId);
    res.status(201).json({
      success: true,
      message: 'Sales Order berhasil dibuat (Status: Belum Difakturkan)',
      data: { ...data, details },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

/**
 * Service untuk Menerbitkan Faktur Penjualan (Accounts Receivable & Jurnal Pendapatan)
 * Dapat dipanggil:
 * 1. Saat DO terkirim (SHIPPED / DELIVERED)
 * 2. Melalui aksi manual staf (Tombol Terbitkan Faktur)
 */
const generateInvoiceForSO = async (soId, tenantId, userId = null, conn = null) => {
  const connection = conn || (await pool.getConnection());
  const shouldManageTransaction = !conn;

  if (shouldManageTransaction) {
    await connection.beginTransaction();
  }

  try {
    const so = await soModel.findById(tenantId, soId, connection);
    if (!so) throw new ApiError(404, 'Sales Order tidak ditemukan');

    // Cek apakah sudah pernah difakturkan
    const existingAr = await receivableModel.findBySoId(soId, connection);
    if (existingAr) {
      if (shouldManageTransaction) await connection.commit();
      return {
        alreadyInvoiced: true,
        arId: existingAr.id,
        noTagihan: existingAr.no_tagihan,
        message: `Faktur Penjualan untuk SO ${so.no_so} sudah pernah terbit (${existingAr.no_tagihan})`,
      };
    }

    const noTagihan = `INV-${so.no_so}`;
    const tanggalInvoice = new Date().toISOString().split('T')[0];
    const jatuhTempo = so.jatuh_tempo || calculateDueDate(tanggalInvoice, so.termin_hari || 30);
    const totalHarga = Number(so.total_harga || 0);
    const subtotal = Number(so.subtotal || 0);
    const diskonNominal = Number(so.diskon_nominal || 0);
    const dpp = Math.max(0, subtotal - diskonNominal);
    const pajakNominal = Number(so.pajak_nominal || 0);

    // 1. Simpan Faktur Piutang ke accounts_receivable
    const arId = await receivableModel.create(
      {
        tenantId,
        noTagihan,
        soId: so.id,
        customerId: so.customer_id,
        tanggal: tanggalInvoice,
        jatuhTempo,
        totalTagihan: totalHarga,
        keterangan: `Faktur Penjualan resmi dari SO ${so.no_so}`,
      },
      connection
    );

    // 2. Terbitkan Jurnal Akuntansi ERP (Debit: Piutang Dagang 1-1010, Kredit: Pendapatan Penjualan 4-1001, Kredit: PPN Keluaran 2-1002)
    if (totalHarga > 0) {
      const accAr = await accountingModel.getAccountIdByKode('1-1010', connection);
      const accSales = await accountingModel.getAccountIdByKode('4-1001', connection);
      const accPpnOut = await accountingModel.getAccountIdByKode('2-1002', connection);

      if (accAr && accSales) {
        const journalLines = [
          { accountId: accAr.id, debit: totalHarga, credit: 0, keterangan: `Piutang Dagang ${so.no_so}` },
          { accountId: accSales.id, debit: 0, credit: dpp, keterangan: `Pendapatan Penjualan ${so.no_so}` },
        ];
        if (pajakNominal > 0 && accPpnOut) {
          journalLines.push({
            accountId: accPpnOut.id,
            debit: 0,
            credit: pajakNominal,
            keterangan: `PPN Keluaran SO ${so.no_so}`,
          });
        }

        await accountingModel.postJournal(
          {
            tenantId,
            tanggal: tanggalInvoice,
            tipeReferensi: 'SO',
            referensiId: so.id,
            noReferensi: noTagihan,
            keterangan: `Faktur Penjualan ${noTagihan} (SO ${so.no_so})`,
            createdBy: userId,
            lines: journalLines,
          },
          connection
        );
      }
    }

    if (shouldManageTransaction) {
      await connection.commit();
    }

    return {
      alreadyInvoiced: false,
      arId,
      noTagihan,
      message: `Faktur Penjualan ${noTagihan} & Jurnal Piutang berhasil diterbitkan`,
    };
  } catch (err) {
    if (shouldManageTransaction) {
      await connection.rollback();
    }
    throw err;
  } finally {
    if (shouldManageTransaction) {
      connection.release();
    }
  }
};

// POST /api/sales-orders/:id/invoice -> Terbitkan Faktur & Piutang secara manual
const createInvoice = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const id = Number(req.params.id);
  const userId = req.user ? req.user.id : null;

  const result = await generateInvoiceForSO(id, userTenantId, userId);
  const data = await soModel.findById(userTenantId, id);
  const details = await soModel.findDetailsBySoId(id);

  res.status(200).json({
    success: true,
    message: result.message,
    data: { ...data, details, ar_id: result.arId, no_tagihan: result.noTagihan },
  });
});

const updateStatus = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const status = (req.body.status || '').trim().toUpperCase();
  const validStatuses = ['OPEN', 'PROCESSING', 'CLOSED', 'CANCELLED'];

  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Status tidak valid. Pilihan: ${validStatuses.join(', ')}`);
  }

  const so = await soModel.findById(tenantId, id);
  if (!so) throw new ApiError(404, 'Sales Order tidak ditemukan');

  await soModel.updateStatus(id, status);
  const data = await soModel.findById(tenantId, id);
  res.json({ success: true, message: `Status SO diubah menjadi ${status}`, data });
});

const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const so = await soModel.findById(tenantId, id);
  if (!so) throw new ApiError(404, 'Sales Order tidak ditemukan');

  await deleteSalesOrderCascade(id, tenantId);
  res.json({
    success: true,
    message: `Sales Order "${so.no_so}" beserta seluruh Delivery Order, mutasi barang keluar, dan kartu stok terkait berhasil dihapus.`
  });
});

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  remove,
  createInvoice,
  generateInvoiceForSO,
};
