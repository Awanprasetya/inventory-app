const pool = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Menghapus Delivery Order secara kaskade:
 * 1. Mengembalikan stok fisik yang telah keluar pada lot barang (product_lots.stok_qty bertambah kembali).
 * 2. Menghapus pencatatan barang keluar (transactions & transaction_details).
 * 3. Menghapus mutasi stok (stock_mutations) sehingga buku Kartu Stok kembali ke posisi semula.
 * 4. Menghapus jurnal akuntansi HPP (OUTBOUND) yang telah dibukukan.
 * 5. Mengembalikan pemenuhan qty_terkirim pada Sales Order (jika DO terhubung ke SO).
 * 6. Menghapus rincian lot pengiriman (delivery_order_details) dan dokumen DO (delivery_orders).
 */
const deleteDeliveryOrderCascade = async (doId, tenantId = null, existingConn = null, skipSoUpdate = false) => {
  const shouldManageTx = !existingConn;
  const conn = existingConn || (await pool.getConnection());

  if (shouldManageTx) {
    await conn.beginTransaction();
  }

  try {
    // 1. Dapatkan data DO
    const [doRows] = await conn.query(
      'SELECT * FROM delivery_orders WHERE id = ? AND (? IS NULL OR tenant_id = ?)',
      [doId, tenantId, tenantId]
    );
    if (!doRows || doRows.length === 0) {
      if (shouldManageTx) await conn.commit();
      return null;
    }
    const doData = doRows[0];
    const actualTenantId = tenantId || doData.tenant_id;

    // 2. Ambil detail DO untuk memulihkan SO qty_terkirim
    const [doDetails] = await conn.query(
      `SELECT dod.*, pl.kode_produk 
       FROM delivery_order_details dod 
       LEFT JOIN product_lots pl ON pl.nomor_lot = dod.nomor_lot AND (? IS NULL OR pl.tenant_id = ?)
       WHERE dod.do_id = ?`,
      [actualTenantId, actualTenantId, doId]
    );

    // 3. Temukan seluruh transaksi KELUAR (Barang Keluar) yang berelasi dengan DO ini
    const [transactions] = await conn.query(
      'SELECT id, kode_transaksi FROM transactions WHERE delivery_order_id = ? OR referensi = ?',
      [doId, doData.no_do]
    );

    for (const trx of transactions) {
      // a. Ambil rincian lot dan kuantitas barang keluar
      const [trxDetails] = await conn.query(
        'SELECT nomor_lot, qty FROM transaction_details WHERE transaction_id = ?',
        [trx.id]
      );

      for (const td of trxDetails) {
        const qtyToRestore = Number(td.qty) || 0;
        if (qtyToRestore > 0) {
          // b. KEMBALIKAN STOK FISIK KE LOT (Revert Barang Keluar -> Stok lot bertambah kembali)
          await conn.query(
            'UPDATE product_lots SET stok_qty = stok_qty + ? WHERE nomor_lot = ? AND (? IS NULL OR tenant_id = ?)',
            [qtyToRestore, td.nomor_lot, actualTenantId, actualTenantId]
          );

          // c. HAPUS MUTASI STOK (Kartu Stok Revert)
          await conn.query(
            `DELETE FROM stock_mutations 
             WHERE (referensi = ? OR referensi = ?) AND nomor_lot = ? AND (? IS NULL OR tenant_id = ?)`,
            [doData.no_do, trx.kode_transaksi, td.nomor_lot, actualTenantId, actualTenantId]
          );
        }
      }

      // d. Hapus Jurnal Akuntansi HPP / Outbound terkait transaksi ini
      const [journals] = await conn.query(
        `SELECT id FROM journal_entries 
         WHERE ((tipe_referensi = 'OUTBOUND' AND referensi_id = ?) OR no_referensi = ? OR no_referensi = ?)
           AND (? IS NULL OR tenant_id = ?)`,
        [trx.id, trx.kode_transaksi, doData.no_do, actualTenantId, actualTenantId]
      );
      if (journals && journals.length > 0) {
        const jIds = journals.map((j) => j.id);
        await conn.query('DELETE FROM journal_lines WHERE journal_id IN (?)', [jIds]);
        await conn.query('DELETE FROM journal_entries WHERE id IN (?)', [jIds]);
      }

      // e. Hapus detail transaksi dan header transaksi barang keluar
      await conn.query('DELETE FROM transaction_details WHERE transaction_id = ?', [trx.id]);
      await conn.query('DELETE FROM transactions WHERE id = ?', [trx.id]);
    }

    // 4. Bersihkan sisa mutasi stok yang masih merujuk ke nomor DO ini jika ada
    await conn.query(
      'DELETE FROM stock_mutations WHERE referensi = ? AND (? IS NULL OR tenant_id = ?)',
      [doData.no_do, actualTenantId, actualTenantId]
    );

    // 5. Kembalikan akumulasi qty_terkirim pada Sales Order jika DO ini terhubung ke SO
    if (doData.so_id && !skipSoUpdate) {
      for (const dod of doDetails) {
        const kodeProduk = dod.kode_produk;
        const qtyKirim = Number(dod.qty_kirim) || 0;
        if (kodeProduk && qtyKirim > 0) {
          await conn.query(
            'UPDATE sales_order_details SET qty_terkirim = GREATEST(0, qty_terkirim - ?) WHERE so_id = ? AND kode_produk = ?',
            [qtyKirim, doData.so_id, kodeProduk]
          );
        }
      }

      // Re-evaluasi status SO
      const [remainingSoDetails] = await conn.query(
        'SELECT qty_pesanan, qty_terkirim FROM sales_order_details WHERE so_id = ?',
        [doData.so_id]
      );
      if (remainingSoDetails && remainingSoDetails.length > 0) {
        const totalTerkirim = remainingSoDetails.reduce((sum, r) => sum + Number(r.qty_terkirim || 0), 0);
        const allFulfilled = remainingSoDetails.every((r) => Number(r.qty_terkirim) >= Number(r.qty_pesanan));
        let newSoStatus = 'OPEN';
        if (allFulfilled) {
          newSoStatus = 'CLOSED';
        } else if (totalTerkirim > 0) {
          newSoStatus = 'PROCESSING';
        }
        await conn.query('UPDATE sales_orders SET status = ? WHERE id = ?', [newSoStatus, doData.so_id]);
      }
    }

    // 6. Hapus detail DO & header DO
    await conn.query('DELETE FROM delivery_order_details WHERE do_id = ?', [doId]);
    await conn.query('DELETE FROM delivery_orders WHERE id = ?', [doId]);

    if (shouldManageTx) {
      await conn.commit();
    }
    return doData;
  } catch (err) {
    if (shouldManageTx) {
      await conn.rollback();
    }
    throw err;
  } finally {
    if (shouldManageTx) {
      conn.release();
    }
  }
};

