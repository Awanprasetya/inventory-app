import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  QrCode,
  Tag,
  Copy,
  Layers,
  Settings2,
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import Barcode128, { encodeCode128 } from './Barcode128.jsx';
import { formatDate } from '../services/api.js';
import { toastSuccess } from '../utils/alert.js';

export default function LotQrModal({ isOpen, onClose, lots = [] }) {
  if (!isOpen || !lots || lots.length === 0) return null;

  // Konfigurasi Label
  const [labelSize, setLabelSize] = useState('thermal_75x50'); // 'thermal_75x50' | 'thermal_50x30' | 'a4_grid'
  const [copiesPerLot, setCopiesPerLot] = useState(1);
  const [qrContentType, setQrContentType] = useState('PRODUCT_CODE'); // 'PRODUCT_CODE' | 'JSON'
  const [showCompanyHeader, setShowCompanyHeader] = useState(true);
  const [companyName, setCompanyName] = useState('PT JARUM PATAH ENTERPRISE');
  const [showExpDate, setShowExpDate] = useState(true);
  const [showProdDate, setShowProdDate] = useState(true);
  const [showWarehouse, setShowWarehouse] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const [activeLotIndex, setActiveLotIndex] = useState(0);

  const canvasRefs = useRef({});

  const currentLot = lots[activeLotIndex] || lots[0];

  // QR Code berisi Kode Produk (atau JSON lengkap bila dipilih)
  const getQrValue = (lot) => {
    if (qrContentType === 'JSON') {
      return JSON.stringify({
        kode_produk: lot.kode_produk,
        nomor_lot: lot.nomor_lot,
        nama_produk: lot.nama_produk,
        expired_date: lot.expired_date,
        gudang: lot.nama_gudang || 'Gudang Utama',
      });
    }
    return lot.kode_produk || lot.nomor_lot || '';
  };

  // Unduh Gambar Stiker Komposit PNG (QR Kode Produk + Info + Barcode Nomor Lot)
  const handleDownloadQr = (lot) => {
    const qrCanvas = canvasRefs.current[lot.nomor_lot];
    if (!qrCanvas) {
      toastSuccess('Gagal membuat gambar stiker');
      return;
    }

    const W = 900;
    const H = 600;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    let yTop = 34;
    if (showCompanyHeader && companyName.trim()) {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(companyName.toUpperCase(), W / 2, yTop + 20);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(32, yTop + 36);
      ctx.lineTo(W - 32, yTop + 36);
      ctx.stroke();
      ctx.setLineDash([]);
      yTop += 52;
    }

    // QR Code Produk (Kiri)
    const qrSize = 230;
    const qrX = 44;
    const qrY = yTop + 8;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`SKU: ${lot.kode_produk || '-'}`, qrX + qrSize / 2, qrY + qrSize + 30);

    // Info Produk (Kanan)
    const infoX = qrX + qrSize + 38;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#020617';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(String(lot.nama_produk || '').slice(0, 32), infoX, qrY + 32);

    let infoY = qrY + 74;
    ctx.font = 'bold 21px sans-serif';
    ctx.fillStyle = '#1e293b';
    if (showExpDate) {
      ctx.fillText(`ED: ${formatDate(lot.expired_date)}`, infoX, infoY);
      infoY += 34;
    }
    if (showProdDate) {
      ctx.font = '20px sans-serif';
      ctx.fillText(`Prod: ${formatDate(lot.tanggal_produksi)}`, infoX, infoY);
      infoY += 32;
    }
    if (showWarehouse) {
      ctx.font = '20px sans-serif';
      ctx.fillText(`Gudang: ${lot.nama_gudang || 'Gudang Utama'}`, infoX, infoY);
      infoY += 34;
    }
    ctx.font = 'bold 18px monospace';
    const badgeLine = `${lot.metode_stok || 'FIFO'}${showStatus ? ` • ${lot.status || 'AVAILABLE'}` : ''}`;
    ctx.fillText(badgeLine, infoX, infoY + 4);

    // Garis pemisah menuju Barcode Nomor Lot (Bawah)
    const barSectionY = 398;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(32, barSectionY);
    ctx.lineTo(W - 32, barSectionY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Barcode Code 128 Nomor Lot
    const { bars, totalWidth } = encodeCode128(lot.nomor_lot, 10);
    if (bars.length > 0) {
      const targetBarW = W - 96;
      const barH = 104;
      const barY = barSectionY + 18;
      const scaleX = targetBarW / totalWidth;
      ctx.fillStyle = '#000000';
      bars.forEach((b) => {
        ctx.fillRect(48 + b.x * scaleX, barY, Math.max(1, b.w * scaleX), barH);
      });
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lot.nomor_lot || '', W / 2, barY + barH + 30);
    }

    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stiker_${lot.kode_produk}_${lot.nomor_lot}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toastSuccess('Gambar Stiker Berhasil Diunduh', `File: Stiker_${lot.kode_produk}_${lot.nomor_lot}.png`);
  };

  // Cetak Label via iframe
  const handlePrint = () => {
    const content = document.getElementById('printable-qr-labels-container');
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

    let pageStyle = '';
    if (labelSize === 'thermal_75x50') {
      pageStyle = `
        @page { size: 75mm 50mm; margin: 0; }
        .label-page { width: 75mm; height: 50mm; page-break-after: always; padding: 2mm; box-sizing: border-box; }
      `;
    } else if (labelSize === 'thermal_50x30') {
      pageStyle = `
        @page { size: 50mm 30mm; margin: 0; }
        .label-page { width: 50mm; height: 30mm; page-break-after: always; padding: 1mm; box-sizing: border-box; }
      `;
    } else {
      pageStyle = `
        @page { size: A4 portrait; margin: 8mm; }
        .label-page {
          width: 63mm;
          height: 38mm;
          padding: 1.5mm;
          margin-bottom: 2mm;
          box-sizing: border-box;
          break-inside: avoid;
          display: inline-block;
          vertical-align: top;
        }
        .a4-grid-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2.5mm;
        }
      `;
    }

    const isMini = labelSize === 'thermal_50x30';
    const isA4 = labelSize === 'a4_grid';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Label Stiker (QR Produk &amp; Barcode Lot)</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace, sans-serif; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            ${pageStyle}
            .label-border {
              width: 100%;
              height: 100%;
              border: 1px solid #000;
              border-radius: 3px;
              padding: ${isMini ? '2px 3px' : '3px 4px'};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: #fff;
              overflow: hidden;
            }
            .label-header {
              font-size: ${isMini ? '6px' : '7.5px'};
              font-weight: 800;
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 1px;
              margin-bottom: 2px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-body {
              display: flex;
              align-items: center;
              gap: ${isMini ? '4px' : '6px'};
              flex: 1;
              min-height: 0;
            }
            .qr-wrapper {
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              border: 1px solid #000;
              padding: ${isMini ? '1px' : '2px'};
              border-radius: 2px;
            }
            .qr-sku-text {
              font-size: ${isMini ? '5.5px' : '6.5px'};
              font-weight: 900;
              margin-top: 1px;
              letter-spacing: -0.2px;
            }
            .info-wrapper {
              flex: 1;
              min-width: 0;
              font-size: ${isMini ? '6px' : isA4 ? '7px' : '7.5px'};
              line-height: 1.2;
            }
            .info-prod-name {
              font-weight: 800;
              font-size: ${isMini ? '6.5px' : isA4 ? '7.5px' : '8.5px'};
              max-height: ${isMini ? '15px' : '20px'};
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            }
            .info-item {
              margin-top: 1px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .badge-chip {
              display: inline-block;
              font-size: ${isMini ? '5.5px' : '6.5px'};
              font-weight: 800;
              border: 1px solid #000;
              border-radius: 2px;
              padding: 0 2px;
              margin-top: 1px;
            }
            .barcode-strip {
              border-top: 1px dashed #999;
              padding-top: ${isMini ? '1px' : '2px'};
              margin-top: ${isMini ? '1px' : '2px'};
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="${isA4 ? 'a4-grid-container' : ''}">
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
    }, 400);
  };

  // Buat array label yang akan dicetak berdasarkan salinan (copies)
  const expandedLabels = [];
  lots.forEach((lot) => {
    for (let c = 0; c < copiesPerLot; c++) {
      expandedLabels.push(lot);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Generate &amp; Cetak Label Stiker (QR Produk &amp; Barcode Lot)
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700/50">
                  {lots.length} Batch Terpilih
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Satu stiker memuat QR Code untuk Kode Produk dan Barcode 1D untuk Nomor Lot.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Modal */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50">
          {/* Kolom Kiri: Konfigurasi Cetak & Pilihan Ukuran */}
          <div className="lg:col-span-5 space-y-4">
            {/* Navigasi Batch Terpilih jika lebih dari 1 */}
            {lots.length > 1 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-teal-600" />
                  Pratinjau Batch / Lot ({activeLotIndex + 1} dari {lots.length})
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {lots.map((lot, idx) => (
                    <button
                      key={lot.id || idx}
                      onClick={() => setActiveLotIndex(idx)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold whitespace-nowrap transition ${
                        activeLotIndex === idx
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {lot.nomor_lot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pengaturan Ukuran Label */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-teal-600" />
                Format / Ukuran Kertas Label
              </label>

              <div className="grid grid-cols-1 gap-2">
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    labelSize === 'thermal_75x50'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="labelSize"
                    value="thermal_75x50"
                    checked={labelSize === 'thermal_75x50'}
                    onChange={(e) => setLabelSize(e.target.value)}
                    className="mt-0.5 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <div className="font-bold">Label Thermal Standar (75 x 50 mm)</div>
                    <div className="text-[11px] text-slate-500">
                      Ukuran barcode stiker paling umum untuk dus / box gudang.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    labelSize === 'thermal_50x30'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="labelSize"
                    value="thermal_50x30"
                    checked={labelSize === 'thermal_50x30'}
                    onChange={(e) => setLabelSize(e.target.value)}
                    className="mt-0.5 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <div className="font-bold">Label Thermal Mini (50 x 30 mm)</div>
                    <div className="text-[11px] text-slate-500">
                      Ukuran ringkas untuk kemasan botol / pouch / satuan kecil.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                    labelSize === 'a4_grid'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="labelSize"
                    value="a4_grid"
                    checked={labelSize === 'a4_grid'}
                    onChange={(e) => setLabelSize(e.target.value)}
                    className="mt-0.5 text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <div className="font-bold">Kertas Stiker A4 Grid (3 Kolom)</div>
                    <div className="text-[11px] text-slate-500">
                      Untuk cetak di printer biasa (Inkjet/Laser) kertas stiker Tom &amp; Jerry / A4.
                    </div>
                  </div>
                </label>
              </div>

              {/* Jumlah Salinan */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  <Copy className="h-3 w-3 text-slate-400" />
                  Salinan per Lot:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCopiesPerLot((c) => Math.max(1, c - 1))}
                    className="w-7 h-7 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-xs font-bold w-6 text-center">{copiesPerLot}</span>
                  <button
                    type="button"
                    onClick={() => setCopiesPerLot((c) => c + 1)}
                    className="w-7 h-7 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center"
                  >
                    +
                  </button>
                  <span className="text-[11px] text-slate-500">stiker</span>
                </div>
              </div>
            </div>

            {/* Opsi Informasi pada Label */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-teal-600" />
                Informasi yang Ditampilkan
              </label>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCompanyHeader}
                    onChange={(e) => setShowCompanyHeader(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Header Perusahaan:</span>
                </label>
                {showCompanyHeader && (
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:border-teal-500 focus:outline-none"
                    placeholder="Nama Perusahaan"
                  />
                )}

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showExpDate}
                    onChange={(e) => setShowExpDate(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Tanggal Kedaluwarsa (Expired Date)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProdDate}
                    onChange={(e) => setShowProdDate(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Tanggal Produksi</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWarehouse}
                    onChange={(e) => setShowWarehouse(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Gudang Penyimpanan</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStatus}
                    onChange={(e) => setShowStatus(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Status Lot (AVAILABLE / QUARANTINE)</span>
                </label>

                <div className="pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-700 block mb-1">
                    Isi Data QR Code (Barcode tetap Nomor Lot):
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQrContentType('PRODUCT_CODE')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        qrContentType === 'PRODUCT_CODE'
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Kode Produk (Direkomendasikan)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrContentType('JSON')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        qrContentType === 'JSON'
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      JSON Lengkap
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Pratinjau Visual Label Stiker */}
          <div className="lg:col-span-7 flex flex-col items-center justify-start space-y-4">
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                <QrCode className="h-4 w-4 text-teal-600" />
                Pratinjau Fisik Label Stiker
              </span>
              <span className="text-xs text-slate-500">
                Total Label yang akan Dicetak: <strong>{expandedLabels.length} lembar</strong>
              </span>
            </div>

            {/* Container Preview Stiker Terpilih */}
            <div className="w-full flex justify-center p-6 bg-slate-200/70 rounded-2xl border border-slate-300/80 shadow-inner overflow-hidden">
              <div
                className={`bg-white shadow-xl border-2 border-slate-900 rounded-lg p-3 transition-all ${
                  labelSize === 'thermal_75x50'
                    ? 'w-[345px] min-h-[235px]'
                    : labelSize === 'thermal_50x30'
                    ? 'w-[280px] min-h-[185px]'
                    : 'w-[315px] min-h-[205px]'
                } flex flex-col justify-between gap-1.5`}
              >
                {/* Header Stiker */}
                {showCompanyHeader && (
                  <div className="text-[10px] font-black text-center border-b border-dashed border-slate-900 pb-1 uppercase tracking-tight text-slate-900 truncate">
                    {companyName}
                  </div>
                )}

                {/* Body Stiker: QR Code Produk (Kiri) + Info Detail (Kanan) */}
                <div className="flex items-center gap-3 flex-1 min-h-0">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="p-1 bg-white border border-slate-900 rounded">
                      <QRCodeSVG
                        value={getQrValue(currentLot)}
                        size={labelSize === 'thermal_50x30' ? 54 : 70}
                        level="M"
                      />
                    </div>
                    <span className="font-mono font-black text-[8.5px] mt-0.5 text-slate-900 tracking-tight text-center">
                      QR: {currentLot.kode_produk}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 text-slate-900 space-y-0.5">
                    <div className="font-extrabold text-[11px] leading-tight text-slate-950 line-clamp-2">
                      {currentLot.nama_produk}
                    </div>
                    <div className="text-[9px] text-slate-600 font-mono font-semibold">
                      SKU: {currentLot.kode_produk}
                    </div>

                    {showExpDate && (
                      <div className="text-[9px] font-bold text-slate-900 flex items-center gap-1">
                        <span>ED:</span>
                        <span className="font-black bg-slate-100 px-1 py-0.2 rounded border border-slate-300">
                          {formatDate(currentLot.expired_date)}
                        </span>
                      </div>
                    )}

                    {showProdDate && (
                      <div className="text-[8.5px] text-slate-700">
                        Prod: {formatDate(currentLot.tanggal_produksi)}
                      </div>
                    )}

                    {showWarehouse && (
                      <div className="text-[8.5px] text-slate-700 truncate">
                        Gudang: {currentLot.nama_gudang || 'Gudang Utama'}
                      </div>
                    )}

                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="inline-block text-[8px] font-black uppercase border border-slate-900 px-1 rounded bg-slate-50">
                        {currentLot.metode_stok || 'FIFO'}
                      </span>
                      {showStatus && (
                        <span
                          className={`inline-block text-[8px] font-black uppercase border px-1 rounded ${
                            currentLot.status === 'QUARANTINE'
                              ? 'border-purple-800 text-purple-900 bg-purple-50'
                              : 'border-emerald-800 text-emerald-900 bg-emerald-50'
                          }`}
                        >
                          {currentLot.status || 'AVAILABLE'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barcode 1D Nomor Lot di Bawah */}
                <div className="border-t border-dashed border-slate-300 pt-1.5">
                  <Barcode128
                    value={currentLot.nomor_lot}
                    height={labelSize === 'thermal_50x30' ? 24 : 30}
                    fontSize={labelSize === 'thermal_50x30' ? 8 : 9}
                  />
                </div>

                {/* Footer Stiker */}
                <div className="text-[7px] text-slate-500 border-t border-dashed border-slate-200 pt-0.5 flex justify-between">
                  <span>Syntesia WMS Label (QR Produk + Barcode Lot)</span>
                  <span className="font-mono">{new Date().toISOString().split('T')[0]}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions untuk Unduh Gambar Stiker */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleDownloadQr(currentLot)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-teal-600" />
                Unduh Gambar Stiker (PNG)
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Container untuk Rendering Cetak Semua Label */}
        <div id="printable-qr-labels-container" className="hidden">
          {expandedLabels.map((lot, index) => (
            <div key={`${lot.nomor_lot}-${index}`} className="label-page">
              <div className="label-border">
                {showCompanyHeader && <div className="label-header">{companyName}</div>}
                <div className="label-body">
                  <div className="qr-wrapper">
                    <QRCodeSVG
                      value={getQrValue(lot)}
                      size={labelSize === 'thermal_50x30' ? 40 : labelSize === 'a4_grid' ? 50 : 62}
                      level="M"
                    />
                    <div className="qr-sku-text">{lot.kode_produk}</div>
                  </div>
                  <div className="info-wrapper">
                    <div className="info-prod-name">{lot.nama_produk}</div>
                    {showExpDate && (
                      <div className="info-item" style={{ fontWeight: 'bold' }}>
                        ED: {formatDate(lot.expired_date)}
                      </div>
                    )}
                    {showProdDate && (
                      <div className="info-item">Prod: {formatDate(lot.tanggal_produksi)}</div>
                    )}
                    {showWarehouse && (
                      <div className="info-item">Gudang: {lot.nama_gudang || 'Gudang Utama'}</div>
                    )}
                    <div className="info-item">
                      <span className="badge-chip">{lot.metode_stok || 'FIFO'}</span>{' '}
                      {showStatus && <span className="badge-chip">{lot.status || 'AVAILABLE'}</span>}
                    </div>
                  </div>
                </div>
                <div className="barcode-strip">
                  <Barcode128
                    value={lot.nomor_lot}
                    height={labelSize === 'thermal_50x30' ? 15 : labelSize === 'a4_grid' ? 19 : 24}
                    fontSize={labelSize === 'thermal_50x30' ? 6 : 7.5}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hidden Canvas untuk keperluan download PNG komposit */}
        <div className="hidden">
          {lots.map((lot) => (
            <QRCodeCanvas
              key={`canvas-${lot.nomor_lot}`}
              ref={(ref) => {
                if (ref) canvasRefs.current[lot.nomor_lot] = ref;
              }}
              value={getQrValue(lot)}
              size={512}
              level="H"
              includeMargin={true}
            />
          ))}
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Mencetak {expandedLabels.length} stiker label ({lots.length} nomor lot unik x {copiesPerLot} salinan)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm transition"
            >
              <Printer className="h-4 w-4" />
              Cetak {expandedLabels.length} Label Stiker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
