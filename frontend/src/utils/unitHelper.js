/**
 * Helper Konversi Satuan Multi-Tingkat (3 Parameter: Box -> Pack -> Pcs)
 * Standar Satuan Dasar Aplikasi: PCS (atau satuan fisik terkecil produk)
 */

export const getProductUnits = (product = {}) => {
  const p = product || {};
  const baseUnit = (p.satuan || 'PCS').toUpperCase();
  const midUnit = (p.satuan_menengah || 'PACK').toUpperCase();
  const bigUnit = (p.satuan_besar || 'BOX').toUpperCase();

  const isiPackPcs = Number(p.isi_pack_pcs) > 0 ? Number(p.isi_pack_pcs) : 1;
  const isiBoxPack = Number(p.isi_box_pack) > 0 ? Number(p.isi_box_pack) : 1;
  
  // Jika isi_box_pcs belum diset, fallback ke isi_box_pack * isi_pack_pcs atau isi_per_kemasan
  let isiBoxPcs = Number(p.isi_box_pcs);
  if (!isiBoxPcs || isiBoxPcs <= 0) {
    if (Number(p.isi_per_kemasan) > 0) {
      isiBoxPcs = Number(p.isi_per_kemasan);
    } else {
      isiBoxPcs = isiBoxPack * isiPackPcs;
    }
  }

  const hasMidUnit = isiPackPcs > 1 || midUnit !== baseUnit;
  const hasBigUnit = isiBoxPcs > 1 || bigUnit !== baseUnit;

  return {
    baseUnit,
    midUnit,
    bigUnit,
    isiPackPcs,
    isiBoxPack,
    isiBoxPcs,
    hasMidUnit,
    hasBigUnit,
  };
};

/**
 * Mendapatkan pilihan opsi dropdown satuan untuk form SO, PO, DO, dsb.
 */
export const getUnitDropdownOptions = (product = {}) => {
  const p = product || {};
  const u = getProductUnits(p);
  const options = [];

  // 1. Satuan Besar (BOX)
  options.push({
    value: u.bigUnit,
    label: `${u.bigUnit} (1 ${u.bigUnit} = ${u.isi_box_pack || 1} ${u.midUnit} = ${u.isiBoxPcs} ${u.baseUnit})`,
    shortLabel: u.bigUnit,
    ratio: u.isiBoxPcs,
    type: 'BIG',
  });

  // 2. Satuan Menengah (PACK)
  if (u.midUnit !== u.bigUnit && (u.isiPackPcs > 1 || u.midUnit !== u.baseUnit)) {
    options.push({
      value: u.midUnit,
      label: `${u.midUnit} (1 ${u.midUnit} = ${u.isiPackPcs} ${u.baseUnit})`,
      shortLabel: u.midUnit,
      ratio: u.isiPackPcs,
      type: 'MID',
    });
  }

  // 3. Satuan Dasar (PCS)
  if (u.baseUnit !== u.bigUnit && u.baseUnit !== u.midUnit) {
    options.push({
      value: u.baseUnit,
      label: `${u.baseUnit} (Satuan Dasar)`,
      shortLabel: u.baseUnit,
      ratio: 1,
      type: 'BASE',
    });
  } else if (options.length === 0) {
    options.push({
      value: u.baseUnit,
      label: `${u.baseUnit} (Satuan Dasar)`,
      shortLabel: u.baseUnit,
      ratio: 1,
      type: 'BASE',
    });
  }

  return options;
};

/**
 * Konversi Qty dari satuan tertentu ke satuan dasar (PCS)
 */
export const convertToPcs = (qty, unitName, product = {}) => {
  const p = product || {};
  const q = Number(qty) || 0;
  if (q <= 0) return 0;
  const u = getProductUnits(p);
  const targetUnit = (unitName || u.baseUnit).toUpperCase();

  if (targetUnit === u.bigUnit) {
    return Math.round(q * u.isiBoxPcs * 100) / 100;
  }
  if (targetUnit === u.midUnit) {
    return Math.round(q * u.isiPackPcs * 100) / 100;
  }
  return q;
};

/**
 * Mendapatkan teks konversi otomatis untuk ditampilkan di bawah input (badge kalkulasi)
 * Contoh: Input 2 BOX -> "= 20 PACK / 400 PCS"
 */
export const getConversionPreviewText = (qty, unitName, product = {}) => {
  if (!product) return null;
  const p = product || {};
  const q = Number(qty) || 0;
  if (q <= 0) return null;
  const u = getProductUnits(p);
  const targetUnit = (unitName || u.baseUnit).toUpperCase();

  if (targetUnit === u.bigUnit) {
    const totalPcs = Math.round(q * u.isiBoxPcs * 100) / 100;
    const totalPack = Math.round(q * u.isiBoxPack * 100) / 100;
    if (u.hasMidUnit && u.midUnit !== u.bigUnit && u.isiBoxPack > 1) {
      return `= ${totalPack.toLocaleString('id-ID')} ${u.midUnit} / ${totalPcs.toLocaleString('id-ID')} ${u.baseUnit}`;
    }
    return `= ${totalPcs.toLocaleString('id-ID')} ${u.baseUnit}`;
  }

  if (targetUnit === u.midUnit) {
    const totalPcs = Math.round(q * u.isiPackPcs * 100) / 100;
    const approxBox = u.isiBoxPack > 0 ? (q / u.isiBoxPack).toFixed(2).replace(/\.00$/, '') : null;
    if (approxBox && Number(approxBox) > 0 && u.bigUnit !== u.midUnit) {
      return `= ${totalPcs.toLocaleString('id-ID')} ${u.baseUnit} (~ ${approxBox} ${u.bigUnit})`;
    }
    return `= ${totalPcs.toLocaleString('id-ID')} ${u.baseUnit}`;
  }

  // Jika input dalam satuan dasar (PCS)
  if (u.hasBigUnit && u.isiBoxPcs > 1) {
    const approxBox = (q / u.isiBoxPcs).toFixed(2).replace(/\.00$/, '');
    return `~ ${approxBox} ${u.bigUnit}`;
  }

  return null;
};

/**
 * Format kuantitas stok PCS ke breakdown kemasan multi-tingkat (Box, Pack, Pcs)
 * Contoh: 450 PCS -> "2 BOX, 2 PACK, 10 PCS"
 */
export const formatMultiTierBreakdown = (qtyPcs, product = {}) => {
  const p = product || {};
  const total = Number(qtyPcs) || 0;
  const u = getProductUnits(p);

  if (total === 0 || !u.hasBigUnit || u.isiBoxPcs <= 1) {
    return `${total.toLocaleString('id-ID')} ${u.baseUnit}`;
  }

  const sign = total < 0 ? '-' : '';
  const absQty = Math.abs(total);

  const boxes = Math.floor(absQty / u.isiBoxPcs);
  let remainder = absQty % u.isiBoxPcs;

  let packs = 0;
  let pcs = remainder;

  if (u.isiPackPcs > 1) {
    packs = Math.floor(remainder / u.isiPackPcs);
    pcs = remainder % u.isiPackPcs;
  }

  const parts = [];
  if (boxes > 0) parts.push(`${boxes} ${u.bigUnit}`);
  if (packs > 0) parts.push(`${packs} ${u.midUnit}`);
  if (pcs > 0 || parts.length === 0) parts.push(`${pcs} ${u.baseUnit}`);

  return `${sign}${parts.join(' ')}`;
};

