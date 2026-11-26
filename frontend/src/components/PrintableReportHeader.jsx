import React from 'react';
import { Building2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDate } from '../services/api.js';

export default function PrintableReportHeader({
  companyName = 'PT MEDIKA DISTRIBUSI INDONESIA',
  companyAddress = 'Jl. Boulevard Medika No. 88, Kawasan Pergudangan Sentra Niaga, Jakarta Barat',
  companyContact = 'Telp: (021) 8899-7722 | Email: finance@medikadistribusi.co.id | NPWP: 01.345.678.9-012.000',
  companyLogo = null,
  showCompanyHeader = true,
  title = 'LAPORAN KEUANGAN',
  subtitle = '',
  docNo = '',
  printedAt = new Date(),
  printedBy = 'Administrator',
  currency = 'Indonesian Rupiah (IDR)',
  badge = null,
}) {
  const formattedPrintedDate = new Date(printedAt).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="w-full mb-6 avoid-break">
      {/* Kop Surat Resmi Perusahaan */}
      {showCompanyHeader && (
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-20 sm:h-24 max-w-[150px] object-contain rounded-lg shrink-0 print:border print:border-black"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-2xl print:border print:border-black shrink-0">
                  <Building2 className="w-9 h-9" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900 print:text-black">
                  {companyName}
                </h1>
                <p className="text-xs text-slate-600 print:text-black leading-relaxed">
                  {companyAddress}
                </p>
                <p className="text-[11px] text-slate-500 print:text-black font-medium">
                  {companyContact}
                </p>
              </div>
            </div>

            {/* Badge Status / Doc Ref (Kanan Atas) */}
            <div className="text-right hidden sm:block print:block shrink-0">
              {docNo && (
                <div className="text-[11px] font-mono text-slate-500 print:text-black">
                  No. Dok: <strong>{docNo}</strong>
                </div>
              )}
              <div className="text-[10px] text-slate-400 print:text-black">
                Mata Uang: <strong>{currency}</strong>
              </div>
            </div>
          </div>
          {/* Garis Ganda Standar Akuntansi */}
          <div className="border-b border-slate-400 mt-2.5"></div>
        </div>
      )}

      {/* Judul Laporan & Periode */}
      <div className="text-center space-y-1 mb-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-900 print:text-black">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs font-semibold text-slate-700 print:text-black">
            {subtitle}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 print:text-black pt-0.5">
          <span>Dicetak: {formattedPrintedDate} WIB</span>
          <span>&bull;</span>
          <span>Oleh: <strong>{printedBy}</strong></span>
        </div>

        {/* Badge Status (Misal: Neraca Seimbang) */}
        {badge && (
          <div className="pt-1.5 flex justify-center">
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}

