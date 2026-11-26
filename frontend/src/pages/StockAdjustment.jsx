import { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Package,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  Sparkles,
  X,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';
import { formatMultiTierBreakdown } from '../utils/unitHelper.js';

const PAGE_SIZE = 10;

const ADJUSTMENT_TYPES = [
  { value: 'OPNAME_FISIK', label: 'Opname Fisik Berkala' },
  { value: 'RUSAK_KEDALUWARSA', label: 'Kerusakan / Kedaluwarsa' },
  { value: 'SELISIH_HILANG', label: 'Selisih Hilang / Susut' },
  { value: 'KOREKSI_TAMBAH', label: 'Koreksi Kelebihan Fisik' },
];

export default function StockAdjustment() {
  const { user } = useAuth();
  const isRestrictedAdminGudang =
    ['ADMIN_GUDANG', 'WAREHOUSE'].includes((user?.role || '').toUpperCase()) &&
    Boolean(user?.warehouse_id);
  const assignedWarehouseId = isRestrictedAdminGudang ? String(user.warehouse_id) : null;

  const [adjustments, setAdjustments] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseProducts, setWarehouseProducts] = useState([]);
  const [loadingWhStock, setLoadingWhStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState(
    assignedWarehouseId || 'ALL'
  );
  const [selectedMonth, setSelectedMonth] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    tipe_adjustment: 'OPNAME_FISIK',
    catatan: '',
    items: [],
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [adjRes, whRes, prodRes] = await Promise.all([
        api.get('/stock-adjustments'),
        api.get('/warehouses'),
        api.get('/products'),
      ]);

      if (adjRes.data.success) {
        setAdjustments(adjRes.data.data || []);
      }
      if (whRes.data.success) {
        setWarehouses(whRes.data.data || []);
      }
      if (prodRes.data.success) {
        setProducts(prodRes.data.data || []);
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

  useEffect(() => {
    if (assignedWarehouseId) {
      setSelectedWarehouseFilter(assignedWarehouseId);
    }
  }, [assignedWarehouseId]);

  const warehouseActiveProducts = warehouseProducts.filter(
    (p) => Number(p.jumlah_lot || 0) > 0 || Number(p.total_stok || 0) > 0
  );

  const handleOpenAddModal = async () => {
    const defaultWh =
      assignedWarehouseId ||
      (selectedWarehouseFilter !== 'ALL' && selectedWarehouseFilter) ||
      (warehouses[0]?.id ? String(warehouses[0].id) : '');

    setLoadingWhStock(true);
    let whProds = [];
    if (defaultWh) {
      try {
        const res = await api.get('/products', { params: { warehouse_id: defaultWh } });
        if (res.data.success) {
          whProds = res.data.data || [];
        }
      } catch (_) {}
    }
    setWarehouseProducts(whProds);
    setLoadingWhStock(false);

    const activeInWh = whProds.filter(
      (p) => Number(p.jumlah_lot || 0) > 0 || Number(p.total_stok || 0) > 0
    );
    const firstProd = activeInWh[0] || whProds[0];

    const initialItem = firstProd?.id
      ? [
          {
            product_id: String(firstProd.id),
            stok_sistem: Number(firstProd.total_stok || 0),
            stok_fisik: Number(firstProd.total_stok || 0),
            harga_satuan: firstProd.harga || 0,
            satuan: firstProd.satuan || 'PCS',
            catatan: '',
          },
        ]
      : [];

    setForm({
      warehouse_id: defaultWh,
      tanggal: new Date().toISOString().split('T')[0],
      tipe_adjustment: 'OPNAME_FISIK',
      catatan: '',
      items: initialItem,
    });
    setModalOpen(true);
  };

  const handleWarehouseChange = async (newWhId) => {
    if (isRestrictedAdminGudang && String(newWhId) !== assignedWarehouseId) return;
    setForm((prev) => ({ ...prev, warehouse_id: newWhId }));
    if (!newWhId) return;

    setLoadingWhStock(true);
    try {
      const res = await api.get('/products', { params: { warehouse_id: newWhId } });
      const whProds = res.data.data || [];
      setWarehouseProducts(whProds);

      setForm((prev) => {
        const updatedItems = prev.items.map((item) => {
          const matched = whProds.find((p) => String(p.id) === String(item.product_id));
          const newStokSistem = Number(matched?.total_stok || 0);
          return {
            ...item,
            stok_sistem: newStokSistem,
            stok_fisik: newStokSistem,
            harga_satuan: matched?.harga || item.harga_satuan || 0,
            satuan: matched?.satuan || item.satuan || 'PCS',
          };
        });
        return {
          ...prev,
          warehouse_id: newWhId,
          items: updatedItems,
        };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWhStock(false);
    }
  };

  const handleAddItemRow = () => {
    const prodList = warehouseProducts.length > 0 ? warehouseProducts : products;
    const defaultObj = warehouseActiveProducts[0] || prodList[0] || {};
    const defaultProd = defaultObj.id ? String(defaultObj.id) : '';
    const stockVal = Number(defaultObj.total_stok || 0);
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: defaultProd,
          stok_sistem: stockVal,
          stok_fisik: stockVal,
          harga_satuan: defaultObj.harga || 0,
          satuan: defaultObj.satuan || 'PCS',
          catatan: '',
        },
      ],
    }));
  };

  const handleRemoveItemRow = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleProductChange = (index, productId) => {
    const prodList = warehouseProducts.length > 0 ? warehouseProducts : products;
    const matched = prodList.find((p) => String(p.id) === String(productId));
    const stockVal = Number(matched?.total_stok || 0);
    setForm((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        product_id: productId,
        stok_sistem: stockVal,
        stok_fisik: stockVal,
        harga_satuan: matched?.harga || 0,
        satuan: matched?.satuan || 'PCS',
      };
      return { ...prev, items: updated };
    });
  };

  const handleItemFieldChange = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handlePopulateAllWarehouseProducts = () => {
    if (loadingWhStock) return;
    if (warehouseActiveProducts.length === 0) {
      alertError(
        'Belum Ada Barang di Gudang',
        'Gudang yang dipilih belum memiliki stok/batch barang. Gunakan "+ Tambah Barang" untuk input manual.'
      );
      return;
    }
    const whObj = warehouses.find((w) => String(w.id) === String(form.warehouse_id));
    const allItems = warehouseActiveProducts.map((p) => ({
      product_id: String(p.id),
      stok_sistem: Number(p.total_stok || 0),
      stok_fisik: Number(p.total_stok || 0),
      harga_satuan: p.harga || 0,
      satuan: p.satuan || 'PCS',
      catatan: '',
    }));
    setForm((prev) => ({ ...prev, items: allItems }));
    toastSuccess(
      `Berhasil memuat ${allItems.length} barang di ${whObj?.nama_gudang || 'gudang terpilih'}`
    );
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!form.warehouse_id) {
      alertError('Peringatan', 'Pilih lokasi gudang opname!');
      return;
    }
    if (form.items.length === 0) {
      alertError('Peringatan', 'Tambahkan minimal 1 produk dalam daftar opname!');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        warehouse_id: Number(form.warehouse_id),
        items: form.items.map((it) => ({
          product_id: Number(it.product_id),
          stok_fisik: Number(it.stok_fisik || 0),
          harga_satuan: Number(it.harga_satuan || 0),
          catatan: it.catatan,
        })),
      };

      const res = await api.post('/stock-adjustments', payload);
      if (res.data.success) {
        toastSuccess('Stok Opname Berhasil!', res.data.message);
        setModalOpen(false);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Memproses Opname', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Filtered
  const filteredAdjustments = adjustments.filter((a) => {
    const matchSearch =
      (a.no_adjustment || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.catatan || '').toLowerCase().includes(search.toLowerCase());
    const matchWh =
      selectedWarehouseFilter === 'ALL' || String(a.warehouse_id) === String(selectedWarehouseFilter);
    const matchMonth =
      !selectedMonth || String(a.tanggal || '').slice(0, 7) === selectedMonth;
    return matchSearch && matchWh && matchMonth;
  });

  const { pageItems: paginatedAdjustments, totalPages, safePage } = paginate(
    filteredAdjustments,
    page,
    pageSize
  );

  const totalNominalSelisih = filteredAdjustments.reduce(
    (sum, a) => sum + Number(a.total_selisih_nominal || 0),
    0
  );

  const handleExportExcel = () => {
    const headers = [
      'No. Penyesuaian',
      'Tanggal Opname',
      'Gudang',
      'Tipe Adjustment',
      'Total Selisih Nominal (Rp)',
      'Catatan / Alasan',
    ];

    const data = filteredAdjustments.map((a) => {
      const typeObj = ADJUSTMENT_TYPES.find((t) => t.value === a.tipe_adjustment);
      return [
        a.no_adjustment || '',
        formatDate(a.tanggal),
        a.nama_gudang || 'Gudang Utama',
        typeObj ? typeObj.label : a.tipe_adjustment,
        a.total_selisih_nominal ?? 0,
        a.catatan || '-',
      ];
    });

    exportToExcel(`Rekap_Stok_Opname_${selectedMonth || 'Semua'}`, headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-indigo-600" />
            Stok Opname & Penyesuaian Fisik (Stock Adjustment)
          </h1>
          <p className="text-sm text-slate-500">
            Penyesuaian fisik stok gudang dengan sistem, pencatatan barang rusak/susut, dan penerbitan jurnal penyesuaian otomatis.
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
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" />
            Mulai Stok Opname Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Sesi Opname</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{filteredAdjustments.length} Transaksi</div>
          <p className="mt-1 text-xs text-slate-500">
            {selectedMonth ? `Periode bulan ${selectedMonth}` : 'Seluruh penyesuaian fisik tercatat'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Net Nilai Penyesuaian</span>
            <div
              className={`rounded-lg p-2 ${
                totalNominalSelisih >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {totalNominalSelisih >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-bold ${
              totalNominalSelisih >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatRupiah(totalNominalSelisih)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {totalNominalSelisih >= 0 ? 'Surplus Persediaan' : 'Beban Kerusakan / Susut'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {isRestrictedAdminGudang ? 'Gudang Tugas Anda' : 'Gudang Operasional'}
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">
            {isRestrictedAdminGudang ? '1 Lokasi' : `${warehouses.length} Lokasi`}
          </div>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {isRestrictedAdminGudang
              ? warehouses.find((w) => String(w.id) === assignedWarehouseId)?.nama_gudang ||
                user?.nama_gudang ||
                'Gudang Terkunci'
              : 'Pusat, Farmasi, Karantina, Cabang'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor opname atau catatan..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              title="Filter berdasarkan bulan opname"
              aria-label="Filter Bulan"
              className="rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {selectedMonth && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth('');
                setPage(1);
              }}
              title="Tampilkan semua bulan"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="w-64">
          {isRestrictedAdminGudang ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              <span className="truncate">
                {warehouses.find((w) => String(w.id) === assignedWarehouseId)
                  ? `${warehouses.find((w) => String(w.id) === assignedWarehouseId).kode_gudang} - ${warehouses.find((w) => String(w.id) === assignedWarehouseId).nama_gudang}`
                  : user?.nama_gudang || 'Gudang Tugas Anda'}
              </span>
              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                Gudang Anda
              </span>
            </div>
          ) : (
            <SearchableSelect
              value={selectedWarehouseFilter}
              onChange={(e) => {
                setSelectedWarehouseFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Semua Gudang' },
                ...warehouses.map((w) => ({ value: String(w.id), label: `${w.kode_gudang} - ${w.nama_gudang}` })),
              ]}
            />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat riwayat stok opname...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ClipboardCheck className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Riwayat Stok Opname</p>
            <p className="text-sm mt-1">Lakukan opname fisik berkala untuk menjamin akurasi stok barang medis.</p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Mulai Opname Sekarang
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">No Opname & Tgl</th>
                    <th className="px-4 py-3">Lokasi Gudang</th>
                    <th className="px-4 py-3">Tipe Penyesuaian</th>
                    <th className="px-4 py-3">Rincian Item</th>
                    <th className="px-4 py-3 text-right">Nilai Selisih</th>
                    <th className="px-4 py-3">Jurnal Terbit</th>
                    <th className="px-4 py-3">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedAdjustments.map((adj) => {
                    const isProfit = Number(adj.total_selisih_nominal) >= 0;
                    return (
                      <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{adj.no_adjustment}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{formatDate(adj.tanggal)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {adj.nama_gudang}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                            {adj.tipe_adjustment}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            {adj.items?.map((it, idx) => (
                              <div key={idx} className="text-xs text-slate-700">
                                <strong>{it.nama_produk}</strong>: Fisik {it.stok_fisik} {it.satuan || ''} (Sistem {it.stok_sistem} {it.satuan || ''}),{' '}
                                <span className={it.selisih_qty >= 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                  Selisih: {it.selisih_qty > 0 ? `+${it.selisih_qty}` : it.selisih_qty} {it.satuan || ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold">
                          <span className={isProfit ? 'text-emerald-700' : 'text-red-600'}>
                            {formatRupiah(adj.total_selisih_nominal)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {adj.journal_id ? (
                            <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                              JRN-#{adj.journal_id}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium text-slate-800">
                          {adj.created_by_name || 'Admin'}
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
                totalItems={filteredAdjustments.length}
                pageSize={pageSize}
                onPageSize={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                label="stok opname"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Mulai Stok Opname Baru */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Formulir Rekonsiliasi Stok Opname Fisik"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveAdjustment} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Lokasi Gudang <span className="text-red-500">*</span>
              </label>
              {isRestrictedAdminGudang ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  <span className="truncate">
                    {warehouses.find((w) => String(w.id) === assignedWarehouseId)
                      ? `${warehouses.find((w) => String(w.id) === assignedWarehouseId).kode_gudang} - ${warehouses.find((w) => String(w.id) === assignedWarehouseId).nama_gudang}`
                      : user?.nama_gudang || 'Gudang Tugas Anda'}
                  </span>
                  <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    Gudang Anda
                  </span>
                </div>
              ) : (
                <SearchableSelect
                  value={form.warehouse_id}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  options={warehouses.map((w) => ({
                    value: String(w.id),
                    label: `${w.kode_gudang} - ${w.nama_gudang}`,
                  }))}
                />
              )}
              {loadingWhStock && (
                <p className="text-[10px] text-indigo-600 mt-1 flex items-center gap-1 font-medium">
                  <Loader2 className="h-3 w-3 animate-spin" /> Menyesuaikan stok gudang...
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tanggal Opname <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tipe Penyesuaian <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.tipe_adjustment}
                onChange={(e) => setForm({ ...form, tipe_adjustment: e.target.value })}
                options={ADJUSTMENT_TYPES}
              />
            </div>
          </div>

          {/* Dynamic Items Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Daftar Barang yang Disesuaikan
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePopulateAllWarehouseProducts}
                  disabled={loadingWhStock || warehouseActiveProducts.length === 0}
                  title="Tarik semua barang yang terdaftar/tersimpan di gudang ini"
                  className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Tarik Seluruh Barang ({warehouseActiveProducts.length})
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Barang
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {form.items.map((item, idx) => {
                const diff = Number(item.stok_fisik || 0) - Number(item.stok_sistem || 0);
                const diffNominal = diff * Number(item.harga_satuan || 0);
                const prodSource = warehouseProducts.length > 0 ? warehouseProducts : products;
                const matchedProd = prodSource.find((p) => String(p.id) === String(item.product_id));
                const unitLabel = (matchedProd?.satuan || item.satuan || 'PCS').toUpperCase();
                const hasMultiTier =
                  matchedProd &&
                  (Number(matchedProd.isi_box_pcs) > 1 ||
                    Number(matchedProd.isi_per_kemasan) > 1 ||
                    Number(matchedProd.isi_pack_pcs) > 1);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                  >
                    <div className="col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Pilih Produk
                      </label>
                      <SearchableSelect
                        value={item.product_id}
                        placeholder="-- Cari / Pilih Produk --"
                        onChange={(e) => handleProductChange(idx, e?.target ? e.target.value : e)}
                        options={prodSource.map((p) => ({
                          value: String(p.id),
                          label: `${p.kode_produk} - ${p.nama_produk} (Stok: ${Number(p.total_stok || 0)} ${(p.satuan || 'pcs').toUpperCase()})`,
                        }))}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Stok Sistem
                      </label>
                      <div className="flex items-center rounded border border-slate-200 bg-slate-100 overflow-hidden">
                        <input
                          type="text"
                          disabled
                          value={loadingWhStock ? '...' : item.stok_sistem}
                          className="w-full min-w-0 bg-transparent px-1.5 py-1.5 text-xs text-slate-700 font-bold text-center focus:outline-none"
                        />
                        <span className="shrink-0 bg-slate-200/80 px-1.5 py-1.5 text-[10px] font-bold text-slate-600 border-l border-slate-200">
                          {unitLabel}
                        </span>
                      </div>
                      {hasMultiTier && (
                        <span
                          className="block text-[10px] text-slate-500 font-medium mt-0.5 truncate"
                          title={formatMultiTierBreakdown(item.stok_sistem, matchedProd)}
                        >
                          ≈ {formatMultiTierBreakdown(item.stok_sistem, matchedProd)}
                        </span>
                      )}
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-indigo-700 mb-1">
                        Stok Fisik Real *
                      </label>
                      <div className="flex items-center rounded border border-indigo-400 bg-white overflow-hidden">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={item.stok_fisik}
                          onChange={(e) => handleItemFieldChange(idx, 'stok_fisik', e.target.value)}
                          className="w-full min-w-0 bg-transparent px-2 py-1.5 text-xs font-bold text-center focus:outline-none"
                        />
                        <span className="shrink-0 bg-indigo-50 px-2 py-1.5 text-[10px] font-bold text-indigo-700 border-l border-indigo-200">
                          {unitLabel}
                        </span>
                      </div>
                      {hasMultiTier && (
                        <span
                          className="block text-[10px] text-indigo-600 font-semibold mt-0.5 truncate"
                          title={formatMultiTierBreakdown(item.stok_fisik, matchedProd)}
                        >
                          ≈ {formatMultiTierBreakdown(item.stok_fisik, matchedProd)}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 text-right">
                      <div className="text-[10px] text-slate-500">Selisih</div>
                      <div className={`text-[11px] font-bold ${diff >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {diff > 0 ? `+${diff}` : diff} {unitLabel}
                      </div>
                      <div className={`text-xs font-bold ${diff >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatRupiah(diffNominal)}
                      </div>
                    </div>

                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={form.items.length <= 1}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Catatan Opname / Berita Acara
            </label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="cth: Ditemukan 2 botol antiseptik pecah saat pemindahan rak B-02..."
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
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan & Posting Penyesuaian
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

