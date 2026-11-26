const pool = require('../config/db');
const productModel = require('../models/productModel');
const transactionModel = require('../models/transactionModel');
const poModel = require('../models/poModel');
const soModel = require('../models/soModel');
const doModel = require('../models/doModel');
const accountingModel = require('../models/accountingModel');
const payableModel = require('../models/payableModel');
const { generateInvoiceForSO } = require('./soController');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { getTenantId, getTargetTenantId } = require('../utils/tenantHelper');
const { normalizeRole } = require('../middleware/rbac');

// Helper: ambil pembatasan gudang jika user adalah ADMIN_GUDANG dengan gudang tugas spesifik
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

// Kode transaksi unik, contoh: IN-20261006-A1B2
const generateKode = (prefix) => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
};

const toPositiveInt = (value, field) => {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ApiError(400, `${field} harus berupa bilangan bulat lebih dari 0`);
  }
  return num;
};

// Jalankan callback di dalam transaksi database (BEGIN/COMMIT/ROLLBACK)
const withTransaction = async (callback) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* abaikan error rollback */
    }
    throw err;
  } finally {
    conn.release();
  }
};

// POST /api/transactions/inbound -> barang MASUK
const createInbound = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const {
    kode_produk,
    nomor_lot,
    tanggal_produksi,
    expired_date,
    shift,
    referensi,
    keterangan,
    purchase_order_id,
    warehouse_id,
    status = 'AVAILABLE',
  } = req.body;
  const kodeProduk = (kode_produk || '').trim();
  const nomorLot = (nomor_lot || '').trim();
  const purchaseOrderId = purchase_order_id ? Number(purchase_order_id) : null;
  const restrictedWh = getRestrictedWarehouse(req);
  if (restrictedWh && warehouse_id && Number(warehouse_id) !== restrictedWh.id) {
    throw new ApiError(
      403,
      `Akses ditolak: Anda hanya diperbolehkan menginput Barang Masuk untuk gudang tugas Anda (${restrictedWh.nama}).`
    );
  }
  const warehouseId = restrictedWh ? restrictedWh.id : (warehouse_id ? Number(warehouse_id) : 1);

  if (!kodeProduk) throw new ApiError(400, 'Kode produk wajib diisi (scan barcode / pilih produk)');
  if (!nomorLot) throw new ApiError(400, 'Nomor lot wajib diisi');
  if (nomorLot.length > 100) throw new ApiError(400, 'Nomor lot maksimal 100 karakter');
  const qty = toPositiveInt(req.body.qty, 'Qty');

  const result = await withTransaction(async (conn) => {
    const product = await productModel.findByKode(userTenantId, kodeProduk, conn);
    if (!product) throw new ApiError(404, `Produk "${kodeProduk}" tidak ditemukan`);

    // Validasi Purchase Order jika dipilih
    if (purchaseOrderId) {
      const po = await poModel.findById(userTenantId, purchaseOrderId, conn);
      if (!po) throw new ApiError(404, 'Purchase Order tidak ditemukan');
    }

    const existingLot = await productModel.findLotByNomor(userTenantId, nomorLot, conn, warehouseId);
    let stokBaru;

    if (existingLot) {
      if (existingLot.kode_produk !== kodeProduk) {
        throw new ApiError(
          400,
          `Lot "${nomorLot}" terdaftar untuk produk lain (${existingLot.kode_produk})`
        );
      }
      if (restrictedWh && existingLot.warehouse_id && Number(existingLot.warehouse_id) !== restrictedWh.id) {
        throw new ApiError(
          403,
          `Akses ditolak: Lot "${nomorLot}" terdaftar di gudang lain. Anda hanya dapat memproses stok di ${restrictedWh.nama}.`
        );
      }
      stokBaru = Number(existingLot.stok_qty) + qty;
      await conn.query(
        'UPDATE product_lots SET stok_qty = stok_qty + ?, warehouse_id = COALESCE(?, warehouse_id) WHERE id = ?',
        [qty, warehouseId, existingLot.id]
      );
    } else {
      // Lot baru: wajib isi tanggal produksi & shift
      if (!tanggal_produksi || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal_produksi)) {
        throw new ApiError(400, 'Tanggal produksi wajib diisi (format YYYY-MM-DD) untuk lot baru');
      }
      const shiftNum = Number(shift || 1);
      if (!Number.isInteger(shiftNum) || shiftNum < 1 || shiftNum > 3) {
        throw new ApiError(400, 'Shift harus 1, 2, atau 3');
      }
      stokBaru = qty;
      try {
        await productModel.insertLot(
          {
            tenantId: userTenantId,
            kodeProduk,
            nomorLot,
            tanggalProduksi: tanggal_produksi,
            expiredDate: expired_date || null,
            shift: shiftNum,
            warehouseId,
            stokQty: qty,
            status: status || 'AVAILABLE',
            keterangan: keterangan || null,
          },
          conn
        );
      } catch (errInsert) {
        if (errInsert.code === 'ER_DUP_ENTRY' || errInsert.errno === 1062) {
          // Lot dengan nomor_lot tersebut sudah ada di DB, perbarui stoknya
          await conn.query(
            'UPDATE product_lots SET stok_qty = stok_qty + ? WHERE (tenant_id = ? OR tenant_id IS NULL) AND nomor_lot = ?',
            [qty, userTenantId, nomorLot]
          );
        } else {
          throw errInsert;
        }
      }
    }

    const kodeTransaksi = generateKode('IN');
    const transactionId = await transactionModel.create(
      {
        tenantId: userTenantId,
        kodeTransaksi,
        tipeTransaksi: 'MASUK',
        referensi: referensi || null,
        keterangan: keterangan || null,
        userId: req.user ? req.user.id : null,
        warehouseId,
        purchaseOrderId,
        deliveryOrderId: null,
      },
      conn
    );
    await transactionModel.createDetail({ tenantId: userTenantId, transactionId, nomorLot, qty }, conn);
    await transactionModel.insertMutation(
      {
        tenantId: userTenantId,
        kodeProduk,
        nomorLot,
        warehouseId,
        tipe: 'MASUK',
        qtyPerubahan: qty,
        qtySisa: stokBaru,
        referensi: referensi || null,
      },
      conn
    );

    // Integrasi PO: update qty_diterima pada detail PO, status PO, & buat tagihan Utang Usaha (AP) saat barang fisik diterima
    if (purchaseOrderId) {
      const po = await poModel.findById(userTenantId, purchaseOrderId, conn);
      const poDetails = await poModel.findDetailsByPoId(purchaseOrderId);
      const matchDetail = poDetails.find((d) => d.kode_produk === kodeProduk);
      if (matchDetail) {
        await poModel.updateDetailQtyDiterima(matchDetail.id, qty, conn);
      }
      const updatedPoDetails = await poModel.findDetailsByPoId(purchaseOrderId);
      const allReceived = updatedPoDetails.every((d) => d.qty_diterima >= d.qty_pesan);
      await poModel.updateStatus(purchaseOrderId, allReceived ? 'COMPLETED' : 'APPROVED', conn);

      // Buat Tagihan Utang Usaha (Accounts Payable) saat barang fisik pertama kali diterima
      if (po && po.total_harga > 0) {
        const apExisting = await payableModel.findByPoId(purchaseOrderId, conn);
        if (!apExisting) {
          await payableModel.create(
            {
              tenantId: userTenantId,
              noTagihan: `AP-${po.no_po}`,
              poId: purchaseOrderId,
              supplierId: po.supplier_id,
              tanggal: new Date().toISOString().split('T')[0],
              jatuhTempo: po.jatuh_tempo || new Date().toISOString().split('T')[0],
              totalTagihan: po.total_harga,
              keterangan: `Faktur Utang otomatis dari penerimaan barang PO ${po.no_po}`,
            },
            conn
          );
        }
      }
    }

    // Integrasi otomatis Jurnal Akuntansi ERP: Penambahan Persediaan Barang Masuk
    const hargaBeli = Number(product.harga_beli || product.harga || 0);
    const totalNilaiMasuk = qty * hargaBeli;
    if (totalNilaiMasuk > 0) {
      const accInv = await accountingModel.getAccountIdByKode('1-1020', conn); // Persediaan
      const accCredit = purchaseOrderId
        ? await accountingModel.getAccountIdByKode('2-1001', conn) // Utang Usaha
        : await accountingModel.getAccountIdByKode('1-1001', conn); // Kas

      if (accInv && accCredit) {
        await accountingModel.postJournal(
          {
            tenantId: userTenantId,
            tanggal: new Date().toISOString().split('T')[0],
            tipeReferensi: 'INBOUND',
            referensiId: transactionId,
            noReferensi: kodeTransaksi,
            keterangan: `Penerimaan Barang Masuk (${kodeTransaksi}) - ${product.nama_produk}`,
            createdBy: req.user ? req.user.id : null,
            lines: [
              { accountId: accInv.id, debit: totalNilaiMasuk, credit: 0, keterangan: `Persediaan Masuk (${kodeTransaksi})` },
              { accountId: accCredit.id, debit: 0, credit: totalNilaiMasuk, keterangan: `Kewajiban Pembelian / Kas (${kodeTransaksi})` },
            ],
          },
          conn
        );
      }
    }

    return {
      kode_transaksi: kodeTransaksi,
      nomor_lot: nomorLot,
      stok_baru: stokBaru,
      lot_baru: !existingLot,
      warehouse_id: warehouseId,
    };
  });

  res.status(201).json({
    success: true,
    message: `Transaksi masuk ${result.kode_transaksi} tersimpan`,
    data: result,
  });
});

