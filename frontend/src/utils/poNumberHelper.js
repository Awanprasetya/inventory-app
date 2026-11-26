export const ROMAN_MONTHS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const DEFAULT_PO_FORMAT = {
  prefix: 'JPM/PO',
  pattern: '{PREFIX}/{BULAN}/{NO}',
  digitCount: 4,
  resetCycle: 'monthly', // 'monthly' | 'yearly' | 'continuous'
};

export const PO_FORMAT_PRESETS = [
  {
    id: 'prefix-month-no',
    label: '[Prefix]/[Bulan]/[No] (Rekomendasi)',
    pattern: '{PREFIX}/{BULAN}/{NO}',
    example: 'JPM/PO/10/0001',
    description: 'Format resmi: awalan, bulan PO dua digit, baru nomor urut PO.',
  },
  {
    id: 'prefix-roman-no',
    label: '[Prefix]/[Bulan Romawi]/[No]',
    pattern: '{PREFIX}/{ROMAN}/{NO}',
    example: 'JPM/PO/X/0001',
    description: 'Awalan diikuti bulan dalam angka Romawi (I-XII) dan nomor urut.',
  },
  {
    id: 'prefix-roman-year-no',
    label: '[Prefix]/[Bulan Romawi]/[Tahun]/[No]',
    pattern: '{PREFIX}/{ROMAN}/{TAHUN}/{NO}',
    example: 'JPM/PO/X/2026/0001',
    description: 'Lengkap dengan bulan Romawi, tahun 4 digit, dan nomor urut.',
  },
  {
    id: 'prefix-year-month-no',
    label: '[Prefix]/[Tahun]/[Bulan]/[No]',
    pattern: '{PREFIX}/{TAHUN}/{BULAN}/{NO}',
    example: 'JPM/PO/2026/10/0001',
    description: 'Standar tahun 4 digit, bulan angka 2 digit, lalu nomor urut.',
  },
  {
    id: 'no-prefix-roman-year',
    label: '[No]/[Prefix]/[Bulan Romawi]/[Tahun]',
    pattern: '{NO}/{PREFIX}/{ROMAN}/{TAHUN}',
    example: '0001/JPM/PO/X/2026',
    description: 'Nomor urut otomatis di paling depan.',
  },
  {
    id: 'custom',
    label: 'Kustom Format Bebas',
    pattern: '',
    example: 'Tentukan pola sendiri',
    description: 'Gunakan tag {PREFIX}, {BULAN}, {ROMAN}, {TAHUN}, {YY}, {NO}.',
  },
];

export function loadSavedPoFormat() {
  try {
    const raw = localStorage.getItem('erp_po_number_format_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PO_FORMAT,
        ...parsed,
      };
    }
  } catch (_) {}
  return DEFAULT_PO_FORMAT;
}

export function savePoFormat(config) {
  try {
    localStorage.setItem('erp_po_number_format_config', JSON.stringify(config));
  } catch (_) {}
}

/**
 * Format string template dengan nilai tanggal dan nomor tertentu
 */
export function renderPoFormatString(pattern, prefix, dateStr, numberValue, digitCount = 4) {
  const d = new Date(dateStr || new Date());
  const yyyy = d.getFullYear();
  const yy = String(yyyy).slice(-2);
  const m = d.getMonth() + 1;
  const mm = String(m).padStart(2, '0');
  const roman = ROMAN_MONTHS[m] || 'I';
  const numStr = String(numberValue || 1).padStart(digitCount, '0');

  return (pattern || '{PREFIX}/{BULAN}/{NO}')
    .replace('{PREFIX}', prefix || 'JPM/PO')
    .replace('{BULAN}', mm)
    .replace('{ROMAN}', roman)
    .replace('{TAHUN}', String(yyyy))
    .replace('{YYYY}', String(yyyy))
    .replace('{YY}', yy)
    .replace('{NO}', numStr);
}

/**
 * Hitung nomor PO berikutnya secara otomatis berdasarkan daftar PO yang ada
 */
export function generateNextPoNumber(dateStr, existingPos = [], config = {}) {
  const effectiveConfig = { ...DEFAULT_PO_FORMAT, ...config };
  const prefix = effectiveConfig.prefix || 'JPM/PO';
  const pattern = effectiveConfig.pattern || '{PREFIX}/{BULAN}/{NO}';
  const digitCount = Number(effectiveConfig.digitCount) || 4;
  const resetCycle = effectiveConfig.resetCycle || 'monthly';

  const d = new Date(dateStr || new Date());
  const yyyy = d.getFullYear();
  const yy = String(yyyy).slice(-2);
  const m = d.getMonth() + 1;
  const mm = String(m).padStart(2, '0');
  const roman = ROMAN_MONTHS[m] || 'I';

  // Bagian sebelum dan sesudah {NO}
  const filledPattern = pattern
    .replace('{PREFIX}', prefix)
    .replace('{BULAN}', mm)
    .replace('{ROMAN}', roman)
    .replace('{TAHUN}', String(yyyy))
    .replace('{YYYY}', String(yyyy))
    .replace('{YY}', yy);

  const parts = filledPattern.split('{NO}');
  const prefixPart = parts[0] || '';
  const suffixPart = parts[1] || '';

  let maxSeq = 0;

  for (const item of existingPos || []) {
    const noPo = (item.no_po || '').trim();
    if (!noPo) continue;

    // Filter tanggal bila reset per bulan atau per tahun
    if (resetCycle === 'monthly' && item.tanggal_po) {
      const itemD = new Date(item.tanggal_po);
      if (itemD.getFullYear() !== yyyy || itemD.getMonth() + 1 !== m) {
        continue;
      }
    } else if (resetCycle === 'yearly' && item.tanggal_po) {
      const itemD = new Date(item.tanggal_po);
      if (itemD.getFullYear() !== yyyy) {
        continue;
      }
    }

    // Periksa apakah no_po cocok dengan prefix dan suffix
    if (prefixPart && !noPo.startsWith(prefixPart)) continue;
    if (suffixPart && !noPo.endsWith(suffixPart)) continue;

    let numStr = noPo;
    if (prefixPart) numStr = numStr.slice(prefixPart.length);
    if (suffixPart) numStr = numStr.slice(0, numStr.length - suffixPart.length);

    const parsed = parseInt(numStr, 10);
    if (!isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed;
    }
  }

  const nextSeq = maxSeq + 1;
  const formattedSeq = String(nextSeq).padStart(digitCount, '0');
  return `${prefixPart}${formattedSeq}${suffixPart}`;
}

