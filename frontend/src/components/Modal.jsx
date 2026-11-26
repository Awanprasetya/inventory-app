import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, isOpen, title, onClose, children, maxWidth = 'max-w-md' }) {
  const show = isOpen !== undefined ? isOpen : open;

  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 print:hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div className={`relative w-full ${maxWidth} max-h-[92vh] flex flex-col rounded-xl bg-white shadow-2xl transition-all`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4 shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate pr-2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5 sm:py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
