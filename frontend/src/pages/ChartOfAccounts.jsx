import { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Landmark,
  Layers,
  HelpCircle,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 12;

const emptyForm = {
  kode_akun: '',
  nama_akun: '',
  kategori: 'EXPENSE',
  subkategori: '',
  saldo_normal: 'DEBIT',
  is_kas_bank: false,
  deskripsi: '',
};

const KATEGORI_OPTIONS = [
  { value: 'ALL', label: 'Semua Kategori' },
  { value: 'ASSET', label: '1 - Aset / Aktiva (Asset)' },
  { value: 'LIABILITY', label: '2 - Kewajiban / Utang (Liability)' },
  { value: 'EQUITY', label: '3 - Ekuitas / Modal (Equity)' },
  { value: 'REVENUE', label: '4 - Pendapatan (Revenue)' },
  { value: 'COGS', label: '5 - Beban Pokok Penjualan (COGS)' },
  { value: 'EXPENSE', label: '6 - Beban Operasional (Expense)' },
];

const categoryBadgeClass = (kat) => {
  switch (kat) {
    case 'ASSET':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'LIABILITY':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'EQUITY':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'REVENUE':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'COGS':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'EXPENSE':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (kategoriFilter !== 'ALL') params.kategori = kategoriFilter;
      if (search.trim()) params.search = search.trim();

      const { data } = await api.get('/accounting/accounts', { params });
      setAccounts(data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadAccounts(), 200);
    return () => clearTimeout(timer);
  }, [kategoriFilter, search]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (acc) => {
    setEditingId(acc.id);
    setForm({
      kode_akun: acc.kode_akun,
      nama_akun: acc.nama_akun,
      kategori: acc.kategori,
      subkategori: acc.subkategori || '',
      saldo_normal: acc.saldo_normal,
      is_kas_bank: Boolean(acc.is_kas_bank),
      deskripsi: acc.deskripsi || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const { data } = await api.put(`/accounting/accounts/${editingId}`, form);
        toastSuccess(data.message);
      } else {
        const { data } = await api.post('/accounting/accounts', form);
        toastSuccess(data.message);
      }
      setModalOpen(false);
      loadAccounts();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Akun', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Akun Perkiraan?',
      text: `Apakah Anda yakin ingin menghapus akun "${acc.nama_akun}" (${acc.kode_akun})?`,
    });
    if (!confirmed) return;

    try {
      const { data } = await api.delete(`/accounting/accounts/${acc.id}`);
      toastSuccess(data.message);
      loadAccounts();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus Akun', msg);
    }
  };

  // Stats calculation
  const totalKasBank = accounts.filter((a) => a.is_kas_bank).length;
  const totalAset = accounts.filter((a) => a.kategori === 'ASSET').length;
  const totalBeban = accounts.filter((a) => a.kategori === 'EXPENSE').length;

  const handleExportExcel = () => {
    const headers = [
      'Kode Akun',
      'Nama Akun',
      'Kategori',
      'Sub-Kategori',
      'Saldo Normal',
      'Akun Kas / Bank',
      'Keterangan / Deskripsi',
    ];

    const data = (accounts || []).map((acc) => [
      acc.kode_akun || '',
      acc.nama_akun || '',
      acc.kategori || '',
      acc.subkategori || '',
      acc.saldo_normal || 'DEBIT',
      acc.is_kas_bank ? 'Ya (Kas/Bank)' : 'Tidak',
      acc.deskripsi || '',
    ]);

    exportToExcel('Bagan_Akun_COA_Ledger', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Bagan Akun (Chart of Accounts)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola daftar master akun perkiraan akuntansi standar ERP dan posisi saldo normal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleExportExcel}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Export ke Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Cetak Daftar Bagan Akun ke PDF"
          >
            <Printer className="h-4 w-4 text-blue-600" /> Cetak / Export PDF
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Tambah Akun Baru
          </button>
        </div>
      </div>

      {/* Alert Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Total Akun Terdaftar</span>
          <p className="text-xl font-bold text-slate-800 mt-1">{accounts.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Akun Kas & Bank</span>
          <p className="text-xl font-bold text-blue-600 mt-1">{totalKasBank}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Akun Aset / Harta</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{totalAset}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Akun Beban Operasional</span>
          <p className="text-xl font-bold text-rose-600 mt-1">{totalBeban}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-3 print:hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode akun atau nama akun..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-9"
            />
          </div>

          <div className="w-full md:w-64">
            <SearchableSelect
              id="kategori-filter"
              value={kategoriFilter}
              onChange={(e) => {
                setKategoriFilter(e.target.value);
                setPage(1);
              }}
              options={KATEGORI_OPTIONS}
              isClearable={false}
              searchPlaceholder="Pilih kategori..."
            />
          </div>
        </div>

        {/* Quick Category Badges Filter */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {KATEGORI_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setKategoriFilter(opt.value);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                kategoriFilter === opt.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label.split(' - ')[1] || opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat data bagan akun...
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Tidak ada akun perkiraan yang sesuai kriteria pencarian.
          </div>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(accounts, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th className="w-28">Kode Akun</th>
                        <th>Nama Akun</th>
                        <th>Kategori</th>
                        <th>Subkategori</th>
                        <th className="text-center">Saldo Normal</th>
                        <th className="text-center">Kas/Bank</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageItems.map((acc) => (
                        <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="font-mono font-semibold text-slate-800">
                            {acc.kode_akun}
                          </td>
                          <td>
                            <div className="font-medium text-slate-800">{acc.nama_akun}</div>
                            {acc.deskripsi && (
                              <div className="text-xs text-slate-400 truncate max-w-xs">{acc.deskripsi}</div>
                            )}
                          </td>
                          <td>
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(
                                acc.kategori
                              )}`}
                            >
                              {acc.kategori}
                            </span>
                          </td>
                          <td className="text-xs text-slate-600">
                            {acc.subkategori || '-'}
                          </td>
                          <td className="text-center">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                                acc.saldo_normal === 'DEBIT'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {acc.saldo_normal}
                            </span>
                          </td>
                          <td className="text-center">
                            {acc.is_kas_bank ? (
                              <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                                <Landmark className="h-3 w-3" /> Ya
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(acc)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                                title="Edit Akun"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(acc)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                                title="Hapus Akun"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  onPage={setPage}
                  totalItems={accounts.length}
                  pageSize={pageSize}
                  onPageSize={(s) => {
                    setPageSize(s);
                    setPage(1);
                  }}
                  label="akun"
                />
              </>
            );
          })()
        )}
      </div>

      {/* Modal Tambah / Edit Akun */}
      <Modal
        isOpen={modalOpen}
        title={editingId ? `Edit Akun: ${form.kode_akun}` : 'Tambah Akun Perkiraan Baru'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="kode_akun">
                Kode Akun *
              </label>
              <input
                id="kode_akun"
                type="text"
                value={form.kode_akun}
                onChange={(e) => setForm({ ...form, kode_akun: e.target.value })}
                placeholder="Contoh: 1-1001"
                className="input font-mono font-medium"
                required
                disabled={Boolean(editingId)}
              />
              <span className="text-xs text-slate-400 mt-1 block">
                Format umum: 1-XXXX (Aset), 2-XXXX (Utang), 3-XXXX (Ekuitas), dll.
              </span>
            </div>

            <div>
              <label className="label" htmlFor="kategori_akun">
                Kategori Akun *
              </label>
              <SearchableSelect
                id="kategori_akun"
                value={form.kategori}
                onChange={(e) => {
                  const kat = e.target.value;
                  const defaultNormal = ['ASSET', 'COGS', 'EXPENSE'].includes(kat) ? 'DEBIT' : 'KREDIT';
                  setForm({ ...form, kategori: kat, saldo_normal: defaultNormal });
                }}
                options={[
                  { value: 'ASSET', label: 'ASSET (Aset / Aktiva Lancar & Tetap)' },
                  { value: 'LIABILITY', label: 'LIABILITY (Kewajiban / Utang)' },
                  { value: 'EQUITY', label: 'EQUITY (Ekuitas / Modal)' },
                  { value: 'REVENUE', label: 'REVENUE (Pendapatan Usaha & Lainnya)' },
                  { value: 'COGS', label: 'COGS (Beban Pokok Penjualan / HPP)' },
                  { value: 'EXPENSE', label: 'EXPENSE (Beban Operasional & Administrasi)' },
                ]}
                isClearable={false}
                searchPlaceholder="Pilih kategori..."
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="nama_akun">
              Nama Akun *
            </label>
            <input
              id="nama_akun"
              type="text"
              value={form.nama_akun}
              onChange={(e) => setForm({ ...form, nama_akun: e.target.value })}
              placeholder="Contoh: Kas Operasional Cabang"
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="subkategori">
                Subkategori / Kelompok Akun
              </label>
              <input
                id="subkategori"
                type="text"
                value={form.subkategori}
                onChange={(e) => setForm({ ...form, subkategori: e.target.value })}
                placeholder="Contoh: Kas & Bank, Piutang, Biaya Utilitas..."
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="saldo_normal">
                Posisi Saldo Normal *
              </label>
              <SearchableSelect
                id="saldo_normal"
                value={form.saldo_normal}
                onChange={(e) => setForm({ ...form, saldo_normal: e.target.value })}
                options={[
                  { value: 'DEBIT', label: 'DEBIT (Bertambah di Debit)' },
                  { value: 'KREDIT', label: 'KREDIT (Bertambah di Kredit)' },
                ]}
                isClearable={false}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="is_kas_bank"
              type="checkbox"
              checked={form.is_kas_bank}
              onChange={(e) => setForm({ ...form, is_kas_bank: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_kas_bank" className="text-sm font-medium text-slate-700 cursor-pointer">
              Tandai sebagai Rekening Kas / Bank (Tersedia untuk Transaksi Kas & Biaya)
            </label>
          </div>

          <div>
            <label className="label" htmlFor="deskripsi">
              Deskripsi / Catatan Perkiraan
            </label>
            <textarea
              id="deskripsi"
              rows={2}
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Keterangan tambahan penggunaan akun ini..."
              className="input resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary"
            >
              Batal
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Simpan Perubahan' : 'Tambah Akun'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

