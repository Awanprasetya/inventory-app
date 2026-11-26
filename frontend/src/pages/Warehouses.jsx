import { useEffect, useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  MapPin,
  User,
  Phone,
  Package,
  CheckCircle2,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Clock,
  XCircle,
  Check,
  X,
  PlusCircle,
} from 'lucide-react';
import Swal from 'sweetalert2';
import api, { getErrorMessage, formatDate, formatNumber } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { confirmDelete, confirmAction, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';
import {
  getProductUnits,
  getUnitDropdownOptions,
  convertToPcs,
  getConversionPreviewText,
} from '../utils/unitHelper.js';

const PAGE_SIZE = 10;

const WAREHOUSE_TYPES = [
  { value: 'UTAMA', label: 'Gudang Utama & Logistik' },
  { value: 'FARMASI', label: 'Gudang Farmasi & Obat-obatan' },
  { value: 'KARANTINA', label: 'Gudang Karantina & Retur' },
  { value: 'CABANG', label: 'Gudang Cabang / Mitra RS' },
];

export default function Warehouses() {
  const { user } = useAuth();
  const userRoleNorm = (user?.role || '').toUpperCase();
  const isSuperAdmin = ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes(userRoleNorm) || user?.username === 'admin';
  const isAdminOrSuper = ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN', 'ADMINISTRATOR', 'ADMIN'].includes(userRoleNorm);
  const userWarehouseId = user?.warehouse_id ? Number(user.warehouse_id) : null;
  const canApprove = isAdminOrSuper || ['ADMIN_GUDANG', 'WAREHOUSE'].includes(userRoleNorm);

  const [activeTab, setActiveTab] = useState('MASTER'); // 'MASTER' | 'TRANSFERS'
  const [transferStatusFilter, setTransferStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED'
  const [warehouses, setWarehouses] = useState([]);
  const [allWarehouses, setAllWarehouses] = useState([]); // Seluruh gudang aktif lintas PT untuk tujuan transfer
  const [transfers, setTransfers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sourceProducts, setSourceProducts] = useState([]); // Stok per produk di gudang asal
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal Master Gudang
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState(null);
  const [whForm, setWhForm] = useState({
    kode_gudang: '',
    nama_gudang: '',
    tipe_gudang: 'UTAMA',
    alamat: '',
    penanggung_jawab: '',
    telepon: '',
  });

  // Modal Transfer Stok
  const [trfModalOpen, setTrfModalOpen] = useState(false);
  const [trfForm, setTrfForm] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    catatan: '',
    items: [],
  });

  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [whRes, allWhRes, trfRes, prodRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/warehouses', { params: { include_other_tenants: 1 } }).catch(() => ({ data: { data: [] } })),
        api.get('/warehouses/transfers'),
        api.get('/products'),
      ]);

      const ownWhs = whRes.data?.data || [];
      if (whRes.data.success) setWarehouses(ownWhs);
      setAllWarehouses(allWhRes.data?.data?.length ? allWhRes.data.data : ownWhs);
      if (trfRes.data.success) setTransfers(trfRes.data.data || []);
      if (prodRes.data.success) setProducts(prodRes.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Muat stok produk spesifik di gudang asal saat modal transfer terbuka & gudang asal berubah
  useEffect(() => {
    if (!trfModalOpen || !trfForm.from_warehouse_id) {
      setSourceProducts([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get('/products', {
          params: { warehouse_id: trfForm.from_warehouse_id },
        });
        if (res.data.success) {
          setSourceProducts(res.data.data || []);
        }
      } catch (_) {
        setSourceProducts([]);
      }
    })();
  }, [trfModalOpen, trfForm.from_warehouse_id]);

  // Handlers Master Gudang
  const handleOpenAddWh = () => {
    setEditingWh(null);
    setWhForm({
      kode_gudang: `GDG-0${warehouses.length + 1}`,
      nama_gudang: '',
      tipe_gudang: 'UTAMA',
      alamat: '',
      penanggung_jawab: '',
      telepon: '',
    });
    setWhModalOpen(true);
  };

  const handleOpenEditWh = (wh) => {
    setEditingWh(wh);
    setWhForm({
      kode_gudang: wh.kode_gudang,
      nama_gudang: wh.nama_gudang,
      tipe_gudang: wh.tipe_gudang,
      alamat: wh.alamat || '',
      penanggung_jawab: wh.penanggung_jawab || '',
      telepon: wh.telepon || '',
    });
    setWhModalOpen(true);
  };

  const handleSaveWh = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingWh) {
        const res = await api.put(`/warehouses/${editingWh.id}`, whForm);
        toastSuccess(res.data.message);
      } else {
        const res = await api.post('/warehouses', whForm);
        toastSuccess(res.data.message);
      }
      setWhModalOpen(false);
      loadData();
    } catch (err) {
      alertError('Gagal Menyimpan Gudang', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWh = async (wh) => {
    const isConfirmed = await confirmDelete({
      title: `Hapus Gudang ${wh.nama_gudang}?`,
      text: 'Gudang hanya bisa dihapus jika tidak memiliki stok fisik aktif.',
    });
    if (!isConfirmed) return;

    try {
      const res = await api.delete(`/warehouses/${wh.id}`);
      toastSuccess(res.data.message);
      loadData();
    } catch (err) {
      alertError('Gagal Menghapus', getErrorMessage(err));
    }
  };

  // Helper membuat baris item transfer default
  const createDefaultTrfItem = (prodObj = null) => {
    if (!prodObj) {
      return {
        product_id: '',
        satuan_transfer: 'PCS',
        qty_input: 1,
        qty: 1,
        catatan: '',
      };
    }
    const u = getProductUnits(prodObj);
    const chosenUnit = u.hasBigUnit && u.isiBoxPcs > 1 ? u.bigUnit : u.baseUnit;
    const rasio = convertToPcs(1, chosenUnit, prodObj);
    return {
      product_id: String(prodObj.id),
      satuan_transfer: chosenUnit,
      qty_input: 1,
      qty: rasio,
      catatan: '',
    };
  };

  // Handlers Transfer Stok
  const handleOpenAddTrf = () => {
    const destPool = allWarehouses.length > 0 ? allWarehouses : warehouses;
    const fromWh = userWarehouseId && !isAdminOrSuper
      ? String(userWarehouseId)
      : (warehouses[0]?.id ? String(warehouses[0].id) : '');
    const otherWh = destPool.find((w) => String(w.id) !== fromWh);
    const toWh = otherWh?.id ? String(otherWh.id) : (destPool[1]?.id ? String(destPool[1].id) : '');
    const firstProd = products[0] || null;

    setTrfForm({
      from_warehouse_id: fromWh,
      to_warehouse_id: toWh,
      tanggal: new Date().toISOString().split('T')[0],
      catatan: '',
      items: [createDefaultTrfItem(firstProd)],
    });
    setTrfModalOpen(true);
  };

  const handleAddTrfItem = () => {
    setTrfForm((prev) => ({
      ...prev,
      items: [...prev.items, createDefaultTrfItem(products[0] || null)],
    }));
  };

  const handleRemoveTrfItem = (index) => {
    setTrfForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleTrfItemChange = (index, field, value) => {
    setTrfForm((prev) => {
      const updated = [...prev.items];
      const current = { ...updated[index], [field]: value };
      const targetProdId = field === 'product_id' ? value : current.product_id;
      const matched = products.find((p) => String(p.id) === String(targetProdId));

      if (field === 'product_id' && matched) {
        const u = getProductUnits(matched);
        const chosenUnit = u.hasBigUnit && u.isiBoxPcs > 1 ? u.bigUnit : u.baseUnit;
        const rasio = convertToPcs(1, chosenUnit, matched);
        current.satuan_transfer = chosenUnit;
        current.qty_input = 1;
        current.qty = rasio;
      } else if ((field === 'qty_input' || field === 'satuan_transfer') && matched) {
        const chosenUnit = field === 'satuan_transfer' ? value : (current.satuan_transfer || matched.satuan || 'PCS');
        const rasio = convertToPcs(1, chosenUnit, matched);
        const qInput = Number(field === 'qty_input' ? value : current.qty_input) || 0;
        current.qty = Math.round(qInput * rasio * 100) / 100;
      }

      updated[index] = current;
      return { ...prev, items: updated };
    });
  };

  const handleSaveTransfer = async (e) => {
    e.preventDefault();
    if (!trfForm.from_warehouse_id || !trfForm.to_warehouse_id) {
      alertError('Peringatan', 'Pilih gudang asal dan gudang tujuan!');
      return;
    }
    if (trfForm.from_warehouse_id === trfForm.to_warehouse_id) {
      alertError('Peringatan', 'Gudang asal dan tujuan tidak boleh sama!');
      return;
    }
    if (trfForm.items.length === 0 || trfForm.items.some((it) => !it.product_id)) {
      alertError('Peringatan', 'Pilih minimal 1 barang yang valid untuk ditransfer!');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...trfForm,
        from_warehouse_id: Number(trfForm.from_warehouse_id),
        to_warehouse_id: Number(trfForm.to_warehouse_id),
        items: trfForm.items.map((it) => {
          const pObj = products.find((p) => String(p.id) === String(it.product_id));
          const rasio = convertToPcs(1, it.satuan_transfer, pObj);
          const qInput = Number(it.qty_input) || 1;
          const qBase = Number(it.qty) > 0 ? Math.round(Number(it.qty)) : Math.round(qInput * rasio);
          return {
            product_id: Number(it.product_id),
            satuan_transfer: it.satuan_transfer || pObj?.satuan || 'PCS',
            qty_input: qInput,
            qty: qBase,
            catatan: it.catatan,
          };
        }),
      };

      const res = await api.post('/warehouses/transfers', payload);
      toastSuccess(res.data.message);
      setTrfModalOpen(false);
      setActiveTab('TRANSFERS');
      loadData();
    } catch (err) {
      alertError('Gagal Mengajukan Transfer', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Approval Handlers
  const handleApproveTransfer = async (trf) => {
    const confirmed = await confirmAction({
      title: `Setujui Transfer ${trf.no_transfer}?`,
      text: `Stok fisik barang akan langsung dipotong dari "${trf.from_warehouse_nama}" dan ditambahkan ke "${trf.to_warehouse_nama}" serta dicatat di Kartu Stok.`,
      confirmButtonText: 'Ya, Setujui & Pindahkan Stok',
      confirmButtonColor: '#059669',
      icon: 'question',
    });
    if (!confirmed) return;

    setProcessingId(trf.id);
    try {
      const res = await api.put(`/warehouses/transfers/${trf.id}/approve`);
      toastSuccess(res.data.message);
      loadData();
    } catch (err) {
      alertError('Gagal Menyetujui Transfer', getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTransfer = async (trf) => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: `Tolak Pengajuan ${trf.no_transfer}?`,
      input: 'text',
      inputLabel: 'Alasan penolakan (opsional)',
      inputPlaceholder: 'cth: Stok dibutuhkan di gudang pusat...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Tolak Transfer',
      cancelButtonText: 'Batal',
      reverseButtons: true,
    });
    if (!isConfirmed) return;

    setProcessingId(trf.id);
    try {
      const res = await api.put(`/warehouses/transfers/${trf.id}/reject`, { reason });
      toastSuccess(res.data.message);
      loadData();
    } catch (err) {
      alertError('Gagal Menolak Transfer', getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  // Filter & Count per Status Transfer
  const pendingCount = useMemo(
    () => transfers.filter((t) => (t.status || '').toUpperCase() === 'PENDING').length,
    [transfers]
  );

  const filteredTransfers = useMemo(() => {
    if (transferStatusFilter === 'ALL') return transfers;
    if (transferStatusFilter === 'COMPLETED') {
      return transfers.filter((t) => ['COMPLETED', 'APPROVED'].includes((t.status || '').toUpperCase()));
    }
    return transfers.filter((t) => (t.status || '').toUpperCase() === transferStatusFilter);
  }, [transfers, transferStatusFilter]);

  const { pageItems: paginatedTransfers, totalPages, safePage } = paginate(
    filteredTransfers,
    page,
    pageSize
  );

  const handleExportExcel = () => {
    if (activeTab === 'MASTER') {
      const headers = [
        'Kode Gudang',
        'Nama Gudang',
        'Tipe Gudang',
        'Alamat',
        'Penanggung Jawab',
        'Telepon',
        'Tanggal Terdaftar',
      ];
      const data = warehouses.map((wh) => {
        const typeObj = WAREHOUSE_TYPES.find((t) => t.value === wh.tipe_gudang);
        return [
          wh.kode_gudang || '',
          wh.nama_gudang || '',
          typeObj ? typeObj.label : wh.tipe_gudang,
          wh.alamat || '-',
          wh.penanggung_jawab || '-',
          wh.telepon || '-',
          formatDate(wh.created_at || wh.createdAt),
        ];
      });
      exportToExcel('Master_Daftar_Gudang', headers, data);
    } else {
      const headers = [
        'No. Transfer',
        'Tanggal',
        'Gudang Asal',
        'Gudang Tujuan',
        'Status',
        'Jumlah Item Barang',
        'Petugas Pengaju',
        'Approver',
        'Catatan / Referensi',
      ];
      const data = filteredTransfers.map((trf) => [
        trf.no_transfer || '',
        formatDate(trf.tanggal),
        `${trf.from_warehouse_kode || ''} - ${trf.from_warehouse_nama || ''}`,
        `${trf.to_warehouse_kode || ''} - ${trf.to_warehouse_nama || ''}`,
        trf.status || 'COMPLETED',
        trf.items?.length || 0,
        trf.created_by_name || 'Admin',
        trf.approved_by_name || '-',
        trf.catatan || '-',
      ]);
      exportToExcel('Riwayat_Transfer_Stok_Antar_Gudang', headers, data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            Manajemen Multi-Gudang & Transfer Stok
          </h1>
          <p className="text-sm text-slate-500">
            Pengelolaan lokasi gudang medis (Pusat, Farmasi, Karantina, Cabang) dan pergerakan mutasi stok antar lokasi dengan persetujuan (approval).
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
          {activeTab === 'MASTER' ? (
            isAdminOrSuper && (
              <button
                onClick={handleOpenAddWh}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                Tambah Gudang Baru
              </button>
            )
          ) : (
            <button
              onClick={handleOpenAddTrf}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Buat Transfer Stok
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('MASTER')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === 'MASTER'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Master Gudang ({warehouses.length})
        </button>
        <button
          onClick={() => setActiveTab('TRANSFERS')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === 'TRANSFERS'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transfer Antar Gudang ({transfers.length})
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300">
              {pendingCount} Menunggu Approval
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600 font-medium">Memuat data gudang & mutasi...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 flex flex-col items-center">
          <AlertCircle className="h-10 w-10 mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : activeTab === 'MASTER' ? (
        /* Tab 1: Master Gudang */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {wh.kode_gudang}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      wh.tipe_gudang === 'KARANTINA'
                        ? 'bg-purple-100 text-purple-800'
                        : wh.tipe_gudang === 'FARMASI'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {wh.tipe_gudang}
                  </span>
                </div>

                <h3 className="mt-2 text-base font-bold text-slate-900">{wh.nama_gudang}</h3>

                {wh.alamat && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
                    <span>{wh.alamat}</span>
                  </p>
                )}

                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> PIC:
                    </span>
                    <span className="font-medium text-slate-800">{wh.penanggung_jawab || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telepon:
                    </span>
                    <span>{wh.telepon || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Total Stok Fisik:
                    </span>
                    <span className="font-bold text-blue-700">
                      {wh.total_stok?.toLocaleString('id-ID')} unit
                    </span>
                  </div>
                </div>
              </div>

              {isAdminOrSuper && (
                <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleOpenEditWh(wh)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                    title="Edit Gudang"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWh(wh)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                    title="Hapus Gudang"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Tab 2: Transfer Stok Antar Gudang */
        <div className="space-y-4">
          {/* Filter Status Transfer */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: `Semua (${transfers.length})` },
              {
                id: 'PENDING',
                label: `Menunggu Approval (${pendingCount})`,
                badge: pendingCount > 0,
              },
              {
                id: 'COMPLETED',
                label: `Disetujui / Selesai (${
                  transfers.filter((t) => ['COMPLETED', 'APPROVED'].includes((t.status || '').toUpperCase())).length
                })`,
              },
              {
                id: 'REJECTED',
                label: `Ditolak (${transfers.filter((t) => (t.status || '').toUpperCase() === 'REJECTED').length})`,
              },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setTransferStatusFilter(f.id);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                  transferStatusFilter === f.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : f.badge
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {filteredTransfers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ArrowRightLeft className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p className="text-base font-semibold text-slate-700">
                  {transfers.length === 0
                    ? 'Belum Ada Mutasi Transfer Gudang'
                    : 'Tidak Ada Transfer pada Filter Status Ini'}
                </p>
                <p className="text-sm mt-1">
                  Pindahkan barang antar cabang atau ke gudang karantina dengan alur persetujuan (approval) yang aman.
                </p>
                {transfers.length === 0 && (
                  <button
                    onClick={handleOpenAddTrf}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Buat Transfer Pertama
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                      <tr>
                        <th className="px-4 py-3">No Transfer & Tgl</th>
                        <th className="px-4 py-3">Gudang Asal</th>
                        <th className="px-4 py-3">Gudang Tujuan</th>
                        <th className="px-4 py-3">Barang Ditransfer</th>
                        <th className="px-4 py-3">Catatan</th>
                        <th className="px-4 py-3">Petugas & Approver</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Aksi Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTransfers.map((trf) => {
                        const status = (trf.status || 'COMPLETED').toUpperCase();
                        const isPending = status === 'PENDING';
                        const isRejected = status === 'REJECTED';
                        const isBusy = processingId === trf.id;

                        return (
                          <tr key={trf.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <span>{trf.no_transfer}</span>
                                {trf.is_intercompany && (
                                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 border border-indigo-200">
                                    Lintas PT
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                <span>{formatDate(trf.tanggal)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-medium text-slate-800">{trf.from_warehouse_nama}</div>
                              <div className="text-xs text-slate-400 font-mono">
                                {trf.from_warehouse_kode}
                                {trf.from_tenant_nama && trf.is_intercompany ? ` • ${trf.from_tenant_nama}` : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-medium text-slate-800">{trf.to_warehouse_nama}</div>
                              <div className="text-xs text-slate-400 font-mono">
                                {trf.to_warehouse_kode}
                                {trf.to_tenant_nama && trf.is_intercompany ? ` • ${trf.to_tenant_nama}` : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="space-y-1">
                                {trf.items?.map((it, idx) => {
                                  const hasCustomUnit =
                                    it.satuan_transfer &&
                                    it.qty_input &&
                                    it.satuan_transfer.toUpperCase() !== (it.satuan || 'PCS').toUpperCase();
                                  return (
                                    <div key={idx} className="text-xs text-slate-700">
                                      <strong>{it.nama_produk}</strong>{' '}
                                      {hasCustomUnit ? (
                                        <span className="font-semibold text-indigo-700">
                                          ({formatNumber(it.qty_input)} {it.satuan_transfer} = {formatNumber(it.qty)} {it.satuan})
                                        </span>
                                      ) : (
                                        <span>
                                          ({formatNumber(it.qty)} {it.satuan})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-500">
                              <div>{trf.catatan || '-'}</div>
                              {trf.is_intercompany && (trf.no_so || trf.no_do || trf.no_po) && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {trf.no_so && (
                                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                                      SO: {trf.no_so}
                                    </span>
                                  )}
                                  {trf.no_do && (
                                    <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 border border-teal-200">
                                      DO: {trf.no_do}
                                    </span>
                                  )}
                                  {trf.no_po && (
                                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                      PO: {trf.no_po}
                                    </span>
                                  )}
                                </div>
                              )}
                              {isRejected && trf.rejected_reason && (
                                <div className="mt-1 text-[11px] font-semibold text-rose-600">
                                  Alasan Tolak: {trf.rejected_reason}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              <div className="text-slate-800 font-medium">
                                Pengaju: {trf.created_by_name || 'Admin'}
                              </div>
                              {trf.approved_by_name && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {isRejected ? 'Ditolak' : 'Disetujui'}: {trf.approved_by_name}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {isPending ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                  <Clock className="h-3 w-3" /> MENUNGGU APPROVAL
                                </span>
                              ) : isRejected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                                  <XCircle className="h-3 w-3" /> DITOLAK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="h-3 w-3" /> DISETUJUI & SELESAI
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {(() => {
                                if (!isPending || !canApprove) {
                                  return <span className="text-xs text-slate-400">-</span>;
                                }
                                const isOwnRequest =
                                  trf.created_by && user?.id && Number(trf.created_by) === Number(user.id);
                                const isDestTenant =
                                  !trf.is_intercompany ||
                                  (user?.tenant_id && Number(user.tenant_id) === Number(trf.to_tenant_id));
                                const isDestWarehouse =
                                  !userWarehouseId || Number(trf.to_warehouse_id) === userWarehouseId;
                                const canApproveRow =
                                  isSuperAdmin ||
                                  (isDestTenant && (isAdminOrSuper || (!isOwnRequest && isDestWarehouse)));

                                if (!canApproveRow) {
                                  return (
                                    <span className="inline-block rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                      {!isDestTenant
                                        ? `Menunggu Persetujuan ${trf.to_tenant_nama || 'PT Tujuan'}`
                                        : isOwnRequest
                                        ? 'Menunggu Gudang Tujuan'
                                        : `Khusus PIC ${trf.to_warehouse_kode || 'Tujuan'}`}
                                    </span>
                                  );
                                }

                                return (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleApproveTransfer(trf)}
                                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-2xs"
                                      title="Setujui & Eksekusi Pemindahan Stok"
                                    >
                                      {isBusy ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                      Setujui
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleRejectTransfer(trf)}
                                      className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 transition"
                                      title="Tolak Pengajuan Transfer"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Tolak
                                    </button>
                                  </div>
                                );
                              })()}
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
                    totalItems={filteredTransfers.length}
                    pageSize={pageSize}
                    onPageSize={(newSize) => {
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    label="mutasi transfer"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Gudang */}
      <Modal
        isOpen={whModalOpen}
        onClose={() => setWhModalOpen(false)}
        title={editingWh ? 'Edit Informasi Gudang' : 'Tambah Gudang Penyimpanan Baru'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveWh} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Kode Gudang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={Boolean(editingWh)}
              value={whForm.kode_gudang}
              onChange={(e) => setWhForm({ ...whForm, kode_gudang: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Nama Gudang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={whForm.nama_gudang}
              onChange={(e) => setWhForm({ ...whForm, nama_gudang: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="cth: Gudang Distribusi Farmasi"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Tipe Gudang <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={whForm.tipe_gudang}
              onChange={(e) => setWhForm({ ...whForm, tipe_gudang: e.target.value })}
              options={WAREHOUSE_TYPES}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Alamat Lengkap
            </label>
            <textarea
              rows={2}
              value={whForm.alamat}
              onChange={(e) => setWhForm({ ...whForm, alamat: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Alamat fasilitas gudang..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Penanggung Jawab (PIC)
              </label>
              <input
                type="text"
                value={whForm.penanggung_jawab}
                onChange={(e) => setWhForm({ ...whForm, penanggung_jawab: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                No Telepon
              </label>
              <input
                type="text"
                value={whForm.telepon}
                onChange={(e) => setWhForm({ ...whForm, telepon: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setWhModalOpen(false)}
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
              Simpan Gudang
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Buat Transfer Stok Antar Gudang (Kolom Satuan ala PO + Info Approval) */}
      <Modal
        isOpen={trfModalOpen}
        onClose={() => setTrfModalOpen(false)}
        title="Formulir Pengajuan Transfer Stok Antar Gudang"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800 flex items-start gap-2">
            <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Pengajuan transfer berstatus <strong>Menunggu Approval</strong> terlebih dahulu. Stok gudang asal baru akan berpindah ke gudang tujuan setelah pengajuan disetujui (Approved).
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Gudang Asal <span className="text-red-500">*</span>
              </label>
              {userWarehouseId && !isAdminOrSuper ? (
                <div className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  {warehouses.find((w) => w.id === userWarehouseId)
                    ? `${warehouses.find((w) => w.id === userWarehouseId).kode_gudang} - ${warehouses.find((w) => w.id === userWarehouseId).nama_gudang}`
                    : user?.nama_gudang || 'Gudang Tugas'}
                </div>
              ) : (
                <SearchableSelect
                  value={trfForm.from_warehouse_id}
                  onChange={(e) => setTrfForm({ ...trfForm, from_warehouse_id: e.target.value })}
                  options={warehouses.map((w) => ({ value: String(w.id), label: `${w.kode_gudang} - ${w.nama_gudang}` }))}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Gudang Tujuan <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={trfForm.to_warehouse_id}
                onChange={(e) => setTrfForm({ ...trfForm, to_warehouse_id: e.target.value })}
                options={(allWarehouses.length > 0 ? allWarehouses : warehouses)
                  .filter((w) => String(w.id) !== String(trfForm.from_warehouse_id))
                  .map((w) => {
                    const isOtherPt = user?.tenant_id && w.tenant_id && Number(w.tenant_id) !== Number(user.tenant_id);
                    const ptLabel = isOtherPt && w.nama_perusahaan ? ` [${w.nama_perusahaan}]` : '';
                    return {
                      value: String(w.id),
                      label: `${w.kode_gudang} - ${w.nama_gudang}${ptLabel}`,
                    };
                  })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tanggal Transfer <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={trfForm.tanggal}
                onChange={(e) => setTrfForm({ ...trfForm, tanggal: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {(() => {
            const destList = allWarehouses.length > 0 ? allWarehouses : warehouses;
            const fromObj = warehouses.find((w) => String(w.id) === String(trfForm.from_warehouse_id));
            const toObj = destList.find((w) => String(w.id) === String(trfForm.to_warehouse_id));
            const isCrossPt = fromObj && toObj && Number(fromObj.tenant_id) !== Number(toObj.tenant_id);
            if (!isCrossPt) return null;
            return (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-3.5 py-2.5 text-xs text-indigo-900 flex items-start gap-2">
                <ArrowRightLeft className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                <span>
                  <strong>Transfer Lintas Perusahaan ({fromObj.nama_perusahaan || 'PT Asal'} → {toObj.nama_perusahaan || 'PT Tujuan'}):</strong>{' '}
                  Setelah disetujui oleh <strong>{toObj.nama_perusahaan || 'PT Tujuan'}</strong>, sistem otomatis menerbitkan{' '}
                  <strong>SO + DO + Piutang (PT Asal)</strong> dan <strong>PO + Utang (PT Tujuan)</strong> beserta Jurnal Akuntansi *At Cost*.
                </span>
              </div>
            );
          })()}

          {/* Items to transfer (Layout Tabel ala PO dengan Qty & Satuan) */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Daftar Barang yang Dipindahkan
                </h4>
                <span className="text-[11px] text-slate-400">({trfForm.items.length} item)</span>
              </div>
              <button
                type="button"
                onClick={handleAddTrfItem}
                className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Tambah Baris
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-semibold tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[230px]">Produk *</th>
                      <th className="py-2.5 px-2.5 w-24 text-center">Qty *</th>
                      <th className="py-2.5 px-2.5 w-36">Satuan *</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trfForm.items.map((item, idx) => {
                      const pObj = products.find((p) => String(p.id) === String(item.product_id));
                      const srcProd = sourceProducts.find((p) => String(p.id) === String(item.product_id));
                      const stokAsal = srcProd ? Number(srcProd.total_stok || 0) : null;
                      const unitOptions = getUnitDropdownOptions(pObj);
                      const qInput = item.qty_input !== undefined ? item.qty_input : item.qty;
                      const prev = getConversionPreviewText(qInput, item.satuan_transfer, pObj);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          {/* Row Number */}
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] align-top pt-3.5">
                            {idx + 1}
                          </td>

                          {/* Produk */}
                          <td className="py-2.5 px-3 align-top">
                            <SearchableSelect
                              size="sm"
                              className="w-full text-xs"
                              value={item.product_id}
                              onChange={(e) => handleTrfItemChange(idx, 'product_id', e.target.value)}
                              placeholder="-- Pilih Produk --"
                              searchPlaceholder="Cari kode atau nama produk..."
                              options={[
                                { value: '', label: '-- Pilih Produk --' },
                                ...products.map((p) => {
                                  const sp = sourceProducts.find((s) => s.id === p.id);
                                  const stk = sp ? Number(sp.total_stok || 0) : null;
                                  return {
                                    value: String(p.id),
                                    label: `${p.kode_produk} — ${p.nama_produk}`,
                                    sublabel:
                                      stk !== null
                                        ? `Stok Gudang Asal: ${formatNumber(stk)} ${p.satuan || 'PCS'}`
                                        : Number(p.isi_per_kemasan) > 1 || Number(p.isi_box_pcs) > 1
                                        ? `1 ${p.satuan_besar || 'BOX'} = ${p.isi_box_pcs || p.isi_per_kemasan} ${p.satuan || 'PCS'}`
                                        : undefined,
                                  };
                                }),
                              ]}
                            />
                            {pObj && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {stokAsal !== null && (
                                  <span
                                    className={`inline-flex items-center text-[10px] font-bold rounded px-1.5 py-0.5 border ${
                                      stokAsal >= Number(item.qty || 0)
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                  >
                                    Stok Asal: {formatNumber(stokAsal)} {pObj.satuan || 'PCS'}
                                  </span>
                                )}
                                {(Number(pObj.isi_per_kemasan) > 1 || Number(pObj.isi_box_pcs) > 1) && (
                                  <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded px-1.5 py-0.5">
                                    {Number(pObj.isi_box_pack) > 1
                                      ? `1 ${pObj.satuan_besar || 'BOX'} = ${pObj.isi_box_pack} ${pObj.satuan_menengah || 'PACK'} = ${pObj.isi_box_pcs || pObj.isi_per_kemasan} ${pObj.satuan || 'PCS'}`
                                      : `1 ${pObj.satuan_besar || 'BOX'} = ${pObj.isi_box_pcs || pObj.isi_per_kemasan} ${pObj.satuan || 'PCS'}`}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Qty Input */}
                          <td className="py-2.5 px-2.5 align-top">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              required
                              value={qInput}
                              onChange={(e) => handleTrfItemChange(idx, 'qty_input', e.target.value)}
                              className="w-full rounded border border-indigo-400 bg-white px-2 py-1.5 text-xs font-bold text-center text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Qty"
                            />
                          </td>

                          {/* Satuan Transfer */}
                          <td className="py-2.5 px-2.5 align-top">
                            <SearchableSelect
                              size="sm"
                              className="w-full text-xs font-semibold text-slate-700"
                              value={item.satuan_transfer || (pObj?.satuan || 'PCS')}
                              onChange={(e) => handleTrfItemChange(idx, 'satuan_transfer', e.target.value)}
                              placeholder="Satuan"
                              searchPlaceholder="Cari satuan..."
                              options={unitOptions.map((opt) => ({
                                value: opt.value,
                                label: opt.shortLabel,
                                sublabel: opt.label.includes('(')
                                  ? opt.label.slice(opt.label.indexOf('(') + 1, -1)
                                  : opt.ratio > 1
                                  ? `1 ${opt.shortLabel} = ${opt.ratio} ${pObj?.satuan || 'PCS'}`
                                  : 'Satuan Dasar',
                              }))}
                            />
                            {prev && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded px-1.5 py-0.5 whitespace-nowrap">
                                  {prev}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Hapus Baris */}
                          <td className="py-2.5 px-2 text-center align-top pt-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveTrfItem(idx)}
                              disabled={trfForm.items.length <= 1}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                              title="Hapus baris"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Catatan / Instruksi Pengiriman
            </label>
            <textarea
              rows={2}
              value={trfForm.catatan}
              onChange={(e) => setTrfForm({ ...trfForm, catatan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="cth: Distribusi stok ampul ke gudang cabang Surabaya..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setTrfModalOpen(false)}
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
              Ajukan Transfer Stok (Butuh Approval)
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
