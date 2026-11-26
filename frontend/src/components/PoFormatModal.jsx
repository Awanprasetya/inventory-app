import React, { useState, useEffect } from 'react';
import { Settings, Hash, Calendar, Sparkles, Check, RotateCcw } from 'lucide-react';
import Modal from './Modal.jsx';
import {
  DEFAULT_PO_FORMAT,
  PO_FORMAT_PRESETS,
  renderPoFormatString,
  generateNextPoNumber,
} from '../utils/poNumberHelper.js';

export default function PoFormatModal({
  isOpen,
  onClose,
  formatConfig = DEFAULT_PO_FORMAT,
  onSave,
  dateStr,
  existingPos = [],
}) {
  const [prefix, setPrefix] = useState(formatConfig.prefix || 'JPM/PO');
  const [pattern, setPattern] = useState(formatConfig.pattern || '{PREFIX}/{BULAN}/{NO}');
  const [digitCount, setDigitCount] = useState(formatConfig.digitCount || 4);
  const [resetCycle, setResetCycle] = useState(formatConfig.resetCycle || 'monthly');
  const [activePreset, setActivePreset] = useState(() => {
    const match = PO_FORMAT_PRESETS.find((p) => p.pattern === (formatConfig.pattern || '{PREFIX}/{BULAN}/{NO}'));
    return match ? match.id : 'custom';
  });

  useEffect(() => {
    if (isOpen) {
      setPrefix(formatConfig.prefix || 'JPM/PO');
      setPattern(formatConfig.pattern || '{PREFIX}/{BULAN}/{NO}');
      setDigitCount(formatConfig.digitCount || 4);
      setResetCycle(formatConfig.resetCycle || 'monthly');
      const match = PO_FORMAT_PRESETS.find((p) => p.pattern === (formatConfig.pattern || '{PREFIX}/{BULAN}/{NO}'));
      setActivePreset(match ? match.id : 'custom');
    }
  }, [isOpen, formatConfig]);

  if (!isOpen) return null;

  const currentConfig = {
    prefix,
    pattern: pattern.includes('{NO}') ? pattern : `${pattern}/{NO}`,
    digitCount: Number(digitCount),
    resetCycle,
  };

  // Kalkulasi preview nomor PO berikutnya
  const nextPreviewNumber = generateNextPoNumber(dateStr, existingPos, currentConfig);

  const handleSelectPreset = (preset) => {
    setActivePreset(preset.id);
    if (preset.id !== 'custom') {
      setPattern(preset.pattern);
    }
  };

  const handleInsertTag = (tag) => {
    if (!pattern.includes(tag)) {
      setPattern((prev) => `${prev}/${tag}`);
    }
  };

  const handleResetDefault = () => {
    setPrefix(DEFAULT_PO_FORMAT.prefix);
    setPattern(DEFAULT_PO_FORMAT.pattern);
    setDigitCount(DEFAULT_PO_FORMAT.digitCount);
    setResetCycle(DEFAULT_PO_FORMAT.resetCycle);
    setActivePreset('prefix-month-no');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalPattern = pattern.includes('{NO}') ? pattern : `${pattern}/{NO}`;
    onSave({
      prefix: prefix.trim() || 'JPM/PO',
      pattern: finalPattern,
      digitCount: Number(digitCount),
      resetCycle,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Pengaturan Format Nomor Purchase Order (PO)"
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Live Preview Box */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Pratinjau Nomor PO Berikutnya:
            </span>
            <span className="text-[10px] text-blue-700 font-medium">
              Berdasarkan tanggal: {dateStr || new Date().toISOString().split('T')[0]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-mono font-black text-lg text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-blue-200 tracking-wider shadow-sm">
              {nextPreviewNumber}
            </div>
            <span className="text-[11px] text-slate-500">
              (Hanya digit angka yang bertambah otomatis berurutan)
            </span>
          </div>
        </div>

        {/* 1. Format Depan (Prefix) */}
        <div>
          <label className="label font-bold text-slate-700">
            1. Awalan Format Depan (Prefix)
          </label>
          <input
            type="text"
            className="input font-mono font-semibold text-xs"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Contoh: JPM/PO atau PT-MDI/PO"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Ditetapkan sendiri sesuai identitas perusahaan, divisi, atau departemen (contoh: <strong>JPM/PO</strong>).
          </p>
        </div>

        {/* 2. Pilihan Pola Struktur Format */}
        <div>
          <label className="label font-bold text-slate-700">
            2. Pilihan Pola Struktur Nomor PO
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PO_FORMAT_PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id;
              const previewSample =
                preset.id === 'custom'
                  ? 'Kustom'
                  : renderPoFormatString(preset.pattern, prefix, dateStr, 1, digitCount);

              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition text-left space-y-1 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500 font-semibold'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{preset.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600">
                    Contoh: <span className="font-bold text-slate-900">{previewSample}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{preset.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Input Pola Kustom (Jika dipilih) */}
        {activePreset === 'custom' && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <label className="label font-bold text-slate-700">
              Pola Template Kustom (Wajib menyertakan &#123;NO&#125;)
            </label>
            <input
              type="text"
              className="input font-mono text-xs"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="{PREFIX}/{BULAN}/{NO}"
              required
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500">Klik tag untuk menambahkan:</span>
              {[
                { tag: '{PREFIX}', label: 'Prefix (Awalan)' },
                { tag: '{BULAN}', label: 'Bulan (10)' },
                { tag: '{ROMAN}', label: 'Romawi (X)' },
                { tag: '{TAHUN}', label: 'Tahun (2026)' },
                { tag: '{YY}', label: 'Tahun 2 Digit (26)' },
                { tag: '{NO}', label: 'No. Urut (0001)' },
              ].map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => handleInsertTag(t.tag)}
                  className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 font-mono text-[10px] text-slate-700 transition"
                >
                  {t.tag} <span className="text-slate-400 font-sans">({t.label})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Konfigurasi Digit & Siklus Reset Nomor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
          <div>
            <label className="label font-bold text-slate-700 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-blue-600" /> Jumlah Digit Nomor Urut Otomatis
            </label>
            <select
              value={digitCount}
              onChange={(e) => setDigitCount(Number(e.target.value))}
              className="select text-xs font-mono"
            >
              <option value={3}>3 Digit (Contoh: 001, 002)</option>
              <option value={4}>4 Digit (Contoh: 0001, 0002) [Standar]</option>
              <option value={5}>5 Digit (Contoh: 00001, 00002)</option>
            </select>
          </div>

          <div>
            <label className="label font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Siklus Reset Nomor Urut
            </label>
            <select
              value={resetCycle}
              onChange={(e) => setResetCycle(e.target.value)}
              className="select text-xs"
            >
              <option value="monthly">Reset Tiap Bulan (Mulai dari 1 tiap bulan baru) [Rekomendasi]</option>
              <option value="yearly">Reset Tiap Tahun (Mulai dari 1 tiap 1 Januari)</option>
              <option value="continuous">Berlanjut Terus (Tidak pernah reset)</option>
            </select>
          </div>
        </div>

        {/* Footer Tombol */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleResetDefault}
            className="btn-secondary !text-xs !py-1.5 flex items-center gap-1 text-slate-600"
          >
            <RotateCcw className="w-3 h-3" /> Kembalikan ke Standar
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary !text-xs !py-1.5">
              Batal
            </button>
            <button type="submit" className="btn-primary !text-xs !py-1.5">
              Simpan Format Nomor PO
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

