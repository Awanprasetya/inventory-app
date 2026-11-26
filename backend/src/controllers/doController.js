const pool = require('../config/db');
const doModel = require('../models/doModel');
const soModel = require('../models/soModel');
const customerModel = require('../models/customerModel');
const productModel = require('../models/productModel');
const transactionModel = require('../models/transactionModel');
const accountingModel = require('../models/accountingModel');
const { generateInvoiceForSO } = require('./soController');
const { deleteDeliveryOrderCascade } = require('../utils/cascadeDeleteHelper');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');

const generateNoDo = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DO/${yyyy}/${mm}/${rand}`;
};

const generateKodeOut = () => {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OUT-${ymd}-${rand}`;
};

/**
 * Memproses pemotongan stok fisik gudang, mutasi stok, transaksi pengeluaran (OUT),
 * dan pembukuan jurnal HPP (Beban Pokok Pendapatan) untuk Delivery Order.
 *
 * IDEMPOTEN: Jika DO sudah pernah dipotong stok fisiknya (sudah ada transaksi OUT),
 * fungsi ini tidak akan memotong stok berulang kali.
 */
const processDoShipment = async (doId, tenantId, userId, conn = null) => {
  const shouldManageTransaction = !conn;
  const connection = conn || (await pool.getConnection());
  if (shouldManageTransaction) {
    await connection.beginTransaction();
  }

  try {
    const doData = await doModel.findById(tenantId, doId, connection);
    if (!doData) {
      throw new ApiError(404, 'Delivery Order tidak ditemukan');
    }

    // 1. Cek Idempotensi: Apakah DO sudah pernah dipotong stok fisiknya?
    const [existingTrx] = await connection.query(
      'SELECT id, kode_transaksi FROM transactions WHERE delivery_order_id = ? AND tipe_transaksi = "KELUAR" LIMIT 1',
      [doId]
    );

    if (existingTrx && existingTrx.length > 0) {
      if (shouldManageTransaction) {
        await connection.commit();
      }
      return {
        alreadyProcessed: true,
        transactionId: existingTrx[0].id,
        kodeTransaksi: existingTrx[0].kode_transaksi,
        message: `Stok fisik DO ${doData.no_do} sudah pernah dipotong (${existingTrx[0].kode_transaksi})`,
      };
    }

    // 2. Ambil detail lot pengiriman DO
    const doDetails = await doModel.findDetailsByDoId(doId, connection);
    if (!doDetails || doDetails.length === 0) {
      throw new ApiError(400, `DO "${doData.no_do}" tidak memiliki item lot untuk dikirim`);
    }

    // 3. Validasi & Lock semua lot untuk memastikan stok cukup dan tidak kedaluwarsa/quarantine
    const today = new Date().toISOString().split('T')[0];
    const lockedLots = [];

    for (const dod of doDetails) {
      const nomorLot = (dod.nomor_lot || '').trim();
      const qtyKirim = Number(dod.qty_kirim);

      if (!nomorLot || qtyKirim <= 0) {
        throw new ApiError(400, `Item DO dengan lot "${nomorLot}" memiliki qty kirim tidak valid (${qtyKirim})`);
      }

      const lot = await productModel.lockLot(nomorLot, connection);
      if (!lot) {
        throw new ApiError(404, `Lot "${nomorLot}" tidak ditemukan di database gudang`);
      }

      if (['QUARANTINE', 'HOLD', 'EXPIRED'].includes(lot.status)) {
        throw new ApiError(
          400,
          `Lot "${nomorLot}" berstatus ${lot.status} dan dilarang untuk dikirim!`
        );
      }

      if (lot.expired_date && lot.expired_date <= today) {
        throw new ApiError(
          400,
          `Lot "${nomorLot}" telah KEDALUWARSA (${lot.expired_date}) dan dilarang untuk dikirim!`
        );
      }

      if (Number(lot.stok_qty) < qtyKirim) {
        throw new ApiError(
          400,
          `Stok fisik gudang untuk lot "${nomorLot}" tidak cukup (tersisa ${lot.stok_qty}, diminta kirim ${qtyKirim})`
        );
      }

      lockedLots.push({ dod, lot, qtyKirim });
    }

    // 4. Buat Transaksi Keluar (OUT) di master transactions
    const primaryWarehouseId = lockedLots[0].lot.warehouse_id || 1;
    const kodeTransaksi = generateKodeOut();
    const transactionId = await transactionModel.create(
      {
        tenantId,
        kodeTransaksi,
        tipeTransaksi: 'KELUAR',
        referensi: doData.no_do,
        keterangan: `Pengiriman DO ${doData.no_do}${doData.no_so ? ` (SO: ${doData.no_so})` : ''}`,
        userId,
        warehouseId: primaryWarehouseId,
        purchaseOrderId: null,
        deliveryOrderId: doId,
      },
      connection
    );

    // 5. Potong stok fisik lot, buat detail transaksi, dan catat mutasi stok
    let totalHpp = 0;
    for (const { dod, lot, qtyKirim } of lockedLots) {
      const affected = await productModel.decreaseStock(dod.nomor_lot, qtyKirim, connection);
      if (affected === 0) {
        throw new ApiError(400, `Stok lot "${dod.nomor_lot}" berubah sebelum pemrosesan selesai, silakan ulangi transaksi`);
      }

      const sisaStok = Number(lot.stok_qty) - qtyKirim;

      // Catat detail transaksi
      await transactionModel.createDetail(
        {
          tenantId,
          transactionId,
          nomorLot: dod.nomor_lot,
          qty: qtyKirim,
        },
        connection
      );

      // Catat mutasi stok
      await transactionModel.insertMutation(
        {
          tenantId,
          kodeProduk: lot.kode_produk,
          nomorLot: dod.nomor_lot,
          warehouseId: lot.warehouse_id || primaryWarehouseId,
          tipe: 'KELUAR',
          qtyPerubahan: qtyKirim,
          qtySisa: sisaStok,
          referensi: doData.no_do,
        },
        connection
      );

      // Hitung HPP
      const prod = await productModel.findByKode(tenantId, lot.kode_produk, connection);
      const hargaBeli = prod ? Number(prod.harga_beli || prod.harga || 0) : 0;
      totalHpp += qtyKirim * hargaBeli;
    }

    // 6. Integrasi Akuntansi: Jurnal HPP (Beban Pokok Pendapatan vs Persediaan Barang Dagang)
    if (totalHpp > 0) {
      const accCogs = await accountingModel.getAccountIdByKode('5-1001', connection, tenantId); // Beban Pokok Pendapatan (HPP)
      const accInv = await accountingModel.getAccountIdByKode('1-1020', connection, tenantId);  // Persediaan Barang Dagang
      if (accCogs && accInv) {
        await accountingModel.postJournal(
          {
            tenantId,
            tanggal: doData.tanggal_do || new Date().toISOString().split('T')[0],
            tipeReferensi: 'OUTBOUND',
            referensiId: transactionId,
            noReferensi: doData.no_do,
            keterangan: `HPP Pengiriman DO ${doData.no_do} (${kodeTransaksi})`,
            createdBy: userId,
            lines: [
              { accountId: accCogs.id, debit: totalHpp, credit: 0, keterangan: `HPP DO ${doData.no_do}` },
              { accountId: accInv.id, debit: 0, credit: totalHpp, keterangan: `Pengurangan Persediaan DO ${doData.no_do}` },
            ],
          },
          connection
        );
      }
    }

    // 7. Update progress pemenuhan SO jika DO ini berelasi ke Sales Order
    if (doData.so_id) {
      const soDetails = await soModel.findDetailsBySoId(doData.so_id);
      for (const { dod, lot, qtyKirim } of lockedLots) {
        const matchingSoDetail = soDetails.find((sod) => sod.kode_produk === lot.kode_produk);
        if (matchingSoDetail) {
          await soModel.updateDetailQtyTerkirim(matchingSoDetail.id, qtyKirim, connection);
        }
      }

      const updatedSoDetails = await soModel.findDetailsBySoId(doData.so_id);
      const allFulfilled = updatedSoDetails.every((d) => d.qty_terkirim >= d.qty_pesanan);
      await soModel.updateStatus(doData.so_id, allFulfilled ? 'CLOSED' : 'PROCESSING', connection);

      // Terbitkan Faktur Penjualan & Piutang otomatis
      await generateInvoiceForSO(doData.so_id, tenantId, userId, connection);
    }

    if (shouldManageTransaction) {
      await connection.commit();
    }

    return {
      alreadyProcessed: false,
      transactionId,
      kodeTransaksi,
      totalHpp,
      message: `Stok fisik (${doDetails.length} lot) & Jurnal HPP (Rp ${totalHpp.toLocaleString('id-ID')}) berhasil dipotong (${kodeTransaksi})`,
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

const getAll = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const status = req.query.status || null;
  const search = req.query.search || '';
  const data = await doModel.findAll(tenantId, status, search);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const doData = await doModel.findById(tenantId, id);
  if (!doData) throw new ApiError(404, 'Delivery Order tidak ditemukan');
  const details = await doModel.findDetailsByDoId(id);
  res.json({ success: true, data: { ...doData, details } });
});

const create = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const soId = req.body.so_id ? Number(req.body.so_id) : null;
  let customerId = req.body.customer_id ? Number(req.body.customer_id) : null;
  const noDo = (req.body.no_do || generateNoDo()).trim();
  const tanggalDo = req.body.tanggal_do || new Date().toISOString().split('T')[0];
  const status = (req.body.status || 'DRAFT').toUpperCase();
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  if (!noDo) throw new ApiError(400, 'Nomor DO wajib diisi');
  if (items.length === 0) throw new ApiError(400, 'Minimal 1 lot pengiriman dalam DO');

  if (soId) {
    const so = await soModel.findById(userTenantId, soId);
    if (!so) throw new ApiError(404, 'Sales Order tidak ditemukan');
    if (!customerId && so.customer_id) customerId = so.customer_id;
  }

  if (customerId) {
    const customer = await customerModel.findById(customerId, userTenantId);
    if (!customer) throw new ApiError(404, 'Customer tidak ditemukan');
  }

  const existing = await doModel.findByNoDo(userTenantId, noDo);
  if (existing) throw new ApiError(409, `Nomor DO "${noDo}" sudah ada`);

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const doId = await doModel.create(
      { tenantId: userTenantId, noDo, soId, customerId, tanggalDo, status },
      conn
    );

    for (const item of items) {
      const nomorLot = (item.nomor_lot || '').trim();
      const qtyKirim = Number(item.qty_kirim);
      if (!nomorLot || !Number.isInteger(qtyKirim) || qtyKirim <= 0) {
        throw new ApiError(400, `Nomor Lot ${nomorLot} atau Qty Kirim ${qtyKirim} tidak valid`);
      }
      const lot = await productModel.findLotByNomor(userTenantId, nomorLot);
      if (!lot) throw new ApiError(404, `Lot "${nomorLot}" tidak ditemukan`);

      const qtyOrder = item.qty_order !== undefined && item.qty_order !== null && item.qty_order !== '' ? Number(item.qty_order) : null;
      const satuanOrder = item.satuan_order || null;
      const rasioPcs = item.rasio_pcs ? Number(item.rasio_pcs) : 1.00;

      await doModel.createDetail({
        tenantId: userTenantId,
        doId,
        nomorLot,
        qtyKirim,
        qtyOrder,
        satuanOrder,
        rasioPcs
      }, conn);
    }

    // Jika DO langsung dibuat dengan status SHIPPED atau DELIVERED, potong stok & HPP
    let shipmentInfo = null;
    if (status === 'SHIPPED' || status === 'DELIVERED') {
      shipmentInfo = await processDoShipment(doId, userTenantId, req.user ? req.user.id : null, conn);
    }

    await conn.commit();
    const data = await doModel.findById(userTenantId, doId);
    const details = await doModel.findDetailsByDoId(doId);
    res.status(201).json({
      success: true,
      message: `Delivery Order berhasil dibuat${shipmentInfo && !shipmentInfo.alreadyProcessed ? ` & ${shipmentInfo.message}` : ''}`,
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
  const validStatuses = ['DRAFT', 'SHIPPED', 'DELIVERED'];

  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Status tidak valid. Pilihan: ${validStatuses.join(', ')}`);
  }

  const doData = await doModel.findById(tenantId, id);
  if (!doData) throw new ApiError(404, 'Delivery Order tidak ditemukan');

  const oldStatus = doData.status;

  // Cegah perubahan status dari SHIPPED/DELIVERED kembali ke DRAFT
  if ((oldStatus === 'SHIPPED' || oldStatus === 'DELIVERED') && status === 'DRAFT') {
    throw new ApiError(
      400,
      'Delivery Order yang sudah dikirim (SHIPPED/DELIVERED) tidak dapat dikembalikan ke status DRAFT karena stok fisik gudang telah dipotong dan jurnal HPP telah dibukukan. Gunakan fitur Retur Penjualan jika terjadi pembatalan.'
    );
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    await doModel.updateStatus(id, status, conn);

    let shipmentInfo = null;
    if (status === 'SHIPPED' || status === 'DELIVERED') {
      shipmentInfo = await processDoShipment(id, tenantId, req.user ? req.user.id : null, conn);
    }

    await conn.commit();
    const data = await doModel.findById(tenantId, id);
    const details = await doModel.findDetailsByDoId(id);
    res.json({
      success: true,
      message: `Status DO diubah menjadi ${status}${shipmentInfo && !shipmentInfo.alreadyProcessed ? ` & ${shipmentInfo.message}` : ''}`,
      data: { ...data, details },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// POST /api/delivery-orders/:id/ship -> Khusus untuk pengiriman 1-klik (potong stok fisik & HPP)
const shipOrder = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const doData = await doModel.findById(tenantId, id);
  if (!doData) throw new ApiError(404, 'Delivery Order tidak ditemukan');

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    await doModel.updateStatus(id, 'SHIPPED', conn);
    const shipmentResult = await processDoShipment(id, tenantId, req.user ? req.user.id : null, conn);

    await conn.commit();
    const data = await doModel.findById(tenantId, id);
    const details = await doModel.findDetailsByDoId(id);
    res.json({
      success: true,
      message: `Delivery Order berhasil dikirim & ${shipmentResult.message}`,
      data: { ...data, details },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

const remove = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const doData = await doModel.findById(tenantId, id);
  if (!doData) throw new ApiError(404, 'Delivery Order tidak ditemukan');

  await deleteDeliveryOrderCascade(id, tenantId);
  res.json({
    success: true,
    message: `Delivery Order "${doData.no_do}" berhasil dihapus, stok fisik lot dikembalikan, dan mutasi barang keluar serta kartu stok telah disesuaikan.`
  });
});

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  shipOrder,
  remove,
  processDoShipment,
};
