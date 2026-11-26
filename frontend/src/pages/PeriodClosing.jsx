import { useEffect, useState } from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileSpreadsheet,
  ShieldAlert,
  Info,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 10;

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export default function PeriodClosing() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [form, setForm] = useState(() => {
    const d = new Date();
    // Default to previous month
    const prevMonth = d.getMonth() === 0 ? 12 : d.getMonth();
    const prevYear = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();

    return {
      tahun: String(prevYear),
      bulan: String(prevMonth),
      tanggal_tutup: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      catatan: '',
    };
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/accounting/periods');
      if (res.data.success) {
        setPeriods(res.data.data || []);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMonthYearChange = (field, val) => {
    const updated = { ...form, [field]: val };
    const y = Number(updated.tahun);
    const m = Number(updated.bulan);
    if (y && m) {
      const lastDay = new Date(y, m, 0).getDate();
      updated.tanggal_tutup = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    setForm(updated);
  };

  const handleClosePeriodSubmit = async (e) => {
    e.preventDefault();
    const monthName = MONTH_NAMES[Number(form.bulan) - 1];

    const isConfirmed = await confirmDelete(
      `Tutup Buku Periode ${monthName} ${form.tahun}?`,
      'Sistem akan otomatis menghitung laba rugi, memposting jurnal penutup, dan mentransfer saldo ke Laba Ditahan.'
    );
    if (!isConfirmed) return;

    setClosing(true);
    try {
      const res = await api.post('/accounting/periods/close', form);
      if (res.data.success) {
        toastSuccess('Tutup Buku Berhasil!', res.data.message);
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Tutup Buku', getErrorMessage(err));
    } finally {
      setClosing(false);
    }
  };

  const handleReopenPeriod = async (period) => {
    const monthName = MONTH_NAMES[period.bulan - 1];
    const isConfirmed = await confirmDelete(
      `Buka Kembali Periode ${monthName} ${period.tahun}?`,
      'Jurnal penutup akan dibatalkan sehingga transaksi pada periode ini dapat disesuaikan kembali.'
    );
    if (!isConfirmed) return;

    try {
      const res = await api.post(`/accounting/periods/${period.id}/reopen`);
      if (res.data.success) {
        toastSuccess('Periode Dibuka!', res.data.message);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Membuka Periode', getErrorMessage(err));
    }
  };

  // Summary KPIs
  const closedCount = periods.filter((p) => p.status === 'CLOSED').length;
  const totalLabaDitahan = periods
    .filter((p) => p.status === 'CLOSED')
    .reduce((sum, p) => sum + Number(p.laba_bersih || 0), 0);

  const { pageItems: paginatedPeriods, totalPages, safePage } = paginate(periods, page, pageSize);

  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: String(currentYear - 2), label: String(currentYear - 2) },
    { value: String(currentYear - 1), label: String(currentYear - 1) },
    { value: String(currentYear), label: String(currentYear) },
    { value: String(currentYear + 1), label: String(currentYear + 1) },
  ];

  const handleExportExcel = () => {
    const headers = [
      'Bulan & Tahun Periode',
      'Tanggal Tutup Buku',
      'Total Pendapatan (Rp)',
      'Total Beban (Rp)',
      'Laba / (Rugi) Bersih (Rp)',
      'Status Lock',
      'Di-Lock Oleh',
      'Tanggal Eksekusi',
      'Catatan',
    ];

    const data = (periods || []).map((p) => [
      `${MONTH_NAMES[p.bulan - 1] || p.bulan} ${p.tahun}`,
      formatDate(p.tanggal_tutup),
      p.total_pendapatan ?? 0,
      p.total_beban ?? 0,
      p.laba_rugi_bersih ?? 0,
      p.status || 'CLOSED',
      p.created_by_user?.nama_lengkap || p.created_by_user?.username || 'Sistem ERP',
      formatDate(p.createdAt),
      p.catatan || '-',
    ]);

    exportToExcel('Riwayat_Tutup_Buku_Periode', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Lock className="h-7 w-7 text-indigo-600" />
            Tutup Buku Periode (Period Closing)
          </h1>
          <p className="text-sm text-slate-500">
            Kunci pencatatan akuntansi bulanan, otomatisasi jurnal penutup (closing entries), dan transfer laba bersih ke Laba Ditahan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            title="Export ke Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Segarkan
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            <Lock className="h-4 w-4" />
            Tutup Buku Periode Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Periode Telah Ditutup</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{closedCount} Periode</div>
          <p className="mt-1 text-xs text-slate-500">Buku besar periode terkunci dari perubahan</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Akumulasi Laba Ditransfer</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{formatRupiah(totalLabaDitahan)}</div>
          <p className="mt-1 text-xs text-slate-500">Total laba bersih dipindah ke Retained Earnings</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Standar Kepatuhan ERP</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">GAAP / PSAK</div>
          <p className="mt-1 text-xs text-slate-500">Otomatisasi seimbang debit dan kredit 100%</p>
        </div>
      </div>

      {/* Info Prosedur Tutup Buku */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-950 space-y-1">
            <p className="font-semibold text-sm text-indigo-900">
              Mekanisme Otomatis Tutup Buku Sistem ERP PT JARUM PATAH MEDICAL:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 text-indigo-800">
              <li>
                Sistem menghitung saldo nominal seluruh akun Pendapatan, HPP (COGS), dan Beban Operasional pada bulan bersangkutan.
              </li>
              <li>
                Menerbitkan <strong>Jurnal Penutup (Closing Entries)</strong>: Akun Pendapatan didebit, Beban & HPP dikredit hingga saldo mutasi kembali 0.
              </li>
              <li>
                Memindahkan selisih Laba/Rugi Bersih secara otomatis ke akun Ekuitas: <strong>3-2001 (Laba Ditahan / Retained Earnings)</strong>.
              </li>
              <li>
                Jika diperlukan revisi, admin dapat melakukan <strong>Buka Kembali (Reopen)</strong> yang akan membatalkan jurnal penutup secara otomatis.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat riwayat tutup buku...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : periods.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Lock className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Riwayat Tutup Buku</p>
            <p className="text-sm mt-1">
              Lakukan tutup buku bulanan untuk membukukan laba rugi ke saldo modal laba ditahan secara resmi.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Lock className="h-4 w-4" />
              Tutup Buku Sekarang
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3">Tgl Tutup</th>
                    <th className="px-4 py-3 text-right">Total Pendapatan</th>
                    <th className="px-4 py-3 text-right">Total Beban & HPP</th>
                    <th className="px-4 py-3 text-right">Laba/Rugi Bersih</th>
                    <th className="px-4 py-3">No Jurnal Penutup</th>
                    <th className="px-4 py-3">Petugas</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPeriods.map((period) => {
                    const isProfit = Number(period.laba_bersih) >= 0;

                    return (
                      <tr key={period.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">
                            {MONTH_NAMES[period.bulan - 1]} {period.tahun}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {period.tahun}-{String(period.bulan).padStart(2, '0')}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{formatDate(period.tanggal_tutup)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                          {formatRupiah(period.total_pendapatan)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-amber-700">
                          {formatRupiah(period.total_beban)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div
                            className={`font-bold flex items-center justify-end gap-1 ${
                              isProfit ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {isProfit ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span>{formatRupiah(period.laba_bersih)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {period.closing_journal_id ? (
                            <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              JRN-CLS-#{period.closing_journal_id}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-slate-800 font-medium">
                            {period.closed_by_name || 'Admin'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              period.status === 'CLOSED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {period.status === 'CLOSED' ? (
                              <>
                                <Lock className="h-3 w-3" /> DITUTUP
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3 w-3" /> TERBUKA
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {period.status === 'CLOSED' ? (
                            <button
                              onClick={() => handleReopenPeriod(period)}
                              className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                              title="Buka Kembali Periode"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              Buka Kembali
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPage={setPage}
                totalItems={periods.length}
                pageSize={pageSize}
                onPageSize={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                label="periode"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Tutup Buku */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tutup Buku Periode Akuntansi"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleClosePeriodSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tahun <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.tahun}
                onChange={(e) => handleMonthYearChange('tahun', e.target.value)}
                options={yearOptions}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Bulan <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.bulan}
                onChange={(e) => handleMonthYearChange('bulan', e.target.value)}
                options={MONTH_NAMES.map((name, idx) => ({
                  value: String(idx + 1),
                  label: `${idx + 1} - ${name}`,
                }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Tanggal Efektif Tutup Buku <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.tanggal_tutup}
              onChange={(e) => setForm({ ...form, tanggal_tutup: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Catatan / Memo Tutup Buku
            </label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="cth: Tutup buku bulanan audit internal selesai..."
            />
          </div>

          <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-amber-900">
              <ShieldAlert className="h-4 w-4" />
              Perhatian Penting:
            </div>
            <p>
              Setelah tutup buku diproses, transaksi pada periode ini tidak dapat diubah kecuali dibuka kembali melalui izin otorisasi. Jurnal penutup akan terbit secara seimbang.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={closing}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {closing && <Loader2 className="h-4 w-4 animate-spin" />}
              Proses Tutup Buku
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

