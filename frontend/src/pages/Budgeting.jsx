import { useEffect, useState } from 'react';
import {
  PieChart,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Layers,
  BarChart3,
  Calendar,
  Building,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const DIVISIONS = [
  'Operasional',
  'Gudang & Logistik',
  'Pemasaran & Penjualan',
  'IT & Sistem Informasi',
  'Umum & Administrasi',
  'Klinis & Medis',
];

export default function Budgeting() {
  const [targetYear, setTargetYear] = useState(() => String(new Date().getFullYear()));
  const [selectedDivisi, setSelectedDivisi] = useState('ALL');
  const [budgetVsActual, setBudgetVsActual] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal Planning
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tahun: String(new Date().getFullYear()),
    judul_anggaran: `Rencana Anggaran Biaya ${new Date().getFullYear()}`,
    divisi: 'Operasional',
    catatan: '',
    details: [],
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [bvaRes, accRes] = await Promise.all([
        api.get('/accounting/budgets/vs-actual', {
          params: {
            tahun: targetYear,
            divisi: selectedDivisi === 'ALL' ? undefined : selectedDivisi,
          },
        }),
        api.get('/accounting/accounts'),
      ]);

      if (bvaRes.data.success) {
        setBudgetVsActual(bvaRes.data.data);
      }
      if (accRes.data.success) {
        setAccounts(accRes.data.data || []);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetYear, selectedDivisi]);

  // Expense accounts for planning
  const expenseAccounts = accounts.filter(
    (a) => a.kategori === 'EXPENSE' || a.kategori === 'COGS'
  );

  const handleOpenPlanModal = () => {
    // If we have existing budget details, populate them, else start with default 3 expense lines
    const existingDetails =
      budgetVsActual?.items?.map((item) => ({
        account_id: String(item.accountId),
        nominal_anggaran: String(item.budget),
        catatan: '',
      })) || [];

    const initialDetails =
      existingDetails.length > 0
        ? existingDetails
        : expenseAccounts.slice(0, 4).map((acc) => ({
            account_id: String(acc.id),
            nominal_anggaran: '5000000',
            catatan: '',
          }));

    setForm({
      tahun: targetYear,
      judul_anggaran: `Pagu Anggaran Operasional ${targetYear}`,
      divisi: selectedDivisi === 'ALL' ? 'Operasional' : selectedDivisi,
      catatan: '',
      details: initialDetails,
    });
    setModalOpen(true);
  };

  const handleAddDetailRow = () => {
    const defaultAcc = expenseAccounts[0]?.id || '';
    setForm((prev) => ({
      ...prev,
      details: [
        ...prev.details,
        { account_id: String(defaultAcc), nominal_anggaran: '1000000', catatan: '' },
      ],
    }));
  };

  const handleRemoveDetailRow = (index) => {
    setForm((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index),
    }));
  };

  const handleDetailChange = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.details];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, details: updated };
    });
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!form.tahun || !form.judul_anggaran) {
      alertError('Peringatan', 'Tahun dan judul anggaran wajib diisi!');
      return;
    }
    if (form.details.length === 0) {
      alertError('Peringatan', 'Tambahkan minimal 1 pos akun anggaran!');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/accounting/budgets', {
        ...form,
        tahun: Number(form.tahun),
        details: form.details.map((d) => ({
          account_id: Number(d.account_id),
          nominal_anggaran: Number(d.nominal_anggaran || 0),
          catatan: d.catatan,
        })),
      });

      if (res.data.success) {
        toastSuccess('Berhasil!', res.data.message || 'Anggaran berhasil disimpan.');
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Menyimpan Anggaran', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const totalBudget = Number(budgetVsActual?.totalBudget || 0);
  const totalActual = Number(budgetVsActual?.totalActual || 0);
  const totalVariance = Number(budgetVsActual?.totalVariance ?? (totalBudget - totalActual));
  const overallPercentage = Number(
    budgetVsActual?.overallPercentage ?? (totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0)
  );
  const items = Array.isArray(budgetVsActual?.items) ? budgetVsActual.items : [];

  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: String(currentYear - 1), label: `Tahun ${currentYear - 1}` },
    { value: String(currentYear), label: `Tahun ${currentYear} (Berjalan)` },
    { value: String(currentYear + 1), label: `Tahun ${currentYear + 1}` },
  ];

  const totalFormBudget = (form.details || []).reduce(
    (sum, d) => sum + Number(d.nominal_anggaran || 0),
    0
  );

  const handleExportExcel = () => {
    const headers = [
      'Kode Akun',
      'Nama Akun Beban',
      'Pagu Anggaran (Budget)',
      'Realisasi Aktual (Actual)',
      'Sisa / Varians (Rp)',
      'Penyerapan (%)',
      'Status',
    ];

    const data = items.map((row) => [
      row.kodeAkun || '',
      row.namaAkun || '',
      row.budget ?? 0,
      row.actual ?? 0,
      row.variance ?? 0,
      `${row.percentage ?? 0}%`,
      row.percentage > 100 ? 'OVER BUDGET' : row.percentage > 85 ? 'WARNING' : 'AMAN',
    ]);

    exportToExcel(`Laporan_Penganggaran_Budget_${targetYear}`, headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <PieChart className="h-7 w-7 text-emerald-600" />
            Penganggaran & Kontrol Biaya (Budgeting)
          </h1>
          <p className="text-sm text-slate-500">
            Perencanaan plafon anggaran per divisi dan analisis perbandingan realisasi aktual (Budget vs Actual) dari buku besar.
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
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            Segarkan
          </button>
          <button
            onClick={handleOpenPlanModal}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            Susun / Edit Anggaran
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-56">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Tahun Anggaran
          </label>
          <SearchableSelect
            value={targetYear}
            onChange={(e) => setTargetYear(e.target.value)}
            options={yearOptions}
          />
        </div>

        <div className="w-56">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Divisi / Departemen
          </label>
          <SearchableSelect
            value={selectedDivisi}
            onChange={(e) => setSelectedDivisi(e.target.value)}
            options={[
              { value: 'ALL', label: 'Semua Divisi' },
              ...DIVISIONS.map((d) => ({ value: d, label: d })),
            ]}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Plafon Anggaran (Budget)</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">{formatRupiah(totalBudget)}</div>
          <p className="mt-1 text-xs text-slate-500">Target pagu biaya tahun {targetYear}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Realisasi Aktual (Actual)</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{formatRupiah(totalActual)}</div>
          <p className="mt-1 text-xs text-slate-500">Beban tercatat di buku besar</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Sisa Pagu Anggaran</span>
            <div
              className={`rounded-lg p-2 ${
                totalVariance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {totalVariance >= 0 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-bold ${
              totalVariance >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatRupiah(totalVariance)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {totalVariance >= 0 ? 'Surplus / Belum Terpakai' : 'Defisit / Terlampaui'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Tingkat Penyerapan</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                overallPercentage > 100
                  ? 'text-red-600'
                  : overallPercentage > 85
                  ? 'text-amber-600'
                  : 'text-slate-900'
              }`}
            >
              {overallPercentage}%
            </span>
            <span className="text-xs text-slate-500">terserap</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallPercentage > 100
                  ? 'bg-red-500'
                  : overallPercentage > 85
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, overallPercentage || 0))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Table Budget vs Actual */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 flex items-center justify-between">
          <div className="font-semibold text-slate-800 text-sm">
            Rincian Analisis Anggaran vs Realisasi per Akun Beban ({targetYear})
          </div>
          {budgetVsActual?.budget?.judul_anggaran && (
            <span className="text-xs text-slate-500">
              Dokumen: <strong className="text-slate-700">{budgetVsActual.budget.judul_anggaran}</strong>
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat data anggaran...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <PieChart className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Anggaran untuk Tahun {targetYear}</p>
            <p className="text-sm mt-1">
              Rencanakan pagu anggaran per pos beban operasional untuk mengendalikan pengeluaran perusahaan.
            </p>
            <button
              onClick={handleOpenPlanModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Susun Anggaran Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                <tr>
                  <th className="px-4 py-3">Akun Beban</th>
                  <th className="px-4 py-3 text-right">Pagu Anggaran</th>
                  <th className="px-4 py-3 text-right">Realisasi Aktual</th>
                  <th className="px-4 py-3 text-right">Sisa (Varians)</th>
                  <th className="px-4 py-3 text-center w-48">Penyerapan</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.accountId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{row.namaAkun}</div>
                      <div className="text-xs font-mono text-slate-500">{row.kodeAkun}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                      {formatRupiah(row.budget)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-purple-700">
                      {formatRupiah(row.actual)}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-bold ${
                        row.variance >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatRupiah(row.variance)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              row.percentage > 100
                                ? 'bg-red-500'
                                : row.percentage > 85
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, row.percentage || 0))}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-bold text-slate-700">
                          {row.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.isOverBudget
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : row.percentage > 85
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {row.isOverBudget
                          ? 'Over Budget'
                          : row.percentage > 85
                          ? 'Hampir Penuh'
                          : 'Aman'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3">TOTAL KESELURUHAN</td>
                  <td className="px-4 py-3 text-right text-blue-700">{formatRupiah(totalBudget)}</td>
                  <td className="px-4 py-3 text-right text-purple-700">{formatRupiah(totalActual)}</td>
                  <td
                    className={`px-4 py-3 text-right font-bold ${
                      totalVariance >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatRupiah(totalVariance)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-slate-800">
                    Rata-rata: {overallPercentage}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        overallPercentage > 100
                          ? 'bg-red-100 text-red-800'
                          : overallPercentage > 85
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {overallPercentage > 100 ? 'MELEBIHI PAGU' : 'DALAM BATAS'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal Susun / Edit Anggaran */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Rencana Anggaran Biaya (Budget Planning) Tahun ${form.tahun}`}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tahun Anggaran <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.tahun}
                onChange={(e) => setForm({ ...form, tahun: e.target.value })}
                options={yearOptions}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Divisi / Bagian <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.divisi}
                onChange={(e) => setForm({ ...form, divisi: e.target.value })}
                options={DIVISIONS.map((d) => ({ value: d, label: d }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Judul Dokumen Anggaran <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.judul_anggaran}
                onChange={(e) => setForm({ ...form, judul_anggaran: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Catatan / Landasan Perencanaan
            </label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="cth: Alokasi anggaran operasional tahunan disetujui direksi..."
            />
          </div>

          {/* Pos-pos Akun Anggaran */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Daftar Pos Akun Beban & Nominal Anggaran
              </h4>
              <button
                type="button"
                onClick={handleAddDetailRow}
                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Pos Beban
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {form.details.map((detail, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                >
                  <div className="col-span-6">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Akun Beban COA
                    </label>
                    <SearchableSelect
                      value={detail.account_id}
                      onChange={(e) => handleDetailChange(idx, 'account_id', e.target.value)}
                      options={expenseAccounts.map((a) => ({
                        value: String(a.id),
                        label: `${a.kode_akun} - ${a.nama_akun}`,
                      }))}
                    />
                  </div>

                  <div className="col-span-5">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Pagu Nominal (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={detail.nominal_anggaran}
                      onChange={(e) => handleDetailChange(idx, 'nominal_anggaran', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="0"
                    />
                  </div>

                  <div className="col-span-1 flex justify-center pt-5">
                    <button
                      type="button"
                      onClick={() => handleRemoveDetailRow(idx)}
                      disabled={form.details.length <= 1}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
              <span>Total Pagu Anggaran Rencana:</span>
              <span className="text-base text-emerald-700">{formatRupiah(totalFormBudget)}</span>
            </div>
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
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan & Terapkan Anggaran
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

