const pool = require('../config/db');
const payableModel = require('../models/payableModel');
const supplierModel = require('../models/supplierModel');
const poModel = require('../models/poModel');
const accountingModel = require('../models/accountingModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const generatePaymentNo = (prefix = 'PAY-AP') => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}/${ymd}/${rand}`;
};

const generateApNo = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AP/${ymd}/${rand}`;
};

const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { status, supplier_id, search, date_from, date_to } = req.query;
  const data = await payableModel.findAll({
    tenantId,
    status,
    supplierId: supplier_id,
    search,
    dateFrom: date_from,
    dateTo: date_to,
  });
  res.json({ success: true, data });
});

const getSummary = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await payableModel.getSummary(tenantId);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const payable = await payableModel.findById(tenantId, id);
  if (!payable) throw new ApiError(404, 'Data utang tidak ditemukan');
  const payments = await payableModel.findPaymentsByPayableId(id);
  let items = [];
  if (payable.po_id) {
    try {
      items = await poModel.findDetailsByPoId(payable.po_id);
    } catch (_) {}
  }
  res.json({ success: true, data: { ...payable, payments, items } });
});

const create = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const supplierId = req.body.supplier_id ? Number(req.body.supplier_id) : null;
  const noTagihan = (req.body.no_tagihan || generateApNo()).trim();
  const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
  const jatuhTempo = req.body.jatuh_tempo;
  const totalTagihan = Number(req.body.total_tagihan);
  const keterangan = (req.body.keterangan || '').trim() || null;

  if (!noTagihan) throw new ApiError(400, 'Nomor tagihan / faktur utang wajib diisi');
  if (!jatuhTempo) throw new ApiError(400, 'Tanggal jatuh tempo wajib diisi');
  if (!Number.isFinite(totalTagihan) || totalTagihan < 0) {
    throw new ApiError(400, 'Total tagihan harus berupa angka >= 0');
  }

  if (supplierId) {
    const supplier = await supplierModel.findById(supplierId, userTenantId);
    if (!supplier) throw new ApiError(404, 'Supplier tidak ditemukan');
  }

  const id = await payableModel.create({
    tenantId: userTenantId,
    noTagihan,
    poId: null,
    supplierId,
    tanggal,
    jatuhTempo,
    totalTagihan,
    keterangan,
  });

  const data = await payableModel.findById(userTenantId, id);
  res.status(201).json({ success: true, message: 'Data utang berhasil dicatat', data });
});

const addPayment = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const payable = await payableModel.findById(tenantId, id);
  if (!payable) throw new ApiError(404, 'Data utang tidak ditemukan');

  if (payable.status === 'LUNAS' || Number(payable.sisa_utang) <= 0) {
    throw new ApiError(400, 'Tagihan utang ini sudah lunas');
  }

  const jumlahBayar = Number(req.body.jumlah_bayar);
  if (!Number.isFinite(jumlahBayar) || jumlahBayar <= 0) {
    throw new ApiError(400, 'Jumlah bayar harus berupa angka lebih dari 0');
  }

  const sisaUtang = Number(payable.sisa_utang);
  if (jumlahBayar > sisaUtang + 0.01) {
    throw new ApiError(
      400,
      `Jumlah bayar (Rp ${jumlahBayar.toLocaleString('id-ID')}) melebihi sisa utang (Rp ${sisaUtang.toLocaleString('id-ID')})`
    );
  }

  const tanggalBayar = req.body.tanggal_bayar || new Date().toISOString().split('T')[0];
  const metodePembayaran = (req.body.metode_pembayaran || 'Transfer Bank').trim();
  const referensiBayar = (req.body.referensi_bayar || '').trim() || null;
  const catatan = (req.body.catatan || '').trim() || null;
  const noPembayaran = (req.body.no_pembayaran || generatePaymentNo()).trim();

  const paymentId = await payableModel.createPayment({
    tenantId: userTenantId,
    payableId: id,
    noPembayaran,
    tanggalBayar,
    jumlahBayar,
    metodePembayaran,
    referensiBayar,
    catatan,
  });

  try {
    const accAp = await accountingModel.getAccountIdByKode('2-1001');
    const kasAccountKode = metodePembayaran === 'Kas Tunai' ? '1-1001' : '1-1002';
    const accKas = await accountingModel.getAccountIdByKode(kasAccountKode);

    if (accAp && accKas) {
      await accountingModel.postJournal({
        tenantId: userTenantId,
        tanggal: tanggalBayar,
        tipeReferensi: 'AP_PAYMENT',
        referensiId: paymentId,
        noReferensi: noPembayaran,
        keterangan: `Bayar Utang: ${payable.no_tagihan} (${noPembayaran})`,
        createdBy: req.user ? req.user.id : null,
        lines: [
          { accountId: accAp.id, debit: jumlahBayar, credit: 0, keterangan: `Pelunasan Utang ${payable.no_tagihan}` },
          { accountId: accKas.id, debit: 0, credit: jumlahBayar, keterangan: `Pembayaran ${noPembayaran} (${metodePembayaran})` },
        ],
      });
    }
  } catch (jErr) {
    console.error('Accounting journal error (AP payment):', jErr);
  }

  const updatedPayable = await payableModel.findById(tenantId, id);
  const payments = await payableModel.findPaymentsByPayableId(id);

  res.status(201).json({
    success: true,
    message: `Pembayaran ${noPembayaran} berhasil dicatat. Status: ${updatedPayable.status}`,
    data: { ...updatedPayable, payments },
  });
});

const deletePayment = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const paymentId = Number(req.params.paymentId);
  const deleted = await payableModel.removePayment(paymentId);
  if (!deleted) throw new ApiError(404, 'Data pembayaran tidak ditemukan');

  await pool.query('DELETE FROM journal_entries WHERE tipe_referensi = "AP_PAYMENT" AND referensi_id = ?', [paymentId]);

  const updatedPayable = await payableModel.findById(tenantId, deleted.payable_id);
  res.json({
    success: true,
    message: 'Data pembayaran berhasil dibatalkan',
    data: updatedPayable,
  });
});

const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const payable = await payableModel.findById(tenantId, id);
  if (!payable) throw new ApiError(404, 'Data utang tidak ditemukan');

  const payments = await payableModel.findPaymentsByPayableId(id);
  if (payments.length > 0) {
    throw new ApiError(
      400,
      'Tidak dapat menghapus utang yang sudah memiliki riwayat pembayaran. Hapus riwayat pembayaran terlebih dahulu.'
    );
  }

  await payableModel.remove(id);
  res.json({ success: true, message: 'Data utang berhasil dihapus' });
});

module.exports = {
  getAll,
  getSummary,
  getById,
  create,
  addPayment,
  deletePayment,
  remove,
};
