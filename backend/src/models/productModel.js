const pool = require('../config/db');

// Jalankan query ke pool, atau ke koneksi transaksi `conn` jika disediakan
const exec = (sql, params, conn) => (conn || pool).query(sql, params);

const normalizeKategoriProduk = (val) => {
  const clean = String(val || '').trim().toUpperCase().replace(/\s+/g, '_');
  return clean === 'MATERIAL' ? 'MATERIAL' : 'BARANG_JADI';
};

let ensureKategoriPromise = null;
const ensureKategoriProdukColumn = async () => {
  if (ensureKategoriPromise) return ensureKategoriPromise;
  ensureKategoriPromise = (async () => {
    try {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'kategori_produk'`
      );
      if (cols.length === 0) {
        await pool.query(
          `ALTER TABLE products ADD COLUMN kategori_produk VARCHAR(30) NOT NULL DEFAULT 'BARANG_JADI' AFTER nama_produk`
        );
      }
    } catch (_) {
      // Abaikan jika sudah ada atau tidak memiliki hak DDL
    }
  })();
  return ensureKategoriPromise;
};

const findAll = async (tenantId = null, search = null, warehouseId = null, kategori = null) => {
  await ensureKategoriProdukColumn();
  const keyword = search ? `%${search}%` : null;
  const kategoriFilter = kategori ? normalizeKategoriProduk(kategori) : null;
  const [rows] = await exec(
    `SELECT p.id, p.kode_produk, p.nama_produk, COALESCE(p.kategori_produk, 'BARANG_JADI') AS kategori_produk,
            p.satuan, p.satuan_besar, p.satuan_menengah, 
            p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan, p.barcode_kemasan, 
            p.jenis_izin, p.nomor_izin,
            p.harga, p.rack_id, p.metode_stok, p.tenant_id, p.created_at,
            r.kode_rak,
            t.nama_perusahaan, t.kode_tenant,
            (SELECT COALESCE(SUM(l.stok_qty), 0) FROM product_lots l 
             WHERE l.kode_produk = p.kode_produk 
               AND (? IS NULL OR l.tenant_id = ?)
               AND (? IS NULL OR l.warehouse_id = ?)) AS total_stok,
            (SELECT COUNT(*) FROM product_lots l 
             WHERE l.kode_produk = p.kode_produk 
               AND (? IS NULL OR l.tenant_id = ?)
               AND (? IS NULL OR l.warehouse_id = ?)) AS jumlah_lot
     FROM products p
     LEFT JOIN racks r ON r.id = p.rack_id
     LEFT JOIN tenants t ON t.id = p.tenant_id
     WHERE (? IS NULL OR p.tenant_id = ?)
       AND COALESCE(p.is_deleted, 0) = 0
       AND (? IS NULL OR COALESCE(p.kategori_produk, 'BARANG_JADI') = ?)
       AND (? IS NULL OR p.kode_produk LIKE ? OR p.nama_produk LIKE ? OR p.barcode_kemasan LIKE ? OR p.nomor_izin LIKE ?)
     ORDER BY p.nama_produk ASC`,
    [
      tenantId, tenantId, warehouseId, warehouseId,
      tenantId, tenantId, warehouseId, warehouseId,
      tenantId, tenantId,
      kategoriFilter, kategoriFilter,
      keyword, keyword, keyword, keyword, keyword,
    ]
  );
  return rows;
};

const findByKode = async (tenantId = null, kodeProduk, conn = null) => {
  await ensureKategoriProdukColumn();
  let tId = tenantId;
  let kode = kodeProduk;
  if (typeof tenantId === 'string' && kodeProduk === undefined) {
    kode = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT p.id, p.kode_produk, p.nama_produk, COALESCE(p.kategori_produk, 'BARANG_JADI') AS kategori_produk,
            p.satuan, p.satuan_besar, p.satuan_menengah, 
            p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan, p.barcode_kemasan, 
            p.jenis_izin, p.nomor_izin,
            p.harga, p.rack_id, p.metode_stok, p.tenant_id, p.created_at,
            r.kode_rak,
            t.nama_perusahaan, t.kode_tenant,
            (SELECT COALESCE(SUM(l.stok_qty), 0) FROM product_lots l WHERE l.kode_produk = p.kode_produk AND (? IS NULL OR l.tenant_id = ?)) AS total_stok,
            (SELECT COUNT(*) FROM product_lots l WHERE l.kode_produk = p.kode_produk AND (? IS NULL OR l.tenant_id = ?)) AS jumlah_lot
     FROM products p
     LEFT JOIN racks r ON r.id = p.rack_id
     LEFT JOIN tenants t ON t.id = p.tenant_id
     WHERE (? IS NULL OR p.tenant_id = ?) AND COALESCE(p.is_deleted, 0) = 0 AND (p.kode_produk = ? OR p.barcode_kemasan = ?)
     LIMIT 1`,
    [tId, tId, tId, tId, tId, tId, kode, kode],
    conn
  );
  if (!rows[0]) return null;
  const p = rows[0];
  return {
    ...p,
    kategori_produk: normalizeKategoriProduk(p.kategori_produk),
    metode_stok: (p.metode_stok || 'FIFO').toUpperCase(),
    is_scanned_kemasan: Boolean(p.barcode_kemasan && p.barcode_kemasan.toUpperCase() === String(kode).toUpperCase()),
  };
};

const create = async ({
  tenantId = 1,
  kodeProduk,
  namaProduk,
  kategoriProduk = 'BARANG_JADI',
  satuan,
  satuanBesar = 'BOX',
  satuanMenengah = 'PACK',
  isiPackPcs = 1,
  isiBoxPack = 1,
  isiBoxPcs = null,
  isiPerKemasan = null,
  barcodeKemasan = null,
  jenisIzin = null,
  nomorIzin = null,
  harga = 0,
  rackId = null,
  metodeStok = 'FIFO',
}) => {
  await ensureKategoriProdukColumn();
  const kProd = normalizeKategoriProduk(kategoriProduk);
  const mStok = (metodeStok || 'FIFO').toUpperCase() === 'FEFO' ? 'FEFO' : 'FIFO';
  const numPackPcs = Number(isiPackPcs) > 0 ? Number(isiPackPcs) : 1;
  const numBoxPack = Number(isiBoxPack) > 0 ? Number(isiBoxPack) : 1;
  const calcBoxPcs = Number(isiBoxPcs) > 0 ? Number(isiBoxPcs) : (Number(isiPerKemasan) > 0 ? Number(isiPerKemasan) : (numBoxPack * numPackPcs));

  const [result] = await exec(
    `INSERT INTO products (tenant_id, kode_produk, nama_produk, kategori_produk, satuan, satuan_besar, satuan_menengah, isi_pack_pcs, isi_box_pack, isi_box_pcs, isi_per_kemasan, barcode_kemasan, jenis_izin, nomor_izin, harga, rack_id, metode_stok)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId || 1,
      kodeProduk,
      namaProduk,
      kProd,
      satuan || 'PCS',
      satuanBesar || 'BOX',
      satuanMenengah || 'PACK',
      numPackPcs,
      numBoxPack,
      calcBoxPcs,
      calcBoxPcs,
      barcodeKemasan || null,
      jenisIzin || null,
      nomorIzin || null,
      harga,
      rackId,
      mStok,
    ]
  );
  return result.insertId;
};

const update = async (
  tenantId = null,
  kodeProduk,
  {
    namaProduk,
    kategoriProduk = null,
    satuan,
    satuanBesar = 'BOX',
    satuanMenengah = 'PACK',
    isiPackPcs = 1,
    isiBoxPack = 1,
    isiBoxPcs = null,
    isiPerKemasan = null,
    barcodeKemasan = null,
    jenisIzin = null,
    nomorIzin = null,
    harga = 0,
    rackId = null,
    metodeStok = null,
    tenantId: newTenantId = null,
  }
) => {
  await ensureKategoriProdukColumn();
  const kProd = kategoriProduk ? normalizeKategoriProduk(kategoriProduk) : null;
  const mStok = metodeStok ? ((metodeStok || '').toUpperCase() === 'FEFO' ? 'FEFO' : 'FIFO') : null;
  const numPackPcs = Number(isiPackPcs) > 0 ? Number(isiPackPcs) : 1;
  const numBoxPack = Number(isiBoxPack) > 0 ? Number(isiBoxPack) : 1;
  const calcBoxPcs = Number(isiBoxPcs) > 0 ? Number(isiBoxPcs) : (Number(isiPerKemasan) > 0 ? Number(isiPerKemasan) : (numBoxPack * numPackPcs));

  const [result] = await exec(
    `UPDATE products
     SET nama_produk = ?, kategori_produk = COALESCE(?, kategori_produk),
         satuan = ?, satuan_besar = ?, satuan_menengah = ?, 
         isi_pack_pcs = ?, isi_box_pack = ?, isi_box_pcs = ?, isi_per_kemasan = ?, 
         barcode_kemasan = ?, jenis_izin = ?, nomor_izin = ?, harga = ?, rack_id = ?, 
         metode_stok = COALESCE(?, metode_stok), tenant_id = COALESCE(?, tenant_id)
     WHERE (? IS NULL OR tenant_id = ?) AND kode_produk = ?`,
    [
      namaProduk,
      kProd,
      satuan || 'PCS',
      satuanBesar || 'BOX',
      satuanMenengah || 'PACK',
      numPackPcs,
      numBoxPack,
      calcBoxPcs,
      calcBoxPcs,
      barcodeKemasan || null,
      jenisIzin !== undefined ? (jenisIzin || null) : null,
      nomorIzin !== undefined ? (nomorIzin || null) : null,
      harga,
      rackId,
      mStok,
      newTenantId,
      tenantId,
      tenantId,
      kodeProduk,
    ]
  );
  return result.affectedRows;
};

const remove = async (tenantId = null, kodeProduk) => {
  const [result] = await exec(`UPDATE products SET is_deleted = 1 WHERE (? IS NULL OR tenant_id = ?) AND kode_produk = ?`, [tenantId, tenantId, kodeProduk]);
  return result.affectedRows;
};

// Daftar lot milik satu produk (bisa diurutkan FEFO atau FIFO)
const findLotsByKode = async (tenantId = null, kodeProduk, metodeOverride = null) => {
  let tId = tenantId;
  let kode = kodeProduk;
  if (typeof tenantId === 'string' && kodeProduk === undefined) {
    kode = tenantId;
    tId = null;
  }

  // Cek produk untuk mendapatkan metode_stok
  const [prod] = await exec(`SELECT metode_stok FROM products WHERE (? IS NULL OR tenant_id = ?) AND kode_produk = ? LIMIT 1`, [tId, tId, kode]);
  const activeMethod = (metodeOverride || prod[0]?.metode_stok || 'FIFO').toUpperCase();

  let orderBySql = `ORDER BY pl.tanggal_produksi ASC, pl.created_at ASC, pl.id DESC`;
  if (activeMethod === 'FEFO') {
    orderBySql = `ORDER BY (pl.expired_date IS NULL) ASC, pl.expired_date ASC, pl.tanggal_produksi ASC, pl.id DESC`;
  }

  const [rows] = await exec(
    `SELECT pl.*, w.nama_gudang, w.kode_gudang,
            p.satuan_besar, p.isi_per_kemasan, p.barcode_kemasan, p.metode_stok,
            DATEDIFF(pl.expired_date, CURRENT_DATE) AS days_to_expire
     FROM product_lots pl
     LEFT JOIN products p ON p.kode_produk = pl.kode_produk AND p.tenant_id = pl.tenant_id
     LEFT JOIN warehouses w ON w.id = pl.warehouse_id
     WHERE (? IS NULL OR pl.tenant_id = ?) AND pl.kode_produk = ?
     ${orderBySql}`,
    [tId, tId, kode]
  );
  return rows.map((r, idx) => {
    const days = r.days_to_expire !== undefined && r.days_to_expire !== null ? Number(r.days_to_expire) : null;
    let autoStatus = r.status || 'AVAILABLE';
    if (days !== null) {
      if (days < 0) autoStatus = 'EXPIRED';
      else if (days <= 90 && autoStatus !== 'QUARANTINE') autoStatus = 'EXPIRING_SOON';
    }
    return {
      ...r,
      days_to_expire: days,
      effective_status: autoStatus,
      is_expired: days !== null && days < 0,
      is_expiring_soon: days !== null && days >= 0 && days <= 90,
      metode_digunakan: activeMethod,
      is_recommended: idx === 0 && r.stok_qty > 0 && autoStatus !== 'EXPIRED' && autoStatus !== 'QUARANTINE',
    };
  });
};

// Semua lot (opsional difilter produk), join info produk & rak
const findAllLots = async (tenantId = null, kodeProduk = null) => {
  const [rows] = await exec(
    `SELECT pl.id, pl.tenant_id, pl.kode_produk, pl.nomor_lot, pl.tanggal_produksi, pl.expired_date, pl.shift, pl.stok_qty, pl.status, pl.keterangan,
            DATEDIFF(pl.expired_date, CURRENT_DATE) AS days_to_expire,
            p.nama_produk, p.satuan, p.satuan_besar, p.isi_per_kemasan, p.barcode_kemasan, p.metode_stok, r.kode_rak, w.nama_gudang, w.kode_gudang
     FROM product_lots pl
     JOIN products p ON p.kode_produk = pl.kode_produk AND p.tenant_id = pl.tenant_id
     LEFT JOIN racks r ON r.id = p.rack_id
     LEFT JOIN warehouses w ON w.id = pl.warehouse_id
     WHERE (? IS NULL OR pl.tenant_id = ?) AND (? IS NULL OR pl.kode_produk = ?)
     ORDER BY pl.expired_date ASC, pl.tanggal_produksi ASC`,
    [tenantId, tenantId, kodeProduk, kodeProduk]
  );
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

const findLotByNomor = async (tenantId = null, nomorLot, conn = null, warehouseId = null) => {
  let tId = tenantId;
  let nomor = nomorLot;
  if (typeof tenantId === 'string' && nomorLot === undefined) {
    nomor = tenantId;
    tId = null;
  }

  const [rows] = await exec(
    `SELECT pl.id, pl.tenant_id, pl.kode_produk, pl.nomor_lot, pl.tanggal_produksi, pl.expired_date, pl.shift,
            pl.warehouse_id, pl.stok_qty, pl.status, pl.keterangan,
            DATEDIFF(pl.expired_date, CURRENT_DATE) AS days_to_expire,
            w.nama_gudang, w.kode_gudang,
            p.nama_produk, COALESCE(p.kategori_produk, 'BARANG_JADI') AS kategori_produk,
            p.satuan, p.satuan_besar, p.satuan_menengah, p.isi_pack_pcs, p.isi_box_pack, p.isi_box_pcs, p.isi_per_kemasan, p.barcode_kemasan, p.metode_stok, p.rack_id, r.kode_rak
     FROM product_lots pl
     LEFT JOIN products p ON p.kode_produk = pl.kode_produk AND p.tenant_id = pl.tenant_id
     LEFT JOIN warehouses w ON w.id = pl.warehouse_id
     LEFT JOIN racks r ON r.id = p.rack_id
     WHERE (? IS NULL OR pl.tenant_id = ?)
       AND pl.nomor_lot = ?
       AND (? IS NULL OR pl.warehouse_id = ?)
     ORDER BY pl.stok_qty DESC, pl.id ASC
     LIMIT 1`,
    [tId, tId, nomor, warehouseId, warehouseId],
    conn
  );
  if (!rows[0]) return null;
  const r = rows[0];
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
};

// Kunci baris lot (FOR UPDATE) agar aman terhadap update bersamaan
const lockLot = async (nomorLot, conn, warehouseId = null, tenantId = null) => {
  const [rows] = await exec(
    `SELECT * FROM product_lots
     WHERE nomor_lot = ?
       AND (? IS NULL OR warehouse_id = ?)
       AND (? IS NULL OR tenant_id = ?)
     ORDER BY stok_qty DESC, id ASC
     LIMIT 1 FOR UPDATE`,
    [nomorLot, warehouseId, warehouseId, tenantId, tenantId],
    conn
  );
  return rows[0] || null;
};

const insertLot = async (
  {
    tenantId = 1,
    kodeProduk,
    nomorLot,
    tanggalProduksi,
    expiredDate = null,
    shift = 1,
    warehouseId = 1,
    stokQty,
    status = 'AVAILABLE',
    keterangan = null,
  },
  conn
) => {
  const exp = expiredDate || new Date(new Date(tanggalProduksi).setFullYear(new Date(tanggalProduksi).getFullYear() + 2)).toISOString().split('T')[0];

  const [result] = await exec(
    `INSERT INTO product_lots
       (tenant_id, kode_produk, nomor_lot, tanggal_produksi, expired_date, shift, warehouse_id, stok_qty, status, keterangan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId || 1, kodeProduk, nomorLot, tanggalProduksi, exp, shift, warehouseId || 1, stokQty, status, keterangan],
    conn
  );
  return result.insertId;
};

const increaseStock = async (nomorLot, qty, conn) => {
  const [result] = await exec(
    `UPDATE product_lots SET stok_qty = stok_qty + ? WHERE nomor_lot = ?`,
    [qty, nomorLot],
    conn
  );
  return result.affectedRows;
};

const decreaseStock = async (nomorLot, qty, conn, warehouseId = null, tenantId = null) => {
  const [result] = await exec(
    `UPDATE product_lots SET stok_qty = stok_qty - ?
     WHERE nomor_lot = ?
       AND (? IS NULL OR warehouse_id = ?)
       AND (? IS NULL OR tenant_id = ?)
       AND stok_qty >= ?`,
    [qty, nomorLot, warehouseId, warehouseId, tenantId, tenantId, qty],
    conn
  );
  return result.affectedRows;
};

const findLotPriorityInfo = async (tenantId = null, lot, conn = null) => {
  if (!lot || !lot.kode_produk) return { has_warning: false };
  const tId = tenantId || lot.tenant_id || null;
  const whId = lot.warehouse_id ? Number(lot.warehouse_id) : null;
  const metode = (lot.metode_stok || 'FIFO').toUpperCase();

  const [candidates] = await exec(
    `SELECT pl.id, pl.nomor_lot, pl.tanggal_produksi, pl.expired_date, pl.stok_qty, pl.status, pl.warehouse_id,
            w.nama_gudang, DATEDIFF(pl.expired_date, CURRENT_DATE) AS days_to_expire
     FROM product_lots pl
     LEFT JOIN warehouses w ON w.id = pl.warehouse_id
     WHERE (? IS NULL OR pl.tenant_id = ?)
       AND pl.kode_produk = ?
       AND pl.nomor_lot <> ?
       AND (? IS NULL OR pl.warehouse_id = ?)
       AND pl.stok_qty > 0
       AND COALESCE(pl.status, 'AVAILABLE') NOT IN ('QUARANTINE', 'HOLD', 'EXPIRED')
       AND (pl.expired_date IS NULL OR pl.expired_date >= CURRENT_DATE)`,
    [tId, tId, lot.kode_produk, lot.nomor_lot, whId, whId],
    conn
  );

  const validCandidates = candidates.map((c) => {
    const days = c.days_to_expire !== undefined && c.days_to_expire !== null ? Number(c.days_to_expire) : null;
    return {
      ...c,
      days_to_expire: days,
      is_expiring_soon: days !== null && days >= 0 && days <= 90,
    };
  });

  // 1. Cek lot yang lebih lama (FIFO)
  const olderLots = validCandidates
    .filter((c) => {
      if (!lot.tanggal_produksi) return false;
      if (!c.tanggal_produksi) return false;
      if (c.tanggal_produksi < lot.tanggal_produksi) return true;
      if (c.tanggal_produksi === lot.tanggal_produksi && Number(c.id) < Number(lot.id)) return true;
      return false;
    })
    .sort((a, b) => {
      if (a.tanggal_produksi !== b.tanggal_produksi) return a.tanggal_produksi < b.tanggal_produksi ? -1 : 1;
      return Number(a.id) - Number(b.id);
    });

  // 2. Cek lot yang lebih cepat / sebentar lagi expired (FEFO)
  const earlierExpiryLots = validCandidates
    .filter((c) => {
      if (!c.expired_date) return false;
      if (!lot.expired_date) return true;
      return c.expired_date < lot.expired_date;
    })
    .sort((a, b) => (a.expired_date < b.expired_date ? -1 : a.expired_date > b.expired_date ? 1 : 0));

  const olderLot = olderLots[0] || null;
  const earlierExpiryLot = earlierExpiryLots[0] || null;
  const recommendedLot =
    metode === 'FEFO' ? (earlierExpiryLot || olderLot) : (olderLot || earlierExpiryLot);

  const reasons = [];
  if (earlierExpiryLot) {
    const expNote = earlierExpiryLot.is_expiring_soon
      ? `sebentar lagi expired (${earlierExpiryLot.days_to_expire} hari lagi, ED ${earlierExpiryLot.expired_date})`
      : `expired lebih dekat (ED ${earlierExpiryLot.expired_date})`;
    reasons.push(`Lot ${earlierExpiryLot.nomor_lot} ${expNote} dengan stok ${earlierExpiryLot.stok_qty}`);
  }
  if (olderLot && (!earlierExpiryLot || olderLot.nomor_lot !== earlierExpiryLot.nomor_lot || olderLot.tanggal_produksi)) {
    reasons.push(
      `Lot ${olderLot.nomor_lot} masuk/diproduksi lebih lama (${olderLot.tanggal_produksi}) dengan stok ${olderLot.stok_qty}`
    );
  }

  const scannedDays = lot.days_to_expire !== undefined && lot.days_to_expire !== null ? Number(lot.days_to_expire) : null;
  const scannedExpiringSoon = scannedDays !== null && scannedDays >= 0 && scannedDays <= 90;

  return {
    has_warning: Boolean(recommendedLot),
    metode_stok: metode,
    has_older_lot: Boolean(olderLot),
    has_earlier_expiry_lot: Boolean(earlierExpiryLot),
    older_lot: olderLot,
    earlier_expiry_lot: earlierExpiryLot,
    recommended_lot: recommendedLot,
    scanned_expiring_soon: scannedExpiringSoon,
    scanned_days_to_expire: scannedDays,
    reasons,
    message: recommendedLot
      ? `Rekomendasi ${metode}: Sebaiknya gunakan lot ${recommendedLot.nomor_lot} terlebih dahulu. ${reasons.join('; ')}.`
      : null,
  };
};

module.exports = {
  findAll,
  findByKode,
  create,
  update,
  remove,
  findLotsByKode,
  findAllLots,
  findLotByNomor,
  findLotPriorityInfo,
  lockLot,
  insertLot,
  increaseStock,
  decreaseStock,
};
