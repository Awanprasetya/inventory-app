import React from 'react';

// Tabel modul bar/spasi resmi ISO/IEC 15417 Code 128 (indeks 0..106)
export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const STOP_CODE = 106;

/**
 * Menghasilkan daftar segmen batang hitam { x, w } dan total lebar modul
 * untuk teks input menggunakan Code 128B (ASCII 32..126).
 */
export function encodeCode128(text, quietZone = 10) {
  const safeText = String(text || '').replace(/[^\x20-\x7e]/g, '-');
  if (!safeText) return { bars: [], totalWidth: 0 };

  const codes = [START_B];
  let checksum = START_B;
  for (let i = 0; i < safeText.length; i++) {
    const val = safeText.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP_CODE);

  const bars = [];
  let cursor = quietZone;
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let j = 0; j < pattern.length; j++) {
      const w = Number(pattern[j]);
      if (j % 2 === 0) {
        bars.push({ x: cursor, w });
      }
      cursor += w;
    }
  }
  return { bars, totalWidth: cursor + quietZone };
}

/**
 * Komponen SVG Barcode Code 128 untuk Nomor Lot agar presisi dicetak maupun dipindai.
 */
export default function Barcode128({
  value = '',
  height = 28,
  quietZone = 8,
  showText = true,
  fontSize = 8,
  className = '',
  style = {},
}) {
  const { bars, totalWidth } = encodeCode128(value, quietZone);
  if (!bars.length) return null;

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', ...style }}
    >
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        style={{ display: 'block', background: '#fff' }}
        aria-label={`Barcode ${value}`}
      >
        <rect x="0" y="0" width={totalWidth} height={height} fill="#ffffff" />
        {bars.map((b, idx) => (
          <rect key={idx} x={b.x} y={0} width={b.w} height={height} fill="#000000" />
        ))}
      </svg>
      {showText && (
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontWeight: 800,
            fontSize: `${fontSize}px`,
            lineHeight: 1.15,
            marginTop: '1.5px',
            color: '#000',
            letterSpacing: '0.4px',
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
