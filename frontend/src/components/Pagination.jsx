// Pagination tabel yang reusable: tombol Prev/Next + nomor halaman + info baris
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SearchableSelect from './SearchableSelect.jsx';

/**
 * @param {number} page        halaman aktif (1-based)
 * @param {number} totalPages  total halaman (>= 1)
 * @param {function} onPage    callback(page) saat pindah halaman
 * @param {number} totalItems  total baris data
 * @param {number} pageSize    baris per halaman
 * @param {function} onPageSize callback(size) saat ukuran halaman berubah (opsional)
 * @param {string} label       nama data untuk info, mis. "produk"
 */
export default function Pagination({
  page,
  totalPages,
  onPage,
  totalItems,
  pageSize,
  onPageSize,
  label = 'data',
}) {
  if (totalItems === 0) return null;

  const go = (p) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next !== page) onPage(next);
  };

  // Nomor halaman: tampilkan maksimal 5 tombol di sekitar halaman aktif
  const numbers = () => {
    const total = Math.max(1, totalPages);
    const start = Math.max(1, Math.min(page - 2, total - 4));
    const end = Math.min(total, start + 4);
    const arr = [];
    for (let i = start; i <= end; i += 1) arr.push(i);
    return arr;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
      <p className="text-xs text-slate-500">
        Menampilkan {from}&ndash;{to} dari {totalItems} {label}
      </p>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <SearchableSelect
            className="w-32"
            size="sm"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Baris per halaman"
            searchPlaceholder="Cari baris..."
            isClearable={false}
            options={[5, 10, 20, 50].map((s) => ({
              value: s,
              label: `${s} / halaman`,
            }))}
          />
        )}
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {numbers().map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => go(n)}
            className={`min-w-8 rounded-lg px-2 py-1.5 text-xs font-medium ${
              n === page
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Potong array menjadi satu halaman + hitung total halaman (pagination sisi klien)
export const paginate = (items, page, pageSize) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), totalPages, safePage };
};
