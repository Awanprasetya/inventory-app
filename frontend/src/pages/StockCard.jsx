import { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ArrowLeft,
  Search,
  Layers,
  Package,
  Barcode,
  Clock,
  AlertTriangle,
  ChevronRight,
  Warehouse,
} from 'lucide-react';
import api, { getErrorMessage, formatNumber, formatDateTime, formatDate } from '../services/api.js';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { exportToExcel } from '../utils/exportHelper.js';
import { formatMultiTierBreakdown } from '../utils/unitHelper.js';

const MUTATION_BADGES = {
  MASUK: { label: 'Barang Masuk (Inbound)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  KELUAR: { label: 'Barang Keluar (Outbound)', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  ADJUSTMENT_MASUK: { label: 'Stok Opname (+)', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  ADJUSTMENT_KELUAR: { label: 'Stok Opname (-)', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  TRANSFER_MASUK: { label: 'Transfer Masuk', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  TRANSFER_KELUAR: { label: 'Transfer Keluar', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  RETUR_BELI: { label: 'Retur ke Supplier', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  RETUR_JUAL: { label: 'Retur dari Pelanggan', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

const POSITIVE_TYPES = ['MASUK', 'ADJUSTMENT_MASUK', 'TRANSFER_MASUK', 'RETUR_JUAL'];

export default function StockCard() {
  // Master lists
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Filters (berlaku global & persisten)
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(15);

  // Selected product detail view
  const [activeProductCode, setActiveProductCode] = useState(null);
  const [activeTab, setActiveTab] = useState('lots'); // 'lots' | 'mutations'

  // Detail state (Lots & Mutations)
  const [lots, setLots] = useState([]);
  const [report, setReport] = useState(null); // { product, rows, ringkasan }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  // Mutation date filters & pagination
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mutationPage, setMutationPage] = useState(1);
  const [mutationPageSize, setMutationPageSize] = useState(15);
  const [lotPage, setLotPage] = useState(1);
  const [lotPageSize, setLotPageSize] = useState(15);

  // Muat daftar gudang saat awal
  useEffect(() => {
    (async () => {
      try {
        const whRes = await api.get('/warehouses');
        setWarehouses(whRes.data.data || []);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
  }, []);

  // Muat seluruh produk (reaktif terhadap filter gudang)
  const loadProducts = async (whId = selectedWarehouse) => {
    setLoadingProducts(true);
    setError('');
    try {
      const { data } = await api.get('/products', {
        params: {
          warehouse_id: whId || undefined,
        },
      });
      setProducts(data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts(selectedWarehouse);
  }, [selectedWarehouse]);

  // Muat detail Lot + Buku Mutasi Saldo Berjalan untuk produk yang diklik
  const loadProductDetail = async (kodeProduk, tanggalDari = from, tanggalSampai = to, whId = selectedWarehouse) => {
    if (!kodeProduk) return;
    setLoadingDetail(true);
    setError('');
    try {
      const [lotsRes, cardRes] = await Promise.all([
        api.get(`/products/${encodeURIComponent(kodeProduk)}/lots`),
        api.get(`/stock-card/${encodeURIComponent(kodeProduk)}`, {
          params: {
            from: tanggalDari || undefined,
            to: tanggalSampai || undefined,
            warehouse_id: whId || undefined,
          },
        }),
      ]);
      setLots(lotsRes.data?.data?.lots || []);
      setReport(cardRes.data?.data || null);
    } catch (err) {
      setLots([]);
      setReport(null);
      setError(getErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  // Muat ulang detail saat produk aktif atau filter gudang berubah
  useEffect(() => {
    if (activeProductCode) {
      setLotPage(1);
      setMutationPage(1);
      loadProductDetail(activeProductCode, from, to, selectedWarehouse);
    }
  }, [activeProductCode, selectedWarehouse]);

  const handleSelectProduct = (kodeProduk) => {
    setActiveProductCode(kodeProduk);
    setActiveTab('lots'); // Default tampilkan tab Lot produk terlebih dahulu
    setLotPage(1);
    setMutationPage(1);
  };

  const handleBackToProducts = () => {
    setActiveProductCode(null);
    setReport(null);
    setLots([]);
    setFrom('');
    setTo('');
    setError('');
  };

  const handleMutationFilter = (e) => {
    e.preventDefault();
    setMutationPage(1);
    loadProductDetail(activeProductCode, from, to, selectedWarehouse);
  };

  const clearMutationFilter = () => {
    setFrom('');
    setTo('');
    setMutationPage(1);
    loadProductDetail(activeProductCode, '', '', selectedWarehouse);
  };

  // Filter daftar produk lokal berdasarkan pencarian
  const filteredProducts = useMemo(() => {
    const q = searchProduct.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.kode_produk || '').toLowerCase().includes(q) ||
        (p.nama_produk || '').toLowerCase().includes(q) ||
        (p.barcode_kemasan || '').toLowerCase().includes(q) ||
        (p.kode_rak || '').toLowerCase().includes(q)
    );
  }, [products, searchProduct]);

  // Filter daftar lot berdasarkan gudang yang dipilih
  const filteredLots = useMemo(() => {
    if (!selectedWarehouse) return lots;
    return lots.filter((l) => String(l.warehouse_id || '') === String(selectedWarehouse));
  }, [lots, selectedWarehouse]);

  // Nama gudang aktif untuk label tampilan
  const selectedWarehouseObj = warehouses.find((w) => String(w.id) === String(selectedWarehouse));

  // Ringkasan agregat untuk daftar semua produk
  const totalProductCount = filteredProducts.length;
  const totalAllStock = filteredProducts.reduce((sum, p) => sum + Number(p.total_stok || 0), 0);
  const totalAllLots = filteredProducts.reduce((sum, p) => sum + Number(p.jumlah_lot || 0), 0);
  const emptyStockCount = filteredProducts.filter((p) => Number(p.total_stok || 0) <= 0).length;

  // Export Excel adaptif sesuai tampilan yang sedang aktif
  const handleExportExcel = () => {
    if (!activeProductCode) {
      if (filteredProducts.length === 0) {
        alert('Tidak ada data produk untuk diexport.');
        return;
      }
      const headers = [
        'Kode Produk',
        'Nama Produk',
        'Lokasi Rak',
        'Metode Stok',
        'Jumlah Lot',
        'Total Stok Fisik',
        'Satuan',
        'Gudang Filter',
      ];
      const data = filteredProducts.map((p) => [
        p.kode_produk || '',
        p.nama_produk || '',
        p.kode_rak || '-',
        (p.metode_stok || 'FIFO').toUpperCase(),
        Number(p.jumlah_lot || 0),
        Number(p.total_stok || 0),
        p.satuan || 'pcs',
        selectedWarehouseObj ? selectedWarehouseObj.nama_gudang : 'Semua Gudang',
      ]);
      exportToExcel('Kartu_Stok_Semua_Produk', headers, data);
      return;
    }

    if (activeTab === 'lots') {
      if (filteredLots.length === 0) {
        alert('Tidak ada data lot untuk diexport.');
        return;
      }
      const headers = [
        'Nomor Lot / Batch',
        'Kode Produk',
        'Nama Produk',
        'Gudang',
        'Tgl Produksi',
        'Expired Date',
        'Sisa Hari ED',
        'Stok Lot',
        'Satuan',
        'Status',
      ];
      const data = filteredLots.map((l) => [
        l.nomor_lot || '',
        l.kode_produk || activeProductCode,
        report?.product?.nama_produk || '',
        l.nama_gudang || 'Gudang Utama',
        formatDate(l.tanggal_produksi),
        formatDate(l.expired_date),
        l.days_to_expire ?? '-',
        Number(l.stok_qty || 0),
        report?.product?.satuan || 'pcs',
        l.effective_status || l.status || 'AVAILABLE',
      ]);
      exportToExcel(`Lot_Produk_${activeProductCode}`, headers, data);
      return;
    }

    // Tab Mutasi
    if (!report || !report.rows || report.rows.length === 0) {
      alert('Tidak ada mutasi stok yang dapat diexport.');
      return;
    }
    const headers = [
      'Waktu Mutasi',
      'Kode Produk',
      'Nama Produk',
      'Gudang',
      'No. Lot / Batch',
      'Tipe Mutasi',
      'Jumlah Masuk (+)',
      'Jumlah Keluar (-)',
      'Sisa Stok Fisik',
      'Referensi Dokumen',
    ];
    const data = report.rows.map((row) => {
      const isPositive = POSITIVE_TYPES.includes(row.tipe);
      const badgeInfo = MUTATION_BADGES[row.tipe] || { label: row.tipe };
      return [
        formatDateTime(row.tanggal_mutasi),
        report.product?.kode_produk || activeProductCode,
        report.product?.nama_produk || '',
        row.nama_gudang || 'Pusat Logistik',
        row.nomor_lot || '-',
        badgeInfo.label,
        isPositive ? row.qty_perubahan ?? 0 : 0,
        !isPositive ? row.qty_perubahan ?? 0 : 0,
        row.qty_sisa ?? 0,
        row.referensi || '-',
      ];
    });
    exportToExcel(`Kartu_Stok_Mutasi_${activeProductCode}`, headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          {activeProductCode && (
            <button
              type="button"
              onClick={handleBackToProducts}
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition shrink-0"
              title="Kembali ke Daftar Seluruh Produk"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {activeProductCode
                ? `Kartu Stok: ${report?.product?.nama_produk || activeProductCode}`
                : 'Kartu Stok Realtime & Audit Mutasi'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeProductCode
                ? 'Lihat rincian batch/lot aktif dan buku pembantu mutasi saldo berjalan untuk produk terpilih.'
                : 'Klik salah satu produk pada tabel di bawah untuk melihat rincian Batch/Lot dan Mutasi Saldo Berjalan.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs transition"
            title="Export ke Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() =>
              activeProductCode
                ? loadProductDetail(activeProductCode, from, to, selectedWarehouse)
                : loadProducts(selectedWarehouse)
            }
            disabled={loadingProducts || loadingDetail}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loadingProducts || loadingDetail ? 'animate-spin' : ''}`} />
            Segarkan
          </button>
        </div>
      </div>

      {/* Notifikasi Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar Global (Pencarian Produk + Filter Gudang Selalu Tersedia) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Pencarian Produk (hanya saat di daftar semua produk, atau tampil info produk aktif) */}
          {!activeProductCode ? (
            <div className="md:col-span-7">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Cari Produk (Kode, Nama, Rak, atau Barcode)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchProduct}
                  onChange={(e) => {
                    setSearchProduct(e.target.value);
                    setProductPage(1);
                  }}
                  placeholder="Ketik kode produk (PRD-001) atau nama produk..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="md:col-span-7">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Ganti Cepat Produk Lain
              </label>
              <SearchableSelect
                value={activeProductCode}
                onChange={(e) => {
                  const val = e.target ? e.target.value : e;
                  if (val) handleSelectProduct(val);
                }}
                placeholder="-- Pilih Produk --"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.kode_produk}>
                    {p.kode_produk} &mdash; {p.nama_produk} ({p.satuan || 'pcs'})
                  </option>
                ))}
              </SearchableSelect>
            </div>
          )}

          {/* Filter Gudang Tertentu (Tetap Ada di Kedua Tampilan) */}
          <div className="md:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
              Filter Gudang Tertentu
            </label>
            <SearchableSelect
              value={selectedWarehouse}
              onChange={(e) => {
                setSelectedWarehouse(e.target ? e.target.value : e);
                setProductPage(1);
              }}
              placeholder="-- Semua Gudang Penyimpanan --"
            >
              <option value="">-- Semua Gudang Penyimpanan --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nama_gudang} ({w.kode_gudang})
                </option>
              ))}
            </SearchableSelect>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: TABEL SELURUH PRODUK                                        */}
      {/* =================================================================== */}
      {!activeProductCode ? (
        <>
          {/* Ringkasan KPI Produk */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Total Produk Terdaftar</span>
                <p className="text-xl font-extrabold text-slate-800">{formatNumber(totalProductCount)} Item</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Total Batch / Lot</span>
                <p className="text-xl font-extrabold text-teal-700">{formatNumber(totalAllLots)} Lot</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Total Akumulasi Stok</span>
                <p className="text-xl font-extrabold text-emerald-700">{formatNumber(totalAllStock)} Unit</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Produk Stok Kosong</span>
                <p className="text-xl font-extrabold text-rose-700">{formatNumber(emptyStockCount)} Item</p>
              </div>
            </div>
          </div>

          {/* Tabel Daftar Seluruh Produk */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  Daftar Kartu Stok Produk {selectedWarehouseObj ? `— ${selectedWarehouseObj.nama_gudang}` : '— Semua Gudang'}
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Klik baris produk untuk melihat <strong>Batch/Lot</strong> & <strong>Mutasi Saldo Berjalan</strong>
              </span>
            </div>

            {loadingProducts ? (
              <div className="p-16 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
                <p className="text-sm">Memuat daftar stok seluruh produk...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-14 text-center text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
                <p className="text-base font-semibold text-slate-600">Produk Tidak Ditemukan</p>
                <p className="text-xs text-slate-400 mt-1">
                  Coba ubah kata kunci pencarian atau pilih filter gudang yang lain.
                </p>
              </div>
            ) : (
              (() => {
                const { pageItems, totalPages, safePage } = paginate(filteredProducts, productPage, productPageSize);
                return (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                          <tr>
                            <th className="py-3 px-4">Kode & Rak</th>
                            <th className="py-3 px-4">Nama Produk</th>
                            <th className="py-3 px-4 text-center">Metode Stok</th>
                            <th className="py-3 px-4 text-center">Jumlah Lot</th>
                            <th className="py-3 px-4 text-right">Total Stok Fisik</th>
                            <th className="py-3 px-4 text-center">Status Stok</th>
                            <th className="py-3 px-4 text-center">Detail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pageItems.map((prod) => {
                            const stok = Number(prod.total_stok || 0);
                            const lotCount = Number(prod.jumlah_lot || 0);
                            const metode = (prod.metode_stok || 'FIFO').toUpperCase();

                            return (
                              <tr
                                key={prod.id}
                                onClick={() => handleSelectProduct(prod.kode_produk)}
                                className="hover:bg-indigo-50/50 cursor-pointer transition group"
                              >
                                <td className="py-3.5 px-4">
                                  <div className="font-mono font-bold text-slate-900 group-hover:text-indigo-700 transition">
                                    {prod.kode_produk}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    Rak: {prod.kode_rak || '-'}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-slate-800 group-hover:text-indigo-700 transition">
                                    {prod.nama_produk}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Satuan: {prod.satuan || 'pcs'}
                                    {(Number(prod.isi_box_pcs) > 1 || Number(prod.isi_per_kemasan) > 1) && (
                                      <span className="ml-2 text-indigo-500">
                                        &bull; 1 {prod.satuan_besar || 'BOX'} = {Number(prod.isi_box_pcs || prod.isi_per_kemasan)} {prod.satuan}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
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
                                <td className="py-3.5 px-4 text-center">
                                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                    <Barcode className="w-3.5 h-3.5 text-slate-500" />
                                    {lotCount} Lot
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="font-extrabold text-slate-900">
                                    {formatNumber(stok)} {prod.satuan || 'pcs'}
                                  </div>
                                  {(Number(prod.isi_box_pcs) > 1 || Number(prod.isi_per_kemasan) > 1) && stok > 0 && (
                                    <div className="text-[11px] font-medium text-indigo-600">
                                      ≈ {formatMultiTierBreakdown(stok, prod)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {stok <= 0 ? (
                                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                                      Kosong
                                    </span>
                                  ) : stok <= 10 ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                      Menipis
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                      Tersedia
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectProduct(prod.kode_produk);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                                  >
                                    Lihat Lot & Mutasi
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      page={safePage}
                      totalPages={totalPages}
                      onPage={setProductPage}
                      totalItems={filteredProducts.length}
                      pageSize={productPageSize}
                      onPageSize={(s) => {
                        setProductPageSize(s);
                        setProductPage(1);
                      }}
                      label="produk"
                    />
                  </>
                );
              })()
            )}
          </div>
        </>
      ) : (
        /* =================================================================== */
        /* VIEW 2: DETAIL PRODUK (RINGKASAN + TAB LOT & TAB MUTASI SALDO)      */
        /* =================================================================== */
        <>
          {loadingDetail && !report ? (
            <div className="p-16 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
              <p className="text-sm">Memuat daftar lot dan buku mutasi saldo berjalan...</p>
            </div>
          ) : (
            <>
              {/* Ringkasan Metrics Produk Terpilih */}
              {report && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Info Produk */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500">Produk Terpilih</span>
                    <p className="text-base font-bold text-slate-800 mt-0.5 truncate">{report.product.nama_produk}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Kode: <strong>{report.product.kode_produk}</strong> &bull; Rak:{' '}
                      <strong>{report.product.kode_rak || '-'}</strong>
                    </p>
                  </div>

                  {/* Total Masuk */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <ArrowDownLeft className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500">Total Masuk (Periode Ini)</span>
                      <p className="text-xl font-extrabold text-emerald-700">
                        +{formatNumber(report.ringkasan.total_masuk)} {report.product.satuan || 'pcs'}
                      </p>
                      {(Number(report.product.isi_box_pcs) > 1 || Number(report.product.isi_per_kemasan) > 1) && (
                        <p className="text-xs font-semibold text-emerald-600">
                          ≈ +{formatMultiTierBreakdown(report.ringkasan.total_masuk, report.product)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total Keluar */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500">Total Keluar (Periode Ini)</span>
                      <p className="text-xl font-extrabold text-orange-700">
                        -{formatNumber(report.ringkasan.total_keluar)} {report.product.satuan || 'pcs'}
                      </p>
                      {(Number(report.product.isi_box_pcs) > 1 || Number(report.product.isi_per_kemasan) > 1) && (
                        <p className="text-xs font-semibold text-orange-600">
                          ≈ -{formatMultiTierBreakdown(report.ringkasan.total_keluar, report.product)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Saldo Akhir */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500">Saldo Akhir Fisik</span>
                      <p className="text-xl font-extrabold text-indigo-700">
                        {formatNumber(report.ringkasan.saldo)} {report.product.satuan || 'pcs'}
                      </p>
                      {(Number(report.product.isi_box_pcs) > 1 || Number(report.product.isi_per_kemasan) > 1) && (
                        <p className="text-xs font-semibold text-indigo-600">
                          ≈ {formatMultiTierBreakdown(report.ringkasan.saldo, report.product)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs Navigation + Content Container */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Tab Headers */}
                <div className="border-b border-slate-200 bg-slate-50/70 px-4 pt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('lots')}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-lg border-b-2 transition ${
                        activeTab === 'lots'
                          ? 'border-indigo-600 text-indigo-700 bg-white'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/70'
                      }`}
                    >
                      <Barcode className="w-4 h-4" />
                      Daftar Batch / Lot Produk
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                          activeTab === 'lots' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {filteredLots.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('mutations')}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-lg border-b-2 transition ${
                        activeTab === 'mutations'
                          ? 'border-indigo-600 text-indigo-700 bg-white'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/70'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4" />
                      Mutasi Saldo Berjalan
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                          activeTab === 'mutations' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {report?.rows?.length || 0}
                      </span>
                    </button>
                  </div>

                  {activeTab === 'mutations' && report && Number(report.ringkasan?.saldo_awal || 0) > 0 && (
                    <div className="pb-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        Saldo Awal: {formatNumber(report.ringkasan.saldo_awal)} {report.product?.satuan || 'pcs'}
                      </span>
                    </div>
                  )}
                </div>

                {/* TAB 1: DAFTAR LOT PRODUK */}
                {activeTab === 'lots' && (
                  <div>
                    {loadingDetail ? (
                      <div className="p-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        <p className="text-xs">Memuat data batch / lot...</p>
                      </div>
                    ) : filteredLots.length === 0 ? (
                      <div className="p-12 text-center text-slate-400">
                        <Barcode className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">
                          Belum Ada Batch / Lot untuk Produk Ini
                          {selectedWarehouseObj ? ` di ${selectedWarehouseObj.nama_gudang}` : ''}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Lot akan otomatis tercatat saat melakukan transaksi Barang Masuk (Inbound).
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const { pageItems, totalPages, safePage } = paginate(filteredLots, lotPage, lotPageSize);
                        return (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                                  <tr>
                                    <th className="py-3 px-4">Nomor Lot / Batch</th>
                                    <th className="py-3 px-4">Gudang</th>
                                    <th className="py-3 px-4">Tgl Produksi</th>
                                    <th className="py-3 px-4">Expired Date (ED)</th>
                                    <th className="py-3 px-4 text-center">Sisa Masa ED</th>
                                    <th className="py-3 px-4 text-center">Shift</th>
                                    <th className="py-3 px-4 text-right">Stok Lot</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {pageItems.map((lot) => {
                                    const days = lot.days_to_expire;
                                    const isExp = days !== null && days < 0;
                                    const isSoon = days !== null && days >= 0 && days <= 90;
                                    const stokLot = Number(lot.stok_qty || 0);

                                    return (
                                      <tr key={lot.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-3 px-4">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-slate-900">{lot.nomor_lot}</span>
                                            {lot.is_recommended && (
                                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                                                Prioritas {lot.metode_digunakan || 'FEFO'}
                                              </span>
                                            )}
                                          </div>
                                          {lot.keterangan && (
                                            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                                              {lot.keterangan}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                                          {lot.nama_gudang || 'Gudang Utama'}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-700">
                                          {formatDate(lot.tanggal_produksi)}
                                        </td>
                                        <td className="py-3 px-4 text-xs font-semibold text-slate-900">
                                          {formatDate(lot.expired_date)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
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
                                        <td className="py-3 px-4 text-center text-xs font-medium text-slate-600">
                                          Shift {lot.shift || 1}
                                        </td>
                                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                                          <div>
                                            <span>
                                              {formatNumber(stokLot)} {report?.product?.satuan || 'pcs'}
                                            </span>
                                            {report?.product &&
                                              (Number(report.product.isi_box_pcs) > 1 ||
                                                Number(report.product.isi_per_kemasan) > 1) &&
                                              stokLot > 0 && (
                                                <p className="text-[10px] text-indigo-600 font-medium">
                                                  ≈ {formatMultiTierBreakdown(stokLot, report.product)}
                                                </p>
                                              )}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
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
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <Pagination
                              page={safePage}
                              totalPages={totalPages}
                              onPage={setLotPage}
                              totalItems={filteredLots.length}
                              pageSize={lotPageSize}
                              onPageSize={(s) => {
                                setLotPageSize(s);
                                setLotPage(1);
                              }}
                              label="batch lot"
                            />
                          </>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* TAB 2: BUKU MUTASI SALDO BERJALAN */}
                {activeTab === 'mutations' && (
                  <div>
                    {/* Filter Periode Tanggal khusus Tab Mutasi */}
                    <form
                      onSubmit={handleMutationFilter}
                      className="p-4 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-end gap-3"
                    >
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Dari Tanggal
                        </label>
                        <input
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Sampai Tanggal
                        </label>
                        <input
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs transition"
                      >
                        Terapkan Tanggal
                      </button>
                      {(from || to) && (
                        <button
                          type="button"
                          onClick={clearMutationFilter}
                          className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                        >
                          Reset Tanggal
                        </button>
                      )}
                    </form>

                    {loadingDetail ? (
                      <div className="p-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        <p className="text-xs">Menghitung mutasi saldo berjalan...</p>
                      </div>
                    ) : !report || report.rows.length === 0 ? (
                      <div className="p-12 text-center text-slate-400">
                        <p className="text-sm font-medium text-slate-600">
                          Tidak ada mutasi stok pada periode filter yang dipilih.
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Coba kosongkan filter tanggal atau pilih semua gudang untuk melihat seluruh riwayat.
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const { pageItems, totalPages, safePage } = paginate(
                          report.rows,
                          mutationPage,
                          mutationPageSize
                        );
                        return (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                                  <tr>
                                    <th className="py-3 px-4">Tanggal & Waktu</th>
                                    <th className="py-3 px-4">Gudang</th>
                                    <th className="py-3 px-4">No. Lot / Batch</th>
                                    <th className="py-3 px-4">Tipe Mutasi</th>
                                    <th className="py-3 px-4 text-right text-emerald-700">Masuk (+)</th>
                                    <th className="py-3 px-4 text-right text-orange-700">Keluar (-)</th>
                                    <th className="py-3 px-4 text-right font-bold text-slate-800">Sisa Stok</th>
                                    <th className="py-3 px-4">Referensi Dokumen</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {pageItems.map((row) => {
                                    const badgeInfo = MUTATION_BADGES[row.tipe] || {
                                      label: row.tipe,
                                      color: 'bg-slate-100 text-slate-700 border-slate-200',
                                    };
                                    const isPositive = POSITIVE_TYPES.includes(row.tipe);

                                    return (
                                      <tr key={row.id} className="hover:bg-slate-50/60 transition">
                                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 font-medium">
                                          {formatDateTime(row.tanggal_mutasi)}
                                        </td>
                                        <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                                          {row.nama_gudang || 'Pusat Logistik'}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-800">
                                          {row.nomor_lot}
                                        </td>
                                        <td className="py-3 px-4">
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badgeInfo.color}`}
                                          >
                                            {badgeInfo.label}
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-emerald-600">
                                          {isPositive ? (
                                            <div>
                                              <span>+{formatNumber(row.qty_perubahan)}</span>
                                              {(Number(report.product.isi_box_pcs) > 1 ||
                                                Number(report.product.isi_per_kemasan) > 1) && (
                                                <p className="text-[10px] text-emerald-700/80 font-normal">
                                                  ≈ {formatMultiTierBreakdown(row.qty_perubahan, report.product)}
                                                </p>
                                              )}
                                            </div>
                                          ) : (
                                            '-'
                                          )}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-orange-600">
                                          {!isPositive ? (
                                            <div>
                                              <span>-{formatNumber(row.qty_perubahan)}</span>
                                              {(Number(report.product.isi_box_pcs) > 1 ||
                                                Number(report.product.isi_per_kemasan) > 1) && (
                                                <p className="text-[10px] text-orange-700/80 font-normal">
                                                  ≈ {formatMultiTierBreakdown(row.qty_perubahan, report.product)}
                                                </p>
                                              )}
                                            </div>
                                          ) : (
                                            '-'
                                          )}
                                        </td>
                                        <td className="py-3 px-4 text-right font-extrabold text-slate-800">
                                          <div>
                                            <span>{formatNumber(row.qty_sisa)}</span>
                                            {(Number(report.product.isi_box_pcs) > 1 ||
                                              Number(report.product.isi_per_kemasan) > 1) && (
                                              <p className="text-[10px] text-indigo-600 font-medium">
                                                ≈ {formatMultiTierBreakdown(row.qty_sisa, report.product)}
                                              </p>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-xs font-medium text-slate-600">
                                          {row.referensi || '-'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <Pagination
                              page={safePage}
                              totalPages={totalPages}
                              onPage={setMutationPage}
                              totalItems={report.rows.length}
                              pageSize={mutationPageSize}
                              onPageSize={(s) => {
                                setMutationPageSize(s);
                                setMutationPage(1);
                              }}
                              label="catatan mutasi"
                            />
                          </>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