// POST /api/transactions/outbound -> barang KELUAR (bisa banyak item)
const createOutbound = asyncHandler(async (req, res) => {
  const userTenantId = getTargetTenantId(req);
  const { items, referensi, keterangan, delivery_order_id, warehouse_id } = req.body;
  const deliveryOrderId = delivery_order_id ? Number(delivery_order_id) : null;
  const restrictedWh = getRestrictedWarehouse(req);
  if (restrictedWh && warehouse_id && Number(warehouse_id) !== restrictedWh.id) {
    throw new ApiError(
      403,
      `Akses ditolak: Anda hanya diperbolehkan menginput Barang Keluar dari gudang tugas Anda (${restrictedWh.nama}).`
    );
  }
  const warehouseId = restrictedWh ? restrictedWh.id : (warehouse_id ? Number(warehouse_id) : 1);

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Minimal satu item barang keluar wajib diisi');
  }

  const merged = new Map();
  for (const item of items) {
    const nomorLot = (item && item.nomor_lot ? String(item.nomor_lot) : '').trim();
    if (!nomorLot) throw new ApiError(400, 'Setiap item wajib memiliki nomor lot');
    const qty = toPositiveInt(item.qty, `Qty lot "${nomorLot}"`);
    merged.set(nomorLot, (merged.get(nomorLot) || 0) + qty);
  }
  const itemList = Array.from(merged, ([nomorLot, qty]) => ({ nomorLot, qty }));

  const result = await withTransaction(async (conn) => {
    let linkedDo = null;
    if (deliveryOrderId) {
      linkedDo = await doModel.findById(userTenantId, deliveryOrderId);
      if (!linkedDo) throw new ApiError(404, 'Delivery Order tidak ditemukan');

      // Validasi apakah DO ini sudah pernah diproses pengeluaran stok fisiknya
      const [existingTrx] = await conn.query(
        'SELECT id, kode_transaksi FROM transactions WHERE delivery_order_id = ? AND tipe_transaksi = "KELUAR" LIMIT 1',
        [deliveryOrderId]
      );
      if (existingTrx && existingTrx.length > 0) {
        throw new ApiError(
          400,
          `Delivery Order "${linkedDo.no_do}" sudah pernah diproses pengeluaran stok fisiknya (${existingTrx[0].kode_transaksi})`
        );
      }
    }

    const locked = [];
    const today = new Date().toISOString().split('T')[0];

    for (const item of itemList) {
      const lot = await productModel.lockLot(item.nomorLot, conn, warehouseId, userTenantId);
      if (!lot) {
        throw new ApiError(404, `Lot "${item.nomorLot}" tidak ditemukan di gudang yang dipilih`);
      }

      if (restrictedWh && lot.warehouse_id && Number(lot.warehouse_id) !== restrictedWh.id) {
        throw new ApiError(
          403,
          `Akses ditolak: Lot "${item.nomorLot}" tersimpan di gudang lain. Anda hanya boleh mengeluarkan barang dari ${restrictedWh.nama}.`
        );
      }

      if (['QUARANTINE', 'HOLD', 'EXPIRED'].includes(lot.status)) {
        throw new ApiError(
          400,
          `Lot "${item.nomorLot}" berstatus ${lot.status} dan dilarang untuk dikeluarkan!`
        );
      }
      if (lot.expired_date && lot.expired_date <= today) {
        throw new ApiError(
          400,
          `Lot "${item.nomorLot}" telah KEDALUWARSA (${lot.expired_date}) dan dilarang untuk dikirim!`
        );
      }

      if (Number(lot.stok_qty) < item.qty) {
        throw new ApiError(
          400,
          `Stok lot "${item.nomorLot}" tidak cukup (tersisa ${lot.stok_qty}, diminta ${item.qty})`
        );
      }
      locked.push({ lot, qty: item.qty });
    }

    const kodeTransaksi = generateKode('OUT');
    const transactionId = await transactionModel.create(
      {
        tenantId: userTenantId,
        kodeTransaksi,
        tipeTransaksi: 'KELUAR',
        referensi: referensi || null,
        keterangan: keterangan || null,
        userId: req.user ? req.user.id : null,
        warehouseId,
        purchaseOrderId: null,
        deliveryOrderId,
      },
      conn
    );

    const detailResult = [];
    for (const { lot, qty } of locked) {
      const affected = await productModel.decreaseStock(lot.nomor_lot, qty, conn, warehouseId, userTenantId);
      if (affected === 0) {
        throw new ApiError(400, `Stok lot "${lot.nomor_lot}" berubah, ulangi transaksi`);
      }
      await transactionModel.createDetail({ tenantId: userTenantId, transactionId, nomorLot: lot.nomor_lot, qty }, conn);
      await transactionModel.insertMutation(
        {
          tenantId: userTenantId,
          kodeProduk: lot.kode_produk,
          nomorLot: lot.nomor_lot,
          warehouseId,
          tipe: 'KELUAR',
          qtyPerubahan: qty,
          qtySisa: Number(lot.stok_qty) - qty,
          referensi: referensi || null,
        },
        conn
      );
      detailResult.push({
        nomor_lot: lot.nomor_lot,
        kode_produk: lot.kode_produk,
        qty,
        sisa_stok: Number(lot.stok_qty) - qty,
      });
    }

    if (deliveryOrderId && linkedDo) {
      await doModel.updateStatus(deliveryOrderId, 'SHIPPED', conn);
      if (linkedDo.so_id) {
        const doDetails = await doModel.findDetailsByDoId(deliveryOrderId);
        const soDetails = await soModel.findDetailsBySoId(linkedDo.so_id);
        for (const dod of doDetails) {
          const matchingSoDetail = soDetails.find((sod) => sod.kode_produk === dod.kode_produk);
          if (matchingSoDetail) {
            await soModel.updateDetailQtyTerkirim(matchingSoDetail.id, dod.qty_kirim, conn);
          }
        }
        const updatedSoDetails = await soModel.findDetailsBySoId(linkedDo.so_id);
        const allFulfilled = updatedSoDetails.every((d) => d.qty_terkirim >= d.qty_pesanan);
        await soModel.updateStatus(linkedDo.so_id, allFulfilled ? 'CLOSED' : 'PROCESSING', conn);

        // Terbitkan Faktur Penjualan & Piutang otomatis saat pengeluaran barang DO berhasil diproses
        await generateInvoiceForSO(linkedDo.so_id, userTenantId, req.user ? req.user.id : null, conn);
      }
    }

    let totalHpp = 0;
    for (const { lot, qty } of locked) {
      const prod = await productModel.findByKode(userTenantId, lot.kode_produk, conn);
      const hargaBeli = prod ? Number(prod.harga || prod.harga_beli || 0) : 0;
      totalHpp += qty * hargaBeli;
    }

    if (totalHpp > 0) {
      const accCogs = await accountingModel.getAccountIdByKode('5-1001', conn);
      const accInv = await accountingModel.getAccountIdByKode('1-1020', conn);
      if (accCogs && accInv) {
        await accountingModel.postJournal(
          {
            tenantId: userTenantId,
            tanggal: new Date().toISOString().split('T')[0],
            tipeReferensi: 'OUTBOUND',
            referensiId: transactionId,
            noReferensi: kodeTransaksi,
            keterangan: `HPP Pengeluaran Barang ${kodeTransaksi}`,
            createdBy: req.user ? req.user.id : null,
            lines: [
              { accountId: accCogs.id, debit: totalHpp, credit: 0, keterangan: `HPP Barang Keluar ${kodeTransaksi}` },
              { accountId: accInv.id, debit: 0, credit: totalHpp, keterangan: `Pengurangan Persediaan ${kodeTransaksi}` },
            ],
          },
          conn
        );
      }
    }

    return { kode_transaksi: kodeTransaksi, items: detailResult, warehouse_id: warehouseId };
  });

  res.status(201).json({
    success: true,
    message: `Transaksi keluar ${result.kode_transaksi} tersimpan`,
    data: result,
  });
});

