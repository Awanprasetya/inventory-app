import { useEffect, useState, useRef, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { useTour } from '../context/TourContext.jsx';

/**
 * Smart Resolver untuk mencari elemen DOM yang menjadi sasaran sorotan (spotlight)
 */
function resolveTargetElement(step) {
  if (!step) return null;

  // 1. Cek targetId eksplisit
  if (step.targetId) {
    const el = document.getElementById(step.targetId);
    if (el) return el;
  }

  // 2. Cek targetSelector eksplisit
  if (step.targetSelector) {
    const el = document.querySelector(step.targetSelector);
    if (el) return el;
  }

  // 3. Cek cerdas berdasarkan targetType
  switch (step.targetType) {
    case 'banner':
      return (
        document.getElementById('module-tour-banner') ||
        document.getElementById('tour-welcome') ||
        document.querySelector('.page-header') ||
        document.querySelector('.card:first-of-type') ||
        document.querySelector('main > div > div:first-child')
      );
    case 'action':
      return (
        document.querySelector('button.btn-primary') ||
        document.querySelector('a.btn-primary') ||
        document.querySelector('button:has(.lucide-plus)') ||
        document.querySelector('button:has(.lucide-package-plus)') ||
        document.querySelector('form button[type="submit"]') ||
        document.querySelector('.btn-primary')
      );
    case 'filter':
      return (
        document.querySelector('input[placeholder*="Cari"]') ||
        document.querySelector('.card-header input') ||
        document.querySelector('.searchable-select') ||
        document.querySelector('select.select') ||
        document.querySelector('select')
      );
    case 'table':
      return (
        document.querySelector('table.table-base') ||
        document.querySelector('.overflow-x-auto') ||
        document.querySelector('table') ||
        document.querySelector('.card:has(table)') ||
        document.querySelector('.card')
      );
    case 'export':
      return (
        document.querySelector('button:has(.lucide-file-spreadsheet)') ||
        document.querySelector('button:has(.lucide-printer)') ||
        document.querySelector('button.btn-secondary:has(svg)') ||
        document.querySelector('button.btn-secondary')
      );
    case 'sop':
      return document.getElementById('tour-sop-guide');
    case 'sidebar':
      return document.getElementById('tour-sidebar-toggle') || document.getElementById('tour-sidebar-menu');
    case 'notif':
      return document.getElementById('tour-notifications');
    case 'profile':
      return document.getElementById('tour-user-profile');
    default:
      return (
        document.getElementById('module-tour-banner') ||
        document.querySelector('.card') ||
        document.querySelector('main > div')
      );
  }
}

export default function TourGuide() {
  const {
    isTourOpen,
    currentStep,
    currentStepIndex,
    totalSteps,
    activeModuleName,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
    startTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, openBelow: true });
  const cardRef = useRef(null);

  // Perbarui posisi target element saat step berubah atau window di-resize / scroll
  const updatePosition = useCallback(() => {
    if (!currentStep) return;

    const el = resolveTargetElement(currentStep);

    if (el) {
      // Scroll halus jika elemen berada di luar viewport
      const rect = el.getBoundingClientRect();
      const isInViewport =
        rect.top >= 50 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - 50 &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

      if (!isInViewport) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Ambil rect terkini
      const currentRect = el.getBoundingClientRect();
      setTargetRect({
        top: currentRect.top,
        left: currentRect.left,
        width: currentRect.width,
        height: currentRect.height,
      });

      // Hitung posisi floating card
      const cardWidth = Math.min(window.innerWidth - 32, 450);
      let leftPos = currentRect.left + currentRect.width / 2 - cardWidth / 2;
      leftPos = Math.max(16, Math.min(leftPos, window.innerWidth - cardWidth - 16));

      // Tentukan di atas atau di bawah target
      const spaceBelow = window.innerHeight - currentRect.bottom;
      const openBelow = spaceBelow > 280 || spaceBelow >= currentRect.top;

      let topPos;
      if (openBelow) {
        topPos = currentRect.bottom + 16;
      } else {
        topPos = Math.max(16, currentRect.top - 270);
      }

      setTooltipPos({ top: topPos, left: leftPos, openBelow });
    } else {
      // Fallback tengah layar dengan aman
      setTargetRect(null);
      setTooltipPos({
        top: Math.max(40, window.innerHeight / 2 - 140),
        left: Math.max(16, window.innerWidth / 2 - Math.min(window.innerWidth - 32, 450) / 2),
        openBelow: true,
      });
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isTourOpen || !currentStep) return;

    // Tunggu render DOM selesai jika berpindah halaman / modal
    const timer = setTimeout(() => {
      updatePosition();
    }, 100);

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isTourOpen, currentStep, currentStepIndex, updatePosition]);

  // Tombol Bantuan Mengambang (Floating Action Button) saat tur sedang tertutup
  if (!isTourOpen) {
    return (
      <aside aria-label="Bantuan Panduan Modul" className="fixed bottom-5 right-5 z-40 print:hidden">
        <button
          type="button"
          onClick={() => startTour()}
          className="group flex items-center gap-2 rounded-full bg-slate-900/90 hover:bg-blue-600 text-white px-4 py-2.5 text-xs font-bold shadow-2xl border border-slate-700/80 hover:border-blue-400 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 ring-1 ring-white/10"
          title={`Buka Panduan Tur ${activeModuleName || 'Modul Ini'}`}
        >
          <Sparkles className="h-4 w-4 text-amber-300 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">Panduan: {activeModuleName || 'Modul Ini'}</span>
          <span className="sm:hidden">Panduan</span>
        </button>
      </aside>
    );
  }

  if (!currentStep) return null;

  const isLastStep = currentStepIndex === totalSteps - 1;

  // Hitung posisi panah penunjuk (arrow pointer)
  const arrowLeft = targetRect
    ? Math.max(24, Math.min(410, targetRect.left + targetRect.width / 2 - tooltipPos.left - 8))
    : 24;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* 1. Backdrop Interaktif (Tanpa Blur sama sekali agar halaman di belakang tetap tajam & jernih) */}
      <div
        className={`fixed inset-0 transition-opacity duration-300 ${
          targetRect ? 'bg-transparent' : 'bg-slate-950/35'
        }`}
        onClick={skipTour}
      />

      {/* 2. Spotlight Cutout di sekeliling Target Element (Jernih tanpa blur, bayangan lembut 40%) */}
      {targetRect && (
        <div
          className="fixed rounded-xl pointer-events-none transition-all duration-300 ease-out ring-4 ring-blue-500 shadow-[0_0_0_9999px_rgba(15,23,42,0.40)] ring-offset-2 ring-offset-white z-40 animate-pulse"
          style={{
            top: `${Math.max(0, targetRect.top - 6)}px`,
            left: `${Math.max(0, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      {/* 3. Floating Tooltip Popover Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className="fixed z-50 w-[92vw] max-w-[450px] rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 ring-1 ring-white/10"
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
        }}
      >
        {/* Panah Penunjuk Segitiga ke Arah Elemen Target */}
        {targetRect && (
          <div
            className={`absolute h-0 w-0 border-8 border-transparent transition-all duration-200 pointer-events-none ${
              tooltipPos.openBelow
                ? 'bottom-full border-b-slate-900 -mb-1'
                : 'top-full border-t-slate-900 -mt-1'
            }`}
            style={{ left: `${arrowLeft}px` }}
          />
        )}

        {/* Header Kartu Panduan */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 truncate">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-400 border border-blue-400/30 truncate max-w-[300px]">
              <Sparkles className="h-3 w-3 shrink-0 text-amber-300" />
              <span className="truncate">{activeModuleName}</span>
              <span className="text-slate-400 font-normal">({currentStepIndex + 1}/{totalSteps})</span>
            </span>
          </div>

          <button
            type="button"
            onClick={skipTour}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Tutup / Lewati Panduan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Isi Panduan */}
        <div className="p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {currentStep.title}
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            {currentStep.content}
          </p>

          {currentStep.tip && (
            <div className="flex items-start gap-2 rounded-xl bg-blue-950/60 border border-blue-500/30 p-2.5 text-[11px] text-blue-200">
              <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">Tips Operasional / Cara Input: </span>
                {currentStep.tip}
              </div>
            </div>
          )}
        </div>

        {/* Footer Aksi: Skip, Prev, Next */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 bg-slate-950/60 rounded-b-2xl">
          {/* Tombol Lewati / Skip */}
          <button
            type="button"
            onClick={skipTour}
            className="text-xs font-semibold text-slate-400 hover:text-white underline underline-offset-2 transition-colors"
          >
            Lewati
          </button>

          {/* Indikator Titik Progress */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStepIndex
                    ? 'w-5 bg-blue-500'
                    : idx < currentStepIndex
                    ? 'w-2 bg-blue-400/50'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Tombol Navigasi: Sebelumnya & Lanjut */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Sebelumnya</span>
              </button>
            )}

            <button
              type="button"
              onClick={isLastStep ? finishTour : nextStep}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-md ${
                isLastStep
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              <span>{isLastStep ? 'Selesai & Paham' : 'Lanjut'}</span>
              {isLastStep ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
