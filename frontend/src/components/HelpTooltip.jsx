import { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info } from 'lucide-react';

/**
 * HelpTooltip Component
 * Menampilkan ikon bantuan (?) atau (i) yang saat di-hover atau di-klik
 * menampilkan popover / tooltip berisi panduan cara pengisian / input field.
 *
 * @param {string} text - Teks penjelasan panduan
 * @param {string} [title] - Judul kecil penjelasan (opsional)
 * @param {string} [example] - Contoh input yang valid (opsional)
 * @param {string} [position] - 'top' | 'bottom' | 'left' | 'right' (default 'top')
 * @param {string} [iconType] - 'help' | 'info' (default 'help')
 * @param {string} [className] - Class tambahan untuk trigger icon
 */
export default function HelpTooltip({
  text,
  title,
  example,
  position = 'top',
  iconType = 'help',
  className = '',
}) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);

  // Tutup tooltip saat klik di luar (untuk perangkat layar sentuh / mobile)
  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [visible]);

  // Posisi tooltip
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-l-slate-900 border-y-transparent border-r-transparent';
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-r-slate-900 border-y-transparent border-l-transparent';
      case 'top':
      default:
        return 'top-full left-1/2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent';
    }
  };

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setVisible((prev) => !prev);
        }}
        className="inline-flex items-center justify-center p-0.5 text-slate-400 hover:text-blue-600 focus:outline-none focus:text-blue-600 transition-colors"
        aria-label="Petunjuk Pengisian"
        tabIndex={-1}
      >
        {iconType === 'info' ? (
          <Info className="h-3.5 w-3.5" />
        ) : (
          <HelpCircle className="h-3.5 w-3.5" />
        )}
      </button>

      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 w-64 rounded-lg bg-slate-900 p-2.5 text-left text-xs text-white shadow-xl ring-1 ring-white/10 animate-in fade-in zoom-in-95 pointer-events-auto ${getPositionClasses()}`}
        >
          {/* Panah Indikator */}
          <div className={`absolute h-0 w-0 border-4 ${getArrowClasses()}`} />

          {title && (
            <div className="font-bold text-blue-300 mb-1 flex items-center gap-1">
              <Info className="h-3 w-3 text-blue-400" />
              <span>{title}</span>
            </div>
          )}

          <p className="text-slate-200 leading-relaxed text-[11px]">{text}</p>

          {example && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-700/80 text-[10px] text-slate-300">
              <span className="font-semibold text-amber-300">Contoh: </span>
              <span className="font-mono bg-slate-800 px-1 py-0.5 rounded text-amber-200">{example}</span>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

