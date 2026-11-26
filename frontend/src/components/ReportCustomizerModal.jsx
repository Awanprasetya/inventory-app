import React, { useState, useEffect } from 'react';
import {
  Settings,
  Printer,
  FileText,
  Sliders,
  CheckCircle2,
  Building,
  UserCheck,
  RotateCcw,
  Eye,
  FileSpreadsheet,
  X,
  Upload,
  Trash2,
  Stamp,
  PenTool,
} from 'lucide-react';
import Modal from './Modal.jsx';
import { toastSuccess } from '../utils/alert.js';

export const DEFAULT_REPORT_CONFIG = {
  companyName: 'PT MEDIKA DISTRIBUSI INDONESIA',
  companyAddress: 'Jl. Boulevard Medika No. 88, Kawasan Pergudangan Sentra Niaga, Jakarta Barat',
  companyContact: 'Telp: (021) 8899-7722 | Email: finance@medikadistribusi.co.id | NPWP: 01.345.678.9-012.000',
  companyLogo: null,
  companyStamp: null,
  showStamp: true,
  stampPosition: 'signer2', // 'signer1' | 'signer2' | 'signer3'
  showCompanyHeader: true,
  docNo: '',
  hideZeroBalances: true,
  showAccountCodes: true,
  orientation: 'portrait', // 'portrait' | 'landscape'
  showSignatures: true,
  signatureCity: 'Jakarta',
  signatureDate: new Date().toISOString().split('T')[0],
  signer1: { title: 'Disiapkan Oleh', name: 'Staf Akuntansi', role: 'Accounting Staff', signature: null },
  signer2: { title: 'Diperiksa Oleh', name: 'Accounting Manager', role: 'Manajer Akuntansi', signature: null },
  signer3: { title: 'Disetujui Oleh', name: 'Direktur Keuangan', role: 'Direktur Keuangan / Direksi', signature: null },
  footerNote: 'Dokumen ini dihasilkan secara otomatis oleh Sistem ERP Terintegrasi dan sah sebagai laporan manajerial & keuangan.',
  columns: {
    // Kolom PO
    no_po: true,
    supplier: true,
    tanggal_po: true,
    jatuh_tempo: true,
    total_tagihan: true,
    status_bayar: true,
    status_po: true,
    keterangan: true,
    // Kolom DO
    no_do: true,
    no_so: true,
    customer: true,
    tanggal_do: true,
    status_do: true,
    // Kolom SO
    tanggal_so: true,
    status_so: true,
    // Kolom Finance / AP / AR / Jurnal
    no_tagihan: true,
    tanggal: true,
    total_dibayar: true,
    sisa_utang: true,
    sisa_piutang: true,
    status: true,
    no_jurnal: true,
    sumber_ref: true,
    total_debit: true,
    total_kredit: true,
  },
};

export function loadSavedReportConfig(menuKey = 'DEFAULT') {
  try {
    const specificKey = `erp_accounting_report_config_${(menuKey || 'DEFAULT').toUpperCase()}`;
    const raw = localStorage.getItem(specificKey);
    let fallbackRaw = null;
    try {
      fallbackRaw = JSON.parse(localStorage.getItem('erp_accounting_report_config') || '{}');
    } catch (_) {}

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_REPORT_CONFIG,
        companyLogo: parsed.companyLogo || fallbackRaw?.companyLogo || null,
        companyStamp: parsed.companyStamp || fallbackRaw?.companyStamp || null,
        ...parsed,
        columns: {
          ...(DEFAULT_REPORT_CONFIG.columns || {}),
          ...(parsed.columns || {}),
        },
      };
    } else if (fallbackRaw && Object.keys(fallbackRaw).length > 0) {
      return {
        ...DEFAULT_REPORT_CONFIG,
        ...fallbackRaw,
        columns: {
          ...(DEFAULT_REPORT_CONFIG.columns || {}),
          ...(fallbackRaw.columns || {}),
        },
      };
    }
  } catch (_) {
    /* fallback to default */
  }
  return { ...DEFAULT_REPORT_CONFIG };
}

