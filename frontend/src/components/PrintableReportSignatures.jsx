import React from 'react';
import { formatDate } from '../services/api.js';

export default function PrintableReportSignatures({
  show = true,
  showSignatures,
  city = 'Jakarta',
  date = new Date().toISOString().split('T')[0],
  signer1 = { title: 'Disiapkan Oleh', name: 'Staf Akuntansi', role: 'Accounting Staff', signature: null },
  signer2 = { title: 'Diperiksa Oleh', name: 'Accounting Manager', role: 'Manajer Akuntansi & Pajak', signature: null },
  signer3 = { title: 'Disetujui Oleh', name: 'Direktur Keuangan', role: 'Finance Director / Direksi', signature: null },
  showSigner1 = true,
  showSigner2 = true,
  showSigner3 = true,
  companyStamp = null,
  showStamp = true,
  stampPosition = 'signer2', // 'signer1' | 'signer2' | 'signer3'
  footerNote = 'Laporan ini telah diaudit dan divalidasi oleh Sistem ERP Terpadu sesuai Standar Akuntansi Keuangan (SAK) Indonesia.',
}) {
  const isVisible = showSignatures !== undefined ? Boolean(showSignatures) : Boolean(show);
  if (!isVisible) return null;

  // Fallback membaca stempel dan konfigurasi dari localStorage jika tidak dioper langsung
  let effectiveStamp = companyStamp;
  let effectiveShowStamp = showStamp;
  let effectiveStampPos = stampPosition;

  if (effectiveStamp === null || effectiveStamp === undefined) {
    try {
      const saved = localStorage.getItem('erp_accounting_report_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyStamp) effectiveStamp = parsed.companyStamp;
        if (parsed.showStamp !== undefined) effectiveShowStamp = parsed.showStamp;
        if (parsed.stampPosition) effectiveStampPos = parsed.stampPosition;
      }
    } catch (_) {}
  }

  // Fallback tanda tangan per signer bila tersimpan di localStorage
  let s1 = signer1;
  let s2 = signer2;
  let s3 = signer3;
  if (!s1?.signature || !s2?.signature || !s3?.signature) {
    try {
      const saved = localStorage.getItem('erp_accounting_report_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!s1?.signature && parsed.signer1?.signature) s1 = { ...s1, signature: parsed.signer1.signature };
        if (!s2?.signature && parsed.signer2?.signature) s2 = { ...s2, signature: parsed.signer2.signature };
        if (!s3?.signature && parsed.signer3?.signature) s3 = { ...s3, signature: parsed.signer3.signature };
      }
    } catch (_) {}
  }

  const renderSignerColumn = (signer, colKey, defaultTitle, defaultRole) => {
    const isStampHere = Boolean(effectiveShowStamp && effectiveStamp && effectiveStampPos === colKey);

    return (
      <div className="flex flex-col items-center">
        {/* Judul Jabatan / Status Otorisasi */}
        <p className="font-semibold text-slate-700 print:text-black uppercase tracking-wider text-[11px] mb-1">
          {signer.title || defaultTitle}
        </p>

        {/* Area Tanda Tangan dan Stempel Resmi */}
        <div className="relative w-full h-24 flex items-center justify-center my-1.5">
          {/* Stempel Perusahaan (bila posisi di kolom ini) */}
          {isStampHere && (
            <img
              src={effectiveStamp}
              alt="Stempel Resmi Perusahaan"
              style={{ mixBlendMode: 'multiply' }}
              className="absolute w-24 h-24 object-contain -rotate-6 opacity-85 pointer-events-none z-10 print:opacity-90"
            />
          )}

          {/* Tanda Tangan Digital (bila diupload) atau Ruang Kosong TTD Fisik */}
          {signer?.signature ? (
            <img
              src={signer.signature}
              alt={`TTD ${signer.name || defaultTitle}`}
              className="h-20 max-w-[160px] object-contain relative z-20"
            />
          ) : (
            <div className="h-16" />
          )}
        </div>

        {/* Nama Terang & Jabatan */}
        <div className="w-full">
          <p className="font-bold underline text-slate-900 print:text-black">
            ( {signer.name || '................................'} )
          </p>
          <p className="text-[10px] text-slate-500 print:text-black mt-0.5">
            {signer.role || defaultRole}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full mt-10 pt-4 border-t border-slate-200 avoid-break">
      {/* Lokasi dan Tanggal Pengesahan */}
      <div className="text-right text-xs text-slate-700 print:text-black font-medium mb-4">
        <span>{city}, {formatDate(date)}</span>
      </div>

      {/* Grid Kolom Tanda Tangan */}
      {(() => {
        const has1 = showSigner1 !== false;
        const has2 = showSigner2 !== false;
        const has3 = showSigner3 !== false;
        const count = [has1, has2, has3].filter(Boolean).length;
        if (count === 0) return null;
        const gridCols =
          count === 1
            ? 'grid-cols-1 max-w-xs mx-auto'
            : count === 2
            ? 'grid-cols-2 max-w-xl mx-auto'
            : 'grid-cols-3';

        return (
          <div className={`grid ${gridCols} gap-6 text-center text-xs`}>
            {has1 && renderSignerColumn(s1, 'signer1', 'Disiapkan Oleh', 'Staf Akuntansi')}
            {has2 && renderSignerColumn(s2, 'signer2', 'Diperiksa Oleh', 'Accounting Manager')}
            {has3 && renderSignerColumn(s3, 'signer3', 'Disetujui Oleh', 'Direktur Keuangan')}
          </div>
        );
      })()}

      {/* Catatan Kaki Dokumen */}
      {footerNote && (
        <div className="mt-8 pt-3 border-t border-dotted border-slate-300 text-[10px] text-slate-500 print:text-slate-700 text-center italic">
          {footerNote}
        </div>
      )}
    </div>
  );
}