/**
 * Menghapus Purchase Order secara kaskade:
 * 1. Validasi riwayat pembayaran utang (AP).
 * 2. Mengurangi kembali stok fisik yang telah masuk pada lot barang (product_lots.stok_qty berkurang).
 * 3. Menghapus pencatatan barang masuk (transactions & transaction_details).
 * 4. Menghapus mutasi stok (stock_mutations) sehingga buku Kartu Stok kembali ke posisi semula.
 * 5. Menghapus faktur utang (accounts_payable) & jurnal akuntansi pembelian/inbound.
 * 6. Menghapus rincian pesanan (purchase_order_details) dan dokumen PO (purchase_orders).
 */
const deletePurchaseOrderCascade = async (poId, tenantId = null, existingConn = null) => {
  const shouldManageTx = !existingConn;
  const conn = existingConn || (await pool.getConnection());

  if (shouldManageTx) {
    await conn.beginTransaction();
  }

  try {
    // 1. Dapatkan data PO
    const [poRows] = await conn.query(
      'SELECT * FROM purchase_orders WHERE id = ? AND (? IS NULL OR tenant_id = ?)',
      [poId, tenantId, tenantId]
    );
    if (!poRows || poRows.length === 0) {
      if (shouldManageTx) await conn.commit();
      return null;
    }
    const poData = poRows[0];
    const actualTenantId = tenantId || poData.tenant_id;

    // 2. Cek apakah ada pembayaran utang
    const [apRows] = await conn.query(
      'SELECT id, no_tagihan FROM accounts_payable WHERE po_id = ?',
      [poId]
    );
    for (const ap of apRows) {
      const [payments] = await conn.query(
        'SELECT id FROM payable_payments WHERE payable_id = ?',
        [ap.id]
      );
      if (payments && payments.length > 0) {
        throw new ApiError(
          400,
          `Purchase Order "${poData.no_po}" tidak dapat dihapus karena sudah memiliki riwayat pembayaran utang. Hapus riwayat pembayaran terlebih dahulu.`
        );
      }
      // Hapus jurnal AP jika ada
      const [journals] = await conn.query(
        `SELECT id FROM journal_entries 
         WHERE ((tipe_referensi = 'AP' AND referensi_id = ?) OR no_referensi = ? OR no_referensi = ?)
           AND (? IS NULL OR tenant_id = ?)`,
        [ap.id, ap.no_tagihan, poData.no_po, actualTenantId, actualTenantId]
      );
      if (journals && journals.length > 0) {
        const jIds = journals.map((j) => j.id);
        await conn.query('DELETE FROM journal_lines WHERE journal_id IN (?)', [jIds]);
        await conn.query('DELETE FROM journal_entries WHERE id IN (?)', [jIds]);
      }
      await conn.query('DELETE FROM accounts_payable WHERE id = ?', [ap.id]);
    }

    // 3. Cek retur pembelian
    const [returRows] = await conn.query(
      'SELECT id, no_return FROM purchase_returns WHERE po_id = ?',
      [poId]
    );
    if (returRows && returRows.length > 0) {
      throw new ApiError(
        400,
        `Purchase Order "${poData.no_po}" tidak dapat dihapus karena sudah memiliki data Retur Pembelian (${returRows[0].no_return}). Hapus retur terlebih dahulu.`
      );
    }

    // 4. Temukan seluruh transaksi MASUK (Barang Masuk / Inbound) yang berelasi dengan PO ini
    const [transactions] = await conn.query(
      'SELECT id, kode_transaksi FROM transactions WHERE purchase_order_id = ? OR referensi = ?',
      [poId, poData.no_po]
    );

    for (const trx of transactions) {
      // a. Ambil rincian lot dan kuantitas barang masuk
      const [trxDetails] = await conn.query(
        'SELECT nomor_lot, qty FROM transaction_details WHERE transaction_id = ?',
        [trx.id]
      );

      for (const td of trxDetails) {
        const qtyToDeduct = Number(td.qty) || 0;
        if (qtyToDeduct > 0) {
          // b. KURANGI KEMBALI STOK FISIK DARI LOT (Revert Barang Masuk -> Stok dikurangi kembali)
          await conn.query(
            'UPDATE product_lots SET stok_qty = GREATEST(0, stok_qty - ?) WHERE nomor_lot = ? AND (? IS NULL OR tenant_id = ?)',
            [qtyToDeduct, td.nomor_lot, actualTenantId, actualTenantId]
          );

          // c. HAPUS MUTASI STOK (Kartu Stok Revert)
          await conn.query(
            `DELETE FROM stock_mutations 
             WHERE (referensi = ? OR referensi = ?) AND nomor_lot = ? AND (? IS NULL OR tenant_id = ?)`,
            [poData.no_po, trx.kode_transaksi, td.nomor_lot, actualTenantId, actualTenantId]
          );

          // d. Bersihkan lot jika stok_qty menjadi 0 dan tidak memiliki transaksi lain sama sekali
          const [otherTrx] = await conn.query(
            'SELECT id FROM transaction_details WHERE nomor_lot = ? AND transaction_id != ? LIMIT 1',
            [td.nomor_lot, trx.id]
          );
          if (!otherTrx || otherTrx.length === 0) {
            await conn.query(
              'DELETE FROM product_lots WHERE nomor_lot = ? AND stok_qty = 0 AND (? IS NULL OR tenant_id = ?)',
              [td.nomor_lot, actualTenantId, actualTenantId]
            );
          }
        }
      }

      // e. Hapus Jurnal Akuntansi Inbound terkait transaksi ini
      const [journals] = await conn.query(
        `SELECT id FROM journal_entries 
         WHERE ((tipe_referensi = 'INBOUND' AND referensi_id = ?) OR no_referensi = ? OR no_referensi = ?)
           AND (? IS NULL OR tenant_id = ?)`,
        [trx.id, trx.kode_transaksi, poData.no_po, actualTenantId, actualTenantId]
      );
      if (journals && journals.length > 0) {
        const jIds = journals.map((j) => j.id);
        await conn.query('DELETE FROM journal_lines WHERE journal_id IN (?)', [jIds]);
        await conn.query('DELETE FROM journal_entries WHERE id IN (?)', [jIds]);
      }

      // f. Hapus detail transaksi dan header transaksi barang masuk
      await conn.query('DELETE FROM transaction_details WHERE transaction_id = ?', [trx.id]);
      await conn.query('DELETE FROM transactions WHERE id = ?', [trx.id]);
    }

    // 5. Hapus sisa mutasi stok yang masih merujuk ke nomor PO ini jika ada
    await conn.query(
      'DELETE FROM stock_mutations WHERE referensi = ? AND (? IS NULL OR tenant_id = ?)',
      [poData.no_po, actualTenantId, actualTenantId]
    );

    // 6. Hapus detail PO & header PO
    await conn.query('DELETE FROM purchase_order_details WHERE po_id = ?', [poId]);
    await conn.query('DELETE FROM purchase_orders WHERE id = ?', [poId]);

    if (shouldManageTx) {
      await conn.commit();
    }
    return poData;
  } catch (err) {
    if (shouldManageTx) {
      await conn.rollback();
    }
    throw err;
  } finally {
    if (shouldManageTx) {
      conn.release();
    }
  }
};

