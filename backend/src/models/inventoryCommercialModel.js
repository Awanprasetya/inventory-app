const pool = require('../config/db');
const accountingModel = require('./accountingModel');
const soModel = require('./soModel');
const doModel = require('./doModel');
const poModel = require('./poModel');
const payableModel = require('./payableModel');
const receivableModel = require('./receivableModel');
const transactionModel = require('./transactionModel');
const { normalizeRole } = require('../middleware/rbac');
const { isSuperUser } = require('../utils/tenantHelper');
const { ApiError } = require('../middleware/errorHandler');

// ============================================================================
// 1. MULTI-GUDANG & TRANSFER ANTAR GUDANG (TERMASUK LINTAS PT / INTERCOMPANY)
// ============================================================================
const findAllWarehouses = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT w.*, 
            t.nama_perusahaan, t.kode_tenant,
            COUNT(DISTINCT pl.kode_produk) AS total_produk,
            COALESCE(SUM(pl.stok_qty), 0) AS total_stok
     FROM warehouses w
     LEFT JOIN tenants t ON w.tenant_id = t.id
     LEFT JOIN product_lots pl ON pl.warehouse_id = w.id
     WHERE (? IS NULL OR w.tenant_id = ?)
       AND (? IS NOT NULL OR (COALESCE(w.is_active, 1) = 1 AND COALESCE(t.status, 'ACTIVE') = 'ACTIVE'))
     GROUP BY w.id
     ORDER BY w.tenant_id ASC, w.id ASC`,
    [tenantId, tenantId, tenantId]
  );
  return rows;
};

const findWarehouseByKode = async (tenantId = null, kodeGudang) => {
  const [rows] = await pool.query(
    'SELECT * FROM warehouses WHERE (? IS NULL OR tenant_id = ?) AND kode_gudang = ? LIMIT 1',
    [tenantId, tenantId, kodeGudang]
  );
  return rows[0] || null;
};

const createWarehouse = async ({ tenantId = 1, kode_gudang, nama_gudang, tipe_gudang, alamat, penanggung_jawab, telepon }) => {
  const [res] = await pool.query(
    `INSERT INTO warehouses (tenant_id, kode_gudang, nama_gudang, tipe_gudang, alamat, penanggung_jawab, telepon)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, kode_gudang, nama_gudang, tipe_gudang || 'UTAMA', alamat || null, penanggung_jawab || null, telepon || null]
  );
  return res.insertId;
};

const updateWarehouse = async (id, { nama_gudang, tipe_gudang, alamat, penanggung_jawab, telepon, is_active }) => {
  await pool.query(
    `UPDATE warehouses 
     SET nama_gudang = ?, tipe_gudang = ?, alamat = ?, penanggung_jawab = ?, telepon = ?, is_active = ?
     WHERE id = ?`,
    [nama_gudang, tipe_gudang, alamat, penanggung_jawab, telepon, is_active ?? 1, id]
  );
};

const deleteWarehouse = async (id) => {
  const [lots] = await pool.query('SELECT COUNT(*) as count FROM product_lots WHERE warehouse_id = ? AND stok_qty > 0', [id]);
  if (lots[0].count > 0) {
    throw new Error('Gudang tidak dapat dihapus karena masih memiliki stok barang aktif.');
  }
  await pool.query('DELETE FROM warehouses WHERE id = ?', [id]);
};

// Transfer Antar Gudang (mendukung satu PT maupun lintas PT)
const findAllWarehouseTransfers = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT wt.*, 
            w1.nama_gudang AS from_warehouse_nama, w1.kode_gudang AS from_warehouse_kode, w1.tenant_id AS from_tenant_id,
            t1.nama_perusahaan AS from_tenant_nama,
            w2.nama_gudang AS to_warehouse_nama, w2.kode_gudang AS to_warehouse_kode, w2.tenant_id AS to_tenant_id,
            t2.nama_perusahaan AS to_tenant_nama,
            u.nama_lengkap AS created_by_name,
            u2.nama_lengkap AS approved_by_name,
            so.no_so,
            do_tbl.no_do,
            po.no_po
     FROM warehouse_transfers wt
     JOIN warehouses w1 ON wt.from_warehouse_id = w1.id
     JOIN warehouses w2 ON wt.to_warehouse_id = w2.id
     LEFT JOIN tenants t1 ON w1.tenant_id = t1.id
     LEFT JOIN tenants t2 ON w2.tenant_id = t2.id
     LEFT JOIN users u ON wt.created_by = u.id
     LEFT JOIN users u2 ON wt.approved_by = u2.id
     LEFT JOIN sales_orders so ON wt.so_id = so.id
     LEFT JOIN delivery_orders do_tbl ON wt.do_id = do_tbl.id
     LEFT JOIN purchase_orders po ON wt.po_id = po.id
     WHERE (? IS NULL OR wt.tenant_id = ? OR w1.tenant_id = ? OR w2.tenant_id = ?)
     ORDER BY wt.tanggal DESC, wt.id DESC`,
    [tenantId, tenantId, tenantId, tenantId]
  );

  if (rows.length === 0) return [];

  const transferIds = rows.map((r) => r.id);
  const [details] = await pool.query(
    `SELECT wtd.*, p.kode_produk, p.nama_produk, p.satuan, p.harga,
            p.satuan_besar, p.satuan_menengah, p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan
     FROM warehouse_transfer_details wtd
     JOIN products p ON wtd.product_id = p.id
     WHERE wtd.transfer_id IN (?)`,
    [transferIds]
  );

  const detailMap = new Map();
  for (const d of details) {
    if (!detailMap.has(d.transfer_id)) detailMap.set(d.transfer_id, []);
    detailMap.get(d.transfer_id).push(d);
  }

  return rows.map((r) => ({
    ...r,
    is_intercompany: Boolean(r.is_intercompany) || (Number(r.from_tenant_id) !== Number(r.to_tenant_id)),
    items: detailMap.get(r.id) || [],
  }));
};

// Pastikan produk tersedia di master produk tenant tujuan saat transfer lintas PT
const ensureDestinationProduct = async (conn, srcProd, destTenantId) => {
  const [existing] = await conn.query(
    'SELECT id, kode_produk, is_deleted FROM products WHERE tenant_id = ? AND kode_produk = ? LIMIT 1',
    [destTenantId, srcProd.kode_produk]
  );
  if (existing.length > 0) {
    if (existing[0].is_deleted) {
      await conn.query('UPDATE products SET is_deleted = 0 WHERE id = ?', [existing[0].id]);
    }
    return existing[0].id;
  }

  const [ins] = await conn.query(
    `INSERT INTO products (
       tenant_id, kode_produk, nama_produk, kategori_produk, satuan, satuan_besar, satuan_menengah,
       isi_pack_pcs, isi_box_pack, isi_box_pcs, isi_per_kemasan, barcode_kemasan,
       harga, rack_id, metode_stok, jenis_izin, nomor_izin
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    [
      destTenantId,
      srcProd.kode_produk,
      srcProd.nama_produk,
      srcProd.kategori_produk || 'BARANG_JADI',
      srcProd.satuan || 'PCS',
      srcProd.satuan_besar || 'BOX',
      srcProd.satuan_menengah || 'PACK',
      Number(srcProd.isi_pack_pcs) || 1,
      Number(srcProd.isi_box_pack) || 1,
      Number(srcProd.isi_box_pcs) || Number(srcProd.isi_per_kemasan) || 1,
      Number(srcProd.isi_per_kemasan) || 1,
      srcProd.barcode_kemasan || null,
      Number(srcProd.harga) || 0,
      srcProd.metode_stok || 'FIFO',
      srcProd.jenis_izin || null,
      srcProd.nomor_izin || null,
    ]
  );
  return ins.insertId;
};

// Pastikan bagan akun (COA) minimal tersedia untuk tenant tujuan/asal agar jurnal otomatis tidak gagal
const ensureTenantDefaultAccounts = async (conn, tenantId) => {
  const requiredCodes = [
    { kode: '1-1010', nama: 'Piutang Usaha (AR)', kategori: 'ASSET', sub: 'Piutang', normal: 'DEBIT' },
    { kode: '1-1020', nama: 'Persediaan Barang Dagang', kategori: 'ASSET', sub: 'Persediaan', normal: 'DEBIT' },
    { kode: '2-1001', nama: 'Utang Usaha (AP)', kategori: 'LIABILITY', sub: 'Kewajiban Lancar', normal: 'KREDIT' },
    { kode: '4-1001', nama: 'Penjualan Barang', kategori: 'REVENUE', sub: 'Pendapatan Usaha', normal: 'KREDIT' },
    { kode: '5-1001', nama: 'Beban Pokok Penjualan (HPP)', kategori: 'COGS', sub: 'Beban Pokok', normal: 'DEBIT' },
  ];

  for (const item of requiredCodes) {
    const existing = await accountingModel.getAccountIdByKode(item.kode, conn, tenantId);
    if (!existing) {
      await accountingModel.createAccount(
        {
          tenantId,
          kode_akun: item.kode,
          nama_akun: item.nama,
          kategori: item.kategori,
          subkategori: item.sub,
          saldo_normal: item.normal,
          is_kas_bank: false,
          deskripsi: 'Akun standar otomatis untuk transaksi persediaan & antar-PT',
        },
        conn
      );
    }
  }
};

