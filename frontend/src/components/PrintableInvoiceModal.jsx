import React, { useState, useEffect } from 'react';
import {
  Printer,
  Sliders,
  X,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Phone,
  MapPin,
  Clock,
  RotateCcw,
  Save,
  Upload,
  Trash2,
  Stamp,
  PenTool,
} from 'lucide-react';
import { formatRupiah, formatDate, formatDateTime, formatNumber } from '../services/api.js';
import { toastSuccess } from '../utils/alert.js';

export const DEFAULT_INVOICE_CONFIG = {
  companyName: 'PT MEDIKA DISTRIBUSI INDONESIA',
  companyAddress: 'Jl. Boulevard Medika No. 88, Kawasan Pergudangan Sentra Niaga, Jakarta Barat',
  companyContact: 'Telp: (021) 8899-7722 | Email: finance@medikadistribusi.co.id | NPWP: 01.345.678.9-012.000',
  companyLogo: null,
  companyStamp: null,
  showStamp: true,
  stampPosition: 'signer2', // 'signer1' | 'signer2' | 'signer3'
  showCompanyHeader: true,
  bankName1: 'BCA (Bank Central Asia)',
  bankAccount1: '883-019-2811',
  bankHolder1: 'PT MEDIKA DISTRIBUSI INDONESIA',
  bankName2: 'Bank Mandiri',
  bankAccount2: '133-00-9821-4421',
  bankHolder2: 'PT MEDIKA DISTRIBUSI INDONESIA',
  showBankDetails: true,
  showOrderStatus: true, // Tampilkan Badge Status Pesanan / Status Pengiriman
  showPaymentStatus: true, // Tampilkan Badge / Label Status Pembayaran
  showDueDate: true, // Tampilkan Tanggal Jatuh Tempo
  showPaymentHistory: true, // Tampilkan Tabel Riwayat Pembayaran (Termin / Angsuran)
  showSignatures: true, // Tampilkan Blok Lembar Pengesahan & Tanda Tangan
  showSigner1: true, // Tampilkan Kolom Pihak 1 (Penerbit)
  showSigner2: true, // Tampilkan Kolom Pihak 2 (Menyetujui)
  showSigner3: true, // Tampilkan Kolom Pihak 3 (Lawan Transaksi)
  signatureCity: 'Jakarta',
  signer1Title: 'Dibuat Oleh (Finance)',
  signer1Name: 'Staf Keuangan & Penagihan',
  signer1Signature: null,
  signer2Title: 'Disetujui Oleh',
  signer2Name: 'Accounting & Finance Manager',
  signer2Signature: null,
  signer3Title: 'Tanda Terima Customer',
  signer3Name: '(Tanda Tangan & Cap Stempel)',
  signer3Signature: null,
  invoiceNotes:
    '1. Pembayaran sah apabila dana telah efektif diterima di rekening resmi perusahaan di atas.\n2. Harap mencantumkan Nomor Invoice pada berita transfer.\n3. Konfirmasi pembayaran dapat dikirimkan ke email finance@medikadistribusi.co.id atau WhatsApp Keuangan.',
  columns: {
    // Delivery Order (DO)
    do_no: true,
    do_lot: true,
    do_item: true,
    do_expired_date: true,
    do_qty: true,
    do_kondisi: true,
    // PO, SO, AP, AR
    inv_no: true,
    inv_item: true,
    inv_qty: true,
    inv_harga: true,
    inv_diskon: true,
    inv_subtotal: true,
    // Status Dokumen
    show_status_pesanan: true,
    show_status_pembayaran: true,
    show_jatuh_tempo: true,
    show_riwayat_pembayaran: true,
    show_signatures: true,
  },
};

export function loadSavedInvoiceConfig(type = 'AR') {
  try {
    const specificKey = `erp_invoice_custom_config_${(type || 'AR').toUpperCase()}`;
    const raw = localStorage.getItem(specificKey);
    let fallbackRaw = null;
    try {
      fallbackRaw = JSON.parse(localStorage.getItem('erp_invoice_custom_config') || '{}');
    } catch (_) {}
    let reportRaw = null;
    try {
      reportRaw = JSON.parse(localStorage.getItem('erp_accounting_report_config') || '{}');
    } catch (_) {}

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_INVOICE_CONFIG,
        companyLogo: parsed.companyLogo || fallbackRaw?.companyLogo || reportRaw?.companyLogo || null,
        companyStamp: parsed.companyStamp || fallbackRaw?.companyStamp || reportRaw?.companyStamp || null,
        showOrderStatus: parsed.showOrderStatus !== undefined ? parsed.showOrderStatus : (parsed.columns?.show_status_pesanan !== undefined ? parsed.columns?.show_status_pesanan : true),
        showPaymentStatus: parsed.showPaymentStatus !== undefined ? parsed.showPaymentStatus : (parsed.columns?.show_status_pembayaran !== undefined ? parsed.columns?.show_status_pembayaran : true),
        showDueDate: parsed.showDueDate !== undefined ? parsed.showDueDate : (parsed.columns?.show_jatuh_tempo !== undefined ? parsed.columns?.show_jatuh_tempo : true),
        showPaymentHistory: parsed.showPaymentHistory !== undefined ? parsed.showPaymentHistory : (parsed.columns?.show_riwayat_pembayaran !== undefined ? parsed.columns?.show_riwayat_pembayaran : true),
        showSignatures: parsed.showSignatures !== undefined ? parsed.showSignatures : (parsed.columns?.show_signatures !== undefined ? parsed.columns?.show_signatures : true),
        showSigner1: parsed.showSigner1 !== undefined ? parsed.showSigner1 : true,
        showSigner2: parsed.showSigner2 !== undefined ? parsed.showSigner2 : true,
        showSigner3: parsed.showSigner3 !== undefined ? parsed.showSigner3 : true,
        ...parsed,
        columns: {
          ...(DEFAULT_INVOICE_CONFIG.columns || {}),
          ...(parsed.columns || {}),
        },
      };
    } else if (fallbackRaw && Object.keys(fallbackRaw).length > 0) {
      return {
        ...DEFAULT_INVOICE_CONFIG,
        ...fallbackRaw,
        companyStamp: fallbackRaw.companyStamp || reportRaw?.companyStamp || null,
        companyLogo: fallbackRaw.companyLogo || reportRaw?.companyLogo || null,
        columns: { ...(DEFAULT_INVOICE_CONFIG.columns || {}) },
      };
    } else if (reportRaw?.companyStamp || reportRaw?.companyLogo) {
      return {
        ...DEFAULT_INVOICE_CONFIG,
        companyStamp: reportRaw.companyStamp || null,
        companyLogo: reportRaw.companyLogo || null,
      };
    }
  } catch (_) {}
  return DEFAULT_INVOICE_CONFIG;
}

