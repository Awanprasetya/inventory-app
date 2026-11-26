import { useEffect, useState } from 'react';
import {
  Barcode,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Package,
  Layers,
  AlertTriangle,
  FileSpreadsheet,
  QrCode,
  Printer,
} from 'lucide-react';
import api, { getErrorMessage, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import LotQrModal from '../components/LotQrModal.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 10;

export default function BatchLots() {
  const [lots, setLots] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [expiringWithinDays, setExpiringWithinDays] = useState('');
  const [metodeFilter, setMetodeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // QR Code Modal State & Selection
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedLotsForQr, setSelectedLotsForQr] = useState([]);
  const [selectedLotIds, setSelectedLotIds] = useState(new Set());
  const defaultExpDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split('T')[0];
  };

  const [form, setForm] = useState({
    kode_produk: '',
    nomor_lot: '',
    tanggal_produksi: new Date().toISOString().split('T')[0],
    expired_date: defaultExpDate(),
    warehouse_id: '1',
    shift: '1',
    stok_qty: '100',
    status: 'AVAILABLE',
    keterangan: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [lotsRes, prodsRes, whRes] = await Promise.all([
        api.get('/lots', {
          params: {
            search: search || undefined,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            warehouseId: warehouseFilter === 'ALL' ? undefined : warehouseFilter,
            expiringWithinDays: expiringWithinDays || undefined,
          },
        }),
        api.get('/products'),
        api.get('/warehouses'),
      ]);

      if (lotsRes.data.success) {
        setLots(lotsRes.data.data || []);
      }
      if (prodsRes.data.success) {
        setProducts(prodsRes.data.data || []);
      }
      if (whRes.data.success) {
        setWarehouses(whRes.data.data || []);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, warehouseFilter, expiringWithinDays]);

  const handleOpenAddModal = () => {
    const defaultProd = products[0]?.kode_produk || '';
    const defaultWh = warehouses[0]?.id ? String(warehouses[0].id) : '1';
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);

    setForm({
      kode_produk: defaultProd,
      nomor_lot: `LOT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`,
      tanggal_produksi: new Date().toISOString().split('T')[0],
      expired_date: d.toISOString().split('T')[0],
      warehouse_id: defaultWh,
      shift: '1',
      stok_qty: '100',
      status: 'AVAILABLE',
      keterangan: '',
    });
    setModalOpen(true);
  };

  const handleSaveLot = async (e) => {
    e.preventDefault();
    if (!form.kode_produk || !form.nomor_lot || !form.expired_date) {
      alertError('Peringatan', 'Kode produk, nomor lot, dan tanggal expired wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/lots', {
        ...form,
        warehouse_id: Number(form.warehouse_id),
        shift: Number(form.shift),
        stok_qty: Number(form.stok_qty || 0),
      });

      if (res.data.success) {
        toastSuccess('Berhasil!', res.data.message);
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Menyimpan Lot', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleQuarantine = async (lot) => {
    const nextStatus = lot.status === 'QUARANTINE' ? 'AVAILABLE' : 'QUARANTINE';
    try {
      const res = await api.put(`/lots/${lot.id}/status`, { status: nextStatus });
      if (res.data.success) {
        toastSuccess('Status Berubah', `Lot ${lot.nomor_lot} diubah ke ${nextStatus}.`);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Mengubah Status', getErrorMessage(err));
    }
  };

  // QR Code Generation & Print Handlers
  const handleOpenQrModal = (lot) => {
    setSelectedLotsForQr([lot]);
    setQrModalOpen(true);
  };

  const handleOpenBulkQrModal = () => {
    let targetLots = [];
    if (selectedLotIds.size > 0) {
      targetLots = lots.filter((l) => selectedLotIds.has(l.id));
    } else {
      targetLots = filteredLots;
    }
    if (targetLots.length === 0) {
      alertError('Perhatian', 'Tidak ada batch / lot yang dapat dicetak QR code-nya.');
      return;
    }
    setSelectedLotsForQr(targetLots);
    setQrModalOpen(true);
  };

  const toggleSelectLot = (id) => {
    setSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllCurrentPage = () => {
    const pageIds = paginatedLots.map((l) => l.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedLotIds.has(id));
    setSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Filtered by local search & metode stok
  const filteredLots = lots.filter((l) => {
    const matchesSearch =
      (l.nomor_lot || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.kode_produk || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.nama_produk || '').toLowerCase().includes(search.toLowerCase());
    const matchesMetode =
      metodeFilter === 'ALL' || (l.metode_stok || 'FIFO').toUpperCase() === metodeFilter;
    return matchesSearch && matchesMetode;
  });

  const { pageItems: paginatedLots, totalPages, safePage } = paginate(
    filteredLots,
    page,
    pageSize
  );

  // KPIs
  const totalAvailable = lots.filter(
    (l) => (l.effective_status === 'AVAILABLE' || l.status === 'AVAILABLE') && !l.is_expired
  ).length;
  const totalExpiringSoon = lots.filter(
    (l) => (l.is_expiring_soon || l.effective_status === 'EXPIRING_SOON') && l.status !== 'QUARANTINE'
  ).length;
  const totalExpired = lots.filter(
    (l) => l.is_expired || l.effective_status === 'EXPIRED' || l.status === 'EXPIRED'
  ).length;
  const totalQuarantine = lots.filter((l) => l.status === 'QUARANTINE').length;

  const handleExportExcel = () => {
    const headers = [
      'Nomor Lot / Batch',
      'Kode Produk',
      'Nama Produk',
      'Metode Stok',
      'Gudang',
      'Tgl Produksi',
      'Expired Date (ED)',
      'Sisa Hari ED',
      'Stok Qty',
      'Satuan',
      'Status',
    ];

    const data = filteredLots.map((lot) => [
      lot.nomor_lot || '',
      lot.kode_produk || '',
      lot.nama_produk || '',
      lot.metode_stok || 'FIFO',
      lot.nama_gudang || 'Gudang Utama',
      formatDate(lot.tanggal_produksi),
      formatDate(lot.expired_date),
      lot.days_to_expire ?? '-',
      lot.stok_qty ?? 0,
      lot.satuan || '',
      lot.status || '',
    ]);

    exportToExcel('Master_Batch_Lot_Medis', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Barcode className="h-7 w-7 text-teal-600" />
            Manajemen Batch / Lot & Tanggal Kedaluwarsa (FEFO & FIFO)
          </h1>
          <p className="text-sm text-slate-500">
            Standar regulasi BPOM & Kemenkes: pelacakan nomor lot alkes/obat, tanggal kedaluwarsa, karantina produk, serta pengeluaran barang berbasis FEFO (First Expired First Out) & FIFO (First In First Out).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenBulkQrModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 shadow-sm hover:bg-teal-100 transition"
            title="Generate & Cetak QR Code Label Batch"
          >
            <QrCode className="h-4 w-4 text-teal-600" />
            {selectedLotIds.size > 0 ? `Cetak QR (${selectedLotIds.size})` : 'Cetak QR Code'}
          </button>
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
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            Segarkan
          </button>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
          >
            <Plus className="h-4 w-4" />
            Daftarkan Batch / Lot Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Lot Aktif (Aman)</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{totalAvailable} Batch</div>
          <p className="mt-1 text-xs text-slate-500">Siap didistribusikan ke customer</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Mendekati Kedaluwarsa</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{totalExpiringSoon} Batch</div>
          <p className="mt-1 text-xs text-slate-500">Prioritas FEFO (&le; 90 hari tersisa)</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Kedaluwarsa (Expired)</span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600">{totalExpired} Batch</div>
          <p className="mt-1 text-xs text-slate-500">Dilarang jual / segera retur</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Dalam Karantina</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{totalQuarantine} Batch</div>
          <p className="mt-1 text-xs text-slate-500">Uji lab / penahanan distribusi</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor lot, kode produk, atau nama barang..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div className="w-48">
          <SearchableSelect
            value={metodeFilter}
            onChange={(e) => {
              setMetodeFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Metode Stok' },
              { value: 'FEFO', label: 'FEFO (Kedaluwarsa)' },
              { value: 'FIFO', label: 'FIFO (Masuk Pertama)' },
            ]}
          />
        </div>

        <div className="w-44">
          <SearchableSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Status' },
              { value: 'AVAILABLE', label: 'Tersedia (Available)' },
              { value: 'EXPIRING_SOON', label: 'Mendekati ED' },
              { value: 'EXPIRED', label: 'Kedaluwarsa (Expired)' },
              { value: 'QUARANTINE', label: 'Karantina' },
            ]}
          />
        </div>

        <div className="w-48">
          <SearchableSelect
            value={warehouseFilter}
            onChange={(e) => {
              setWarehouseFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Gudang' },
              ...warehouses.map((w) => ({ value: String(w.id), label: `${w.kode_gudang} - ${w.nama_gudang}` })),
            ]}
          />
        </div>

        <div className="w-48">
          <SearchableSelect
            value={expiringWithinDays}
            onChange={(e) => {
              setExpiringWithinDays(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Semua Masa Berlaku' },
              { value: '30', label: 'Kedaluwarsa < 30 Hari' },
              { value: '60', label: 'Kedaluwarsa < 60 Hari' },
              { value: '90', label: 'Kedaluwarsa < 90 Hari' },
              { value: '180', label: 'Kedaluwarsa < 180 Hari' },
            ]}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat data batch & lot medis...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredLots.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Barcode className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Batch / Lot Terdaftar</p>
            <p className="text-sm mt-1">Daftarkan batch produksi alkes dan obat-obatan untuk kepatuhan regulasi BPOM.</p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              Daftarkan Batch Sekarang
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedLots.length > 0 && paginatedLots.every((l) => selectedLotIds.has(l.id))
                        }
                        onChange={toggleSelectAllCurrentPage}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        title="Pilih semua lot di halaman ini"
                      />
                    </th>
                    <th className="px-4 py-3">Nomor Lot / Batch</th>
                    <th className="px-4 py-3">Nama Produk Medis</th>
                    <th className="px-4 py-3 text-center">Metode Stok</th>
                    <th className="px-4 py-3">Gudang</th>
                    <th className="px-4 py-3">Tgl Produksi</th>
                    <th className="px-4 py-3">Expired Date (ED)</th>
                    <th className="px-4 py-3 text-center">Sisa Masa ED</th>
                    <th className="px-4 py-3 text-right">Stok Fisik</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLots.map((lot) => {
                    const days = lot.days_to_expire;
                    const isExp = days !== null && days < 0;
                    const isSoon = days !== null && days >= 0 && days <= 90;
                    const metode = (lot.metode_stok || 'FIFO').toUpperCase();
                    const isChecked = selectedLotIds.has(lot.id);

                    return (
                      <tr
                        key={lot.id}
                        className={`transition-colors ${
                          isChecked ? 'bg-teal-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectLot(lot.id)}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-slate-900">{lot.nomor_lot}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{lot.kode_produk}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">{lot.nama_produk}</div>
                          <div className="text-xs text-slate-400">Satuan: {lot.satuan}</div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              metode === 'FEFO'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {metode}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-700 font-medium">
                          {lot.nama_gudang || 'Gudang Utama'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-700">
                          {formatDate(lot.tanggal_produksi)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{formatDate(lot.expired_date)}</div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {days === null ? (
                            <span className="text-xs text-slate-400">-</span>
                          ) : isExp ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              <AlertTriangle className="h-3 w-3" /> Lewat {Math.abs(days)} hari
                            </span>
                          ) : isSoon ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              <Clock className="h-3 w-3" /> {days} hari lagi
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700">
                              {days} hari aman
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                          {lot.stok_qty?.toLocaleString('id-ID')} {lot.satuan}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              lot.status === 'QUARANTINE'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : isExp
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : isSoon
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {lot.effective_status || lot.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenQrModal(lot)}
                              className="inline-flex items-center gap-1 rounded bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition border border-teal-200"
                              title="Generate & Cetak QR Code Label"
                            >
                              <QrCode className="h-3.5 w-3.5 text-teal-600" />
                              QR Code
                            </button>
                            <button
                              onClick={() => handleToggleQuarantine(lot)}
                              className={`rounded px-2.5 py-1 text-xs font-semibold transition border ${
                                lot.status === 'QUARANTINE'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              }`}
                              title={lot.status === 'QUARANTINE' ? 'Lepas dari Karantina' : 'Masukkan ke Karantina'}
                            >
                              {lot.status === 'QUARANTINE' ? 'Lepas' : 'Karantina'}
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
                totalItems={filteredLots.length}
                pageSize={pageSize}
                onPageSize={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                label="batch lot"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Tambah Batch Lot Baru */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Daftarkan Nomor Batch & Expired Date Baru"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveLot} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Pilih Produk Medis <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={form.kode_produk}
              onChange={(e) => setForm({ ...form, kode_produk: e.target.value })}
              options={products.map((p) => ({
                value: p.kode_produk,
                label: `${p.kode_produk} - ${p.nama_produk}`,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nomor Batch / Lot <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.nomor_lot}
                onChange={(e) => setForm({ ...form, nomor_lot: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="LOT-2026-MED01"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Lokasi Gudang Penempatan <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.warehouse_id}
                onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                options={warehouses.map((w) => ({
                  value: String(w.id),
                  label: `${w.kode_gudang} - ${w.nama_gudang}`,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tanggal Produksi (Mfg Date) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.tanggal_produksi}
                onChange={(e) => setForm({ ...form, tanggal_produksi: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tanggal Kedaluwarsa (Exp Date) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.expired_date}
                onChange={(e) => setForm({ ...form, expired_date: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Kuantitas Fisik Awal
              </label>
              <input
                type="number"
                min="0"
                value={form.stok_qty}
                onChange={(e) => setForm({ ...form, stok_qty: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Shift Produksi
              </label>
              <input
                type="number"
                min="1"
                max="3"
                value={form.shift}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Status Awal
              </label>
              <SearchableSelect
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={[
                  { value: 'AVAILABLE', label: 'Tersedia' },
                  { value: 'QUARANTINE', label: 'Karantina' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Catatan Spesifikasi / Nomor Izin Edar
            </label>
            <textarea
              rows={2}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              placeholder="Nomor izin edar Kemenkes RI AKD/AKL..."
            />
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
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Daftarkan Lot
            </button>
          </div>
        </form>
      </Modal>
      {/* Modal Cetak & Generate QR Code Lot */}
      <LotQrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        lots={selectedLotsForQr}
      />
    </div>
  );
}