// Pastikan customer PT tujuan terdaftar di PT pengirim
const ensureIntercompanyCustomer = async (conn, sourceTenantId, destTenantId) => {
  const [tRows] = await conn.query('SELECT id, kode_tenant, nama_perusahaan, telepon, email_pemilik FROM tenants WHERE id = ? LIMIT 1', [destTenantId]);
  const destTenant = tRows[0] || { kode_tenant: `TENANT-${destTenantId}`, nama_perusahaan: `Perusahaan #${destTenantId}` };
  const kodeCust = `INT-${destTenant.kode_tenant || destTenantId}`.slice(0, 50);

  const [exist] = await conn.query(
    'SELECT id FROM customers WHERE tenant_id = ? AND (kode_customer = ? OR nama_customer = ?) LIMIT 1',
    [sourceTenantId, kodeCust, destTenant.nama_perusahaan]
  );
  if (exist.length > 0) return { customerId: exist[0].id, tenant: destTenant };

  const [ins] = await conn.query(
    `INSERT INTO customers (tenant_id, kode_customer, nama_customer, jenis_customer, telepon, email)
     VALUES (?, ?, ?, 'PT', ?, ?)`,
    [sourceTenantId, kodeCust, destTenant.nama_perusahaan, destTenant.telepon || null, destTenant.email_pemilik || null]
  );
  return { customerId: ins.insertId, tenant: destTenant };
};

// Pastikan supplier PT pengirim terdaftar di PT penerima
const ensureIntercompanySupplier = async (conn, destTenantId, sourceTenantId) => {
  const [tRows] = await conn.query('SELECT id, kode_tenant, nama_perusahaan, telepon, email_pemilik FROM tenants WHERE id = ? LIMIT 1', [sourceTenantId]);
  const srcTenant = tRows[0] || { kode_tenant: `TENANT-${sourceTenantId}`, nama_perusahaan: `Perusahaan #${sourceTenantId}` };
  const kodeSup = `INT-${srcTenant.kode_tenant || sourceTenantId}`.slice(0, 50);

  const [exist] = await conn.query(
    'SELECT id FROM suppliers WHERE tenant_id = ? AND (kode_supplier = ? OR nama_supplier = ?) LIMIT 1',
    [destTenantId, kodeSup, srcTenant.nama_perusahaan]
  );
  if (exist.length > 0) return { supplierId: exist[0].id, tenant: srcTenant };

  const [ins] = await conn.query(
    `INSERT INTO suppliers (tenant_id, kode_supplier, nama_supplier, telepon, email)
     VALUES (?, ?, ?, ?, ?)`,
    [destTenantId, kodeSup, srcTenant.nama_perusahaan, srcTenant.telepon || null, srcTenant.email_pemilik || null]
  );
  return { supplierId: ins.insertId, tenant: srcTenant };
};