export function saveInvoiceConfigToStorage(config, type = 'AR') {
  try {
    const specificKey = `erp_invoice_custom_config_${(type || 'AR').toUpperCase()}`;
    localStorage.setItem(specificKey, JSON.stringify(config));
    // Simpan juga identitas kop global agar sinkron dengan template lain
    try {
      const prevFallback = JSON.parse(localStorage.getItem('erp_invoice_custom_config') || '{}');
      localStorage.setItem(
        'erp_invoice_custom_config',
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
  } catch (_) {}
}

export default function PrintableInvoiceModal({
  isOpen,
  onClose,
  type = 'AR', // 'AR' (Sales Invoice) | 'AP' (Purchase Invoice) | 'PO' (Purchase Order) | 'SO' (Sales Order) | 'DO' (Delivery Order / Surat Jalan)
  data = null,
  loading = false,
}) {
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'customize'
  const [config, setConfig] = useState(DEFAULT_INVOICE_CONFIG);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadSavedInvoiceConfig(type));
      setActiveTab('preview');
    }
  }, [isOpen, type]);

  if (!isOpen || !data) return null;

  const isAR = type === 'AR';
  const isAP = type === 'AP';
  const isPO = type === 'PO';
  const isSO = type === 'SO';
  const isDO = type === 'DO';

  let docTitle = 'FAKTUR';
  let docSubTitle = 'INVOICE';
  if (isAR) {
    docTitle = 'FAKTUR PENJUALAN';
    docSubTitle = 'SALES INVOICE';
  } else if (isAP) {
    docTitle = 'FAKTUR PEMBELIAN / BUKTI TAGIHAN';
    docSubTitle = 'PURCHASE INVOICE / VENDOR BILL';
  } else if (isPO) {
    docTitle = 'SURAT PESANAN PEMBELIAN';
    docSubTitle = 'PURCHASE ORDER (PO)';
  } else if (isSO) {
    docTitle = 'SURAT PESANAN PENJUALAN';
    docSubTitle = 'SALES ORDER (SO)';
  } else if (isDO) {
    docTitle = 'SURAT JALAN PENGIRIMAN BARANG';
    docSubTitle = 'DELIVERY ORDER (SURAT JALAN)';
  }

  let partnerLabel = 'DITUJUKAN KEPADA:';
  if (isAR) partnerLabel = 'DITAGIHKAN KEPADA (BILL TO):';
  else if (isAP) partnerLabel = 'DITERBITKAN OLEH (VENDOR / SUPPLIER):';
  else if (isPO) partnerLabel = 'DIPESAN KEPADA (SUPPLIER / VENDOR):';
  else if (isSO) partnerLabel = 'DIPESAN OLEH (CUSTOMER / PELANGGAN):';
  else if (isDO) partnerLabel = 'TUJUAN PENGIRIMAN (CONSIGNEE / SHIP TO):';

  const partnerName = isAP || isPO ? data.nama_supplier : data.nama_customer;
  const partnerCode = isAP || isPO ? data.kode_supplier : data.kode_customer;
  const partnerPhone = isAP || isPO ? data.supplier_telepon : data.customer_telepon;
  const partnerAddress = isAP || isPO
    ? (data.supplier_alamat || data.alamat)
    : (data.alamat_pengiriman || data.customer_alamat || data.alamat);

  const docNo = isPO ? data.no_po : isSO ? data.no_so : isDO ? data.no_do : (data.no_tagihan || '-');
  const docDate = isPO ? data.tanggal_po : isSO ? data.tanggal_so : isDO ? data.tanggal_do : data.tanggal;

  const refNo = isDO ? data.no_so : isAR ? data.no_so : isAP ? data.no_po : null;
  const refLabel = isDO ? 'No. Referensi Sales Order (SO)' : isAR ? 'No. Sales Order (SO)' : 'No. Purchase Order (PO)';

  const totalTagihan = Number(data.total_harga ?? data.total_tagihan ?? 0);
  const totalDibayar = Number(data.total_dibayar || 0);
  const sisa = Number(
    isAR
      ? data.sisa_piutang
      : isAP
      ? data.sisa_utang
      : isSO
      ? (data.sisa_piutang !== null && data.sisa_piutang !== undefined ? data.sisa_piutang : totalTagihan)
      : isPO
      ? (data.sisa_utang !== null && data.sisa_utang !== undefined ? data.sisa_utang : totalTagihan)
      : Math.max(0, totalTagihan - totalDibayar)
  );
  const isBelumDitagih =
    (isSO || isPO) &&
    !data.ar_id &&
    !data.ap_id &&
    (data.status_pembayaran === 'BELUM_DITAGIH' || data.status_pembayaran === 'BELUM_DITAGIHKAN');
  const isLunas =
    !isBelumDitagih &&
    (data.status_pembayaran === 'LUNAS' ||
      data.status === 'LUNAS' ||
      data.status === 'COMPLETED' ||
      (totalTagihan > 0 && sisa <= 0));

  const items = data.details || data.items || [];
  const payments = data.payments || data.apDetails?.payments || data.arDetails?.payments || [];

  // Default Signers bila belum diubah secara kustom
  let signer1Title = config.signer1Title;
  let signer1Name = config.signer1Name;
  let signer2Title = config.signer2Title;
  let signer2Name = config.signer2Name;
  let signer3Title = config.signer3Title;
  let signer3Name = config.signer3Name;

  if (config.signer1Title === DEFAULT_INVOICE_CONFIG.signer1Title) {
    if (isPO) {
      signer1Title = 'Dibuat Oleh (Purchasing)';
      signer1Name = 'Staff Pengadaan & Pembelian';
      signer2Title = 'Disetujui Oleh';
      signer2Name = 'Purchasing Manager / Direksi';
      signer3Title = 'Konfirmasi Supplier';
      signer3Name = partnerName || '(Tanda Tangan & Cap Rekanan)';
    } else if (isSO) {
      signer1Title = 'Dibuat Oleh (Sales)';
      signer1Name = 'Staff Penjualan & Marketing';
      signer2Title = 'Disetujui Oleh';
      signer2Name = 'Sales Manager / Direksi';
      signer3Title = 'Tanda Terima Pelanggan';
      signer3Name = partnerName || '(Tanda Tangan & Cap Pelanggan)';
    } else if (isDO) {
      signer1Title = 'Petugas Gudang (Pengirim)';
      signer1Name = 'Kepala Gudang / Logistik';
      signer2Title = 'Pengemudi / Ekspedisi';
      signer2Name = 'Driver / Kurir Pengantar';
      signer3Title = 'Penerima Barang';
      signer3Name = partnerName || '(Tanda Tangan & Cap Penerima)';
    } else if (isAP) {
      signer1Title = 'Diverifikasi Oleh (Finance)';
      signer1Name = 'Staff Keuangan & Hutang';
      signer2Title = 'Disetujui Oleh';
      signer2Name = 'Accounting & Finance Manager';
      signer3Title = 'Penerbit Tagihan (Vendor)';
      signer3Name = partnerName || '(Tanda Tangan & Cap Vendor)';
    }
  }

  // Catatan Dokumen Default bila belum diubah secara kustom
  let displayNotes = config.invoiceNotes;
  if (config.invoiceNotes === DEFAULT_INVOICE_CONFIG.invoiceNotes) {
    if (isDO) {
      displayNotes = '1. Harap diperiksa kondisi segel dan fisik barang saat serah terima.\n2. Komplain/klaim kerusakan atau kekurangan barang maksimal 2x24 jam sejak penerimaan.\n3. Surat jalan ini merupakan bukti serah terima barang yang sah.';
    } else if (isPO) {
      displayNotes = '1. Barang yang dikirim harus sesuai dengan spesifikasi dan tanggal kadaluarsa (ED) minimal 18 bulan.\n2. Surat pesanan ini sah apabila telah ditandatangani dan distempel resmi.\n3. Harap mencantumkan Nomor PO ini pada Surat Jalan dan Faktur Tagihan.';
    } else if (isSO) {
      displayNotes = '1. Pesanan akan diproses dan dikirimkan setelah konfirmasi pemesanan / PO diterima.\n2. Pembayaran dapat dilakukan sesuai termin yang disepakati melalui rekening resmi di atas.\n3. Harap mencantumkan Nomor SO pada berita acara atau bukti transfer.';
    }
  }

  const handlePrint = () => {
    if (activeTab !== 'preview') {
      setActiveTab('preview');
    }

    setTimeout(() => {
      const content = document.getElementById('printable-invoice-content');
      if (!content) {
        window.print();
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();

      const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((node) => node.outerHTML)
        .join('\n');

      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${docNo || docTitle}</title>
            ${headStyles}
            <style>
              @media print {
                @page { size: A4 portrait; margin: 1cm; }
                body { background: #ffffff !important; color: #0f172a !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              }
              body { background: #ffffff !important; margin: 0; padding: 16px; font-family: ui-sans-serif, system-ui, sans-serif; }
              #printable-invoice-content { max-width: 100% !important; box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }
            </style>
          </head>
          <body>
            <div id="printable-invoice-content">
              ${content.innerHTML}
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 250);
    }, activeTab !== 'preview' ? 150 : 0);
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    saveInvoiceConfigToStorage(config, type);
    toastSuccess(`Pengaturan template cetak ${type} berhasil disimpan`);
    setActiveTab('preview');
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
        setConfig((prev) => ({ ...prev, companyLogo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran berkas stempel maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setConfig((prev) => ({ ...prev, companyStamp: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignerSignatureUpload = (field, e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran berkas tanda tangan maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setConfig((prev) => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColumnToggle = (columnKey, checked) => {
    setConfig((prev) => ({
      ...prev,
      columns: {
        ...(prev.columns || {}),
        [columnKey]: checked,
      },
    }));
  };

  const handleSelectAllColumns = () => {
    if (isDO) {
      setConfig((prev) => ({
        ...prev,
        showOrderStatus: true,
        showSignatures: true,
        showSigner1: true,
        showSigner2: true,
        showSigner3: true,
        columns: {
          ...(prev.columns || {}),
          do_no: true,
          do_lot: true,
          do_item: true,
          do_expired_date: true,
          do_qty: true,
          do_kondisi: true,
          show_status_pesanan: true,
          show_signatures: true,
        },
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        showOrderStatus: true,
        showPaymentStatus: true,
        showDueDate: true,
        showPaymentHistory: true,
        showSignatures: true,
        showSigner1: true,
        showSigner2: true,
        showSigner3: true,
        columns: {
          ...(prev.columns || {}),
          inv_no: true,
          inv_item: true,
          inv_qty: true,
          inv_harga: true,
          inv_diskon: true,
          inv_subtotal: true,
          show_status_pesanan: true,
          show_status_pembayaran: true,
          show_jatuh_tempo: true,
          show_riwayat_pembayaran: true,
          show_signatures: true,
        },
      }));
    }
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_INVOICE_CONFIG);
    saveInvoiceConfigToStorage(DEFAULT_INVOICE_CONFIG, type);
    toastSuccess(`Pengaturan template cetak ${type} dikembalikan ke default`);
  };

  return (
    <div
      id="printable-invoice-modal-root"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden invoice-print-container">
        {/* Header Modal (Disembunyikan saat Cetak) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white print:hidden border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {docTitle}: <span className="font-mono text-blue-300">{docNo}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {isDO ? 'Tujuan Pengiriman' : 'Lawan Transaksi'}: <strong>{partnerName || '-'}</strong>
                {!isDO && (
                  <> &bull; Total: <strong>{formatRupiah(totalTagihan)}</strong></>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Pratinjau Faktur
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('customize')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${
                  activeTab === 'customize'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Kustomisasi Template
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition"
              title="Cetak Faktur Resmi ke PDF / Printer"
            >
              <Printer className="w-4 h-4" />
              Cetak / Download PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Konten Modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 print:p-0 print:bg-white print:overflow-visible">
          {/* TAB 1: FORM KUSTOMISASI */}
          {activeTab === 'customize' && (
            <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-xl border border-slate-200 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Pengaturan Kop & Identitas Faktur
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kustomisasi identitas perusahaan, rekening pembayaran bank, dan penandatangan dokumen faktur.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Default
                </button>
              </div>

              {/* Kop Perusahaan */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Logo Perusahaan (Kop Faktur)</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {config.companyLogo ? (
                      <img
                        src={config.companyLogo}
                        alt="Logo Perusahaan"
                        className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-lg border border-slate-200 bg-white p-1 shadow-2xs"
                      />
                    ) : (
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold shrink-0">
                        <Building2 className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="btn-secondary !py-1 !px-2.5 !text-xs cursor-pointer inline-flex items-center gap-1.5 font-semibold">
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          <span>{config.companyLogo ? 'Ganti Logo' : 'Upload Logo Perusahaan'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                        {config.companyLogo && (
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, companyLogo: null })}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Hapus Logo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">Format gambar: PNG, JPG, WebP, SVG (Maks. 2MB).</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Perusahaan / Entitas</label>
                    <input
                      type="text"
                      value={config.companyName}
                      onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                      className="input text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kontak, Email & NPWP</label>
                    <input
                      type="text"
                      value={config.companyContact}
                      onChange={(e) => setConfig({ ...config, companyContact: e.target.value })}
                      className="input text-xs"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Lengkap Kantor / Gudang</label>
                  <input
                    type="text"
                    value={config.companyAddress}
                    onChange={(e) => setConfig({ ...config, companyAddress: e.target.value })}
                    className="input text-xs"
                    required
                  />
                </div>
              </div>

              {/* Rekening Bank Pembayaran */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Instruksi Rekening Bank Tujuan
                  </h4>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showBankDetails}
                      onChange={(e) => setConfig({ ...config, showBankDetails: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Tampilkan Rekening Bank pada Faktur
                  </label>
                </div>

                {config.showBankDetails && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {/* Bank 1 */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-blue-700">Rekening Bank 1:</span>
                      <input
                        type="text"
                        placeholder="Nama Bank (e.g. BCA)"
                        value={config.bankName1}
                        onChange={(e) => setConfig({ ...config, bankName1: e.target.value })}
                        className="input text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Nomor Rekening"
                        value={config.bankAccount1}
                        onChange={(e) => setConfig({ ...config, bankAccount1: e.target.value })}
                        className="input text-xs font-mono font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Atas Nama Pemilik Rekening"
                        value={config.bankHolder1}
                        onChange={(e) => setConfig({ ...config, bankHolder1: e.target.value })}
                        className="input text-xs"
                      />
                    </div>

                    {/* Bank 2 */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-blue-700">Rekening Bank 2 (Opsional):</span>
                      <input
                        type="text"
                        placeholder="Nama Bank (e.g. Bank Mandiri)"
                        value={config.bankName2}
                        onChange={(e) => setConfig({ ...config, bankName2: e.target.value })}
                        className="input text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Nomor Rekening"
                        value={config.bankAccount2}
                        onChange={(e) => setConfig({ ...config, bankAccount2: e.target.value })}
                        className="input text-xs font-mono font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Atas Nama Pemilik Rekening"
                        value={config.bankHolder2}
                        onChange={(e) => setConfig({ ...config, bankHolder2: e.target.value })}
                        className="input text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pengesahan Tanda Tangan */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase tracking-wider text-slate-800">
                    <input
                      type="checkbox"
                      checked={config.showSignatures !== false && config.columns?.show_signatures !== false}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setConfig((prev) => ({
                          ...prev,
                          showSignatures: val,
                          columns: { ...(prev.columns || {}), show_signatures: val },
                        }));
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Tampilkan Blok Pengesahan & Tanda Tangan</span>
                  </label>
                  {config.showSignatures !== false && config.columns?.show_signatures !== false && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Kota Dokumen:</span>
                      <input
                        type="text"
                        value={config.signatureCity}
                        onChange={(e) => setConfig({ ...config, signatureCity: e.target.value })}
                        className="input !w-32 !py-1 text-xs"
                      />
                    </div>
                  )}
                </div>

                {config.showSignatures === false || config.columns?.show_signatures === false ? (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <span className="font-semibold">Perhatian:</span> Blok pengesahan dan lembar tanda tangan dinonaktifkan. Dokumen cetak PDF tidak akan memuat kolom tanda tangan.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Pihak 1 */}
                    <div className={`p-3 rounded-lg border transition ${config.showSigner1 !== false ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100 opacity-60'} space-y-2.5`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={config.showSigner1 !== false}
                            onChange={(e) => setConfig({ ...config, showSigner1: e.target.checked })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <PenTool className="w-3 h-3 text-blue-600" /> Pihak 1 (Penerbit):
                        </label>
                        {config.signer1Signature && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            TTD Ada
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Jabatan (e.g. Dibuat Oleh)"
                        value={config.signer1Title}
                        onChange={(e) => setConfig({ ...config, signer1Title: e.target.value })}
                        disabled={config.showSigner1 === false}
                        className="input text-xs disabled:bg-slate-200 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        placeholder="Nama Terang"
                        value={config.signer1Name}
                        onChange={(e) => setConfig({ ...config, signer1Name: e.target.value })}
                        disabled={config.showSigner1 === false}
                        className="input text-xs font-semibold disabled:bg-slate-200 disabled:cursor-not-allowed"
                      />
                      {/* Upload TTD 1 */}
                      <div className="pt-1 border-t border-slate-200 flex items-center justify-between">
                        {config.signer1Signature ? (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={config.signer1Signature}
                              alt="TTD 1"
                              className="h-10 max-w-[100px] object-contain rounded border bg-white p-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => setConfig({ ...config, signer1Signature: null })}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                              title="Hapus TTD"
                              disabled={config.showSigner1 === false}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Ruang TTD manual</span>
                        )}
                        <label className={`btn-secondary !py-1 !px-2 !text-[11px] inline-flex items-center gap-1 font-semibold ${config.showSigner1 === false ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                          <Upload className="w-3 h-3 text-blue-600" />
                          <span>{config.signer1Signature ? 'Ganti' : 'Upload TTD'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={config.showSigner1 === false}
                            onChange={(e) => handleSignerSignatureUpload('signer1Signature', e)}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Pihak 2 */}
                    <div className={`p-3 rounded-lg border transition ${config.showSigner2 !== false ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100 opacity-60'} space-y-2.5`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={config.showSigner2 !== false}
                            onChange={(e) => setConfig({ ...config, showSigner2: e.target.checked })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <PenTool className="w-3 h-3 text-blue-600" /> Pihak 2 (Menyetujui):
                        </label>
                        {config.signer2Signature && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            TTD Ada
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Jabatan (e.g. Disetujui Oleh)"
                        value={config.signer2Title}
                        onChange={(e) => setConfig({ ...config, signer2Title: e.target.value })}
                        disabled={config.showSigner2 === false}
                        className="input text-xs disabled:bg-slate-200 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        placeholder="Nama Terang"
                        value={config.signer2Name}
                        onChange={(e) => setConfig({ ...config, signer2Name: e.target.value })}
                        disabled={config.showSigner2 === false}
                        className="input text-xs font-semibold disabled:bg-slate-200 disabled:cursor-not-allowed"
                      />
                      {/* Upload TTD 2 */}
                      <div className="pt-1 border-t border-slate-200 flex items-center justify-between">
                        {config.signer2Signature ? (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={config.signer2Signature}
                              alt="TTD 2"
                              className="h-10 max-w-[100px] object-contain rounded border bg-white p-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => setConfig({ ...config, signer2Signature: null })}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                              title="Hapus TTD"
                              disabled={config.showSigner2 === false}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Ruang TTD manual</span>
                        )}
                        <label className={`btn-secondary !py-1 !px-2 !text-[11px] inline-flex items-center gap-1 font-semibold ${config.showSigner2 === false ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                          <Upload className="w-3 h-3 text-blue-600" />
                          <span>{config.signer2Signature ? 'Ganti' : 'Upload TTD'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={config.showSigner2 === false}
                            onChange={(e) => handleSignerSignatureUpload('signer2Signature', e)}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Pihak 3 */}
                    <div className={`p-3 rounded-lg border transition ${config.showSigner3 !== false ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100 opacity-60'} space-y-2.5`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={config.showSigner3 !== false}
                            onChange={(e) => setConfig({ ...config, showSigner3: e.target.checked })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <PenTool className="w-3 h-3 text-blue-600" /> Pihak 3 (Lawan Transaksi):
                        </label>
                        {config.signer3Signature && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            TTD Ada
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Jabatan (e.g. Tanda Terima)"
                        value={config.signer3Title}
                        onChange={(e) => setConfig({ ...config, signer3Title: e.target.value })}
                        disabled={config.showSigner3 === false}
                        className="input text-xs disabled:bg-slate-200 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        placeholder="Nama Terang / Stempel"
                        value={config.signer3Name}
                        onChange={(e) => setConfig({ ...config, signer3Name: e.target.value })}
                        disabled={config.showSigner3 === false}
                        className="input text-xs font-semibold disabled:bg-slate-200 disabled:cursor-not-allowed"
                      />
                      {/* Upload TTD 3 */}
                      <div className="pt-1 border-t border-slate-200 flex items-center justify-between">
                        {config.signer3Signature ? (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={config.signer3Signature}
                              alt="TTD 3"
                              className="h-10 max-w-[100px] object-contain rounded border bg-white p-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => setConfig({ ...config, signer3Signature: null })}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                              title="Hapus TTD"
                              disabled={config.showSigner3 === false}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Ruang TTD manual</span>
                        )}
                        <label className={`btn-secondary !py-1 !px-2 !text-[11px] inline-flex items-center gap-1 font-semibold ${config.showSigner3 === false ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}>
                          <Upload className="w-3 h-3 text-blue-600" />
                          <span>{config.signer3Signature ? 'Ganti' : 'Upload TTD'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={config.showSigner3 === false}
                            onChange={(e) => handleSignerSignatureUpload('signer3Signature', e)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

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
                          Stempel dicetak otomatis bertumpuk realistis di atas lembar tanda tangan pengesahan faktur
                        </span>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showStamp !== false}
                        onChange={(e) => setConfig({ ...config, showStamp: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Aktifkan Stempel</span>
                    </label>
                  </div>

                  {config.showStamp !== false && (
                    <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-3">
                      <div className="flex items-center gap-3">
                        {config.companyStamp ? (
                          <div className="relative">
                            <img
                              src={config.companyStamp}
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
                              <span>{config.companyStamp ? 'Ganti Stempel' : 'Upload Berkas Stempel'}</span>
                              <input type="file" accept="image/*" className="hidden" onChange={handleStampUpload} />
                            </label>
                            {config.companyStamp && (
                              <button
                                type="button"
                                onClick={() => setConfig({ ...config, companyStamp: null })}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Hapus Stempel"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Disarankan format PNG transparan (Maks. 2MB). Disimpan otomatis di preferensi template invoice.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                          Posisi Letak Stempel pada Lembar Pengesahan Faktur:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {[
                            { value: 'signer2', label: 'Pihak 2 (Menyetujui / Manager) [Default]' },
                            { value: 'signer1', label: 'Pihak 1 (Penerbit Dokumen)' },
                            { value: 'signer3', label: 'Pihak 3 (Lawan Transaksi)' },
                          ].map((pos) => (
                            <label
                              key={pos.value}
                              className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition ${
                                (config.stampPosition || 'signer2') === pos.value
                                  ? 'border-blue-600 bg-blue-50/60 font-semibold text-blue-900'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name="invoiceStampPosition"
                                value={pos.value}
                                checked={(config.stampPosition || 'signer2') === pos.value}
                                onChange={(e) => setConfig({ ...config, stampPosition: e.target.value })}
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
              </div>

              {/* Pilihan Kolom Tabel Dokumen (Checklist) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div>
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                      Pilihan Kolom Tabel {isDO ? 'Surat Jalan (DO)' : isPO ? 'Purchase Order (PO)' : isSO ? 'Sales Order (SO)' : 'Faktur (Invoice)'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Centang kolom yang ingin dicetak di dokumen PDF. Hilangkan centang untuk menyembunyikan kolom.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllColumns}
                    className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold shrink-0"
                  >
                    Centang Semua
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {isDO ? (
                    [
                      { key: 'do_no', label: '1. No (Nomor Urut)' },
                      { key: 'do_lot', label: '2. Nomor Lot / Batch' },
                      { key: 'do_item', label: '3. Deskripsi Barang / Produk' },
                      { key: 'do_expired_date', label: '4. Expired Date (ED)' },
                      { key: 'do_qty', label: '5. Kuantitas Kirim' },
                      { key: 'do_kondisi', label: '6. Kondisi Fisik' },
                    ].map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition"
                      >
                        <input
                          type="checkbox"
                          checked={config.columns?.[col.key] !== false}
                          onChange={(e) => handleColumnToggle(col.key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-slate-700 font-medium text-[11px]">{col.label}</span>
                      </label>
                    ))
                  ) : (
                    [
                      { key: 'inv_no', label: '1. No (Nomor Urut)' },
                      { key: 'inv_item', label: '2. Deskripsi Barang / Layanan' },
                      { key: 'inv_qty', label: '3. Kuantitas (Qty)' },
                      { key: 'inv_harga', label: '4. Harga Satuan (Rp)' },
                      { key: 'inv_diskon', label: '5. Diskon Item' },
                      { key: 'inv_subtotal', label: '6. Subtotal Jumlah (Rp)' },
                    ].map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition"
                      >
                        <input
                          type="checkbox"
                          checked={config.columns?.[col.key] !== false}
                          onChange={(e) => handleColumnToggle(col.key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-slate-700 font-medium text-[11px]">{col.label}</span>
                      </label>
                    ))
                  )}
                </div>

                {/* Pilihan Status & Jatuh Tempo Dokumen (Kop Metadata) */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="mb-2">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                      Pilihan Informasi Status, Jatuh Tempo & Riwayat Transaksi
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Hilangkan centang jika tidak ingin menampilkan status pesanan, pembayaran, jatuh tempo, atau riwayat pembayaran termin di dokumen cetak PDF resmi.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                      <input
                        type="checkbox"
                        checked={config.showOrderStatus !== false && config.columns?.show_status_pesanan !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setConfig((prev) => ({
                            ...prev,
                            showOrderStatus: val,
                            columns: { ...(prev.columns || {}), show_status_pesanan: val },
                          }));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-slate-800 font-bold text-[11px] block">
                          {isDO ? 'Status Pengiriman' : isPO || isSO ? 'Status Pesanan' : 'Status Faktur'}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Badge {isDO ? 'Delivery Order' : 'Purchase / Sales Order'}
                        </span>
                      </div>
                    </label>

                    {!isDO && (
                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                        <input
                          type="checkbox"
                          checked={config.showPaymentStatus !== false && config.columns?.show_status_pembayaran !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig((prev) => ({
                              ...prev,
                              showPaymentStatus: val,
                              columns: { ...(prev.columns || {}), show_status_pembayaran: val },
                            }));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-slate-800 font-bold text-[11px] block">Status Pembayaran</span>
                          <span className="text-[10px] text-slate-500 block">
                            Badge status lunas / belum lunas
                          </span>
                        </div>
                      </label>
                    )}

                    {!isDO && (
                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                        <input
                          type="checkbox"
                          checked={config.showDueDate !== false && config.columns?.show_jatuh_tempo !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig((prev) => ({
                              ...prev,
                              showDueDate: val,
                              columns: { ...(prev.columns || {}), show_jatuh_tempo: val },
                            }));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-slate-800 font-bold text-[11px] block">Tanggal Jatuh Tempo</span>
                          <span className="text-[10px] text-slate-500 block">
                            Informasi batas waktu jatuh tempo
                          </span>
                        </div>
                      </label>
                    )}

                    {!isDO && (
                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                        <input
                          type="checkbox"
                          checked={config.showPaymentHistory !== false && config.columns?.show_riwayat_pembayaran !== false}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig((prev) => ({
                              ...prev,
                              showPaymentHistory: val,
                              columns: { ...(prev.columns || {}), show_riwayat_pembayaran: val },
                            }));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-slate-800 font-bold text-[11px] block">Riwayat Pembayaran</span>
                          <span className="text-[10px] text-slate-500 block">
                            Tabel rincian termin / cicilan
                          </span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Pilihan Lembar Pengesahan & Tanda Tangan */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="mb-2">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                      Pilihan Lembar Pengesahan & Tanda Tangan
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Tentukan apakah blok tanda tangan atau kolom pihak tertentu ditampilkan di bagian bawah dokumen PDF.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                      <input
                        type="checkbox"
                        checked={config.showSignatures !== false && config.columns?.show_signatures !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setConfig((prev) => ({
                            ...prev,
                            showSignatures: val,
                            columns: { ...(prev.columns || {}), show_signatures: val },
                          }));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-slate-800 font-bold text-[11px] block">Semua Lembar TTD</span>
                        <span className="text-[10px] text-slate-500 block">Master blok tanda tangan</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                      <input
                        type="checkbox"
                        checked={config.showSigner1 !== false}
                        disabled={config.showSignatures === false || config.columns?.show_signatures === false}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showSigner1: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div>
                        <span className="text-slate-800 font-bold text-[11px] block">Pihak 1 (Penerbit)</span>
                        <span className="text-[10px] text-slate-500 block">Kolom pembuat dokumen</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                      <input
                        type="checkbox"
                        checked={config.showSigner2 !== false}
                        disabled={config.showSignatures === false || config.columns?.show_signatures === false}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showSigner2: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div>
                        <span className="text-slate-800 font-bold text-[11px] block">Pihak 2 (Menyetujui)</span>
                        <span className="text-[10px] text-slate-500 block">Kolom otorisasi / manager</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 transition">
                      <input
                        type="checkbox"
                        checked={config.showSigner3 !== false}
                        disabled={config.showSignatures === false || config.columns?.show_signatures === false}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showSigner3: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div>
                        <span className="text-slate-800 font-bold text-[11px] block">Pihak 3 (Penerima)</span>
                        <span className="text-[10px] text-slate-500 block">Kolom lawan transaksi</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Syarat & Ketentuan */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Kaki & Syarat Ketentuan Faktur (Terms of Payment)
                </label>
                <textarea
                  rows="3"
                  value={config.invoiceNotes}
                  onChange={(e) => setConfig({ ...config, invoiceNotes: e.target.value })}
                  className="input text-xs font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Simpan Pengaturan Template
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PRATINJAU DOKUMEN FAKTUR RESMI (A4 PRINTABLE) */}
          {activeTab === 'preview' && (
            <div
              id="printable-invoice-content"
              className="bg-white max-w-3xl mx-auto p-8 rounded-xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none text-slate-800 text-xs leading-relaxed"
            >
              {/* 1. KOP SURAT PERUSAHAAN */}
              {config.showCompanyHeader && (
                <div className="border-b-2 border-slate-900 pb-4 mb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {config.companyLogo ? (
                        <img
                          src={config.companyLogo}
                          alt={config.companyName}
                          className="h-20 sm:h-24 max-w-[150px] object-contain rounded-lg shrink-0 print:border print:border-black"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-2xl print:border print:border-black shrink-0">
                          <Building2 className="w-9 h-9" />
                        </div>
                      )}
                      <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 print:text-black">
                          {config.companyName}
                        </h1>
                        <p className="text-xs text-slate-600 print:text-black leading-snug">
                          {config.companyAddress}
                        </p>
                        <p className="text-[11px] text-slate-500 print:text-black font-medium">
                          {config.companyContact}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black tracking-tight text-blue-900 print:text-black block">
                        {docTitle}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                        {docSubTitle}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. INFORMASI DOKUMEN FAKTUR & LAWAN TRANSAKSI */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Kolom Kiri: Lawan Transaksi */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 print:border-slate-300 print:bg-transparent">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                    {partnerLabel}
                  </span>
                  <div className="text-sm font-extrabold text-slate-900 mb-1">
                    {partnerName || '(Nama Pelanggan / Rekanan Belum Dipilih)'}
                  </div>
                  {partnerCode && (
                    <div className="text-[11px] text-slate-600 mb-0.5">
                      ID / Kode: <strong className="font-mono text-slate-800">{partnerCode}</strong>
                    </div>
                  )}
                  {partnerPhone && (
                    <div className="text-[11px] text-slate-600 mb-0.5">
                      Telepon / Kontak: <strong>{partnerPhone}</strong>
                    </div>
                  )}
                  {partnerAddress && (
                    <div className="text-[11px] text-slate-600 leading-snug mt-1">
                      Alamat: {partnerAddress}
                    </div>
                  )}
                </div>

                {/* Kolom Kanan: Rincian Metadata Dokumen */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 print:border-slate-300 print:bg-transparent space-y-1.5">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {isDO ? 'Nomor Surat Jalan (DO):' : isPO ? 'Nomor Purchase Order:' : isSO ? 'Nomor Sales Order:' : 'Nomor Invoice:'}
                    </span>
                    <span className="font-mono font-black text-xs text-blue-950 print:text-black">
                      {docNo}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-600">
                      {isDO ? 'Tanggal Pengiriman:' : 'Tanggal Dokumen:'}
                    </span>
                    <span className="font-semibold">{formatDate(docDate)}</span>
                  </div>

                  {!isDO && data.jatuh_tempo && config.showDueDate !== false && config.columns?.show_jatuh_tempo !== false && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-600">Jatuh Tempo:</span>
                      <span className="font-bold text-rose-700 print:text-black">
                        {formatDate(data.jatuh_tempo)}
                      </span>
                    </div>
                  )}

                  {refNo && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-600">{refLabel}:</span>
                      <span className="font-mono font-semibold text-slate-800">{refNo}</span>
                    </div>
                  )}

                  {config.showOrderStatus !== false && config.columns?.show_status_pesanan !== false && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-600">
                        {isDO ? 'Status Pengiriman:' : isPO || isSO ? 'Status Pesanan:' : 'Status Faktur:'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-black text-[10px] tracking-wide uppercase border ${
                          isDO
                            ? data.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border-blue-300'
                            : isLunas
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : totalDibayar > 0
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {data.status || (isLunas ? 'LUNAS' : 'BELUM LUNAS')}
                      </span>
                    </div>
                  )}

                  {!isDO && config.showPaymentStatus !== false && config.columns?.show_status_pembayaran !== false && (
                    (isPO || isSO) ? (
                      data.status_pembayaran ? (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500">Status Pembayaran:</span>
                          <span className="font-bold text-slate-800 uppercase">
                            {data.status_pembayaran === 'BELUM_DITAGIH'
                              ? 'BELUM DIFAKTURKAN'
                              : data.status_pembayaran}
                          </span>
                        </div>
                      ) : null
                    ) : (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">Status Pembayaran:</span>
                        <span className="font-bold text-slate-800 uppercase">
                          {isLunas ? 'LUNAS' : totalDibayar > 0 ? 'SEBAGIAN' : 'BELUM LUNAS'}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* 3. TABEL RINCIAN ITEM / LAYANAN */}
              {(() => {
                // Konfigurasi Kolom DO (Surat Jalan)
                const showDoNo = config.columns?.do_no !== false;
                const showDoLot = config.columns?.do_lot !== false;
                const showDoItem = config.columns?.do_item !== false;
                const showDoED = config.columns?.do_expired_date !== false;
                const showDoQty = config.columns?.do_qty !== false;
                const showDoKondisi = config.columns?.do_kondisi !== false;

                let doColsBeforeQty = 0;
                if (showDoNo) doColsBeforeQty++;
                if (showDoLot) doColsBeforeQty++;
                if (showDoItem) doColsBeforeQty++;
                if (showDoED) doColsBeforeQty++;

                const totalDoCols = Math.max(1, doColsBeforeQty + (showDoQty ? 1 : 0) + (showDoKondisi ? 1 : 0));
                const doSpanBeforeQty = Math.max(1, doColsBeforeQty);

                // Konfigurasi Kolom PO, SO, Invoice (AP/AR)
                const showInvNo = config.columns?.inv_no !== false;
                const showInvItem = config.columns?.inv_item !== false;
                const showInvQty = config.columns?.inv_qty !== false;
                const showInvHarga = config.columns?.inv_harga !== false;
                const showInvDiskon = config.columns?.inv_diskon !== false;
                const showInvSubtotal = config.columns?.inv_subtotal !== false;

                let invColsBeforeSubtotal = 0;
                if (showInvNo) invColsBeforeSubtotal++;
                if (showInvItem) invColsBeforeSubtotal++;
                if (showInvQty) invColsBeforeSubtotal++;
                if (showInvHarga) invColsBeforeSubtotal++;
                if (showInvDiskon) invColsBeforeSubtotal++;

                const totalInvCols = Math.max(1, invColsBeforeSubtotal + (showInvSubtotal ? 1 : 0));
                const invSpanBeforeSubtotal = Math.max(1, invColsBeforeSubtotal);

                if (isDO) {
                  return (
                    /* TABEL KHUSUS DELIVERY ORDER (SURAT JALAN) */
                    <div className="mb-6">
                      <table className="w-full text-left border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-[11px]">
                            {showDoNo && <th className="py-2 px-3 text-center border-r border-slate-300 w-10">No</th>}
                            {showDoLot && <th className="py-2 px-3 border-r border-slate-300 w-36">Nomor Lot / Batch</th>}
                            {showDoItem && <th className="py-2 px-3 border-r border-slate-300">Deskripsi Barang / Produk Alkes</th>}
                            {showDoED && <th className="py-2 px-3 text-center border-r border-slate-300 w-28">Expired Date</th>}
                            {showDoQty && <th className="py-2 px-3 text-right border-r border-slate-300 w-32">Kuantitas Kirim</th>}
                            {showDoKondisi && <th className="py-2 px-3 text-center w-24">Kondisi Fisik</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {items.length > 0 ? (
                            items.map((it, idx) => {
                              const qty = Number(it.qty_kirim || it.qty || 0);
                              const isi = Number(it.isi_per_kemasan || 1);
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  {showDoNo && (
                                    <td className="py-2.5 px-3 text-center border-r border-slate-200 font-medium">{idx + 1}</td>
                                  )}
                                  {showDoLot && (
                                    <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                                      {it.nomor_lot || '-'}
                                    </td>
                                  )}
                                  {showDoItem && (
                                    <td className="py-2.5 px-3 border-r border-slate-200">
                                      <span className="font-bold text-slate-900">{it.nama_produk || it.deskripsi || '-'}</span>
                                      {it.kode_produk && (
                                        <span className="block font-mono text-[10px] text-slate-500">
                                          Kode: {it.kode_produk}
                                        </span>
                                      )}
                                    </td>
                                  )}
                                  {showDoED && (
                                    <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-700 font-medium">
                                      {it.expired_date ? formatDate(it.expired_date) : '-'}
                                    </td>
                                  )}
                                  {showDoQty && (
                                    <td className="py-2.5 px-3 text-right border-r border-slate-200 font-bold text-slate-900">
                                      <p>{formatNumber(qty)} {it.satuan || 'pcs'}</p>
                                      {isi > 1 && (
                                        <p className="text-[10px] text-blue-600 font-medium">
                                          ≈ {formatNumber(Number((qty / isi).toFixed(1)))} {it.satuan_besar || 'BOX'}
                                        </p>
                                      )}
                                    </td>
                                  )}
                                  {showDoKondisi && (
                                    <td className="py-2.5 px-3 text-center text-emerald-700 font-semibold text-[11px]">
                                      [ ✓ ] Baik
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={totalDoCols} className="py-4 text-center text-slate-500">
                                Tidak ada rincian lot barang untuk delivery order ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-300 font-bold bg-slate-50 text-xs">
                            <td
                              colSpan={showDoQty ? doSpanBeforeQty : Math.max(1, totalDoCols - (showDoKondisi ? 1 : 0))}
                              className="py-2 px-3 text-right border-r border-slate-300"
                            >
                              Total Kuantitas Fisik Dikirim:
                            </td>
                            {showDoQty && (
                              <td className="py-2 px-3 text-right font-black text-slate-900 border-r border-slate-300">
                                {formatNumber(items.reduce((acc, it) => acc + Number(it.qty_kirim || it.qty || 0), 0))} Unit
                              </td>
                            )}
                            {showDoKondisi && (
                              <td className="py-2 px-3 text-center text-[10px] text-slate-500 font-semibold">
                                {items.length} Baris Lot
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                }

                return (
                  /* TABEL UNTUK PO, SO, DAN INVOICE */
                  <div className="mb-6">
                    <table className="w-full text-left border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-[11px]">
                          {showInvNo && <th className="py-2 px-3 text-center border-r border-slate-300 w-10">No</th>}
                          {showInvItem && <th className="py-2 px-3 border-r border-slate-300">Deskripsi Barang / Layanan</th>}
                          {showInvQty && <th className="py-2 px-3 text-center border-r border-slate-300 w-28">Kuantitas</th>}
                          {showInvHarga && <th className="py-2 px-3 text-right border-r border-slate-300 w-28">Harga Satuan</th>}
                          {showInvDiskon && <th className="py-2 px-3 text-right border-r border-slate-300 w-24">Diskon</th>}
                          {showInvSubtotal && <th className="py-2 px-3 text-right w-32">Jumlah (IDR)</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {items.length > 0 ? (
                          items.map((it, idx) => {
                            const qty = Number(it.qty_pesan || it.qty_pesanan || it.qty || 1);
                            const harga = Number(it.harga_satuan || it.harga || 0);
                            const diskon = Number(it.diskon || 0);
                            const subtotal = Number(it.subtotal || qty * harga - diskon);
                            const isi = Number(it.isi_per_kemasan || 1);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                {showInvNo && (
                                  <td className="py-2 px-3 text-center border-r border-slate-200 font-medium">{idx + 1}</td>
                                )}
                                {showInvItem && (
                                  <td className="py-2 px-3 border-r border-slate-200">
                                    <span className="font-bold text-slate-900">{it.nama_produk || it.deskripsi}</span>
                                    {it.kode_produk && (
                                      <span className="block font-mono text-[10px] text-slate-500">
                                        Kode: {it.kode_produk}
                                      </span>
                                    )}
                                  </td>
                                )}
                                {showInvQty && (
                                  <td className="py-2 px-3 text-center border-r border-slate-200 font-semibold">
                                    <p>{formatNumber(qty)} {it.satuan || 'pcs'}</p>
                                    {isi > 1 && (
                                      <p className="text-[10px] text-blue-600 font-medium">
                                        ≈ {formatNumber(Number((qty / isi).toFixed(1)))} {it.satuan_besar || 'BOX'}
                                      </p>
                                    )}
                                  </td>
                                )}
                                {showInvHarga && (
                                  <td className="py-2 px-3 text-right border-r border-slate-200">
                                    {formatRupiah(harga)}
                                  </td>
                                )}
                                {showInvDiskon && (
                                  <td className="py-2 px-3 text-right border-r border-slate-200 text-rose-600 font-medium">
                                    {Number(it.diskon_persen) > 0 ? (
                                      <div>
                                        <span className="font-semibold">{Number(it.diskon_persen)}%</span>
                                        {diskon > 0 && (
                                          <span className="block text-[9px] text-slate-500 font-normal">(-{formatRupiah(diskon)})</span>
                                        )}
                                      </div>
                                    ) : diskon > 0 ? (
                                      `-${formatRupiah(diskon)}`
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                )}
                                {showInvSubtotal && (
                                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                                    {formatRupiah(subtotal)}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            {showInvNo && <td className="py-3 px-3 text-center border-r border-slate-200 font-medium">1</td>}
                            <td
                              colSpan={Math.max(1, totalInvCols - (showInvNo ? 1 : 0) - (showInvSubtotal ? 1 : 0))}
                              className="py-3 px-3 border-r border-slate-200"
                            >
                              <span className="font-bold text-slate-900">
                                {data.keterangan || (isAR ? 'Penjualan Barang Dagang / Jasa Alkes' : isSO ? 'Pesanan Penjualan Pelanggan' : 'Pengadaan Barang / Operasional')}
                              </span>
                              <span className="block text-[10px] text-slate-500">
                                Transaksi dokumen referensi {docNo}
                              </span>
                            </td>
                            {showInvSubtotal && (
                              <td className="py-3 px-3 text-right font-bold text-slate-900">
                                {formatRupiah(totalTagihan)}
                              </td>
                            )}
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        {/* Subtotal */}
                        <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                          <td
                            colSpan={showInvSubtotal ? invSpanBeforeSubtotal : totalInvCols}
                            className="py-2 px-3 text-right border-r border-slate-300"
                          >
                            Subtotal Nilai Barang (Bruto):
                          </td>
                          {showInvSubtotal && (
                            <td className="py-2 px-3 text-right font-black text-slate-900">
                              {formatRupiah(data.subtotal || totalTagihan)}
                            </td>
                          )}
                        </tr>
                        {/* Diskon PO/SO jika ada */}
                        {(Number(data.diskon_nominal) > 0 || Number(data.diskon_persen) > 0) && (
                          <tr className="border-t border-slate-200 text-rose-700 bg-rose-50/40">
                            <td
                              colSpan={showInvSubtotal ? invSpanBeforeSubtotal : totalInvCols}
                              className="py-1.5 px-3 text-right border-r border-slate-300 font-medium"
                            >
                              Diskon Dokumen ({Number(data.diskon_persen || 0)}%):
                            </td>
                            {showInvSubtotal && (
                              <td className="py-1.5 px-3 text-right font-bold">
                                - {formatRupiah(data.diskon_nominal)}
                              </td>
                            )}
                          </tr>
                        )}
                        {/* PPN jika ada */}
                        {(Number(data.pajak_nominal) > 0 || Number(data.pajak_persen) > 0) && (
                          <tr className="border-t border-slate-200 text-blue-800 bg-blue-50/40">
                            <td
                              colSpan={showInvSubtotal ? invSpanBeforeSubtotal : totalInvCols}
                              className="py-1.5 px-3 text-right border-r border-slate-300 font-medium"
                            >
                              PPN / Pajak ({Number(data.pajak_persen || 0)}%):
                            </td>
                            {showInvSubtotal && (
                              <td className="py-1.5 px-3 text-right font-bold">
                                + {formatRupiah(data.pajak_nominal)}
                              </td>
                            )}
                          </tr>
                        )}
                        {/* Total Tagihan / Nilai Pesanan */}
                        <tr className="border-t-2 border-slate-900 font-black text-sm bg-slate-100">
                          <td
                            colSpan={showInvSubtotal ? invSpanBeforeSubtotal : totalInvCols}
                            className="py-2.5 px-3 text-right border-r border-slate-300 uppercase tracking-tight"
                          >
                            {isPO ? 'Total Nilai Purchase Order (PO):' : isSO ? 'Total Nilai Sales Order (SO):' : 'Total Nilai Tagihan (Netto):'}
                          </td>
                          {showInvSubtotal && (
                            <td className="py-2.5 px-3 text-right text-blue-900 print:text-black text-sm font-black">
                              {formatRupiah(totalTagihan)}
                            </td>
                          )}
                        </tr>
                        {/* Sudah Dibayar (Jika ada) */}
                        {totalDibayar > 0 && (
                          <tr className="border-t border-slate-200 font-medium text-emerald-800 bg-emerald-50/50">
                            <td
                              colSpan={showInvSubtotal ? invSpanBeforeSubtotal : totalInvCols}
                              className="py-1.5 px-3 text-right border-r border-slate-300"
                            >
                              Total Pembayaran Telah Diterima / DP:
                            </td>
                            {showInvSubtotal && (
                              <td className="py-1.5 px-3 text-right font-bold">
                                - {formatRupiah(totalDibayar)}
                              </td>
                            )}
                          </tr>
                        )}
                        {/* Sisa jika ada pembayaran bertahap */}
                        {totalDibayar > 0 && sisa > 0 && (
                          <tr className="border-t border-slate-200 font-bold bg-slate-50">
                            <td
                              colSpan={showInvSubtotal ? invSpanBeforeSubtotal : totalInvCols}
                              className="py-2 px-3 text-right border-r border-slate-300 uppercase text-rose-700"
                            >
                              {isPO ? 'Sisa Hutang Berjalan:' : 'Sisa Piutang Berjalan:'}
                            </td>
                            {showInvSubtotal && (
                              <td className="py-2 px-3 text-right text-rose-700 print:text-black font-bold">
                                {formatRupiah(sisa)}
                              </td>
                            )}
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

              {/* 4. RIWAYAT PEMBAYARAN TERMIN / ANGSURAN (BILA SUDAH ADA & BUKAN DO) */}
              {!isDO && payments.length > 0 && config.showPaymentHistory !== false && config.columns?.show_riwayat_pembayaran !== false && (
                <div className="mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50 avoid-break">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                    {isPO ? 'Riwayat Angsuran / Pembayaran Keluar:' : 'Riwayat Pembayaran Termin Masuk:'}
                  </span>
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-1 px-1">Tgl Bayar</th>
                        <th className="py-1 px-1">No. Bukti / Referensi</th>
                        <th className="py-1 px-1">Metode</th>
                        <th className="py-1 px-1 text-right">Jumlah Pelunasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {payments.map((p, pIdx) => (
                        <tr key={pIdx}>
                          <td className="py-1 px-1">{formatDate(p.tanggal_bayar)}</td>
                          <td className="py-1 px-1 font-mono">{p.no_pembayaran || p.referensi_bayar || '-'}</td>
                          <td className="py-1 px-1">{p.metode_pembayaran || 'Transfer'}</td>
                          <td className="py-1 px-1 text-right font-bold text-emerald-700">
                            {formatRupiah(p.jumlah_bayar)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. INSTRUKSI PEMBAYARAN BANK (KHUSUS PENJUALAN / AR / SO) */}
              {!isDO && !isPO && config.showBankDetails && (
                <div className="mb-6 p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 avoid-break">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 block mb-1">
                    Instruksi Transfer Bank Resmi:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-800">
                    {config.bankName1 && (
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                        <span className="font-bold text-blue-900 block">{config.bankName1}</span>
                        <span className="font-mono font-black text-xs text-slate-900 block">
                          No. Rek: {config.bankAccount1}
                        </span>
                        <span className="text-[10px] text-slate-500 block">A.N: {config.bankHolder1}</span>
                      </div>
                    )}
                    {config.bankName2 && (
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                        <span className="font-bold text-blue-900 block">{config.bankName2}</span>
                        <span className="font-mono font-black text-xs text-slate-900 block">
                          No. Rek: {config.bankAccount2}
                        </span>
                        <span className="text-[10px] text-slate-500 block">A.N: {config.bankHolder2}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. CATATAN / SYARAT KETENTUAN */}
              {displayNotes && (
                <div className="mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-600 avoid-break">
                  <span className="font-bold text-slate-800 uppercase tracking-wide block mb-1">
                    {isDO ? 'Catatan Serah Terima Pengiriman:' : 'Syarat & Ketentuan Dokumen:'}
                  </span>
                  <p className="whitespace-pre-line leading-relaxed">{displayNotes}</p>
                </div>
              )}

              {/* 7. BLOK TANDA TANGAN */}
              {config.showSignatures !== false && config.columns?.show_signatures !== false && (
                (() => {
                  const hasSigner1 = config.showSigner1 !== false;
                  const hasSigner2 = config.showSigner2 !== false;
                  const hasSigner3 = config.showSigner3 !== false;
                  const activeCount = [hasSigner1, hasSigner2, hasSigner3].filter(Boolean).length;
                  if (activeCount === 0) return null;

                  const gridColsClass =
                    activeCount === 1
                      ? 'grid-cols-1 max-w-xs mx-auto'
                      : activeCount === 2
                      ? 'grid-cols-2 max-w-xl mx-auto'
                      : 'grid-cols-3';

                  return (
                    <div className="avoid-break mt-6 pt-4 border-t border-slate-300">
                      <div className="text-right text-[11px] text-slate-600 mb-3">
                        {config.signatureCity}, {formatDate(new Date())}
                      </div>

                      <div className={`grid ${gridColsClass} gap-4 text-center`}>
                        {/* Pihak 1 */}
                        {hasSigner1 && (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                              {signer1Title}
                            </span>
                            <div className="relative w-full h-24 flex items-center justify-center my-1.5">
                              {config.showStamp !== false && config.companyStamp && (config.stampPosition || 'signer2') === 'signer1' && (
                                <img
                                  src={config.companyStamp}
                                  alt="Stempel Resmi"
                                  style={{ mixBlendMode: 'multiply' }}
                                  className="absolute w-24 h-24 object-contain -rotate-6 opacity-85 pointer-events-none z-10 print:opacity-90"
                                />
                              )}
                              {config.signer1Signature ? (
                                <img
                                  src={config.signer1Signature}
                                  alt={`TTD ${signer1Name}`}
                                  className="h-20 max-w-[160px] object-contain relative z-20"
                                />
                              ) : (
                                <div className="h-16" />
                              )}
                            </div>
                            <div className="w-full border-b border-slate-900 font-bold text-slate-900 pb-1">
                              ( {signer1Name} )
                            </div>
                          </div>
                        )}

                        {/* Pihak 2 */}
                        {hasSigner2 && (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                              {signer2Title}
                            </span>
                            <div className="relative w-full h-24 flex items-center justify-center my-1.5">
                              {config.showStamp !== false && config.companyStamp && (config.stampPosition || 'signer2') === 'signer2' && (
                                <img
                                  src={config.companyStamp}
                                  alt="Stempel Resmi"
                                  style={{ mixBlendMode: 'multiply' }}
                                  className="absolute w-24 h-24 object-contain -rotate-6 opacity-85 pointer-events-none z-10 print:opacity-90"
                                />
                              )}
                              {config.signer2Signature ? (
                                <img
                                  src={config.signer2Signature}
                                  alt={`TTD ${signer2Name}`}
                                  className="h-20 max-w-[160px] object-contain relative z-20"
                                />
                              ) : (
                                <div className="h-16" />
                              )}
                            </div>
                            <div className="w-full border-b border-slate-900 font-bold text-slate-900 pb-1">
                              ( {signer2Name} )
                            </div>
                          </div>
                        )}

                        {/* Pihak 3 */}
                        {hasSigner3 && (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                              {signer3Title}
                            </span>
                            <div className="relative w-full h-24 flex items-center justify-center my-1.5">
                              {config.showStamp !== false && config.companyStamp && (config.stampPosition || 'signer2') === 'signer3' && (
                                <img
                                  src={config.companyStamp}
                                  alt="Stempel Resmi"
                                  style={{ mixBlendMode: 'multiply' }}
                                  className="absolute w-24 h-24 object-contain -rotate-6 opacity-85 pointer-events-none z-10 print:opacity-90"
                                />
                              )}
                              {config.signer3Signature ? (
                                <img
                                  src={config.signer3Signature}
                                  alt={`TTD ${signer3Name}`}
                                  className="h-20 max-w-[160px] object-contain relative z-20"
                                />
                              ) : (
                                <div className="h-16" />
                              )}
                            </div>
                            <div className="w-full border-b border-slate-900 font-bold text-slate-900 pb-1">
                              ( {signer3Name} )
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

