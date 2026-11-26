import { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Calendar,
  Trash2,
  AlertCircle,
  Loader2,
  DollarSign,
  TrendingDown,
  Layers,
  Calculator,
  RefreshCw,
  CheckCircle2,
  MapPin,
  Tag,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 10;

const ASSET_CATEGORIES = [
  'Peralatan & Mesin',
  'Kendaraan Operasional',
  'Gedung & Bangunan',
  'Komputer & Elektronik IT',
  'Inventaris & Perabot Kantor',
  'Aset Medis & Klinis',
  'Lain-lain',
];

const emptyAssetForm = {
  kode_aset: '',
  nama_aset: '',
  kategori_aset: 'Peralatan & Mesin',
  account_asset_id: '',
  account_accum_id: '',
  account_expense_id: '',
  tanggal_perolehan: new Date().toISOString().split('T')[0],
  harga_perolehan: '',
  nilai_residu: '0',
  masa_manfaat_bulan: '48',
  metode_penyusutan: 'GARIS_LURUS',
  lokasi: '',
  keterangan: '',
  post_purchase_journal: false,
  credit_account_id: '',
};

export default function FixedAssets() {
  const [assets, setAssets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal Add Asset
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyAssetForm);
  const [saving, setSaving] = useState(false);

  // Modal Depreciate Asset
  const [deprModalOpen, setDeprModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [deprPeriode, setDeprPeriode] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [depreciating, setDepreciating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [assetRes, accRes] = await Promise.all([
        api.get('/accounting/fixed-assets'),
        api.get('/accounting/accounts'),
      ]);

      if (assetRes.data.success) {
        setAssets(assetRes.data.data || []);
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
  }, []);

  // Filtered accounts for dropdowns
  const assetAccounts = accounts.filter(
    (a) => a.kategori === 'ASSET' && (a.subkategori?.includes('ASET_TETAP') || a.kode_akun.startsWith('1-12') || a.kode_akun.startsWith('1-13'))
  );
  const accumAccounts = accounts.filter(
    (a) => a.kategori === 'ASSET' && (a.saldo_normal === 'CREDIT' || a.nama_akun.toLowerCase().includes('akumulasi'))
  );
  const expenseAccounts = accounts.filter(
    (a) => a.kategori === 'EXPENSE'
  );
  const cashOrLiabilityAccounts = accounts.filter(
    (a) =>
      (a.kategori === 'ASSET' && (a.subkategori?.includes('KAS') || a.subkategori?.includes('BANK'))) ||
      a.kategori === 'LIABILITY'
  );

  const handleOpenAddModal = () => {
    const nextNum = assets.length + 1;
    const generatedCode = `AST-${String(nextNum).padStart(3, '0')}`;
    
    // Default smart select COA accounts if available
    const defAssetAcc = assetAccounts[0]?.id || '';
    const defAccumAcc = accumAccounts[0]?.id || '';
    const defExpenseAcc = expenseAccounts.find((a) => a.nama_akun.toLowerCase().includes('penyusutan'))?.id || expenseAccounts[0]?.id || '';
    const defCreditAcc = cashOrLiabilityAccounts[0]?.id || '';

    setForm({
      ...emptyAssetForm,
      kode_aset: generatedCode,
      account_asset_id: defAssetAcc ? String(defAssetAcc) : '',
      account_accum_id: defAccumAcc ? String(defAccumAcc) : '',
      account_expense_id: defExpenseAcc ? String(defExpenseAcc) : '',
      credit_account_id: defCreditAcc ? String(defCreditAcc) : '',
    });
    setModalOpen(true);
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    if (!form.kode_aset || !form.nama_aset) {
      alertError('Peringatan', 'Kode aset dan nama aset wajib diisi!');
      return;
    }
    if (!form.account_asset_id || !form.account_accum_id || !form.account_expense_id) {
      alertError('Peringatan', 'Akun aset tetap, akumulasi penyusutan, dan beban penyusutan wajib dipilih!');
      return;
    }
    if (Number(form.harga_perolehan) <= 0) {
      alertError('Peringatan', 'Harga perolehan harus lebih dari 0!');
      return;
    }
    if (form.post_purchase_journal && !form.credit_account_id) {
      alertError('Peringatan', 'Pilih akun kredit (Kas/Bank/Utang) untuk jurnal pengadaan aset!');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/accounting/fixed-assets', form);
      if (res.data.success) {
        toastSuccess('Berhasil!', res.data.message || 'Aset tetap berhasil ditambahkan.');
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Menyimpan', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset) => {
    const isConfirmed = await confirmDelete(
      `Hapus Aset ${asset.nama_aset}?`,
      'Data aset tetap dan riwayat penyusutannya akan dihapus.'
    );
    if (!isConfirmed) return;

    try {
      const res = await api.delete(`/accounting/fixed-assets/${asset.id}`);
      if (res.data.success) {
        toastSuccess('Dihapus!', res.data.message || 'Aset tetap berhasil dihapus.');
        loadData();
      }
    } catch (err) {
      alertError('Gagal Menghapus', getErrorMessage(err));
    }
  };

  const handleOpenDeprModal = (asset) => {
    setSelectedAsset(asset);
    setDeprModalOpen(true);
  };

  const handleProcessDepreciation = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;

    setDepreciating(true);
    try {
      const res = await api.post('/accounting/fixed-assets/depreciate', {
        asset_id: selectedAsset.id,
        periode_bulan: deprPeriode,
      });

      if (res.data.success) {
        toastSuccess(
          'Penyusutan Sukses!',
          `Penyusutan periode ${deprPeriode} sebesar ${formatRupiah(res.data.data.deprPerBulan)} berhasil dicatat ke Jurnal Umum!`
        );
        setDeprModalOpen(false);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Memproses Penyusutan', getErrorMessage(err));
    } finally {
      setDepreciating(false);
    }
  };

  // Filtered Assets
  const filteredAssets = assets.filter((item) => {
    const matchSearch =
      (item.nama_aset || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.kode_aset || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.lokasi || '').toLowerCase().includes(search.toLowerCase());

    const matchCategory = categoryFilter === 'ALL' || item.kategori_aset === categoryFilter;
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchSearch && matchCategory && matchStatus;
  });

  const { pageItems: paginatedAssets, totalPages, safePage } = paginate(filteredAssets, page, pageSize);

  // Statistics Summary
  const totalPerolehan = assets.reduce((sum, a) => sum + Number(a.harga_perolehan || 0), 0);
  const totalAkumulasi = assets.reduce((sum, a) => sum + Number(a.akumulasi_penyusutan || 0), 0);
  const totalNilaiBuku = assets.reduce((sum, a) => sum + Number(a.nilai_buku || 0), 0);
  const totalAktif = assets.filter((a) => a.status === 'AKTIF').length;

  const handleExportExcel = () => {
    const headers = [
      'Kode Aset',
      'Nama Aset Tetap',
      'Kategori Aset',
      'Lokasi',
      'Tanggal Perolehan',
      'Masa Manfaat (Bulan)',
      'Harga Perolehan (Rp)',
      'Akumulasi Penyusutan (Rp)',
      'Nilai Buku saat ini (Rp)',
      'Status Aset',
    ];

    const data = filteredAssets.map((item) => [
      item.kode_aset || '',
      item.nama_aset || '',
      item.kategori_aset || '',
      item.lokasi || '-',
      formatDate(item.tanggal_perolehan),
      item.masa_manfaat_bulan ?? 0,
      item.harga_perolehan ?? 0,
      item.akumulasi_penyusutan ?? 0,
      item.nilai_buku ?? 0,
      item.status || '',
    ]);

    exportToExcel('Master_Aset_Tetap_Depresiasi', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            Manajemen Aset Tetap & Depresiasi
          </h1>
          <p className="text-sm text-slate-500">
            Pencatatan aset tetap perusahaan, perhitungan nilai buku, dan otomatisasi jurnal penyusutan bulanan.
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
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Segarkan
          </button>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Tambah Aset Tetap
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Harga Perolehan</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(totalPerolehan)}</div>
          <p className="mt-1 text-xs text-slate-500">{assets.length} unit total tercatat</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Akumulasi Penyusutan</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{formatRupiah(totalAkumulasi)}</div>
          <p className="mt-1 text-xs text-slate-500">Telah dibebankan ke Laba/Rugi</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Nilai Buku Bersih</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{formatRupiah(totalNilaiBuku)}</div>
          <p className="mt-1 text-xs text-slate-500">Nilai aset di Neraca (Balance Sheet)</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Aset Beroperasi Aktif</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{totalAktif} Unit</div>
          <p className="mt-1 text-xs text-slate-500">Siap dilakukan penyusutan berkala</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode aset, nama barang, atau lokasi..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <SearchableSelect
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Semua Kategori' },
                ...ASSET_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>

          <div className="w-36">
            <SearchableSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Semua Status' },
                { value: 'AKTIF', label: 'Aktif' },
                { value: 'DILEPAS', label: 'Dilepas/Dijual' },
                { value: 'HABIS_MANFAAT', label: 'Habis Manfaat' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat master aset tetap...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Aset Tetap Terdaftar</p>
            <p className="text-sm mt-1">Daftarkan inventaris dan aset tetap perusahaan untuk otomatisasi penyusutan buku besar.</p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Aset Sekarang
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Aset & Kode</th>
                    <th className="px-4 py-3">Kategori & Lokasi</th>
                    <th className="px-4 py-3">Tgl Perolehan & Manfaat</th>
                    <th className="px-4 py-3 text-right">Harga Perolehan</th>
                    <th className="px-4 py-3 text-right">Akum. Penyusutan</th>
                    <th className="px-4 py-3 text-right">Nilai Buku</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedAssets.map((asset) => {
                    const deprPerMonth =
                      (Number(asset.harga_perolehan) - Number(asset.nilai_residu || 0)) /
                      Math.max(1, Number(asset.masa_manfaat_bulan));

                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{asset.nama_aset}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Tag className="h-3.5 w-3.5 text-blue-500" />
                            <span className="font-mono font-medium text-blue-700">{asset.kode_aset}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">{asset.kategori_aset}</div>
                          {asset.lokasi && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span>{asset.lokasi}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{formatDate(asset.tanggal_perolehan)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>
                              {asset.masa_manfaat_bulan} bln ({Math.round((asset.masa_manfaat_bulan / 12) * 10) / 10} thn)
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                          {formatRupiah(asset.harga_perolehan)}
                          {Number(asset.nilai_residu) > 0 && (
                            <div className="text-[11px] text-slate-400">Residu: {formatRupiah(asset.nilai_residu)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-amber-700">
                          {formatRupiah(asset.akumulasi_penyusutan)}
                          <div className="text-[11px] text-slate-400">
                            {formatRupiah(deprPerMonth)}/bln
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-emerald-700">
                          {formatRupiah(asset.nilai_buku)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              asset.status === 'AKTIF'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : asset.status === 'HABIS_MANFAAT'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {asset.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {asset.status === 'AKTIF' && (
                              <button
                                onClick={() => handleOpenDeprModal(asset)}
                                title="Proses Penyusutan Bulanan"
                                className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                              >
                                <Calculator className="h-3.5 w-3.5" />
                                Susutkan
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(asset)}
                              title="Hapus Aset"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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
                totalItems={filteredAssets.length}
                pageSize={pageSize}
                onPageSize={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                label="aset tetap"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Tambah Aset Tetap */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Daftarkan Aset Tetap Baru"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveAsset} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Kode Aset <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.kode_aset}
                onChange={(e) => setForm({ ...form, kode_aset: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="AST-001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Kategori Aset <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.kategori_aset}
                onChange={(e) => setForm({ ...form, kategori_aset: e.target.value })}
                options={ASSET_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Nama Aset / Barang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nama_aset}
              onChange={(e) => setForm({ ...form, nama_aset: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="cth: Mesin USG 4D Mindray / Toyota Hilux Pickup"
            />
          </div>

          {/* Akun COA Mapping */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Pemetaan Akun Buku Besar (COA Mapping)
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Akun Aset Tetap <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={form.account_asset_id}
                  onChange={(e) => setForm({ ...form, account_asset_id: e.target.value })}
                  options={assetAccounts.map((a) => ({
                    value: String(a.id),
                    label: `${a.kode_akun} - ${a.nama_akun}`,
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Akun Akumulasi Penyusutan <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={form.account_accum_id}
                  onChange={(e) => setForm({ ...form, account_accum_id: e.target.value })}
                  options={accumAccounts.map((a) => ({
                    value: String(a.id),
                    label: `${a.kode_akun} - ${a.nama_akun}`,
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Akun Beban Penyusutan <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={form.account_expense_id}
                  onChange={(e) => setForm({ ...form, account_expense_id: e.target.value })}
                  options={expenseAccounts.map((a) => ({
                    value: String(a.id),
                    label: `${a.kode_akun} - ${a.nama_akun}`,
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Nilai & Masa Manfaat */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tanggal Perolehan <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.tanggal_perolehan}
                onChange={(e) => setForm({ ...form, tanggal_perolehan: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Harga Perolehan (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.harga_perolehan}
                onChange={(e) => setForm({ ...form, harga_perolehan: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nilai Residu / Sisa (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={form.nilai_residu}
                onChange={(e) => setForm({ ...form, nilai_residu: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Masa Manfaat (Bulan) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.masa_manfaat_bulan}
                onChange={(e) => setForm({ ...form, masa_manfaat_bulan: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="48 (4 tahun)"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Metode Penyusutan
              </label>
              <SearchableSelect
                value={form.metode_penyusutan}
                onChange={(e) => setForm({ ...form, metode_penyusutan: e.target.value })}
                options={[
                  { value: 'GARIS_LURUS', label: 'Garis Lurus (Straight Line)' },
                  { value: 'SALDO_MENURUN', label: 'Saldo Menurun (Declining)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Lokasi Penempatan
              </label>
              <input
                type="text"
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="cth: Ruang Laboratorium Lt.2"
              />
            </div>
          </div>

          {/* Opsi Posting Jurnal Pengadaan Awal */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.post_purchase_journal}
                onChange={(e) => setForm({ ...form, post_purchase_journal: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-800">
                Otomatis Terbitkan Jurnal Pembelian / Pengadaan Aset Ini
              </span>
            </label>

            {form.post_purchase_journal && (
              <div className="pl-6 pt-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sumber Dana Kredit (Kas / Bank / Utang Pengadaan) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={form.credit_account_id}
                  onChange={(e) => setForm({ ...form, credit_account_id: e.target.value })}
                  options={cashOrLiabilityAccounts.map((a) => ({
                    value: String(a.id),
                    label: `${a.kode_akun} - ${a.nama_akun}`,
                  }))}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Sistem akan otomatis mencatat jurnal: Debit [Akun Aset Tetap] & Kredit [Akun Sumber Dana].
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Catatan Tambahan</label>
            <textarea
              rows={2}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Nomor seri, garansi, atau spesifikasi unit..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Aset Tetap
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Eksekusi Penyusutan Bulanan */}
      <Modal
        isOpen={deprModalOpen}
        onClose={() => setDeprModalOpen(false)}
        title="Proses Penyusutan Bulanan Aset"
        maxWidth="max-w-md"
      >
        {selectedAsset && (
          <form onSubmit={handleProcessDepreciation} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-sm space-y-1.5">
              <div className="font-semibold text-slate-900">{selectedAsset.nama_aset}</div>
              <div className="text-xs text-slate-500">Kode: {selectedAsset.kode_aset}</div>
              <div className="text-xs text-slate-500">Harga Perolehan: {formatRupiah(selectedAsset.harga_perolehan)}</div>
              <div className="text-xs text-slate-500">Nilai Buku Saat Ini: {formatRupiah(selectedAsset.nilai_buku)}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Pilih Periode Bulan (YYYY-MM) <span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                required
                value={deprPeriode}
                onChange={(e) => setDeprPeriode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
              <p className="font-semibold mb-1">Kalkulasi Penyusutan Garis Lurus:</p>
              <p>
                Nominal Beban: <strong>{formatRupiah((Number(selectedAsset.harga_perolehan) - Number(selectedAsset.nilai_residu || 0)) / Math.max(1, Number(selectedAsset.masa_manfaat_bulan)))}</strong> / bulan.
              </p>
              <p className="mt-1">
                Jurnal otomatis akan mendebit <em>Beban Penyusutan</em> dan mengkredit <em>Akumulasi Penyusutan</em>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeprModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={depreciating}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {depreciating && <Loader2 className="h-4 w-4 animate-spin" />}
                Eksekusi & Posting Jurnal
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

