import { useEffect, useState } from 'react';
import {
  Undo2,
  RotateCcw,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  DollarSign,
  Package,
  Building,
  UserCheck,
  CheckCircle2,
  BookOpen,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate, formatNumber } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 10;

const SETTLEMENT_PURCHASE = {
  POTONG_UTANG: { label: 'Potong Utang (AP)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENGEMBALIAN_KAS: { label: 'Pengembalian Kas/Bank', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const SETTLEMENT_SALES = {
  POTONG_PIUTANG: { label: 'Potong Piutang (Kredit Nota)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENGEMBALIAN_KAS: { label: 'Refund Kas/Bank', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function Returns() {
  const [activeTab, setActiveTab] = useState('PURCHASE'); // 'PURCHASE' | 'SALES'

  // Data
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter & Pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modals
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form Purchase Return
  const [prForm, setPrForm] = useState({
    supplier_id: '',
    warehouse_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    tipe_penyelesaian: 'POTONG_UTANG',
    alasan_retur: '',
    items: [{ product_id: '', kemasan_count: '1', qty: 1, harga_satuan: 0, catatan: '' }],
  });

  // Form Sales Return
  const [srForm, setSrForm] = useState({
    customer_id: '',
    warehouse_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    tipe_penyelesaian: 'POTONG_PIUTANG',
    kembali_ke_stok: true,
    alasan_retur: '',
    items: [{ product_id: '', kemasan_count: '1', qty: 1, harga_satuan: 0, catatan: '' }],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [prRes, srRes, whRes, supRes, cusRes, prodRes] = await Promise.all([
        api.get('/returns/purchase'),
        api.get('/returns/sales'),
        api.get('/warehouses'),
        api.get('/suppliers'),
        api.get('/customers'),
        api.get('/products'),
      ]);
      setPurchaseReturns(prRes.data.data || []);
      setSalesReturns(srRes.data.data || []);
      setWarehouses(whRes.data.data || []);
      setSuppliers(supRes.data.data || []);
      setCustomers(cusRes.data.data || []);
      setProducts(prodRes.data.data || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered List
  const currentList = activeTab === 'PURCHASE' ? purchaseReturns : salesReturns;
  const filteredList = currentList.filter((item) => {
    const q = search.toLowerCase();
    const matchNo = item.no_return?.toLowerCase().includes(q);
    const matchEntity =
      activeTab === 'PURCHASE'
        ? item.nama_supplier?.toLowerCase().includes(q) || item.kode_supplier?.toLowerCase().includes(q)
        : item.nama_customer?.toLowerCase().includes(q) || item.kode_customer?.toLowerCase().includes(q);
    const matchReason = item.alasan_retur?.toLowerCase().includes(q);
    return matchNo || matchEntity || matchReason;
  });

  const { pageItems: paginatedData, totalPages, safePage } = paginate(filteredList, page, pageSize);

  // Summary Metrics
  const totalPurchaseReturnVal = purchaseReturns.reduce((sum, r) => sum + Number(r.total_nominal || 0), 0);
  const totalSalesReturnVal = salesReturns.reduce((sum, r) => sum + Number(r.total_nominal || 0), 0);

  // Reset Purchase Form
  const openNewPurchaseReturn = () => {
    const defaultProd = products[0];
    const isi = Number(defaultProd?.isi_per_kemasan) || 1;
    setPrForm({
      supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : '',
      warehouse_id: warehouses.length > 0 ? String(warehouses[0].id) : '',
      tanggal: new Date().toISOString().split('T')[0],
      tipe_penyelesaian: 'POTONG_UTANG',
      alasan_retur: '',
      items: [
        {
          product_id: defaultProd ? String(defaultProd.id) : '',
          kemasan_count: '1',
          qty: isi,
          harga_satuan: defaultProd ? Number(defaultProd.harga_beli || defaultProd.harga || 0) : 0,
          catatan: '',
        },
      ],
    });
    setPurchaseModalOpen(true);
  };

  // Reset Sales Form
  const openNewSalesReturn = () => {
    const defaultProd = products[0];
    const isi = Number(defaultProd?.isi_per_kemasan) || 1;
    setSrForm({
      customer_id: customers.length > 0 ? String(customers[0].id) : '',
      warehouse_id: warehouses.length > 0 ? String(warehouses[0].id) : '',
      tanggal: new Date().toISOString().split('T')[0],
      tipe_penyelesaian: 'POTONG_PIUTANG',
      kembali_ke_stok: true,
      alasan_retur: '',
      items: [
        {
          product_id: defaultProd ? String(defaultProd.id) : '',
          kemasan_count: '1',
          qty: isi,
          harga_satuan: defaultProd ? Number(defaultProd.harga_jual || defaultProd.harga || 0) : 0,
          catatan: '',
        },
      ],
    });
    setSalesModalOpen(true);
  };

  // Handler Item Baris Purchase Return
  const handlePrItemChange = (index, field, value) => {
    const val = value?.target !== undefined ? value.target.value : value;
    const updated = [...prForm.items];
    const currentItem = updated[index];
    const prod = products.find((p) => String(p.id) === String(field === 'product_id' ? val : currentItem.product_id));
    const isi = Number(prod?.isi_per_kemasan) || 1;

    if (field === 'product_id') {
      updated[index] = {
        ...currentItem,
        product_id: String(val),
        harga_satuan: prod ? Number(prod.harga_beli || prod.harga || 0) : 0,
        kemasan_count: '1',
        qty: isi,
      };
    } else if (field === 'kemasan_count') {
      const kNum = Number(val) || 0;
      const calcQty = Math.round(kNum * isi * 100) / 100;
      updated[index] = {
        ...currentItem,
        kemasan_count: val,
        qty: calcQty,
      };
    } else if (field === 'qty') {
      const qNum = Number(val) || 0;
      const calcKemasan = isi > 1 ? (qNum / isi).toFixed(2).replace(/\.00$/, '') : String(qNum);
      updated[index] = {
        ...currentItem,
        qty: val,
        kemasan_count: calcKemasan,
      };
    } else {
      updated[index] = { ...currentItem, [field]: val };
    }
    setPrForm((prev) => ({ ...prev, items: updated }));
  };

  const addPrItem = () => {
    const defaultProd = products[0];
    const isi = Number(defaultProd?.isi_per_kemasan) || 1;
    setPrForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: defaultProd ? String(defaultProd.id) : '',
          kemasan_count: '1',
          qty: isi,
          harga_satuan: defaultProd ? Number(defaultProd.harga_beli || defaultProd.harga || 0) : 0,
          catatan: '',
        },
      ],
    }));
  };

  const removePrItem = (idx) => {
    if (prForm.items.length <= 1) return;
    setPrForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  // Handler Item Baris Sales Return
  const handleSrItemChange = (index, field, value) => {
    const val = value?.target !== undefined ? value.target.value : value;
    const updated = [...srForm.items];
    const currentItem = updated[index];
    const prod = products.find((p) => String(p.id) === String(field === 'product_id' ? val : currentItem.product_id));
    const isi = Number(prod?.isi_per_kemasan) || 1;

    if (field === 'product_id') {
      updated[index] = {
        ...currentItem,
        product_id: String(val),
        harga_satuan: prod ? Number(prod.harga_jual || prod.harga || 0) : 0,
        kemasan_count: '1',
        qty: isi,
      };
    } else if (field === 'kemasan_count') {
      const kNum = Number(val) || 0;
      const calcQty = Math.round(kNum * isi * 100) / 100;
      updated[index] = {
        ...currentItem,
        kemasan_count: val,
        qty: calcQty,
      };
    } else if (field === 'qty') {
      const qNum = Number(val) || 0;
      const calcKemasan = isi > 1 ? (qNum / isi).toFixed(2).replace(/\.00$/, '') : String(qNum);
      updated[index] = {
        ...currentItem,
        qty: val,
        kemasan_count: calcKemasan,
      };
    } else {
      updated[index] = { ...currentItem, [field]: val };
    }
    setSrForm((prev) => ({ ...prev, items: updated }));
  };

  const addSrItem = () => {
    const defaultProd = products[0];
    const isi = Number(defaultProd?.isi_per_kemasan) || 1;
    setSrForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: defaultProd ? String(defaultProd.id) : '',
          kemasan_count: '1',
          qty: isi,
          harga_satuan: defaultProd ? Number(defaultProd.harga_jual || defaultProd.harga || 0) : 0,
          catatan: '',
        },
      ],
    }));
  };

  const removeSrItem = (idx) => {
    if (srForm.items.length <= 1) return;
    setSrForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  // Simpan Purchase Return
  const handleSavePurchaseReturn = async (e) => {
    e.preventDefault();
    if (!prForm.supplier_id || !prForm.warehouse_id) {
      alertError('Peringatan', 'Silakan pilih Supplier dan Gudang.');
      return;
    }
    if (!prForm.items || prForm.items.length === 0) {
      alertError('Peringatan', 'Minimal harus ada 1 item yang diretur.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...prForm,
        supplier_id: Number(prForm.supplier_id),
        warehouse_id: Number(prForm.warehouse_id),
        items: prForm.items.map((it) => ({
          product_id: Number(it.product_id),
          qty: Number(it.qty),
          harga_satuan: Number(it.harga_satuan),
          catatan: it.catatan,
        })),
      };
      await api.post('/returns/purchase', payload);
      toastSuccess('Berhasil!', 'Retur pembelian berhasil dicatat & jurnal otomatis terposting.');
      setPurchaseModalOpen(false);
      loadData();
    } catch (err) {
      alertError('Gagal Menyimpan Retur', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Simpan Sales Return
  const handleSaveSalesReturn = async (e) => {
    e.preventDefault();
    if (!srForm.customer_id || !srForm.warehouse_id) {
      alertError('Peringatan', 'Silakan pilih Customer dan Gudang penerima.');
      return;
    }
    if (!srForm.items || srForm.items.length === 0) {
      alertError('Peringatan', 'Minimal harus ada 1 item yang diretur.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...srForm,
        customer_id: Number(srForm.customer_id),
        warehouse_id: Number(srForm.warehouse_id),
        kembali_ke_stok: Boolean(srForm.kembali_ke_stok),
        items: srForm.items.map((it) => ({
          product_id: Number(it.product_id),
          qty: Number(it.qty),
          harga_satuan: Number(it.harga_satuan),
          catatan: it.catatan,
        })),
      };
      await api.post('/returns/sales', payload);
      toastSuccess('Berhasil!', 'Retur penjualan berhasil dicatat & jurnal otomatis terposting.');
      setSalesModalOpen(false);
      loadData();
    } catch (err) {
      alertError('Gagal Menyimpan Retur', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Total Calculation
  const prTotalNominal = prForm.items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.harga_satuan) || 0),
    0
  );
  const srTotalNominal = srForm.items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.harga_satuan) || 0),
    0
  );

  const handleExportExcel = () => {
    if (activeTab === 'PURCHASE') {
      const headers = [
        'No. Retur',
        'Tanggal',
        'Kode Supplier',
        'Nama Supplier',
        'Gudang',
        'Metode Kompensasi',
        'Total Nominal (Rp)',
        'Alasan Retur',
      ];
      const data = filteredList.map((row) => [
        row.no_return || '',
        formatDate(row.tanggal),
        row.kode_supplier || '',
        row.nama_supplier || '',
        row.nama_gudang || '',
        SETTLEMENT_PURCHASE[row.tipe_penyelesaian]?.label || row.tipe_penyelesaian,
        row.total_nominal ?? 0,
        row.alasan_retur || '',
      ]);
      exportToExcel('Rekap_Retur_Pembelian_Supplier', headers, data);
    } else {
      const headers = [
        'No. Retur',
        'Tanggal',
        'Kode Customer',
        'Nama Customer',
        'Gudang',
        'Metode Kompensasi',
        'Kembali Ke Stok',
        'Total Nominal (Rp)',
        'Alasan Retur',
      ];
      const data = filteredList.map((row) => [
        row.no_return || '',
        formatDate(row.tanggal),
        row.kode_customer || '',
        row.nama_customer || '',
        row.nama_gudang || '',
        SETTLEMENT_SALES[row.tipe_penyelesaian]?.label || row.tipe_penyelesaian,
        row.kembali_ke_stok ? 'Ya' : 'Tidak',
        row.total_nominal ?? 0,
        row.alasan_retur || '',
      ]);
      exportToExcel('Rekap_Retur_Penjualan_Customer', headers, data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Retur Penjualan & Pembelian</h1>
          <p className="text-sm text-slate-500 mt-1">
            Penanganan retur barang rusak/cacat/klaim garansi dengan pemotongan stok otomatis dan sinkronisasi jurnal akuntansi.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </button>
          {activeTab === 'PURCHASE' ? (
            <button
              onClick={openNewPurchaseReturn}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition"
            >
              <RotateCcw className="w-4 h-4" />
              Catat Retur Pembelian
            </button>
          ) : (
            <button
              onClick={openNewSalesReturn}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition"
            >
              <Undo2 className="w-4 h-4" />
              Catat Retur Penjualan
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Retur Pembelian</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{purchaseReturns.length} Transaksi</p>
            <p className="text-xs text-indigo-600 font-semibold mt-1">{formatRupiah(totalPurchaseReturnVal)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Undo2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Retur Penjualan</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{salesReturns.length} Transaksi</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">{formatRupiah(totalSalesReturnVal)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Kredit Nota AP (Utang)</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">
              {purchaseReturns.filter((r) => r.tipe_penyelesaian === 'POTONG_UTANG').length} Transaksi
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Jurnal Otomatis Terposting</p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">
              {purchaseReturns.filter((r) => r.journal_id).length + salesReturns.filter((r) => r.journal_id).length} Jurnal
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Tab & Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg w-fit">
            <button
              onClick={() => {
                setActiveTab('PURCHASE');
                setPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'PURCHASE'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Retur Pembelian (Supplier)
            </button>
            <button
              onClick={() => {
                setActiveTab('SALES');
                setPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'SALES'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Retur Penjualan (Customer)
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No Retur, Supplier, Customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span className="text-sm font-medium">Memuat data transaksi retur...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Undo2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Transaksi Retur</p>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'PURCHASE'
                ? 'Klik "Catat Retur Pembelian" untuk merekam retur barang ke supplier.'
                : 'Klik "Catat Retur Penjualan" untuk merekam retur barang dari pelanggan.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">No. Retur</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">{activeTab === 'PURCHASE' ? 'Supplier' : 'Customer'}</th>
                    <th className="py-3 px-4">Gudang</th>
                    <th className="py-3 px-4">Metode Kompensasi</th>
                    {activeTab === 'SALES' && <th className="py-3 px-4">Stok Gudang</th>}
                    <th className="py-3 px-4 text-right">Total Nominal</th>
                    <th className="py-3 px-4">Status & Jurnal</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((row) => {
                    const st =
                      activeTab === 'PURCHASE'
                        ? SETTLEMENT_PURCHASE[row.tipe_penyelesaian] || { label: row.tipe_penyelesaian, color: 'bg-slate-100' }
                        : SETTLEMENT_SALES[row.tipe_penyelesaian] || { label: row.tipe_penyelesaian, color: 'bg-slate-100' };

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                          {row.no_return}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{formatDate(row.tanggal)}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-800">
                            {activeTab === 'PURCHASE' ? row.nama_supplier : row.nama_customer}
                          </p>
                          <p className="text-xs text-slate-400">
                            {activeTab === 'PURCHASE' ? row.kode_supplier : row.kode_customer}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {row.nama_gudang || '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        {activeTab === 'SALES' && (
                          <td className="py-3.5 px-4">
                            {row.kembali_ke_stok ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Ya (Restock)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Tidak (Dimusnahkan)
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                          {formatRupiah(row.total_nominal)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {row.status}
                            </span>
                            {row.journal_id && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded w-fit">
                                <BookOpen className="w-3 h-3" />
                                Jurnal #{row.journal_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedReturn(row);
                              setDetailModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
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
              onPage={setPage}
              totalItems={filteredList.length}
              pageSize={pageSize}
              onPageSize={setPageSize}
              label="transaksi retur"
            />
          </>
        )}
      </div>

      {/* MODAL 1: Catat Retur Pembelian */}
      <Modal
        open={purchaseModalOpen}
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title="Catat Retur Pembelian ke Supplier"
        maxWidth="max-w-6xl"
      >
        <form onSubmit={handleSavePurchaseReturn} className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Informasi Integrasi Otomatis:</strong> Barang yang diretur akan otomatis dipotong dari stok gudang, dan sistem akan membuat jurnal akuntansi (Debit Utang Usaha/Kas, Kredit Persediaan Barang). Saldo utang supplier akan disesuaikan otomatis jika opsi potong utang dipilih.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier *</label>
              <SearchableSelect
                value={prForm.supplier_id}
                onChange={(val) => setPrForm((prev) => ({ ...prev, supplier_id: val?.target ? val.target.value : val }))}
                placeholder="Pilih Supplier..."
                required
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama_supplier} ({s.kode_supplier})
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gudang Asal Barang *</label>
              <SearchableSelect
                value={prForm.warehouse_id}
                onChange={(val) => setPrForm((prev) => ({ ...prev, warehouse_id: val?.target ? val.target.value : val }))}
                placeholder="Pilih Gudang..."
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nama_gudang} ({w.kode_gudang})
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Retur *</label>
              <input
                type="date"
                required
                value={prForm.tanggal}
                onChange={(e) => setPrForm((prev) => ({ ...prev, tanggal: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Metode Penyelesaian *</label>
              <SearchableSelect
                value={prForm.tipe_penyelesaian}
                onChange={(val) => setPrForm((prev) => ({ ...prev, tipe_penyelesaian: val?.target ? val.target.value : val }))}
              >
                <option value="POTONG_UTANG">Potong Utang Usaha (AP Invoice Offset)</option>
                <option value="PENGEMBALIAN_KAS">Pengembalian Tunai / Kas / Bank Masuk</option>
              </SearchableSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Retur / Masalah Barang *</label>
              <input
                type="text"
                required
                placeholder="Misal: Cacat kemasan, produk kedaluwarsa, tidak sesuai PO"
                value={prForm.alasan_retur}
                onChange={(e) => setPrForm((prev) => ({ ...prev, alasan_retur: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Produk yang Diretur</span>
              <button
                type="button"
                onClick={addPrItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Produk
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 w-[35%]">Produk yang Diretur</th>
                    <th className="px-3 py-2.5 w-32 text-center">Jml Kemasan (BOX)</th>
                    <th className="px-3 py-2.5 w-36 text-right">Total Qty (PCS)</th>
                    <th className="px-3 py-2.5 w-36 text-right">Harga Beli (Rp)</th>
                    <th className="px-3 py-2.5 w-36 text-right">Subtotal (Rp)</th>
                    <th className="px-3 py-2.5">Catatan Item</th>
                    <th className="px-3 py-2.5 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {prForm.items.map((it, idx) => {
                    const prod = products.find((p) => String(p.id) === String(it.product_id));
                    const isi = Number(prod?.isi_per_kemasan) || 1;
                    const satuanBesar = prod?.satuan_besar || 'BOX';
                    const satuanKecil = prod?.satuan || 'PCS';
                    const sub = (Number(it.qty) || 0) * (Number(it.harga_satuan) || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 align-top">
                          <SearchableSelect
                            value={it.product_id}
                            onChange={(val) => handlePrItemChange(idx, 'product_id', val)}
                            placeholder="Pilih Produk..."
                            required
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nama_produk} ({p.kode_produk})
                              </option>
                            ))}
                          </SearchableSelect>
                          {prod && (
                            <div className="mt-1 text-[11px] text-slate-500 font-mono flex items-center gap-1">
                              <span>Kode: {prod.kode_produk}</span>
                              {isi > 1 && (
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-sans font-medium">
                                  1 {satuanBesar} = {isi} {satuanKecil}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2.5 align-top text-center">
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-center font-bold focus:border-indigo-500 focus:outline-none"
                              value={it.kemasan_count || '1'}
                              onChange={(e) => handlePrItemChange(idx, 'kemasan_count', e.target.value)}
                              placeholder="1"
                            />
                            <span className="block text-[10px] text-slate-400 mt-0.5 font-semibold">
                              {satuanBesar}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 align-top text-right">
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-bold text-indigo-700 focus:border-indigo-500 focus:outline-none"
                              value={it.qty}
                              onChange={(e) => handlePrItemChange(idx, 'qty', e.target.value)}
                              placeholder="Qty PCS"
                              required
                            />
                            <span className="block text-[10px] text-slate-400 mt-0.5 font-semibold">
                              {satuanKecil}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 align-top text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-semibold focus:border-indigo-500 focus:outline-none"
                            value={it.harga_satuan}
                            onChange={(e) => handlePrItemChange(idx, 'harga_satuan', e.target.value)}
                          />
                        </td>

                        <td className="px-3 py-2.5 align-top text-right font-bold text-slate-800 pt-3">
                          {formatRupiah(sub)}
                        </td>

                        <td className="px-3 py-2.5 align-top">
                          <input
                            type="text"
                            placeholder="Ket. kondisi / alasan retur item..."
                            value={it.catatan || ''}
                            onChange={(e) => handlePrItemChange(idx, 'catatan', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                        </td>

                        <td className="px-3 py-2.5 align-top text-center pt-3">
                          <button
                            type="button"
                            disabled={prForm.items.length <= 1}
                            onClick={() => removePrItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-700">Total Nilai Retur Pembelian:</span>
              <span className="text-lg font-extrabold text-indigo-700">{formatRupiah(prTotalNominal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPurchaseModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Simpan & Posting Retur Beli'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Catat Retur Penjualan */}
      <Modal
        open={salesModalOpen}
        isOpen={salesModalOpen}
        onClose={() => setSalesModalOpen(false)}
        title="Catat Retur Penjualan dari Pelanggan"
        maxWidth="max-w-6xl"
      >
        <form onSubmit={handleSaveSalesReturn} className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Informasi Integrasi Otomatis:</strong> Retur penjualan akan memotong piutang pelanggan (Kredit Nota) atau mengembalikan kas, serta memposting jurnal (Debit Retur Penjualan, Kredit Piutang Usaha/Kas). Jika opsi 'Restock ke Gudang' aktif, stok fisik di gudang akan otomatis bertambah kembali.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Rumah Sakit *</label>
              <SearchableSelect
                value={srForm.customer_id}
                onChange={(val) => setSrForm((prev) => ({ ...prev, customer_id: val?.target ? val.target.value : val }))}
                placeholder="Pilih Customer..."
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama_customer} ({c.kode_customer})
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gudang Penerima Barang *</label>
              <SearchableSelect
                value={srForm.warehouse_id}
                onChange={(val) => setSrForm((prev) => ({ ...prev, warehouse_id: val?.target ? val.target.value : val }))}
                placeholder="Pilih Gudang..."
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nama_gudang} ({w.kode_gudang})
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Retur *</label>
              <input
                type="date"
                required
                value={srForm.tanggal}
                onChange={(e) => setSrForm((prev) => ({ ...prev, tanggal: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Metode Kompensasi *</label>
              <SearchableSelect
                value={srForm.tipe_penyelesaian}
                onChange={(val) => setSrForm((prev) => ({ ...prev, tipe_penyelesaian: val?.target ? val.target.value : val }))}
              >
                <option value="POTONG_PIUTANG">Kredit Nota (Potong Tagihan Piutang)</option>
                <option value="PENGEMBALIAN_KAS">Refund Tunai / Kas / Bank Keluar</option>
              </SearchableSelect>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Retur dari Pelanggan *</label>
              <input
                type="text"
                required
                placeholder="Misal: Barang tidak sesuai pesanan, kemasan penyok dalam pengiriman"
                value={srForm.alasan_retur}
                onChange={(e) => setSrForm((prev) => ({ ...prev, alasan_retur: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
            <input
              type="checkbox"
              id="kembaliStokCheck"
              checked={srForm.kembali_ke_stok}
              onChange={(e) => setSrForm((prev) => ({ ...prev, kembali_ke_stok: e.target.checked }))}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <label htmlFor="kembaliStokCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
              <strong>Kembalikan fisik barang ke stok gudang:</strong> Centang jika barang masih layak atau dimasukkan ke Gudang Karantina untuk inspeksi QC ulang. Uncheck jika barang rusak total/dibuang.
            </label>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Produk yang Diretur</span>
              <button
                type="button"
                onClick={addSrItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Produk
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 w-[35%]">Produk yang Diretur</th>
                    <th className="px-3 py-2.5 w-32 text-center">Jml Kemasan (BOX)</th>
                    <th className="px-3 py-2.5 w-36 text-right">Total Qty (PCS)</th>
                    <th className="px-3 py-2.5 w-36 text-right">Harga Jual (Rp)</th>
                    <th className="px-3 py-2.5 w-36 text-right">Subtotal (Rp)</th>
                    <th className="px-3 py-2.5">Catatan Item</th>
                    <th className="px-3 py-2.5 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {srForm.items.map((it, idx) => {
                    const prod = products.find((p) => String(p.id) === String(it.product_id));
                    const isi = Number(prod?.isi_per_kemasan) || 1;
                    const satuanBesar = prod?.satuan_besar || 'BOX';
                    const satuanKecil = prod?.satuan || 'PCS';
                    const sub = (Number(it.qty) || 0) * (Number(it.harga_satuan) || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 align-top">
                          <SearchableSelect
                            value={it.product_id}
                            onChange={(val) => handleSrItemChange(idx, 'product_id', val)}
                            placeholder="Pilih Produk..."
                            required
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nama_produk} ({p.kode_produk})
                              </option>
                            ))}
                          </SearchableSelect>
                          {prod && (
                            <div className="mt-1 text-[11px] text-slate-500 font-mono flex items-center gap-1">
                              <span>Kode: {prod.kode_produk}</span>
                              {isi > 1 && (
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-sans font-medium">
                                  1 {satuanBesar} = {isi} {satuanKecil}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2.5 align-top text-center">
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-center font-bold focus:border-emerald-500 focus:outline-none"
                              value={it.kemasan_count || '1'}
                              onChange={(e) => handleSrItemChange(idx, 'kemasan_count', e.target.value)}
                              placeholder="1"
                            />
                            <span className="block text-[10px] text-slate-400 mt-0.5 font-semibold">
                              {satuanBesar}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 align-top text-right">
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-bold text-emerald-700 focus:border-emerald-500 focus:outline-none"
                              value={it.qty}
                              onChange={(e) => handleSrItemChange(idx, 'qty', e.target.value)}
                              placeholder="Qty PCS"
                              required
                            />
                            <span className="block text-[10px] text-slate-400 mt-0.5 font-semibold">
                              {satuanKecil}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 align-top text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-semibold focus:border-emerald-500 focus:outline-none"
                            value={it.harga_satuan}
                            onChange={(e) => handleSrItemChange(idx, 'harga_satuan', e.target.value)}
                          />
                        </td>

                        <td className="px-3 py-2.5 align-top text-right font-bold text-slate-800 pt-3">
                          {formatRupiah(sub)}
                        </td>

                        <td className="px-3 py-2.5 align-top">
                          <input
                            type="text"
                            placeholder="Ket. kondisi / alasan retur item..."
                            value={it.catatan || ''}
                            onChange={(e) => handleSrItemChange(idx, 'catatan', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                          />
                        </td>

                        <td className="px-3 py-2.5 align-top text-center pt-3">
                          <button
                            type="button"
                            disabled={srForm.items.length <= 1}
                            onClick={() => removeSrItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-700">Total Nilai Retur Penjualan:</span>
              <span className="text-lg font-extrabold text-emerald-700">{formatRupiah(srTotalNominal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSalesModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : 'Simpan & Posting Retur Jual'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Detail Retur */}
      <Modal
        open={detailModalOpen}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Detail Transaksi Retur - ${selectedReturn?.no_return || ''}`}
        maxWidth="max-w-5xl"
      >
        {selectedReturn && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-400 block">No. Transaksi</span>
                <span className="text-sm font-bold text-slate-800">{selectedReturn.no_return}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Tanggal Retur</span>
                <span className="text-sm font-semibold text-slate-700">{formatDate(selectedReturn.tanggal)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Entitas Terkait</span>
                <span className="text-sm font-semibold text-slate-700">
                  {selectedReturn.nama_supplier || selectedReturn.nama_customer || '-'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Gudang</span>
                <span className="text-sm font-semibold text-slate-700">{selectedReturn.nama_gudang || '-'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600">
              <strong>Alasan Retur:</strong> {selectedReturn.alasan_retur || '-'}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Kode</th>
                    <th className="py-2.5 px-4">Nama Produk</th>
                    <th className="py-2.5 px-4 text-right">Qty Retur</th>
                    <th className="py-2.5 px-4 text-right">Harga Satuan</th>
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                    <th className="py-2.5 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedReturn.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-700">{item.kode_produk}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{item.nama_produk}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        <p>{formatNumber(item.qty)} {item.satuan}</p>
                        {Number(item.isi_per_kemasan) > 1 && (
                          <p className="text-[11px] text-indigo-600 font-medium">
                            ≈ {formatNumber(Number((item.qty / item.isi_per_kemasan).toFixed(1)))} {item.satuan_besar || 'BOX'}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">{formatRupiah(item.harga_satuan)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-800">{formatRupiah(item.subtotal)}</td>
                      <td className="py-2.5 px-4 text-slate-500">{item.catatan || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-slate-50 p-3 border-t border-slate-200 text-right">
                <span className="text-xs text-slate-500 mr-2">Grand Total Retur:</span>
                <span className="text-base font-extrabold text-slate-800">{formatRupiah(selectedReturn.total_nominal)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