export function saveReportConfigToStorage(config, menuKey = 'DEFAULT') {
  try {
    const specificKey = `erp_accounting_report_config_${(menuKey || 'DEFAULT').toUpperCase()}`;
    localStorage.setItem(specificKey, JSON.stringify(config));
    // Simpan juga identitas kop global agar saling melengkapi
    try {
      const prevFallback = JSON.parse(localStorage.getItem('erp_accounting_report_config') || '{}');
      localStorage.setItem(
        'erp_accounting_report_config',
        JSON.stringify({
          ...prevFallback,
          companyName: config.companyName,
          companyAddress: config.companyAddress,
          companyContact: config.companyContact,
          companyLogo: config.companyLogo,
          companyStamp: config.companyStamp,
        })
      );
    } catch (_) {}
  } catch (_) {
    /* ignore */
  }
}

export default function ReportCustomizerModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  onApplyAndPrint,
  activeReportTitle = 'Laporan Keuangan',
  menuKey = 'DEFAULT',
}) {
  const [tab, setTab] = useState('company'); // 'company' | 'display' | 'signatures' | 'notes'
  const [form, setForm] = useState(config || DEFAULT_REPORT_CONFIG);

  useEffect(() => {
    if (config) {
      setForm(config);
    }
  }, [config, isOpen]);

  const handleFieldChange = (field, value) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    onChangeConfig(updated);
  };

  const handleSignerChange = (signerKey, subField, value) => {
    const updated = {
      ...form,
      [signerKey]: {
        ...form[signerKey],
        [subField]: value,
      },
    };
    setForm(updated);
    onChangeConfig(updated);
  };

  const handleColumnToggle = (columnKey, isChecked) => {
    const updated = {
      ...form,
      columns: {
        ...(form.columns || {}),
        [columnKey]: isChecked,
      },
    };
    setForm(updated);
    onChangeConfig(updated);
  };

  const handleSaveDefault = () => {
    saveReportConfigToStorage(form, menuKey);
    toastSuccess('Tersimpan!', `Pengaturan kustomisasi laporan ${menuKey} disimpan sebagai preferensi.`);
  };

  const handleReset = () => {
    setForm(DEFAULT_REPORT_CONFIG);
    onChangeConfig(DEFAULT_REPORT_CONFIG);
    saveReportConfigToStorage(DEFAULT_REPORT_CONFIG, menuKey);
    toastSuccess('Direset!', `Pengaturan laporan ${menuKey} dikembalikan ke format standar.`);
  };

  const handlePrintNow = () => {
    saveReportConfigToStorage(form, menuKey);
    onClose();
    setTimeout(() => {
      if (onApplyAndPrint) {
        onApplyAndPrint(form);
      } else {
        window.print();
      }
    }, 150);
  };

  const getReportColumns = () => {
    const norm = (menuKey || '').toUpperCase();
    if (norm === 'PO') {
      return [
        { key: 'no_po', label: '1. No PO' },
        { key: 'supplier', label: '2. Supplier' },
        { key: 'tanggal_po', label: '3. Tanggal PO' },
        { key: 'jatuh_tempo', label: '4. Jatuh Tempo' },
        { key: 'total_tagihan', label: '5. Total Tagihan' },
        { key: 'status_bayar', label: '6. Status Bayar' },
        { key: 'status_po', label: '7. Status PO' },
        { key: 'keterangan', label: '8. Keterangan' },
      ];
    }
    if (norm === 'DO') {
      return [
        { key: 'no_do', label: '1. No DO' },
        { key: 'no_so', label: '2. Ref SO' },
        { key: 'customer', label: '3. Customer' },
        { key: 'tanggal_do', label: '4. Tanggal DO' },
        { key: 'status_do', label: '5. Status DO' },
        { key: 'keterangan', label: '6. Keterangan' },
      ];
    }
    if (norm === 'SO') {
      return [
        { key: 'no_so', label: '1. No SO' },
        { key: 'customer', label: '2. Customer' },
        { key: 'tanggal_so', label: '3. Tanggal SO' },
        { key: 'jatuh_tempo', label: '4. Jatuh Tempo' },
        { key: 'total_tagihan', label: '5. Total Pesanan' },
        { key: 'status_bayar', label: '6. Status Bayar' },
        { key: 'status_so', label: '7. Status SO' },
        { key: 'keterangan', label: '8. Keterangan' },
      ];
    }
    return [
      { key: 'no_tagihan', label: 'No. Tagihan / Ref' },
      { key: 'supplier', label: 'Supplier / Rekanan' },
      { key: 'customer', label: 'Customer' },
      { key: 'tanggal', label: 'Tanggal Dokumen' },
      { key: 'jatuh_tempo', label: 'Jatuh Tempo' },
      { key: 'total_tagihan', label: 'Total Nominal Tagihan' },
      { key: 'total_dibayar', label: 'Total Dibayar / Diterima' },
      { key: 'sisa_utang', label: 'Sisa Utang / Piutang' },
      { key: 'status', label: 'Status Pembayaran' },
      { key: 'keterangan', label: 'Keterangan' },
    ];
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran berkas logo maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        handleFieldChange('companyLogo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran berkas stempel resmi maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        handleFieldChange('companyStamp', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignerSignatureUpload = (signerKey, e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran berkas tanda tangan maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        handleSignerChange(signerKey, 'signature', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      open={isOpen}
      onClose={onClose}
      title="Kustomisasi & Pengaturan Cetak Laporan (Customize PDF)"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Banner Info */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 flex items-start gap-2.5">
          <Sliders className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Kustomisasi Laporan {activeReportTitle}:</strong> Sesuaikan informasi kop surat perusahaan, sembunyikan akun saldo nol, lengkapi blok tanda tangan otorisasi, dan cetak dokumen ke format PDF standar A4.
          </div>
        </div>

        {/* Tab Sub-Navigation */}
        <div className="flex border-b border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('company')}
            className={`py-2 px-3 border-b-2 transition ${
              tab === 'company'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            1. Kop Perusahaan & Ref
          </button>
          <button
            type="button"
            onClick={() => setTab('display')}
            className={`py-2 px-3 border-b-2 transition ${
              tab === 'display'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            2. Tampilan & Saldo Nol
          </button>
          <button
            type="button"
            onClick={() => setTab('signatures')}
            className={`py-2 px-3 border-b-2 transition ${
              tab === 'signatures'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            3. Lembar Pengesahan
          </button>
          <button
            type="button"
            onClick={() => setTab('notes')}
            className={`py-2 px-3 border-b-2 transition ${
              tab === 'notes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            4. Catatan & Tata Letak
          </button>
        </div>

        {/* Content Tab 1: Kop Perusahaan */}
        {tab === 'company' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showCompanyHeader"
                checked={form.showCompanyHeader}
                onChange={(e) => handleFieldChange('showCompanyHeader', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="showCompanyHeader" className="font-semibold text-slate-700 cursor-pointer">
                Tampilkan Kop Surat Resmi Perusahaan di Bagian Atas
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Logo Perusahaan (Kop Laporan)</label>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                {form.companyLogo ? (
                  <img
                    src={form.companyLogo}
                    alt="Logo Perusahaan"
                    className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-lg border border-slate-200 bg-white p-1 shadow-2xs"
                  />
                ) : (
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400">
                    <Building className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="btn-secondary !py-1 !px-2.5 !text-xs cursor-pointer inline-flex items-center gap-1.5 font-semibold">
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>{form.companyLogo ? 'Ganti Logo' : 'Upload Logo Perusahaan'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                    {form.companyLogo && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('companyLogo', null)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">Format gambar: PNG, JPG, WebP, SVG (Maks. 2MB). Disimpan otomatis.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nama Perusahaan (Entity Name)</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => handleFieldChange('companyName', e.target.value)}
                placeholder="PT NAMA PERUSAHAAN"
                className="input text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Alamat Kantor / Pergudangan</label>
              <input
                type="text"
                value={form.companyAddress}
                onChange={(e) => handleFieldChange('companyAddress', e.target.value)}
                placeholder="Jl. Alamat Perusahaan No..."
                className="input text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Kontak & NPWP Perusahaan</label>
              <input
                type="text"
                value={form.companyContact}
                onChange={(e) => handleFieldChange('companyContact', e.target.value)}
                placeholder="Telp: (021)... | Email: ... | NPWP: ..."
                className="input text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nomor Dokumen / Referensi Dokumen (Opsional)</label>
              <input
                type="text"
                value={form.docNo}
                onChange={(e) => handleFieldChange('docNo', e.target.value)}
                placeholder="Contoh: RPT-KEU/2026/10/01"
                className="input text-xs"
              />
            </div>
          </div>
        )}

        {/* Content Tab 2: Tampilan Data & Saldo Nol */}
        {tab === 'display' && (
          <div className="space-y-4 text-xs">
            {/* Pilihan Kolom Tabel */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
                    Pilihan Kolom Tabel Laporan {menuKey !== 'DEFAULT' ? `(${menuKey})` : ''}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Centang kolom yang ingin ditampilkan pada dokumen laporan / PDF.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cols = getReportColumns();
                      const updated = { ...(form.columns || {}) };
                      cols.forEach((c) => {
                        updated[c.key] = true;
                      });
                      setForm((prev) => ({ ...prev, columns: updated }));
                      onChangeConfig({ ...form, columns: updated });
                    }}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    Centang Semua
                  </button>
                  <span className="text-slate-300">&bull;</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cols = getReportColumns();
                      const updated = { ...(form.columns || {}) };
                      cols.forEach((c) => {
                        updated[c.key] = false;
                      });
                      setForm((prev) => ({ ...prev, columns: updated }));
                      onChangeConfig({ ...form, columns: updated });
                    }}
                    className="text-[11px] text-slate-500 hover:underline font-semibold"
                  >
                    Hilangkan Semua
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {getReportColumns().map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-slate-200 hover:border-blue-400 transition"
                  >
                    <input
                      type="checkbox"
                      checked={form.columns?.[col.key] !== false}
                      onChange={(e) => handleColumnToggle(col.key, e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 font-medium text-[11px]">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="hideZeroBalances"
                  checked={form.hideZeroBalances}
                  onChange={(e) => handleFieldChange('hideZeroBalances', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <div>
                  <label htmlFor="hideZeroBalances" className="font-bold text-slate-800 cursor-pointer block">
                    Sembunyikan Akun Bersaldo Rp 0 (Hide Zero Balances)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Rekomendasi aktif: Menyembunyikan perkiraan akun yang tidak memiliki mutasi/saldo selama periode agar dokumen PDF rapi, padat, dan ringkas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 border-t border-slate-200 pt-2.5">
                <input
                  type="checkbox"
                  id="showAccountCodes"
                  checked={form.showAccountCodes}
                  onChange={(e) => handleFieldChange('showAccountCodes', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <div>
                  <label htmlFor="showAccountCodes" className="font-bold text-slate-800 cursor-pointer block">
                    Tampilkan Kolom Kode Akun (COA Code)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Menampilkan kode akun perkiraan di samping nama akun (misal: 1-1001 Kas, 4-1001 Pendapatan).
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Orientasi Kertas Cetak</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleFieldChange('orientation', 'portrait')}
                  className={`p-3 rounded-lg border text-left flex items-center gap-3 transition ${
                    form.orientation === 'portrait'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="w-5 h-7 border-2 border-current rounded flex items-center justify-center text-[9px]">A4</div>
                  <div>
                    <p className="text-xs">Portrait (Vertikal)</p>
                    <p className="text-[10px] text-slate-500 font-normal">Cocok untuk Laba Rugi, Neraca, Arus Kas</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleFieldChange('orientation', 'landscape')}
                  className={`p-3 rounded-lg border text-left flex items-center gap-3 transition ${
                    form.orientation === 'landscape'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="w-7 h-5 border-2 border-current rounded flex items-center justify-center text-[9px]">A4</div>
                  <div>
                    <p className="text-xs">Landscape (Horisontal)</p>
                    <p className="text-[10px] text-slate-500 font-normal">Cocok untuk Buku Besar, Neraca Saldo, Aging</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Tab 3: Pengesahan & Tanda Tangan */}
        {tab === 'signatures' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showSignatures"
                checked={form.showSignatures}
                onChange={(e) => handleFieldChange('showSignatures', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="showSignatures" className="font-semibold text-slate-700 cursor-pointer">
                Sertakan Lembar Pengesahan Tanda Tangan (3 Kolom Otorisasi)
              </label>
            </div>

            {form.showSignatures && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Kota Pengesahan</label>
                    <input
                      type="text"
                      value={form.signatureCity}
                      onChange={(e) => handleFieldChange('signatureCity', e.target.value)}
                      className="input text-xs"
                      placeholder="Jakarta"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Tanggal Pengesahan</label>
                    <input
                      type="date"
                      value={form.signatureDate}
                      onChange={(e) => handleFieldChange('signatureDate', e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                </div>

                {/* Pihak 1 */}
                <div className="border border-slate-200 rounded-lg p-3 space-y-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-blue-600" />
                      Pihak 1: Disiapkan Oleh (Pembuat Laporan)
                    </span>
                    {form.signer1?.signature && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> TTD Terpasang
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={form.signer1.title}
                      onChange={(e) => handleSignerChange('signer1', 'title', e.target.value)}
                      className="input text-xs"
                      placeholder="Disiapkan Oleh"
                    />
                    <input
                      type="text"
                      value={form.signer1.name}
                      onChange={(e) => handleSignerChange('signer1', 'name', e.target.value)}
                      className="input text-xs"
                      placeholder="Nama Terang"
                    />
                    <input
                      type="text"
                      value={form.signer1.role}
                      onChange={(e) => handleSignerChange('signer1', 'role', e.target.value)}
                      className="input text-xs"
                      placeholder="Jabatan"
                    />
                  </div>
                  {/* Upload TTD Pihak 1 */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      {form.signer1?.signature ? (
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200">
                          <img
                            src={form.signer1.signature}
                            alt="TTD Pihak 1"
                            className="h-11 max-w-[110px] object-contain bg-slate-50 rounded"
                          />
                          <span className="text-[11px] text-slate-600 font-medium">Gambar TTD Aktif</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Belum ada gambar TTD (otomatis sediakan ruang kosong untuk paraf manual)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="btn-secondary !py-1 !px-2.5 !text-xs cursor-pointer inline-flex items-center gap-1 font-semibold">
                        <Upload className="w-3 h-3 text-blue-600" />
                        <span>{form.signer1?.signature ? 'Ganti TTD' : 'Upload TTD'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSignerSignatureUpload('signer1', e)}
                        />
                      </label>
                      {form.signer1?.signature && (
                        <button
                          type="button"
                          onClick={() => handleSignerChange('signer1', 'signature', null)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Hapus TTD Pihak 1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pihak 2 */}
                <div className="border border-slate-200 rounded-lg p-3 space-y-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-blue-600" />
                      Pihak 2: Diperiksa Oleh (Accounting Manager)
                    </span>
                    {form.signer2?.signature && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> TTD Terpasang
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={form.signer2.title}
                      onChange={(e) => handleSignerChange('signer2', 'title', e.target.value)}
                      className="input text-xs"
                      placeholder="Diperiksa Oleh"
                    />
                    <input
                      type="text"
                      value={form.signer2.name}
                      onChange={(e) => handleSignerChange('signer2', 'name', e.target.value)}
                      className="input text-xs"
                      placeholder="Nama Terang"
                    />
                    <input
                      type="text"
                      value={form.signer2.role}
                      onChange={(e) => handleSignerChange('signer2', 'role', e.target.value)}
                      className="input text-xs"
                      placeholder="Jabatan"
                    />
                  </div>
                  {/* Upload TTD Pihak 2 */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      {form.signer2?.signature ? (
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200">
                          <img
                            src={form.signer2.signature}
                            alt="TTD Pihak 2"
                            className="h-11 max-w-[110px] object-contain bg-slate-50 rounded"
                          />
                          <span className="text-[11px] text-slate-600 font-medium">Gambar TTD Aktif</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Belum ada gambar TTD (otomatis sediakan ruang kosong untuk paraf manual)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="btn-secondary !py-1 !px-2.5 !text-xs cursor-pointer inline-flex items-center gap-1 font-semibold">
                        <Upload className="w-3 h-3 text-blue-600" />
                        <span>{form.signer2?.signature ? 'Ganti TTD' : 'Upload TTD'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSignerSignatureUpload('signer2', e)}
                        />
                      </label>
                      {form.signer2?.signature && (
                        <button
                          type="button"
                          onClick={() => handleSignerChange('signer2', 'signature', null)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Hapus TTD Pihak 2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pihak 3 */}
                <div className="border border-slate-200 rounded-lg p-3 space-y-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-blue-600" />
                      Pihak 3: Disetujui Oleh (Direksi / Direktur Keuangan)
                    </span>
                    {form.signer3?.signature && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> TTD Terpasang
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={form.signer3.title}
                      onChange={(e) => handleSignerChange('signer3', 'title', e.target.value)}
                      className="input text-xs"
                      placeholder="Disetujui Oleh"
                    />
                    <input
                      type="text"
                      value={form.signer3.name}
                      onChange={(e) => handleSignerChange('signer3', 'name', e.target.value)}
                      className="input text-xs"
                      placeholder="Nama Terang"
                    />
                    <input
                      type="text"
                      value={form.signer3.role}
                      onChange={(e) => handleSignerChange('signer3', 'role', e.target.value)}
                      className="input text-xs"
                      placeholder="Jabatan"
                    />
                  </div>
                  {/* Upload TTD Pihak 3 */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      {form.signer3?.signature ? (
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200">
                          <img
                            src={form.signer3.signature}
                            alt="TTD Pihak 3"
                            className="h-11 max-w-[110px] object-contain bg-slate-50 rounded"
                          />
                          <span className="text-[11px] text-slate-600 font-medium">Gambar TTD Aktif</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Belum ada gambar TTD (otomatis sediakan ruang kosong untuk paraf manual)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="btn-secondary !py-1 !px-2.5 !text-xs cursor-pointer inline-flex items-center gap-1 font-semibold">
                        <Upload className="w-3 h-3 text-blue-600" />
                        <span>{form.signer3?.signature ? 'Ganti TTD' : 'Upload TTD'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSignerSignatureUpload('signer3', e)}
                        />
                      </label>
                      {form.signer3?.signature && (
                        <button
                          type="button"
                          onClick={() => handleSignerChange('signer3', 'signature', null)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Hapus TTD Pihak 3"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stempel & Cap Resmi Perusahaan */}
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                        <Stamp className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">
                          Stempel / Cap Resmi Perusahaan (Company Seal)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Stempel dicetak otomatis bertumpuk realistis di atas lembar tanda tangan pengesahan
                        </span>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.showStamp !== false}
                        onChange={(e) => handleFieldChange('showStamp', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Aktifkan Stempel</span>
                    </label>
                  </div>

                  {form.showStamp !== false && (
                    <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-3">
                      <div className="flex items-center gap-3">
                        {form.companyStamp ? (
                          <div className="relative">
                            <img
                              src={form.companyStamp}
                              alt="Stempel Perusahaan"
                              className="h-14 w-14 object-contain rounded-lg border border-slate-200 bg-white p-1 -rotate-6 shadow-sm"
                            />
                          </div>
                        ) : (
                          <div className="h-14 w-14 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 flex flex-col items-center justify-center text-blue-400">
                            <Stamp className="w-6 h-6" />
                          </div>
                        )}

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <label className="btn-secondary !py-1 !px-2.5 !text-xs cursor-pointer inline-flex items-center gap-1.5 font-semibold">
                              <Upload className="w-3.5 h-3.5 text-blue-600" />
                              <span>{form.companyStamp ? 'Ganti Stempel' : 'Upload Berkas Stempel'}</span>
                              <input type="file" accept="image/*" className="hidden" onChange={handleStampUpload} />
                            </label>
                            {form.companyStamp && (
                              <button
                                type="button"
                                onClick={() => handleFieldChange('companyStamp', null)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Hapus Stempel"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Disarankan format PNG transparan (Maks. 2MB). Disimpan otomatis di browser.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                          Posisi Letak Stempel pada Lembar Pengesahan:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {[
                            { value: 'signer2', label: 'Pihak 2 (Manager / Pemeriksa) [Default]' },
                            { value: 'signer3', label: 'Pihak 3 (Direksi / Penyetuju)' },
                            { value: 'signer1', label: 'Pihak 1 (Pembuat Dokumen)' },
                          ].map((pos) => (
                            <label
                              key={pos.value}
                              className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition ${
                                (form.stampPosition || 'signer2') === pos.value
                                  ? 'border-blue-600 bg-blue-50/60 font-semibold text-blue-900'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name="stampPosition"
                                value={pos.value}
                                checked={(form.stampPosition || 'signer2') === pos.value}
                                onChange={(e) => handleFieldChange('stampPosition', e.target.value)}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-[11px]">{pos.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Content Tab 4: Catatan Kaki */}
        {tab === 'notes' && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Catatan Kaki Laporan (Footer Legal Note)</label>
              <textarea
                rows={3}
                value={form.footerNote}
                onChange={(e) => handleFieldChange('footerNote', e.target.value)}
                className="input text-xs w-full"
                placeholder="Keterangan audit atau disclaimer laporan..."
              />
            </div>
            <p className="text-[11px] text-slate-500 italic">
              Catatan kaki akan dicetak di bagian paling bawah halaman pengesahan dokumen PDF.
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Reset Standar
            </button>
            <button
              type="button"
              onClick={handleSaveDefault}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              Simpan Default
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrintNow}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              Terapkan & Cetak PDF Sekarang
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