// Helper internal untuk mengeksekusi mutasi fisik lot antar gudang (saat approval)
const executeTransferItemMove = async (conn, { transfer, productId, qty, sourceTenantId, destTenantId }) => {
  const [prods] = await conn.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
  if (prods.length === 0) throw new Error(`Produk dengan ID ${productId} tidak ditemukan.`);
  const prod = prods[0];
  const kodeProduk = prod.kode_produk;
  const metode = (prod.metode_stok || 'FIFO').toUpperCase();

  if (Number(sourceTenantId) !== Number(destTenantId)) {
    await ensureDestinationProduct(conn, prod, destTenantId);
  }

  let lotSort = 'ORDER BY tanggal_produksi ASC, created_at ASC, id ASC';
  if (metode === 'FEFO') {
    lotSort = 'ORDER BY (expired_date IS NULL) ASC, expired_date ASC, tanggal_produksi ASC, id ASC';
  }

  const [srcLots] = await conn.query(
    `SELECT * FROM product_lots WHERE kode_produk = ? AND warehouse_id = ? AND stok_qty > 0 AND tenant_id = ? ${lotSort} FOR UPDATE`,
    [kodeProduk, transfer.from_warehouse_id, sourceTenantId]
  );
  const totalAvailable = srcLots.reduce((s, l) => s + Number(l.stok_qty), 0);
  if (totalAvailable < qty) {
    throw new Error(`Stok produk "${prod.nama_produk}" di gudang asal tidak mencukupi (Tersedia: ${totalAvailable}, Diminta: ${qty}).`);
  }

  const movedLots = [];
  let remaining = qty;
  for (const lot of srcLots) {
    if (remaining <= 0) break;
    const take = Math.min(Number(lot.stok_qty), remaining);
    await conn.query('UPDATE product_lots SET stok_qty = stok_qty - ? WHERE id = ?', [take, lot.id]);

    const [destLot] = await conn.query(
      'SELECT id, stok_qty FROM product_lots WHERE kode_produk = ? AND nomor_lot = ? AND warehouse_id = ? AND tenant_id = ?',
      [kodeProduk, lot.nomor_lot, transfer.to_warehouse_id, destTenantId]
    );
    let destSisa = take;
    if (destLot.length > 0) {
      destSisa = Number(destLot[0].stok_qty) + take;
      await conn.query('UPDATE product_lots SET stok_qty = stok_qty + ? WHERE id = ?', [take, destLot[0].id]);
    } else {
      await conn.query(
        `INSERT INTO product_lots (tenant_id, kode_produk, nomor_lot, tanggal_produksi, expired_date, shift, warehouse_id, stok_qty, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
        [destTenantId, kodeProduk, lot.nomor_lot, lot.tanggal_produksi, lot.expired_date, lot.shift, transfer.to_warehouse_id, take]
      );
    }

    await conn.query(
      `INSERT INTO stock_mutations (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
       VALUES (?, NOW(), ?, ?, ?, 'TRANSFER_KELUAR', ?, ?, ?)`,
      [sourceTenantId, kodeProduk, lot.nomor_lot, transfer.from_warehouse_id, take, Math.max(0, Number(lot.stok_qty) - take), transfer.no_transfer]
    );
    await conn.query(
      `INSERT INTO stock_mutations (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
       VALUES (?, NOW(), ?, ?, ?, 'TRANSFER_MASUK', ?, ?, ?)`,
      [destTenantId, kodeProduk, lot.nomor_lot, transfer.to_warehouse_id, take, destSisa, transfer.no_transfer]
    );

    movedLots.push({
      nomorLot: lot.nomor_lot,
      qtyTaken: take,
      kodeProduk,
      harga: Number(prod.harga) || 0,
    });
    remaining -= take;
  }

  return { product: prod, movedLots };
};

// Helper validasi wewenang approval / penolakan transfer gudang
const assertCanApproveTransfer = async (conn, transfer, reqUser) => {
  if (!reqUser) return;
  if (isSuperUser({ user: reqUser })) return;

  const normRole = normalizeRole(reqUser.role, reqUser.tenant_id, reqUser.username);
  const isIntercompany =
    Number(transfer.from_tenant_id || transfer.tenant_id) !== Number(transfer.to_tenant_id || transfer.tenant_id);

  if (transfer.created_by && Number(transfer.created_by) === Number(reqUser.id)) {
    throw new ApiError(
      403,
      'Anda tidak dapat menyetujui atau menolak pengajuan transfer yang Anda buat sendiri. Menunggu persetujuan Gudang / Perusahaan Tujuan.'
    );
  }

  if (isIntercompany && Number(reqUser.tenant_id) !== Number(transfer.to_tenant_id)) {
    throw new ApiError(
      403,
      `Akses ditolak: Transfer lintas PT hanya dapat disetujui/ditolak oleh Admin Gudang atau Administrator perusahaan tujuan (${transfer.to_tenant_nama || 'PT Tujuan'}).`
    );
  }

  if (!isIntercompany && normRole === 'ADMINISTRATOR') return;

  const assignedWhId = reqUser.warehouse_id ? Number(reqUser.warehouse_id) : null;
  if (normRole === 'ADMIN_GUDANG' && assignedWhId && Number(transfer.to_warehouse_id) !== assignedWhId) {
    const [whRows] = await conn.query('SELECT nama_gudang FROM warehouses WHERE id = ? LIMIT 1', [transfer.to_warehouse_id]);
    const destName = whRows[0]?.nama_gudang || 'Gudang Tujuan';
    throw new ApiError(
      403,
      `Akses ditolak: Hanya Admin Gudang Tujuan (${destName}) atau Administrator terkait yang berhak menyetujui/menolak transfer ini.`
    );
  }
};

// Pengajuan Transfer Antar Gudang (Status awal: PENDING, mendukung 1 PT maupun Lintas PT)
const createWarehouseTransfer = async ({ from_warehouse_id, to_warehouse_id, tanggal, catatan, items }, userId, userTenantId = 1, reqUser = null) => {
  if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
    throw new Error('Gudang asal dan gudang tujuan tidak boleh sama.');
  }
  if (!items || items.length === 0) {
    throw new Error('Pilih minimal 1 barang untuk ditransfer.');
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [fromRows] = await conn.query('SELECT * FROM warehouses WHERE id = ? LIMIT 1', [Number(from_warehouse_id)]);
    const [toRows] = await conn.query('SELECT * FROM warehouses WHERE id = ? LIMIT 1', [Number(to_warehouse_id)]);
    if (fromRows.length === 0) throw new ApiError(404, 'Gudang asal tidak ditemukan.');
    if (toRows.length === 0) throw new ApiError(404, 'Gudang tujuan tidak ditemukan.');

    const fromWh = fromRows[0];
    const toWh = toRows[0];
    const sourceTenantId = Number(fromWh.tenant_id || userTenantId || 1);
    const destTenantId = Number(toWh.tenant_id || sourceTenantId);
    const isIntercompany = sourceTenantId !== destTenantId ? 1 : 0;

    if (reqUser) {
      const superFlag = isSuperUser({ user: reqUser });
      const normRole = normalizeRole(reqUser.role, reqUser.tenant_id, reqUser.username);
      const assignedWhId = reqUser.warehouse_id ? Number(reqUser.warehouse_id) : null;

      if (!superFlag && Number(reqUser.tenant_id) !== sourceTenantId) {
        throw new ApiError(403, 'Akses ditolak: Anda hanya boleh mengajukan transfer keluar dari gudang milik perusahaan Anda.');
      }
      if (normRole === 'ADMIN_GUDANG' && assignedWhId && Number(from_warehouse_id) !== assignedWhId) {
        throw new ApiError(
          403,
          `Akses ditolak: Akun Anda ditugaskan di "${reqUser.nama_gudang || 'Gudang Anda'}" dan hanya diperbolehkan mengajukan transfer keluar dari gudang tersebut.`
        );
      }
    }

    const noTransfer = `TRF-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [res] = await conn.query(
      `INSERT INTO warehouse_transfers (tenant_id, no_transfer, from_warehouse_id, to_warehouse_id, to_tenant_id, is_intercompany, tanggal, status, catatan, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [sourceTenantId, noTransfer, Number(from_warehouse_id), Number(to_warehouse_id), destTenantId, isIntercompany, tanggal, catatan || null, userId]
    );
    const transferId = res.insertId;

    for (const item of items) {
      const productId = Number(item.product_id);
      if (!productId) continue;

      const [prods] = await conn.query(
        'SELECT kode_produk, nama_produk, satuan, satuan_besar, satuan_menengah, isi_pack_pcs, isi_box_pack, isi_box_pcs, isi_per_kemasan FROM products WHERE id = ?',
        [productId]
      );
      if (prods.length === 0) throw new Error(`Produk dengan ID ${productId} tidak ditemukan.`);
      const p = prods[0];

      const satuanTransfer = (item.satuan_transfer || p.satuan || 'PCS').toUpperCase();
      let rasio = 1;
      if (satuanTransfer === (p.satuan_besar || 'BOX').toUpperCase()) {
        rasio = Number(p.isi_box_pcs) || Number(p.isi_per_kemasan) || 1;
      } else if (satuanTransfer === (p.satuan_menengah || 'PACK').toUpperCase()) {
        rasio = Number(p.isi_pack_pcs) || 1;
      }

      const qtyInput = item.qty_input != null ? Number(item.qty_input) : Number(item.qty);
      const qty = Number(item.qty) > 0 ? Math.round(Number(item.qty)) : Math.round(qtyInput * rasio);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Jumlah transfer untuk "${p.nama_produk}" harus lebih dari 0.`);
      }

      const [availRows] = await conn.query(
        'SELECT COALESCE(SUM(stok_qty), 0) AS total_avail FROM product_lots WHERE kode_produk = ? AND warehouse_id = ? AND stok_qty > 0 AND tenant_id = ?',
        [p.kode_produk, Number(from_warehouse_id), sourceTenantId]
      );
      const totalAvailable = Number(availRows[0]?.total_avail || 0);
      if (totalAvailable < qty) {
        throw new Error(`Stok produk "${p.nama_produk}" di gudang asal tidak mencukupi (Tersedia: ${totalAvailable} ${p.satuan || 'pcs'}, Diminta: ${qty} ${p.satuan || 'pcs'}).`);
      }

      await conn.query(
        `INSERT INTO warehouse_transfer_details (tenant_id, transfer_id, product_id, qty, satuan_transfer, qty_input, rasio_pcs, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sourceTenantId, transferId, productId, qty, satuanTransfer, qtyInput, rasio, item.catatan || null]
      );
    }

    await conn.commit();
    return { transferId, noTransfer, status: 'PENDING', isIntercompany: Boolean(isIntercompany) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Terbitkan otomatis SO + DO + AR + Jurnal (PT Asal) dan PO + AP + Jurnal (PT Tujuan) untuk Transfer Lintas PT
const generateIntercompanyDocuments = async (conn, { transfer, detailMoves, userId }) => {
  const sourceTenantId = Number(transfer.from_tenant_id || transfer.tenant_id);
  const destTenantId = Number(transfer.to_tenant_id);
  const tgl = transfer.tanggal || new Date().toISOString().split('T')[0];
  const dueDateObj = new Date(tgl);
  dueDateObj.setDate(dueDateObj.getDate() + 30);
  const jatuhTempo = dueDateObj.toISOString().split('T')[0];

  const { customerId, tenant: destTenant } = await ensureIntercompanyCustomer(conn, sourceTenantId, destTenantId);
  const { supplierId, tenant: srcTenant } = await ensureIntercompanySupplier(conn, destTenantId, sourceTenantId);

  let totalNilai = 0;
  for (const dm of detailMoves) {
    const harga = Number(dm.product.harga) || 0;
    totalNilai += Number(dm.detail.qty) * harga;
  }
  totalNilai = Math.round(totalNilai * 100) / 100;

  // 1. PT Asal: Sales Order (CLOSED) + Detail
  const noSo = `SO-${transfer.no_transfer}`;
  const soId = await soModel.create(
    {
      tenantId: sourceTenantId,
      noSo,
      customerId,
      tanggalSo: tgl,
      terminHari: 30,
      jatuhTempo,
      status: 'CLOSED',
      keterangan: `Otomatis Transfer Lintas PT ${transfer.no_transfer} ke ${destTenant.nama_perusahaan}`,
      subtotal: totalNilai,
      diskonPersen: 0,
      diskonNominal: 0,
      pajakPersen: 0,
      pajakNominal: 0,
      totalHarga: totalNilai,
    },
    conn
  );

  for (const dm of detailMoves) {
    const harga = Number(dm.product.harga) || 0;
    const qtyBase = Number(dm.detail.qty);
    await soModel.createDetail(
      {
        tenantId: sourceTenantId,
        soId,
        kodeProduk: dm.product.kode_produk,
        qtyPesanan: qtyBase,
        hargaSatuan: harga,
        diskon: 0,
        diskonPersen: 0,
        subtotal: qtyBase * harga,
        qtyTerkirim: qtyBase,
        satuanOrder: dm.detail.satuan_transfer || dm.product.satuan || 'PCS',
        qtyOrder: dm.detail.qty_input ?? qtyBase,
        rasioPcs: Number(dm.detail.rasio_pcs) || 1,
      },
      conn
    );
  }

  // 2. PT Asal: Delivery Order (DELIVERED) + Outbound Transaction Record
  const noDo = `DO-${transfer.no_transfer}`;
  const doId = await doModel.create(
    {
      tenantId: sourceTenantId,
      noDo,
      soId,
      customerId,
      tanggalDo: tgl,
      status: 'DELIVERED',
    },
    conn
  );

  const trxOutId = await transactionModel.create(
    {
      tenantId: sourceTenantId,
      kodeTransaksi: `OUT-${transfer.no_transfer}`,
      tipeTransaksi: 'KELUAR',
      referensi: transfer.no_transfer,
      keterangan: `Pengiriman Lintas PT ${transfer.no_transfer} ke ${destTenant.nama_perusahaan}`,
      userId,
      warehouseId: transfer.from_warehouse_id,
      purchaseOrderId: null,
      deliveryOrderId: doId,
    },
    conn
  );

  for (const dm of detailMoves) {
    const rasio = Number(dm.detail.rasio_pcs) || 1;
    for (const ml of dm.movedLots) {
      const qOrd = rasio > 1 ? Math.round((ml.qtyTaken / rasio) * 100) / 100 : ml.qtyTaken;
      await doModel.createDetail(
        {
          tenantId: sourceTenantId,
          doId,
          nomorLot: ml.nomorLot,
          qtyKirim: ml.qtyTaken,
          qtyOrder: qOrd,
          satuanOrder: dm.detail.satuan_transfer || dm.product.satuan || 'PCS',
          rasioPcs: rasio,
        },
        conn
      );
      await transactionModel.createDetail(
        {
          tenantId: sourceTenantId,
          transactionId: trxOutId,
          nomorLot: ml.nomorLot,
          qty: ml.qtyTaken,
        },
        conn
      );
    }
  }

  // 3. PT Asal: Piutang (AR)
  await receivableModel.create(
    {
      tenantId: sourceTenantId,
      noTagihan: `AR-${transfer.no_transfer}`,
      soId,
      customerId,
      tanggal: tgl,
      jatuhTempo,
      totalTagihan: totalNilai,
      keterangan: `Piutang Transfer Lintas PT ${transfer.no_transfer} ke ${destTenant.nama_perusahaan}`,
    },
    conn
  );

  // 4. PT Tujuan: Purchase Order (COMPLETED) + Inbound Transaction Record
  const noPo = `PO-${transfer.no_transfer}`;
  const poId = await poModel.create(
    {
      tenantId: destTenantId,
      noPo,
      supplierId,
      tanggalPo: tgl,
      terminHari: 30,
      jatuhTempo,
      status: 'COMPLETED',
      keterangan: `Otomatis Penerimaan Lintas PT ${transfer.no_transfer} dari ${srcTenant.nama_perusahaan}`,
      subtotal: totalNilai,
      diskonPersen: 0,
      diskonNominal: 0,
      pajakPersen: 0,
      pajakNominal: 0,
      totalHarga: totalNilai,
    },
    conn
  );

  for (const dm of detailMoves) {
    const harga = Number(dm.product.harga) || 0;
    const qtyBase = Number(dm.detail.qty);
    await poModel.createDetail(
      {
        tenantId: destTenantId,
        poId,
        kodeProduk: dm.product.kode_produk,
        qtyPesan: qtyBase,
        hargaSatuan: harga,
        diskon: 0,
        diskonPersen: 0,
        subtotal: qtyBase * harga,
        qtyDiterima: qtyBase,
        satuanOrder: dm.detail.satuan_transfer || dm.product.satuan || 'PCS',
        qtyOrder: dm.detail.qty_input ?? qtyBase,
        rasioPcs: Number(dm.detail.rasio_pcs) || 1,
      },
      conn
    );
  }

  const trxInId = await transactionModel.create(
    {
      tenantId: destTenantId,
      kodeTransaksi: `IN-${transfer.no_transfer}`,
      tipeTransaksi: 'MASUK',
      referensi: transfer.no_transfer,
      keterangan: `Penerimaan Lintas PT ${transfer.no_transfer} dari ${srcTenant.nama_perusahaan}`,
      userId,
      warehouseId: transfer.to_warehouse_id,
      purchaseOrderId: poId,
      deliveryOrderId: null,
    },
    conn
  );

  for (const dm of detailMoves) {
    for (const ml of dm.movedLots) {
      await transactionModel.createDetail(
        {
          tenantId: destTenantId,
          transactionId: trxInId,
          nomorLot: ml.nomorLot,
          qty: ml.qtyTaken,
        },
        conn
      );
    }
  }

  // 5. PT Tujuan: Utang (AP)
  await payableModel.create(
    {
      tenantId: destTenantId,
      noTagihan: `AP-${transfer.no_transfer}`,
      poId,
      supplierId,
      tanggal: tgl,
      jatuhTempo,
      totalTagihan: totalNilai,
      keterangan: `Utang Transfer Lintas PT ${transfer.no_transfer} dari ${srcTenant.nama_perusahaan}`,
    },
    conn
  );

  // 6. Jurnal Akuntansi At Cost untuk kedua PT
  if (totalNilai > 0) {
    await ensureTenantDefaultAccounts(conn, sourceTenantId);
    const srcAr = await accountingModel.getAccountIdByKode('1-1010', conn, sourceTenantId);
    const srcInv = await accountingModel.getAccountIdByKode('1-1020', conn, sourceTenantId);
    if (srcAr && srcInv) {
      await accountingModel.postJournal(
        {
          tenantId: sourceTenantId,
          tanggal: tgl,
          tipeReferensi: 'MANUAL',
          referensiId: transfer.id,
          noReferensi: transfer.no_transfer,
          keterangan: `Jurnal Piutang Transfer Lintas PT ${transfer.no_transfer} ke ${destTenant.nama_perusahaan}`,
          createdBy: userId,
          lines: [
            { accountId: srcAr.id, debit: totalNilai, credit: 0, keterangan: `Piutang Antar-PT (${noDo})` },
            { accountId: srcInv.id, debit: 0, credit: totalNilai, keterangan: `Pengeluaran Persediaan Lintas PT (${noDo})` },
          ],
        },
        conn
      );
    }

    await ensureTenantDefaultAccounts(conn, destTenantId);
    const dstInv = await accountingModel.getAccountIdByKode('1-1020', conn, destTenantId);
    const dstAp = await accountingModel.getAccountIdByKode('2-1001', conn, destTenantId);
    if (dstInv && dstAp) {
      await accountingModel.postJournal(
        {
          tenantId: destTenantId,
          tanggal: tgl,
          tipeReferensi: 'MANUAL',
          referensiId: transfer.id,
          noReferensi: transfer.no_transfer,
          keterangan: `Jurnal Penerimaan Transfer Lintas PT ${transfer.no_transfer} dari ${srcTenant.nama_perusahaan}`,
          createdBy: userId,
          lines: [
            { accountId: dstInv.id, debit: totalNilai, credit: 0, keterangan: `Persediaan Masuk Lintas PT (${noPo})` },
            { accountId: dstAp.id, debit: 0, credit: totalNilai, keterangan: `Utang Antar-PT (${noPo})` },
          ],
        },
        conn
      );
    }
  }

  return { soId, doId, poId, noSo, noDo, noPo, totalNilai };
};

// Approval Transfer Antar Gudang (eksekusi pemindahan stok fisik & mutasi kartu stok + dokumen Lintas PT)
const approveWarehouseTransfer = async (transferId, userId, tenantId = null, reqUser = null) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [rows] = await conn.query(
      `SELECT wt.*, w1.tenant_id AS from_tenant_id, w2.tenant_id AS to_tenant_id,
              t2.nama_perusahaan AS to_tenant_nama
       FROM warehouse_transfers wt
       JOIN warehouses w1 ON wt.from_warehouse_id = w1.id
       JOIN warehouses w2 ON wt.to_warehouse_id = w2.id
       LEFT JOIN tenants t2 ON w2.tenant_id = t2.id
       WHERE wt.id = ?
         AND (? IS NULL OR wt.tenant_id = ? OR w1.tenant_id = ? OR w2.tenant_id = ?)
       FOR UPDATE`,
      [transferId, tenantId, tenantId, tenantId, tenantId]
    );
    if (rows.length === 0) throw new ApiError(404, 'Dokumen transfer gudang tidak ditemukan.');
    const transfer = rows[0];

    await assertCanApproveTransfer(conn, transfer, reqUser);

    if (transfer.status !== 'PENDING') {
      throw new ApiError(400, `Transfer "${transfer.no_transfer}" berstatus ${transfer.status} dan tidak dapat disetujui.`);
    }

    const [details] = await conn.query(
      'SELECT * FROM warehouse_transfer_details WHERE transfer_id = ?',
      [transferId]
    );
    if (details.length === 0) {
      throw new Error('Detail barang transfer tidak ditemukan.');
    }

    const sourceTenantId = Number(transfer.from_tenant_id || transfer.tenant_id || 1);
    const destTenantId = Number(transfer.to_tenant_id || transfer.to_tenant_id === 0 ? transfer.to_tenant_id : sourceTenantId);
    const isIntercompany = sourceTenantId !== destTenantId;

    const detailMoves = [];
    for (const d of details) {
      const moveRes = await executeTransferItemMove(conn, {
        transfer,
        productId: Number(d.product_id),
        qty: Number(d.qty),
        sourceTenantId,
        destTenantId,
      });
      detailMoves.push({ detail: d, ...moveRes });
    }

    let docRefs = null;
    if (isIntercompany) {
      docRefs = await generateIntercompanyDocuments(conn, {
        transfer: { ...transfer, from_tenant_id: sourceTenantId, to_tenant_id: destTenantId },
        detailMoves,
        userId,
      });
    }

    await conn.query(
      `UPDATE warehouse_transfers
       SET status = 'COMPLETED', approved_by = ?, approved_at = NOW(),
           so_id = COALESCE(?, so_id), do_id = COALESCE(?, do_id), po_id = COALESCE(?, po_id)
       WHERE id = ?`,
      [userId, docRefs?.soId || null, docRefs?.doId || null, docRefs?.poId || null, transferId]
    );

    await conn.commit();
    return {
      transferId,
      noTransfer: transfer.no_transfer,
      status: 'COMPLETED',
      isIntercompany,
      ...(docRefs || {}),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Tolak (Reject) Pengajuan Transfer Antar Gudang
const rejectWarehouseTransfer = async (transferId, reason, userId, tenantId = null, reqUser = null) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [rows] = await conn.query(
      `SELECT wt.*, w1.tenant_id AS from_tenant_id, w2.tenant_id AS to_tenant_id,
              t2.nama_perusahaan AS to_tenant_nama
       FROM warehouse_transfers wt
       JOIN warehouses w1 ON wt.from_warehouse_id = w1.id
       JOIN warehouses w2 ON wt.to_warehouse_id = w2.id
       LEFT JOIN tenants t2 ON w2.tenant_id = t2.id
       WHERE wt.id = ?
         AND (? IS NULL OR wt.tenant_id = ? OR w1.tenant_id = ? OR w2.tenant_id = ?)
       FOR UPDATE`,
      [transferId, tenantId, tenantId, tenantId, tenantId]
    );
    if (rows.length === 0) throw new ApiError(404, 'Dokumen transfer gudang tidak ditemukan.');
    const transfer = rows[0];

    await assertCanApproveTransfer(conn, transfer, reqUser);

    if (transfer.status !== 'PENDING') {
      throw new ApiError(400, `Transfer "${transfer.no_transfer}" berstatus ${transfer.status} dan tidak dapat ditolak.`);
    }

    await conn.query(
      `UPDATE warehouse_transfers
       SET status = 'REJECTED', approved_by = ?, approved_at = NOW(), rejected_reason = ?
       WHERE id = ?`,
      [userId, (reason || '').trim() || 'Ditolak oleh approver', transferId]
    );

    await conn.commit();
    return { transferId, noTransfer: transfer.no_transfer, status: 'REJECTED' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ============================================================================
// 2. MANAJEMEN BATCH / LOT & EXPIRED DATE (FEFO)
// ============================================================================
const findAllLotsWithExpiry = async ({ tenantId = null, search, status, warehouseId, expiringWithinDays, kode_produk } = {}) => {
  let sql = `
    SELECT pl.*, p.nama_produk, COALESCE(p.kategori_produk, 'BARANG_JADI') AS kategori_produk,
           p.satuan, p.satuan_besar, p.satuan_menengah, p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan, p.barcode_kemasan, p.harga, p.metode_stok, w.nama_gudang, w.kode_gudang,
           DATEDIFF(pl.expired_date, CURRENT_DATE) AS days_to_expire
    FROM product_lots pl
    JOIN products p ON pl.kode_produk = p.kode_produk AND pl.tenant_id = p.tenant_id
    LEFT JOIN warehouses w ON pl.warehouse_id = w.id
    WHERE (? IS NULL OR pl.tenant_id = ?)
  `;
  const params = [tenantId, tenantId];

  if (kode_produk) {
    sql += ' AND pl.kode_produk = ?';
    params.push(kode_produk);
  }
  if (search) {
    sql += ' AND (pl.nomor_lot LIKE ? OR pl.kode_produk LIKE ? OR p.nama_produk LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status && status !== 'ALL') {
    if (status === 'EXPIRED') {
      sql += ' AND (pl.status = "EXPIRED" OR (pl.expired_date IS NOT NULL AND pl.expired_date < CURRENT_DATE))';
    } else if (status === 'EXPIRING_SOON') {
      sql += ' AND pl.status != "QUARANTINE" AND (pl.status = "EXPIRING_SOON" OR (pl.expired_date IS NOT NULL AND pl.expired_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 90 DAY)))';
    } else {
      sql += ' AND pl.status = ?';
      params.push(status);
    }
  }
  if (warehouseId && warehouseId !== 'ALL') {
    sql += ' AND pl.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (expiringWithinDays) {
    sql += ' AND pl.expired_date IS NOT NULL AND pl.expired_date <= DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)';
    params.push(Number(expiringWithinDays));
  }

  sql += ' ORDER BY pl.expired_date ASC, pl.stok_qty DESC';
  const [rows] = await pool.query(sql, params);

  return rows.map((r) => {
    const days = r.days_to_expire !== undefined && r.days_to_expire !== null ? Number(r.days_to_expire) : null;
    let autoStatus = r.status || 'AVAILABLE';
    if (days !== null) {
      if (days < 0) autoStatus = 'EXPIRED';
      else if (days <= 90 && autoStatus !== 'QUARANTINE') autoStatus = 'EXPIRING_SOON';
    }
    return {
      ...r,
      metode_stok: (r.metode_stok || 'FIFO').toUpperCase(),
      days_to_expire: days,
      effective_status: autoStatus,
      is_expired: days !== null && days < 0,
      is_expiring_soon: days !== null && days >= 0 && days <= 90,
    };
  });
};

const createLot = async (data, userTenantId = 1) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { kode_produk, nomor_lot, tanggal_produksi, expired_date, shift = 1, warehouse_id = 1, stok_qty = 0, status = 'AVAILABLE', keterangan } = data;

    const [existing] = await conn.query('SELECT id FROM product_lots WHERE (tenant_id = ? OR tenant_id IS NULL) AND nomor_lot = ? LIMIT 1', [userTenantId, nomor_lot]);
    if (existing.length > 0) {
      const { ApiError } = require('../middleware/errorHandler');
      throw new ApiError(400, `Nomor lot "${nomor_lot}" sudah terdaftar dalam sistem.`);
    }

    const [res] = await conn.query(
      `INSERT INTO product_lots (tenant_id, kode_produk, nomor_lot, tanggal_produksi, expired_date, shift, warehouse_id, stok_qty, status, keterangan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userTenantId || 1, kode_produk, nomor_lot, tanggal_produksi, expired_date, shift, warehouse_id, stok_qty, status, keterangan || null]
    );

    if (Number(stok_qty) > 0) {
      await conn.query(
        `INSERT INTO stock_mutations (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
         VALUES (?, NOW(), ?, ?, ?, 'MASUK', ?, ?, ?)`,
        [userTenantId || 1, kode_produk, nomor_lot, warehouse_id, stok_qty, stok_qty, `PENDAFTARAN BATCH LOT (${nomor_lot})`]
      );
    }

    await conn.commit();
    return res.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateLotStatus = async (id, status) => {
  await pool.query('UPDATE product_lots SET status = ? WHERE id = ?', [status, id]);
};

// ============================================================================
// 3. STOK OPNAME & STOCK ADJUSTMENT (PENYESUAIAN STOK FISIK)
// ============================================================================
const findAllStockAdjustments = async (tenantId = null, warehouseId = null) => {
  const [rows] = await pool.query(
    `SELECT sa.*, w.nama_gudang, w.kode_gudang, u.nama_lengkap AS created_by_name
     FROM stock_adjustments sa
     JOIN warehouses w ON sa.warehouse_id = w.id
     LEFT JOIN users u ON sa.created_by = u.id
     WHERE (? IS NULL OR sa.tenant_id = ?)
       AND (? IS NULL OR sa.warehouse_id = ?)
     ORDER BY sa.tanggal DESC, sa.id DESC`,
    [tenantId, tenantId, warehouseId, warehouseId]
  );

  if (rows.length === 0) return [];
  const adjIds = rows.map((r) => r.id);

  const [details] = await pool.query(
    `SELECT sad.*, p.kode_produk, p.nama_produk, p.satuan, p.satuan_menengah, p.satuan_besar, p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan
     FROM stock_adjustment_details sad
     JOIN products p ON sad.product_id = p.id
     WHERE sad.adjustment_id IN (?)`,
    [adjIds]
  );

  const detailMap = new Map();
  for (const d of details) {
    if (!detailMap.has(d.adjustment_id)) detailMap.set(d.adjustment_id, []);
    detailMap.get(d.adjustment_id).push(d);
  }

  return rows.map((r) => ({
    ...r,
    items: detailMap.get(r.id) || [],
  }));
};

const createStockAdjustment = async (data, userId, userTenantId = 1) => {
  const { warehouse_id, tanggal, tipe_adjustment, catatan, items } = data;
  if (!items || items.length === 0) throw new Error('Minimal harus ada 1 item penyesuaian stok opname.');

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const noAdj = `ADJ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalSelisihNominal = 0;
    const detailRows = [];

    for (const item of items) {
      const productId = Number(item.product_id);
      const [prods] = await conn.query('SELECT kode_produk, nama_produk, harga FROM products WHERE id = ?', [productId]);
      if (prods.length === 0) continue;

      const prod = prods[0];
      const stokFisik = Number(item.stok_fisik);
      
      const [lotRows] = await conn.query(
        'SELECT COALESCE(SUM(stok_qty), 0) AS total_stok FROM product_lots WHERE kode_produk = ? AND warehouse_id = ?',
        [prod.kode_produk, warehouse_id]
      );
      const stokSistem = Number(lotRows[0].total_stok);
      const selisihQty = stokFisik - stokSistem;
      const hargaSatuan = Number(item.harga_satuan || prod.harga || 0);
      const selisihNominal = selisihQty * hargaSatuan;

      totalSelisihNominal += selisihNominal;

      if (selisihQty > 0) {
        const [existLots] = await conn.query(
          'SELECT id FROM product_lots WHERE kode_produk = ? AND warehouse_id = ? ORDER BY id DESC LIMIT 1',
          [prod.kode_produk, warehouse_id]
        );
        if (existLots.length > 0) {
          await conn.query('UPDATE product_lots SET stok_qty = stok_qty + ? WHERE id = ?', [selisihQty, existLots[0].id]);
        } else {
          await conn.query(
            `INSERT INTO product_lots (tenant_id, kode_produk, nomor_lot, tanggal_produksi, expired_date, shift, warehouse_id, stok_qty, status)
             VALUES (?, ?, ?, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 2 YEAR), 1, ?, ?, 'AVAILABLE')`,
            [userTenantId || 1, prod.kode_produk, `LOT-OPN-${Date.now().toString().slice(-4)}-${productId}`, warehouse_id, selisihQty]
          );
        }
      } else if (selisihQty < 0) {
        let toDeduct = Math.abs(selisihQty);
        const metode = (prod.metode_stok || 'FIFO').toUpperCase();
        let lotSort = 'ORDER BY tanggal_produksi ASC, created_at ASC, id ASC';
        if (metode === 'FEFO') {
          lotSort = 'ORDER BY (expired_date IS NULL) ASC, expired_date ASC, tanggal_produksi ASC, id ASC';
        }
        const [lots] = await conn.query(
          `SELECT id, stok_qty FROM product_lots WHERE kode_produk = ? AND warehouse_id = ? AND stok_qty > 0 ${lotSort}`,
          [prod.kode_produk, warehouse_id]
        );
        for (const lot of lots) {
          if (toDeduct <= 0) break;
          const deduct = Math.min(lot.stok_qty, toDeduct);
          await conn.query('UPDATE product_lots SET stok_qty = stok_qty - ? WHERE id = ?', [deduct, lot.id]);
          toDeduct -= deduct;
        }
      }

      detailRows.push({
        productId,
        stokSistem,
        stokFisik,
        selisihQty,
        hargaSatuan,
        selisihNominal,
        catatan: item.catatan,
      });
    }

    let journalId = null;
    const absNominal = Math.abs(totalSelisihNominal);

    if (absNominal > 0) {
      const accInventory = await accountingModel.getAccountIdByKode('1-1020', conn, userTenantId || 1);
      const accExpenseAdj = await accountingModel.getAccountIdByKode('6-1030', conn, userTenantId || 1);
      const accRevenueAdj = await accountingModel.getAccountIdByKode('4-2001', conn, userTenantId || 1);

      const journalLines = [];
      if (totalSelisihNominal < 0) {
        journalLines.push(
          { accountId: accExpenseAdj.id, debit: absNominal, credit: 0, keterangan: `Penyesuaian Opname Berkurang (${noAdj})` },
          { accountId: accInventory.id, debit: 0, credit: absNominal, keterangan: `Pengurangan Nilai Persediaan (${noAdj})` }
        );
      } else {
        journalLines.push(
          { accountId: accInventory.id, debit: absNominal, credit: 0, keterangan: `Penambahan Nilai Persediaan (${noAdj})` },
          { accountId: accRevenueAdj.id, debit: 0, credit: absNominal, keterangan: `Koreksi Fisik Lebih Opname (${noAdj})` }
        );
      }

      journalId = await accountingModel.postJournal(
        {
          tenantId: userTenantId,
          tanggal,
          tipeReferensi: 'MANUAL',
          noReferensi: noAdj,
          keterangan: `Jurnal Stok Opname Fisik Gudang (${tipe_adjustment}) ${noAdj}`,
          createdBy: userId,
          lines: journalLines,
        },
        conn
      );
    }

    const [adjRes] = await conn.query(
      `INSERT INTO stock_adjustments (tenant_id, no_adjustment, warehouse_id, tanggal, tipe_adjustment, status, total_selisih_nominal, journal_id, catatan, created_by)
       VALUES (?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?)`,
      [userTenantId || 1, noAdj, warehouse_id, tanggal, tipe_adjustment, totalSelisihNominal, journalId, catatan || null, userId]
    );
    const adjustmentId = adjRes.insertId;

    for (const d of detailRows) {
      await conn.query(
        `INSERT INTO stock_adjustment_details (tenant_id, adjustment_id, product_id, stok_sistem, stok_fisik, selisih_qty, harga_satuan, selisih_nominal, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userTenantId || 1, adjustmentId, d.productId, d.stokSistem, d.stokFisik, d.selisihQty, d.hargaSatuan, d.selisihNominal, d.catatan || null]
      );

      if (d.selisihQty > 0) {
        await conn.query(
          `INSERT INTO stock_mutations (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
           VALUES (?, NOW(), (SELECT kode_produk FROM products WHERE id = ?), 'OPNAME', ?, 'ADJUSTMENT_MASUK', ?, ?, ?)`,
          [userTenantId || 1, d.productId, warehouse_id, d.selisihQty, d.stokFisik, noAdj]
        );
      } else if (d.selisihQty < 0) {
        await conn.query(
          `INSERT INTO stock_mutations (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
           VALUES (?, NOW(), (SELECT kode_produk FROM products WHERE id = ?), 'OPNAME', ?, 'ADJUSTMENT_KELUAR', ?, ?, ?)`,
          [userTenantId || 1, d.productId, warehouse_id, Math.abs(d.selisihQty), d.stokFisik, noAdj]
        );
      }
    }

    await conn.commit();
    return { adjustmentId, noAdj, totalSelisihNominal, journalId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ============================================================================
// 4. PENAWARAN HARGA (SALES QUOTATION / SQ)
// ============================================================================
const findAllQuotations = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT sq.*, c.nama_customer, c.kode_customer, c.alamat_pengiriman AS alamat_customer, c.telepon AS telepon_customer,
            u.nama_lengkap AS created_by_name
     FROM sales_quotations sq
     LEFT JOIN customers c ON sq.customer_id = c.id
     LEFT JOIN users u ON sq.created_by = u.id
     WHERE (? IS NULL OR sq.tenant_id = ?)
     ORDER BY sq.tanggal DESC, sq.id DESC`,
    [tenantId, tenantId]
  );

  if (rows.length === 0) return [];
  const qIds = rows.map((r) => r.id);

  const [details] = await pool.query(
    `SELECT sqd.*, p.kode_produk, p.nama_produk, p.satuan, p.satuan_besar, p.satuan_menengah, p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan
     FROM sales_quotation_details sqd
     JOIN products p ON sqd.product_id = p.id
     WHERE sqd.quotation_id IN (?)`,
    [qIds]
  );

  const detailMap = new Map();
  for (const d of details) {
    if (!detailMap.has(d.quotation_id)) detailMap.set(d.quotation_id, []);
    detailMap.get(d.quotation_id).push(d);
  }

  return rows.map((r) => ({
    ...r,
    items: detailMap.get(r.id) || [],
  }));
};

const createQuotation = async (data, userId, userTenantId = 1) => {
  const { customer_id, tanggal, berlaku_sampai, termin_pembayaran, items, catatan, pajak_persen = 11, diskon_nominal = 0 } = data;
  if (!items || items.length === 0) throw new Error('Minimal harus ada 1 barang dalam penawaran harga.');

  let subtotal = 0;
  for (const item of items) {
    const itemSub = Number(item.qty) * Number(item.harga_satuan) - Number(item.diskon_nominal || 0);
    subtotal += Math.max(0, itemSub);
  }

  const dNominal = Number(diskon_nominal || 0);
  const afterDiscount = Math.max(0, subtotal - dNominal);
  const pNominal = Math.round((afterDiscount * Number(pajak_persen || 0)) / 100);
  const grandTotal = afterDiscount + pNominal;

  const noQuotation = `SQ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const [res] = await conn.query(
      `INSERT INTO sales_quotations (tenant_id, no_quotation, customer_id, tanggal, berlaku_sampai, termin_pembayaran, subtotal, diskon_nominal, pajak_persen, pajak_nominal, grand_total, status, catatan, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [userTenantId || 1, noQuotation, customer_id, tanggal, berlaku_sampai, termin_pembayaran || 'NET 30', subtotal, dNominal, pajak_persen, pNominal, grandTotal, catatan || null, userId]
    );
    const quotationId = res.insertId;

    for (const item of items) {
      const itemSub = Number(item.qty) * Number(item.harga_satuan) - Number(item.diskon_nominal || 0);
      await conn.query(
        `INSERT INTO sales_quotation_details (tenant_id, quotation_id, product_id, qty, harga_satuan, diskon_nominal, subtotal, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userTenantId || 1, quotationId, item.product_id, item.qty, item.harga_satuan, item.diskon_nominal || 0, Math.max(0, itemSub), item.catatan || null]
      );
    }

    await conn.commit();
    return { quotationId, noQuotation, grandTotal };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateQuotationStatus = async (id, status) => {
  await pool.query('UPDATE sales_quotations SET status = ? WHERE id = ?', [status, id]);
};

const convertQuotationToSO = async (quotationId, userId, userTenantId = 1) => {
  const [qRows] = await pool.query('SELECT * FROM sales_quotations WHERE id = ?', [quotationId]);
  if (qRows.length === 0) throw new Error('Penawaran harga tidak ditemukan.');
  const sq = qRows[0];

  if (sq.status === 'CONVERTED_TO_SO') {
    throw new Error('Penawaran harga ini sudah pernah dikonversi menjadi Sales Order.');
  }

  const [details] = await pool.query(
    `SELECT sqd.*, p.kode_produk 
     FROM sales_quotation_details sqd 
     JOIN products p ON sqd.product_id = p.id 
     WHERE sqd.quotation_id = ?`,
    [quotationId]
  );

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const noSo = `SO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const terminHari = sq.termin_pembayaran === 'NET 14' ? 14 : sq.termin_pembayaran === 'NET 60' ? 60 : 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + terminHari);
    const jatuhTempo = dueDate.toISOString().split('T')[0];

    const soId = await soModel.create(
      {
        tenantId: userTenantId || sq.tenant_id || 1,
        noSo,
        customerId: sq.customer_id,
        tanggalSo: new Date().toISOString().split('T')[0],
        terminHari,
        jatuhTempo,
        status: 'OPEN',
        keterangan: `Dikonversi dari Penawaran ${sq.no_quotation}`,
        subtotal: sq.subtotal,
        diskonPersen: 0,
        diskonNominal: sq.diskon_nominal,
        pajakPersen: sq.pajak_persen,
        pajakNominal: sq.pajak_nominal,
        totalHarga: sq.grand_total,
      },
      conn
    );

    for (const d of details) {
      await soModel.createDetail(
        {
          tenantId: userTenantId || sq.tenant_id || 1,
          soId,
          kodeProduk: d.kode_produk,
          qtyPesanan: d.qty,
          hargaSatuan: d.harga_satuan,
          diskon: d.diskon_nominal || 0,
          subtotal: d.subtotal,
          qtyTerkirim: 0,
        },
        conn
      );
    }

    await receivableModel.create(
      {
        tenantId: userTenantId || sq.tenant_id || 1,
        noTagihan: `AR-${noSo}`,
        soId,
        customerId: sq.customer_id,
        tanggal: new Date().toISOString().split('T')[0],
        jatuhTempo,
        totalTagihan: sq.grand_total,
        keterangan: `Faktur Piutang otomatis dari konversi Quotation ${sq.no_quotation}`,
      },
      conn
    );

    const targetTenant = userTenantId || sq.tenant_id || 1;
    const accAr = await accountingModel.getAccountIdByKode('1-1010', conn, targetTenant);
    const accSales = await accountingModel.getAccountIdByKode('4-1001', conn, targetTenant);
    const accPpnOut = await accountingModel.getAccountIdByKode('2-1002', conn, targetTenant);

    if (accAr && accSales && Number(sq.grand_total) > 0) {
      const journalLines = [
        { accountId: accAr.id, debit: Number(sq.grand_total), credit: 0, keterangan: `Piutang Dagang konversi ${noSo}` },
      ];
      if (Number(sq.pajak_nominal) > 0 && accPpnOut) {
        journalLines.push({ accountId: accSales.id, debit: 0, credit: Number(sq.subtotal) - Number(sq.diskon_nominal), keterangan: `Penjualan Barang konversi ${noSo}` });
        journalLines.push({ accountId: accPpnOut.id, debit: 0, credit: Number(sq.pajak_nominal), keterangan: `PPN Keluaran konversi ${noSo}` });
      } else {
        journalLines.push({ accountId: accSales.id, debit: 0, credit: Number(sq.grand_total), keterangan: `Penjualan Barang konversi ${noSo}` });
      }

      await accountingModel.postJournal(
        {
          tenantId: userTenantId || sq.tenant_id || 1,
          tanggal: new Date().toISOString().split('T')[0],
          tipeReferensi: 'MANUAL',
          noReferensi: noSo,
          keterangan: `Jurnal Otomatis Penjualan SO ${noSo} (Penawaran ${sq.no_quotation})`,
          createdBy: userId,
          lines: journalLines,
        },
        conn
      );
    }

    await conn.query('UPDATE sales_quotations SET status = \'CONVERTED_TO_SO\', so_id = ? WHERE id = ?', [soId, quotationId]);

    await conn.commit();
    return { soId, noSO: noSo, noQuotation: sq.no_quotation };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ============================================================================
// 5. RETUR PEMBELIAN (PURCHASE RETURN) & RETUR PENJUALAN (SALES RETURN)
// ============================================================================
const findAllPurchaseReturns = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT pr.*, s.nama_supplier, s.kode_supplier, w.nama_gudang,
            u.nama_lengkap AS created_by_name
     FROM purchase_returns pr
     LEFT JOIN suppliers s ON pr.supplier_id = s.id
     LEFT JOIN warehouses w ON pr.warehouse_id = w.id
     LEFT JOIN users u ON pr.created_by = u.id
     WHERE (? IS NULL OR pr.tenant_id = ?)
     ORDER BY pr.tanggal DESC, pr.id DESC`,
    [tenantId, tenantId]
  );

  if (rows.length === 0) return [];
  const rIds = rows.map((r) => r.id);

  const [details] = await pool.query(
    `SELECT prd.*, p.kode_produk, p.nama_produk, p.satuan
     FROM purchase_return_details prd
     JOIN products p ON prd.product_id = p.id
     WHERE prd.return_id IN (?)`,
    [rIds]
  );

  const detailMap = new Map();
  for (const d of details) {
    if (!detailMap.has(d.return_id)) detailMap.set(d.return_id, []);
    detailMap.get(d.return_id).push(d);
  }

  return rows.map((r) => ({
    ...r,
    items: detailMap.get(r.id) || [],
  }));
};

const createPurchaseReturn = async (data, userId, userTenantId = 1) => {
  const { supplier_id, warehouse_id, po_id, tanggal, alasan_retur, tipe_penyelesaian = 'POTONG_UTANG', items } = data;
  if (!items || items.length === 0) throw new Error('Minimal harus ada 1 barang untuk diretur ke supplier.');

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const noReturn = `PR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalNominal = 0;
    const detailRows = [];

    for (const item of items) {
      const productId = Number(item.product_id);
      const qty = Number(item.qty);
      const hargaSatuan = Number(item.harga_satuan);
      const subtotal = qty * hargaSatuan;
      totalNominal += subtotal;

      const [prods] = await conn.query('SELECT kode_produk, nama_produk, metode_stok FROM products WHERE id = ?', [productId]);
      if (prods.length === 0) continue;
      const kodeProduk = prods[0].kode_produk;
      const metode = (prods[0].metode_stok || 'FIFO').toUpperCase();

      let lotSort = 'ORDER BY tanggal_produksi ASC, created_at ASC, id ASC';
      if (metode === 'FEFO') {
        lotSort = 'ORDER BY (expired_date IS NULL) ASC, expired_date ASC, tanggal_produksi ASC, id ASC';
      }

      let toDeduct = qty;
      const [lots] = await conn.query(
        `SELECT id, stok_qty FROM product_lots WHERE kode_produk = ? AND warehouse_id = ? AND stok_qty > 0 ${lotSort}`,
        [kodeProduk, warehouse_id]
      );
      for (const lot of lots) {
        if (toDeduct <= 0) break;
        const deduct = Math.min(lot.stok_qty, toDeduct);
        await conn.query('UPDATE product_lots SET stok_qty = stok_qty - ? WHERE id = ?', [deduct, lot.id]);
        toDeduct -= deduct;
      }

      detailRows.push({ productId, qty, hargaSatuan, subtotal, catatan: item.catatan });
    }

    let journalId = null;
    if (totalNominal > 0) {
      const accAP = await accountingModel.getAccountIdByKode('2-1001', conn, userTenantId || 1);
      const accCash = await accountingModel.getAccountIdByKode('1-1001', conn, userTenantId || 1);
      const accInventory = await accountingModel.getAccountIdByKode('1-1020', conn, userTenantId || 1);

      const debitAcc = tipe_penyelesaian === 'PENGEMBALIAN_KAS' ? accCash : accAP;

      journalId = await accountingModel.postJournal(
        {
          tenantId: userTenantId || 1,
          tanggal,
          tipeReferensi: 'MANUAL',
          noReferensi: noReturn,
          keterangan: `Retur Pembelian ke Supplier (${noReturn}) - ${alasan_retur || 'Barang Rusak/Tidak Sesuai'}`,
          createdBy: userId,
          lines: [
            { accountId: debitAcc.id, debit: totalNominal, credit: 0, keterangan: `Pengurangan Kewajiban / Terima Refund (${noReturn})` },
            { accountId: accInventory.id, debit: 0, credit: totalNominal, keterangan: `Pengurangan Persediaan Barang Diretur (${noReturn})` },
          ],
        },
        conn
      );

      if (tipe_penyelesaian === 'POTONG_UTANG') {
        const [apRows] = await conn.query(
          'SELECT id, sisa_utang FROM accounts_payable WHERE supplier_id = ? AND sisa_utang > 0 AND tenant_id = ? ORDER BY jatuh_tempo ASC',
          [supplier_id, userTenantId || 1]
        );
        let remDeduct = totalNominal;
        for (const ap of apRows) {
          if (remDeduct <= 0) break;
          const ded = Math.min(Number(ap.sisa_utang), remDeduct);
          const newSisa = Number(ap.sisa_utang) - ded;
          await conn.query(
            `UPDATE accounts_payable SET sisa_utang = ?, status = ? WHERE id = ?`,
            [newSisa, newSisa <= 0 ? 'LUNAS' : 'SEBAGIAN', ap.id]
          );
          remDeduct -= ded;
        }
      }
    }

    const [res] = await conn.query(
      `INSERT INTO purchase_returns (tenant_id, no_return, po_id, supplier_id, warehouse_id, tanggal, total_nominal, alasan_retur, tipe_penyelesaian, status, journal_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
      [userTenantId || 1, noReturn, po_id || null, supplier_id, warehouse_id, tanggal, totalNominal, alasan_retur || null, tipe_penyelesaian, journalId, userId]
    );
    const returnId = res.insertId;

    for (const d of detailRows) {
      await conn.query(
        `INSERT INTO purchase_return_details (tenant_id, return_id, product_id, qty, harga_satuan, subtotal, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userTenantId || 1, returnId, d.productId, d.qty, d.hargaSatuan, d.subtotal, d.catatan || null]
      );
      await conn.query(
        `INSERT INTO stock_mutations (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
         VALUES (?, NOW(), (SELECT kode_produk FROM products WHERE id = ?), 'RETUR_BELI', ?, 'RETUR_BELI', ?, 0, ?)`,
        [userTenantId || 1, d.productId, warehouse_id, d.qty, noReturn]
      );
    }

    await conn.commit();
    return { returnId, noReturn, totalNominal, journalId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const findAllSalesReturns = async (tenantId = null) => {
  const [rows] = await pool.query(
    `SELECT sr.*, c.nama_customer, c.kode_customer, w.nama_gudang,
            u.nama_lengkap AS created_by_name
     FROM sales_returns sr
     LEFT JOIN customers c ON sr.customer_id = c.id
     LEFT JOIN warehouses w ON sr.warehouse_id = w.id
     LEFT JOIN users u ON sr.created_by = u.id
     WHERE (? IS NULL OR sr.tenant_id = ?)
     ORDER BY sr.tanggal DESC, sr.id DESC`,
    [tenantId, tenantId]
  );

  if (rows.length === 0) return [];
  const rIds = rows.map((r) => r.id);

  const [details] = await pool.query(
    `SELECT srd.*, p.kode_produk, p.nama_produk, p.satuan, p.satuan_besar, p.satuan_menengah, p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan
     FROM sales_return_details srd
     JOIN products p ON srd.product_id = p.id
     WHERE srd.return_id IN (?)`,
    [rIds]
  );

  const detailMap = new Map();
  for (const d of details) {
    if (!detailMap.has(d.return_id)) detailMap.set(d.return_id, []);
    detailMap.get(d.return_id).push(d);
  }

  return rows.map((r) => ({
    ...r,
    items: detailMap.get(r.id) || [],
  }));
};

const createSalesReturn = async (data, userId, userTenantId = 1) => {
  const { customer_id, warehouse_id, so_id, tanggal, alasan_retur, tipe_penyelesaian = 'POTONG_PIUTANG', kembali_ke_stok = true, items } = data;
  if (!items || items.length === 0) throw new Error('Minimal harus ada 1 barang untuk diretur.');

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const noReturn = `SR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalNominal = 0;
    const detailRows = [];

    for (const item of items) {
      const productId = Number(item.product_id);
      const qty = Number(item.qty);
      const hargaSatuan = Number(item.harga_satuan);
      const subtotal = qty * hargaSatuan;
      totalNominal += subtotal;

      const [prods] = await conn.query('SELECT kode_produk, nama_produk, harga FROM products WHERE id = ?', [productId]);
      if (prods.length === 0) continue;
      const kodeProduk = prods[0].kode_produk;

      let lotNomor = 'RETUR_JUAL';
      let sisaStok = qty;

      if (kembali_ke_stok) {
        const [lots] = await conn.query(
          'SELECT id, nomor_lot, stok_qty FROM product_lots WHERE kode_produk = ? AND warehouse_id = ? ORDER BY id DESC LIMIT 1',
          [kodeProduk, warehouse_id]
        );
        if (lots.length > 0) {
          lotNomor = lots[0].nomor_lot;
          sisaStok = Number(lots[0].stok_qty) + qty;
          await conn.query('UPDATE product_lots SET stok_qty = stok_qty + ? WHERE id = ?', [qty, lots[0].id]);
        } else {
          lotNomor = `LOT-RET-${Date.now().toString().slice(-4)}`;
          sisaStok = qty;
          await conn.query(
            `INSERT INTO product_lots (tenant_id, kode_produk, nomor_lot, tanggal_produksi, expired_date, shift, warehouse_id, stok_qty, status)
             VALUES (?, ?, ?, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL 2 YEAR), 1, ?, ?, 'PASSED')`,
            [userTenantId || 1, kodeProduk, lotNomor, warehouse_id, qty]
          );
        }
      }

      detailRows.push({
        productId,
        qty,
        hargaSatuan,
        subtotal,
        catatan: item.catatan,
        lotNomor,
        sisaStok,
        hargaBeli: Number(prods[0].harga || 0),
      });
    }

    let journalId = null;
    if (totalNominal > 0) {
      const accReturn = await accountingModel.getAccountIdByKode('4-1003', conn, userTenantId || 1);
      const accAR = await accountingModel.getAccountIdByKode('1-1010', conn, userTenantId || 1);
      const accCash = await accountingModel.getAccountIdByKode('1-1001', conn, userTenantId || 1);

      const creditAcc = tipe_penyelesaian === 'PENGEMBALIAN_KAS' ? accCash : accAR;

      const journalLines = [
        { accountId: accReturn.id, debit: totalNominal, credit: 0, keterangan: `Retur Penjualan Produk (${noReturn})` },
        { accountId: creditAcc.id, debit: 0, credit: totalNominal, keterangan: `Kredit Nota / Pengurangan Piutang (${noReturn})` },
      ];

      // Jika barang dikembalikan ke stok fisik, jurnal penyesuaian Persediaan Barang vs HPP
      if (kembali_ke_stok) {
        let totalHppRetur = 0;
        for (const d of detailRows) {
          totalHppRetur += (d.qty || 0) * (d.hargaBeli || 0);
        }
        if (totalHppRetur > 0) {
          const accInventory = await accountingModel.getAccountIdByKode('1-1020', conn, userTenantId || 1);
          const accHpp = await accountingModel.getAccountIdByKode('5-1001', conn, userTenantId || 1);
          if (accInventory && accHpp) {
            journalLines.push(
              { accountId: accInventory.id, debit: totalHppRetur, credit: 0, keterangan: `Restock Persediaan Retur Penjualan (${noReturn})` },
              { accountId: accHpp.id, debit: 0, credit: totalHppRetur, keterangan: `Penyesuaian HPP Retur Penjualan (${noReturn})` }
            );
          }
        }
      }

      journalId = await accountingModel.postJournal(
        {
          tenantId: userTenantId || 1,
          tanggal,
          tipeReferensi: 'MANUAL',
          noReferensi: noReturn,
          keterangan: `Retur Penjualan dari Customer (${noReturn}) - ${alasan_retur || 'Koreksi Faktur'}`,
          createdBy: userId,
          lines: journalLines,
        },
        conn
      );

      if (tipe_penyelesaian === 'POTONG_PIUTANG') {
        const [arRows] = await conn.query(
          'SELECT id, sisa_piutang FROM accounts_receivable WHERE customer_id = ? AND sisa_piutang > 0 AND tenant_id = ? ORDER BY jatuh_tempo ASC',
          [customer_id, userTenantId || 1]
        );
        let remDeduct = totalNominal;
        for (const ar of arRows) {
          if (remDeduct <= 0) break;
          const ded = Math.min(Number(ar.sisa_piutang), remDeduct);
          const newSisa = Number(ar.sisa_piutang) - ded;
          await conn.query(
            `UPDATE accounts_receivable SET sisa_piutang = ?, status = ? WHERE id = ?`,
            [newSisa, newSisa <= 0 ? 'LUNAS' : 'SEBAGIAN', ar.id]
          );
          remDeduct -= ded;
        }
      }
    }

    const [res] = await conn.query(
      `INSERT INTO sales_returns (tenant_id, no_return, so_id, customer_id, warehouse_id, tanggal, total_nominal, alasan_retur, tipe_penyelesaian, kembali_ke_stok, status, journal_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
      [userTenantId || 1, noReturn, so_id || null, customer_id, warehouse_id, tanggal, totalNominal, alasan_retur || null, tipe_penyelesaian, kembali_ke_stok ? 1 : 0, journalId, userId]
    );
    const returnId = res.insertId;

    for (const d of detailRows) {
      await conn.query(
        `INSERT INTO sales_return_details (tenant_id, return_id, product_id, qty, harga_satuan, subtotal, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userTenantId || 1, returnId, d.productId, d.qty, d.hargaSatuan, d.subtotal, d.catatan || null]
      );
      if (kembali_ke_stok) {
        await conn.query(
          `INSERT INTO stock_mutations (tenant_id, tanggal_mutasi, kode_produk, nomor_lot, warehouse_id, tipe, qty_perubahan, qty_sisa, referensi)
           VALUES (?, NOW(), (SELECT kode_produk FROM products WHERE id = ?), ?, ?, 'RETUR_JUAL', ?, ?, ?)`,
          [userTenantId || 1, d.productId, d.lotNomor || 'RETUR_JUAL', warehouse_id, d.qty, d.sisaStok || 0, noReturn]
        );
      }
    }

    await conn.commit();
    return { returnId, noReturn, totalNominal, journalId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Rekomendasi Lot berdasarkan Metode Pengeluaran Stok (FIFO / FEFO)
const getRecommendedLots = async ({ tenantId = null, kodeProduk, warehouseId = null, requestedQty = 1, metodeOverride = null }) => {
  const [prods] = await pool.query(
    `SELECT p.*, r.kode_rak 
     FROM products p 
     LEFT JOIN racks r ON r.id = p.rack_id 
     WHERE (? IS NULL OR p.tenant_id = ?) AND (p.kode_produk = ? OR p.barcode_kemasan = ?) 
     LIMIT 1`,
    [tenantId, tenantId, kodeProduk, kodeProduk]
  );
  if (!prods[0]) return { success: false, message: 'Produk tidak ditemukan' };
  const prod = prods[0];
  const activeKode = prod.kode_produk;
  const metode = (metodeOverride || prod.metode_stok || 'FIFO').toUpperCase();

  let orderClause = 'ORDER BY pl.tanggal_produksi ASC, pl.created_at ASC, pl.id ASC';
  if (metode === 'FEFO') {
    orderClause = 'ORDER BY (pl.expired_date IS NULL) ASC, pl.expired_date ASC, pl.tanggal_produksi ASC, pl.id ASC';
  }

  let sql = `
    SELECT pl.*, w.nama_gudang, w.kode_gudang,
           DATEDIFF(pl.expired_date, CURRENT_DATE) AS days_to_expire
    FROM product_lots pl
    LEFT JOIN warehouses w ON w.id = pl.warehouse_id
    WHERE (? IS NULL OR pl.tenant_id = ?) AND pl.kode_produk = ? AND pl.stok_qty > 0
  `;
  const params = [tenantId, tenantId, activeKode];
  if (warehouseId && warehouseId !== 'ALL') {
    sql += ' AND pl.warehouse_id = ?';
    params.push(Number(warehouseId));
  }
  sql += ` ${orderClause}`;

  const [rows] = await pool.query(sql, params);

  let remaining = Number(requestedQty) || 1;
  let totalAvailable = 0;

  let firstValidFound = false;
  const allocatedLots = rows.map((r) => {
    const days = r.days_to_expire !== undefined && r.days_to_expire !== null ? Number(r.days_to_expire) : null;
    const isExpired = days !== null && days < 0;
    const isBlocked = ['QUARANTINE', 'HOLD', 'EXPIRED'].includes((r.status || '').toUpperCase()) || isExpired;
    let take = 0;
    let isBest = false;
    if (!isBlocked) {
      totalAvailable += r.stok_qty;
      if (!firstValidFound) {
        isBest = true;
        firstValidFound = true;
      }
      if (remaining > 0) {
        take = Math.min(r.stok_qty, remaining);
        remaining -= take;
      }
    }
    return {
      ...r,
      days_to_expire: days,
      effective_status: days !== null ? (days < 0 ? 'EXPIRED' : days <= 90 && r.status !== 'QUARANTINE' ? 'EXPIRING_SOON' : r.status) : r.status,
      is_expired: isExpired,
      is_expiring_soon: days !== null && days >= 0 && days <= 90,
      qty_dialokasikan: take,
      is_recommended: isBest || take > 0,
      metode_digunakan: metode,
    };
  });

  return {
    success: true,
    kode_produk: activeKode,
    nama_produk: prod.nama_produk,
    kategori_produk: prod.kategori_produk || 'BARANG_JADI',
    satuan: prod.satuan,
    satuan_besar: prod.satuan_besar,
    satuan_menengah: prod.satuan_menengah,
    isi_pack_pcs: prod.isi_pack_pcs,
    isi_box_pack: prod.isi_box_pack,
    isi_box_pcs: prod.isi_box_pcs,
    isi_per_kemasan: prod.isi_per_kemasan,
    barcode_kemasan: prod.barcode_kemasan,
    metode_digunakan: metode,
    requested_qty: Number(requestedQty) || 1,
    total_stok_tersedia: totalAvailable,
    is_stok_cukup: totalAvailable >= (Number(requestedQty) || 1),
    recommended_lots: allocatedLots,
  };
};

module.exports = {
  // Warehouses
  findAllWarehouses,
  findWarehouseByKode,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  findAllWarehouseTransfers,
  createWarehouseTransfer,
  approveWarehouseTransfer,
  rejectWarehouseTransfer,
  // Lots
  findAllLotsWithExpiry,
  createLot,
  updateLotStatus,
  getRecommendedLots,
  // Stock Adjustment
  findAllStockAdjustments,
  createStockAdjustment,
  // Quotations
  findAllQuotations,
  createQuotation,
  updateQuotationStatus,
  convertQuotationToSO,
  // Returns
  findAllPurchaseReturns,
  createPurchaseReturn,
  findAllSalesReturns,
  createSalesReturn,
};