// GET /api/transactions?type=MASUK|KELUAR&limit=20
const list = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const tipe = ['MASUK', 'KELUAR'].includes(req.query.type) ? req.query.type : null;
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const transactions = await transactionModel.findMany(tenantId, tipe, limit);
  const details = await transactionModel.findDetailsByTransactionIds(transactions.map((t) => t.id));
  const data = transactions.map((t) => ({
    ...t,
    details: details.filter((d) => d.transaction_id === t.id),
  }));

  res.json({ success: true, data });
});

// GET /api/transactions/:kode
const getById = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const transaction = await transactionModel.findByKode(tenantId, req.params.kode);
  if (!transaction) throw new ApiError(404, `Transaksi "${req.params.kode}" tidak ditemukan`);

  const details = await transactionModel.findDetailsByTransactionIds([transaction.id]);
  res.json({ success: true, data: { ...transaction, details } });
});

// GET /api/stock-card/:kode_produk?from=&to=&warehouse_id=
const stockCard = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const kodeProduk = req.params.kode_produk;
  const from = (req.query.from || '').trim() || null;
  const to = (req.query.to || '').trim() || null;
  const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;

  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new ApiError(400, 'Format tanggal dari tidak valid');
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new ApiError(400, 'Format tanggal sampai tidak valid');

  const product = await productModel.findByKode(tenantId, kodeProduk);
  if (!product) throw new ApiError(404, `Produk "${kodeProduk}" tidak ditemukan`);

  const rawRows = await transactionModel.findMutations(tenantId, kodeProduk, from, to, warehouseId);
  const saldoAwal = await transactionModel.getOpeningStock(tenantId, kodeProduk, from, warehouseId);

  const positiveTypes = ['MASUK', 'ADJUSTMENT_MASUK', 'TRANSFER_MASUK', 'RETUR_JUAL'];
  const negativeTypes = ['KELUAR', 'ADJUSTMENT_KELUAR', 'TRANSFER_KELUAR', 'RETUR_BELI'];

  let runningBalance = saldoAwal;
  const rows = rawRows.map((r) => {
    const isPos = positiveTypes.includes(r.tipe);
    const qty = Number(r.qty_perubahan || 0);
    if (isPos) {
      runningBalance += qty;
    } else {
      runningBalance -= qty;
    }
    return {
      ...r,
      saldo_berjalan: runningBalance,
      qty_sisa_lot: r.qty_sisa, // Simpan sisa stok lot spesifik jika dibutuhkan
      qty_sisa: runningBalance, // Saldo berjalan buku mutasi produk
    };
  });

  const totalMasuk = rows.filter((r) => positiveTypes.includes(r.tipe)).reduce((s, r) => s + Number(r.qty_perubahan), 0);
  const totalKeluar = rows.filter((r) => negativeTypes.includes(r.tipe)).reduce((s, r) => s + Number(r.qty_perubahan), 0);
  const saldo = rows.length ? runningBalance : saldoAwal;

  res.json({
    success: true,
    data: {
      product,
      rows,
      ringkasan: {
        saldo_awal: saldoAwal,
        total_masuk: totalMasuk,
        total_keluar: totalKeluar,
        saldo,
      },
    },
  });
});

module.exports = { createInbound, createOutbound, list, getById, stockCard };
