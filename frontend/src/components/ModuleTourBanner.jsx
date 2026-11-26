import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, ChevronDown, ChevronUp, X, Lightbulb } from 'lucide-react';
import { useTour } from '../context/TourContext.jsx';

export default function ModuleTourBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRouteTour, startTour, isCompleted } = useTour();

  const [dismissed, setDismissed] = useState(false);

  // Jangan tampilkan di halaman login
  if (location.pathname === '/login') return null;

  const moduleName = currentRouteTour?.moduleName || 'SyntesiaERP';
  const isTourDone = isCompleted(location.pathname);

  if (dismissed) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs shadow-sm print:hidden">
        <div className="flex items-center gap-2 text-slate-600">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span>Panduan modul <strong>{moduleName}</strong> disembunyikan.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => startTour()}
            className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Mulai Tur Panduan
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => setDismissed(false)}
            className="text-slate-400 hover:text-slate-600 text-[11px]"
          >
            Tampilkan Banner
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="module-tour-banner"
      className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white shadow-lg border border-indigo-900/40 print:hidden animate-in fade-in slide-in-from-top-1"
    >
      {/* Background Accent Glow */}
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300 border border-blue-400/30">
              <Sparkles className="h-3 w-3 text-amber-300" />
              Panduan Operasional & Alur Input
            </span>
            {isTourDone && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-400/30">
                ✓ Tur Selesai
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Modul: {moduleName}
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed">
            {location.pathname === '/'
              ? 'Selamat datang di dashboard pusat kendali ERP. Pantau seluruh pergerakan stok gudang, penjualan, pengadaan, dan akuntansi secara seketika.'
              : `Pelajari cara pengisian data, aturan alur transaksi, serta integrasi akuntansi otomatis untuk modul ${moduleName} melalui panduan interaktif.`}
          </p>
        </div>

        {/* Tombol Aksi Panduan */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => startTour()}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 hover:shadow-lg transition-all active:scale-95"
            title={`Mulai Tur Interaktif ${moduleName}`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Mulai Tur Panduan</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/workflows')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
            title="Buka Buku Panduan SOP Alur Kerja Lengkap"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">Buku SOP</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Sembunyikan banner panduan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

