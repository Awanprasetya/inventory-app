const pool = require('../config/db');
const receivableModel = require('../models/receivableModel');
const customerModel = require('../models/customerModel');
const soModel = require('../models/soModel');
const accountingModel = require('../models/accountingModel');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const generatePaymentNo = (prefix = 'PAY-AR') => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}/${ymd}/${rand}`;
};

const generateArNo = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AR/${ymd}/${rand}`;
};

const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { status, customer_id, search, date_from, date_to } = req.query;
  const data = await receivableModel.findAll({
    tenantId,
    status,
    customerId: customer_id,
    search,
    dateFrom: date_from,
    dateTo: date_to,
  });
  res.json({ success: true, data });
});

const getSummary = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const data = await receivableModel.getSummary(tenantId);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const receivable = await receivableModel.findById(tenantId, id);
  if (!receivable) throw new ApiError(404, 'Data piutang tidak ditemukan');
  const payments = await receivableModel.findPaymentsByReceivableId(id);
  let items = [];
  if (receivable.so_id) {
    try {
      items = await soModel.findDetailsBySoId(receivable.so_id);
    } catch (_) {}
  }
  res.json({ success: true, data: { ...receivable, payments, items } });
});

const create = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const customerId = req.body.customer_id ? Number(req.body.customer_id) : null;
  const noTagihan = (req.body.no_tagihan || generateArNo()).trim();
  const tanggal = req.body.tanggal || new Date().toISOString().split('T')[0];
  const jatuhTempo = req.body.jatuh_tempo;
  const totalTagihan = Number(req.body.total_tagihan);
  const keterangan = (req.body.keterangan || '').trim() || null;

  if (!noTagihan) throw new ApiError(400, 'Nomor invoice / faktur piutang wajib diisi');
  if (!jatuhTempo) throw new ApiError(400, 'Tanggal jatuh tempo wajib diisi');
  if (!Number.isFinite(totalTagihan) || totalTagihan < 0) {
    throw new ApiError(400, 'Total tagihan harus berupa angka >= 0');
  }

  if (customerId) {
    const customer = await customerModel.findById(customerId, userTenantId);
    if (!customer) throw new ApiError(404, 'Customer tidak ditemukan');
  }

  const id = await receivableModel.create({
    tenantId: userTenantId,
    noTagihan,
    soId: null,
    customerId,
    tanggal,
    jatuhTempo,
    totalTagihan,
    keterangan,
  });

  const data = await receivableModel.findById(userTenantId, id);
  res.status(201).json({ success: true, message: 'Data piutang berhasil dicatat', data });
});

const addPayment = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const receivable = await receivableModel.findById(tenantId, id);
  if (!receivable) throw new ApiError(404, 'Data piutang tidak ditemukan');

  if (receivable.status === 'LUNAS' || Number(receivable.sisa_piutang) <= 0) {
    throw new ApiError(400, 'Tagihan piutang ini sudah lunas');
  }

  const jumlahBayar = Number(req.body.jumlah_bayar);
  if (!Number.isFinite(jumlahBayar) || jumlahBayar <= 0) {
    throw new ApiError(400, 'Jumlah bayar harus berupa angka lebih dari 0');
  }

  const sisaPiutang = Number(receivable.sisa_piutang);
  if (jumlahBayar > sisaPiutang + 0.01) {
    throw new ApiError(
      400,
      `Jumlah bayar (Rp ${jumlahBayar.toLocaleString('id-ID')}) melebihi sisa piutang (Rp ${sisaPiutang.toLocaleString('id-ID')})`
    );
  }

  const tanggalBayar = req.body.tanggal_bayar || new Date().toISOString().split('T')[0];
  const metodePembayaran = (req.body.metode_pembayaran || 'Transfer Bank').trim();
  const referensiBayar = (req.body.referensi_bayar || '').trim() || null;
  const catatan = (req.body.catatan || '').trim() || null;
  const noPembayaran = (req.body.no_pembayaran || generatePaymentNo()).trim();

  const paymentId = await receivableModel.createPayment({
    tenantId: userTenantId,
    receivableId: id,
    noPembayaran,
    tanggalBayar,
    jumlahBayar,
    metodePembayaran,
    referensiBayar,
    catatan,
  });

  try {
    const accAr = await accountingModel.getAccountIdByKode('1-1010');
    const kasAccountKode = metodePembayaran === 'Kas Tunai' ? '1-1001' : '1-1002';
    const accKas = await accountingModel.getAccountIdByKode(kasAccountKode);

    if (accAr && accKas) {
      await accountingModel.postJournal({
        tenantId: userTenantId,
        tanggal: tanggalBayar,
        tipeReferensi: 'AR_PAYMENT',
        referensiId: paymentId,
        noReferensi: noPembayaran,
        keterangan: `Terima Bayar: ${receivable.no_tagihan} (${noPembayaran})`,
        createdBy: req.user ? req.user.id : null,
        lines: [
          { accountId: accKas.id, debit: jumlahBayar, credit: 0, keterangan: `Penerimaan ${noPembayaran} (${metodePembayaran})` },
          { accountId: accAr.id, debit: 0, credit: jumlahBayar, keterangan: `Pelunasan Piutang ${receivable.no_tagihan}` },
        ],
      });
    }
  } catch (jErr) {
    console.error('Accounting journal error (AR payment):', jErr);
  }

  const updatedReceivable = await receivableModel.findById(tenantId, id);
  const payments = await receivableModel.findPaymentsByReceivableId(id);

  res.status(201).json({
    success: true,
    message: `Penerimaan pembayaran ${noPembayaran} berhasil dicatat. Status: ${updatedReceivable.status}`,
    data: { ...updatedReceivable, payments },
  });
});

const deletePayment = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const paymentId = Number(req.params.paymentId);
  const deleted = await receivableModel.removePayment(paymentId);
  if (!deleted) throw new ApiError(404, 'Data pembayaran tidak ditemukan');

  await pool.query('DELETE FROM journal_entries WHERE tipe_referensi = "AR_PAYMENT" AND referensi_id = ?', [paymentId]);

  const updatedReceivable = await receivableModel.findById(tenantId, deleted.receivable_id);
  res.json({
    success: true,
    message: 'Data pembayaran piutang berhasil dibatalkan',
    data: updatedReceivable,
  });
});

const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const receivable = await receivableModel.findById(tenantId, id);
  if (!receivable) throw new ApiError(404, 'Data piutang tidak ditemukan');

  const payments = await receivableModel.findPaymentsByReceivableId(id);
  if (payments.length > 0) {
    throw new ApiError(
      400,
      'Tidak dapat menghapus piutang yang sudah memiliki riwayat pembayaran. Hapus riwayat pembayaran terlebih dahulu.'
    );
  }

  await receivableModel.remove(id);
  res.json({ success: true, message: 'Data piutang berhasil dihapus' });
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