/**
 * Menghapus Sales Order secara kaskade:
 * 1. Validasi riwayat penerimaan pembayaran piutang (AR).
 * 2. Menghapus seluruh Delivery Order (DO) terkait beserta pemulihan stok fisik & kartu stoknya.
 * 3. Menghapus faktur piutang (accounts_receivable) & jurnal akuntansi penjualan.
 * 4. Menghapus rincian pesanan (sales_order_details) dan dokumen SO (sales_orders).
 */
const deleteSalesOrderCascade = async (soId, tenantId = null, existingConn = null) => {
  const shouldManageTx = !existingConn;
  const conn = existingConn || (await pool.getConnection());

  if (shouldManageTx) {
    await conn.beginTransaction();
  }

  try {
    // 1. Dapatkan data SO
    const [soRows] = await conn.query(
      'SELECT * FROM sales_orders WHERE id = ? AND (? IS NULL OR tenant_id = ?)',
      [soId, tenantId, tenantId]
    );
    if (!soRows || soRows.length === 0) {
      if (shouldManageTx) await conn.commit();
      return null;
    }
    const soData = soRows[0];
    const actualTenantId = tenantId || soData.tenant_id;

    // 2. Cek apakah ada pembayaran piutang
    const [arRows] = await conn.query(
      'SELECT id, no_tagihan FROM accounts_receivable WHERE so_id = ?',
      [soId]
    );
    for (const ar of arRows) {
      const [payments] = await conn.query(
        'SELECT id FROM receivable_payments WHERE receivable_id = ?',
        [ar.id]
      );
      if (payments && payments.length > 0) {
        throw new ApiError(
          400,
          `Sales Order "${soData.no_so}" tidak dapat dihapus karena sudah memiliki riwayat penerimaan pembayaran piutang. Hapus riwayat pembayaran terlebih dahulu.`
        );
      }
      // Hapus jurnal AR jika ada
      const [journals] = await conn.query(
        `SELECT id FROM journal_entries 
         WHERE ((tipe_referensi = 'AR' AND referensi_id = ?) OR no_referensi = ? OR no_referensi = ?)
           AND (? IS NULL OR tenant_id = ?)`,
        [ar.id, ar.no_tagihan, soData.no_so, actualTenantId, actualTenantId]
      );
      if (journals && journals.length > 0) {
        const jIds = journals.map((j) => j.id);
        await conn.query('DELETE FROM journal_lines WHERE journal_id IN (?)', [jIds]);
        await conn.query('DELETE FROM journal_entries WHERE id IN (?)', [jIds]);
      }
      await conn.query('DELETE FROM accounts_receivable WHERE id = ?', [ar.id]);
    }

    // 3. Cek retur penjualan
    const [returRows] = await conn.query(
      'SELECT id, no_return FROM sales_returns WHERE so_id = ?',
      [soId]
    );
    if (returRows && returRows.length > 0) {
      throw new ApiError(
        400,
        `Sales Order "${soData.no_so}" tidak dapat dihapus karena sudah memiliki data Retur Penjualan (${returRows[0].no_return}). Hapus retur terlebih dahulu.`
      );
    }

    // 4. Hapus seluruh Delivery Order yang terkait dengan SO ini (beserta barang keluar & kartu stoknya)
    const [linkedDos] = await conn.query(
      'SELECT id FROM delivery_orders WHERE so_id = ?',
      [soId]
    );
    for (const lDo of linkedDos) {
      await deleteDeliveryOrderCascade(lDo.id, actualTenantId, conn, true);
    }

    // 5. Hapus detail SO & header SO
    await conn.query('DELETE FROM sales_order_details WHERE so_id = ?', [soId]);
    await conn.query('DELETE FROM sales_orders WHERE id = ?', [soId]);

    if (shouldManageTx) {
      await conn.commit();
    }
    return soData;
  } catch (err) {
    if (shouldManageTx) {
      await conn.rollback();
    }
    throw err;
  } finally {
    if (shouldManageTx) {
      conn.release();
    }
  }
};

module.exports = {
  deleteDeliveryOrderCascade,
  deletePurchaseOrderCascade,
  deleteSalesOrderCascade,
};

