import { useEffect, useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  Receipt,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Building2,
  Printer,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate, formatDateTime } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';
import PrintableInvoiceModal from '../components/PrintableInvoiceModal.jsx';
import ReportCustomizerModal, {
  loadSavedReportConfig,
  saveReportConfigToStorage,
} from '../components/ReportCustomizerModal.jsx';
import PrintableReportHeader from '../components/PrintableReportHeader.jsx';
import PrintableReportSignatures from '../components/PrintableReportSignatures.jsx';

const PAGE_SIZE = 10;

const emptyPaymentForm = {
  jumlah_bayar: '',
  tanggal_bayar: new Date().toISOString().split('T')[0],
  metode_pembayaran: 'Transfer Bank',
  referensi_bayar: '',
  catatan: '',
};

const emptyCreateForm = {
  no_tagihan: '',
  supplier_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  termin_hari: '30',
  jatuh_tempo: '',
  total_tagihan: '',
  keterangan: '',
};

export default function AccountsPayable() {
  const [payables, setPayables] = useState([]);
  const [summary, setSummary] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal Pembayaran
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [savingPayment, setSavingPayment] = useState(false);

  // Modal Riwayat Pembayaran
  const [historyModal, setHistoryModal] = useState(false);
  const [payableDetails, setPayableDetails] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal Buat Utang Manual
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [savingCreate, setSavingCreate] = useState(false);

  // Modal Cetak Faktur / Bukti Tagihan
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Modal Kustomisasi Laporan Rekap
  const [reportCustomizerOpen, setReportCustomizerOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState(() => loadSavedReportConfig('AP'));

  const openInvoiceModal = async (item) => {
    setSelectedInvoiceData(item);
    setInvoiceModalOpen(true);
    setLoadingInvoice(true);
    try {
      const { data } = await api.get(`/payables/${item.id}`);
      setSelectedInvoiceData(data.data);
    } catch (_) {
      // fallback ke item
    } finally {
      setLoadingInvoice(false);
    }
  };

  const calculateDueDate = (dateStr, days) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().split('T')[0];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (supplierFilter) params.supplier_id = supplierFilter;
      if (search.trim()) params.search = search.trim();

      const [resList, resSum, resSupp] = await Promise.all([
        api.get('/payables', { params }),
        api.get('/payables/summary'),
        api.get('/suppliers'),
      ]);

      setPayables(resList.data.data);
      setSummary(resSum.data.data);
      setSuppliers(resSupp.data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter, supplierFilter]);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // --- Modal Bayar ---
  const openPaymentModal = (item) => {
    setSelectedPayable(item);
    setPaymentForm({
      ...emptyPaymentForm,
      jumlah_bayar: String(item.sisa_utang),
      tanggal_bayar: new Date().toISOString().split('T')[0],
    });
    setPaymentModal(true);
  };

  const handlePayFull = () => {
    if (selectedPayable) {
      setPaymentForm((prev) => ({ ...prev, jumlah_bayar: String(selectedPayable.sisa_utang) }));
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedPayable) return;
    setSavingPayment(true);
    setError('');
    try {
      const { data } = await api.post(`/payables/${selectedPayable.id}/payments`, {
        jumlah_bayar: Number(paymentForm.jumlah_bayar),
        tanggal_bayar: paymentForm.tanggal_bayar,
        metode_pembayaran: paymentForm.metode_pembayaran,
        referensi_bayar: paymentForm.referensi_bayar.trim() || null,
        catatan: paymentForm.catatan.trim() || null,
      });

      toastSuccess(data.message);
      setPaymentModal(false);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Mencatat Pembayaran', msg);
    } finally {
      setSavingPayment(false);
    }
  };

  // --- Modal Riwayat ---
  const openHistoryModal = async (item) => {
    setSelectedPayable(item);
    setHistoryModal(true);
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/payables/${item.id}`);
      setPayableDetails(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    const confirmed = await confirmDelete({
      title: 'Batalkan Pembayaran?',
      text: 'Batalkan riwayat pembayaran ini? Sisa utang akan kembali bertambah.',
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/payables/payments/${paymentId}`);
      toastSuccess(data.message);
      if (selectedPayable) {
        const res = await api.get(`/payables/${selectedPayable.id}`);
        setPayableDetails(res.data.data);
      }
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Membatalkan Pembayaran', msg);
    }
  };

  // --- Modal Tambah Utang Manual ---
  const openCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setCreateForm({
      ...emptyCreateForm,
      tanggal: today,
      jatuh_tempo: calculateDueDate(today, 30),
    });
    setCreateModal(true);
  };

  const handleCreateTanggalChange = (tgl) => {
    setCreateForm((prev) => ({
      ...prev,
      tanggal: tgl,
      jatuh_tempo: calculateDueDate(tgl, prev.termin_hari),
    }));
  };

  const handleCreateTerminChange = (days) => {
    setCreateForm((prev) => ({
      ...prev,
      termin_hari: days,
      jatuh_tempo: calculateDueDate(prev.tanggal, days),
    }));
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSavingCreate(true);
    setError('');
    try {
      const { data } = await api.post('/payables', {
        no_tagihan: createForm.no_tagihan.trim() || undefined,
        supplier_id: createForm.supplier_id ? Number(createForm.supplier_id) : null,
        tanggal: createForm.tanggal,
        jatuh_tempo: createForm.jatuh_tempo,
        total_tagihan: Number(createForm.total_tagihan),
        keterangan: createForm.keterangan.trim() || null,
      });

      toastSuccess(data.message);
      setCreateModal(false);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Mencatat Utang', msg);
    } finally {
      setSavingCreate(false);
    }
  };

  const deletePayable = async (item) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Catatan Utang?',
      text: `Apakah Anda yakin ingin menghapus catatan utang "${item.no_tagihan}"?`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/payables/${item.id}`);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus Utang', msg);
    }
  };

  const renderDueBadge = (item) => {
    if (item.status === 'LUNAS' || Number(item.sisa_utang) <= 0) {
      return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Lunas</span>;
    }
    const days = Number(item.hari_terlewat);
    if (days > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
          <AlertTriangle className="h-3 w-3" />
          Lewat {days} hari
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
          <Clock className="h-3 w-3" />
          Jatuh Tempo Hari Ini
        </span>
      );
    }
    const rem = Math.abs(days);
    if (rem <= 3) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          <Clock className="h-3 w-3" />
          Sisa {rem} hari
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Sisa {rem} hari
      </span>
    );
  };

  const renderPaymentStatusBadge = (status) => {
    switch (status) {
      case 'LUNAS':
        return <span className="badge bg-emerald-100 text-emerald-800">Lunas</span>;
      case 'SEBAGIAN':
        return <span className="badge bg-blue-100 text-blue-800">Sebagian</span>;
      default:
        return <span className="badge bg-rose-100 text-rose-800">Belum Lunas</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Kop Resmi Khusus Cetak / Print Mode */}
      <div className="hidden print:block">
        <PrintableReportHeader
          companyName={reportConfig.companyName}
          companyAddress={reportConfig.companyAddress}
          companyContact={reportConfig.companyContact}
          companyLogo={reportConfig.companyLogo}
          showCompanyHeader={reportConfig.showCompanyHeader}
          title="LAPORAN REKAPITULASI UTANG USAHA (ACCOUNTS PAYABLE)"
          subtitle={`Status Filter: ${statusFilter !== 'ALL' ? statusFilter : 'Semua Status'} | Per Tanggal: ${formatDate(new Date())}`}
          docNo="REP-AP"
        />
      </div>

      {/* Header (Disembunyikan saat Cetak Rekap) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Utang Usaha (Accounts Payable)</h1>
          <p className="text-sm text-slate-500">
            Kelola tagihan pembelian ke supplier, pembayaran termin, dan pantau jatuh tempo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReportCustomizerOpen(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Kustomisasi Kop Perusahaan, Tanda Tangan & Format Cetak"
          >
            <Sliders className="h-3.5 w-3.5 text-blue-600" />
            Kustomisasi Laporan
          </button>
          <button
            type="button"
            onClick={() => {
              const headers = ['No. Tagihan / PO', 'Supplier', 'Kode Supplier', 'Tanggal', 'Jatuh Tempo', 'Total Tagihan (Rp)', 'Total Dibayar (Rp)', 'Sisa Utang (Rp)', 'Status'];
              const rows = payables.map((item) => [
                item.no_tagihan + (item.no_po ? ` (${item.no_po})` : ''),
                item.nama_supplier || '',
                item.kode_supplier || '',
                formatDate(item.tanggal),
                formatDate(item.jatuh_tempo),
                item.total_tagihan || 0,
                item.total_dibayar || 0,
                item.sisa_utang || 0,
                item.status || '',
              ]);
              exportToExcel('Rekap_Utang_Usaha_AP', headers, rows);
            }}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Export Data Rekap Utang ke Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Cetak Dokumen Rekapitulasi Utang ke PDF"
          >
            <Printer className="h-3.5 w-3.5 text-blue-600" />
            Cetak / Export PDF
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Muat ulang data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </button>
          <button type="button" onClick={openCreateModal} className="btn-primary flex items-center gap-1.5 text-xs font-semibold">
            <Plus className="h-4 w-4" /> Catat Utang Baru
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Sisa Utang
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-800">
            {formatRupiah(summary?.sisa_utang || 0)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Dari {summary?.count_belum_lunas || 0} faktur aktif
          </p>
        </div>

        <div className="card border-rose-100 bg-rose-50/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Lewat Jatuh Tempo
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-rose-700">
            {formatRupiah(summary?.utang_overdue || 0)}
          </div>
          <p className="mt-1 text-xs font-medium text-rose-600">
            {summary?.count_overdue || 0} faktur telah melewati batas tempo
          </p>
        </div>

        <div className="card border-amber-100 bg-amber-50/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Tempo ≤ 7 Hari
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-amber-700">
            {formatRupiah(summary?.utang_due_soon || 0)}
          </div>
          <p className="mt-1 text-xs text-amber-600">
            {summary?.count_due_soon || 0} faktur mendekati jatuh tempo
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Sudah Dibayar
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-800">
            {formatRupiah(summary?.total_dibayar || 0)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {summary?.count_lunas || 0} faktur telah lunas
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 print:hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'UNPAID', label: 'Belum Lunas' },
              { id: 'OVERDUE', label: 'Lewat Tempo' },
              { id: 'DUE_SOON', label: 'Tempo ≤ 7 Hari' },
              { id: 'LUNAS', label: 'Lunas' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56">
              <SearchableSelect
                id="filter-supplier"
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Semua Supplier"
                searchPlaceholder="Cari supplier..."
                options={[
                  { value: '', label: 'Semua Supplier' },
                  ...suppliers.map((s) => ({
                    value: s.id,
                    label: s.nama_supplier,
                    sublabel: s.kode_supplier,
                  })),
                ]}
              />
            </div>

            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input pl-9 text-xs"
                placeholder="Cari tagihan, PO, supplier..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Data */}
      <div className="card overflow-hidden">
        {loading && payables.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm">Memuat data utang...</span>
          </div>
        ) : payables.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Tidak ada data utang yang cocok dengan filter.
          </div>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(payables, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="table-base print:w-full">
                    <thead>
                      <tr>
                        {reportConfig.columns?.no_tagihan !== false && <th className="print:w-[18%]">No. Tagihan</th>}
                        {reportConfig.columns?.supplier !== false && <th className="print:w-[20%]">Supplier</th>}
                        {reportConfig.columns?.tanggal !== false && <th className="print:w-[12%]">Tanggal</th>}
                        {reportConfig.columns?.jatuh_tempo !== false && <th className="print:w-[14%]">Jatuh Tempo</th>}
                        {reportConfig.columns?.total_tagihan !== false && <th className="text-right print:w-[13%]">Total Tagihan</th>}
                        {reportConfig.columns?.total_dibayar !== false && <th className="text-right print:w-[10%]">Total Dibayar</th>}
                        {reportConfig.columns?.sisa_utang !== false && <th className="text-right print:w-[13%]">Sisa Utang</th>}
                        {reportConfig.columns?.status !== false && <th className="text-center print:w-[10%]">Status</th>}
                        <th className="text-right print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payables.map((item, index) => {
                        const isCurrentPage = index >= (safePage - 1) * pageSize && index < safePage * pageSize;
                        const isLunas = item.status === 'LUNAS' || Number(item.sisa_utang) <= 0;
                        return (
                          <tr key={item.id} className={`hover:bg-slate-50 ${isCurrentPage ? '' : 'hidden print:table-row'}`}>
                            {reportConfig.columns?.no_tagihan !== false && (
                              <td>
                                <div className="font-semibold text-slate-800">{item.no_tagihan}</div>
                                {item.no_po && (
                                  <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                    <Receipt className="h-3 w-3" /> {item.no_po}
                                  </div>
                                )}
                              </td>
                            )}
                            {reportConfig.columns?.supplier !== false && (
                              <td>
                                <div className="font-medium text-slate-800">
                                  {item.nama_supplier || <span className="text-slate-400">-</span>}
                                </div>
                                {item.kode_supplier && (
                                  <div className="text-xs text-slate-500">{item.kode_supplier}</div>
                                )}
                              </td>
                            )}
                            {reportConfig.columns?.tanggal !== false && (
                              <td className="whitespace-nowrap text-xs text-slate-600">
                                {formatDate(item.tanggal)}
                              </td>
                            )}
                            {reportConfig.columns?.jatuh_tempo !== false && (
                              <td className="whitespace-nowrap">
                                <div className="text-xs font-medium text-slate-800">
                                  {formatDate(item.jatuh_tempo)}
                                </div>
                                <div className="mt-1">{renderDueBadge(item)}</div>
                              </td>
                            )}
                            {reportConfig.columns?.total_tagihan !== false && (
                              <td className="whitespace-nowrap text-right font-medium text-slate-700">
                                {formatRupiah(item.total_tagihan)}
                              </td>
                            )}
                            {reportConfig.columns?.total_dibayar !== false && (
                              <td className="whitespace-nowrap text-right text-emerald-700">
                                {formatRupiah(item.total_dibayar)}
                              </td>
                            )}
                            {reportConfig.columns?.sisa_utang !== false && (
                              <td className="whitespace-nowrap text-right font-bold text-slate-900">
                                {formatRupiah(item.sisa_utang)}
                              </td>
                            )}
                            {reportConfig.columns?.status !== false && (
                              <td className="whitespace-nowrap text-center">
                                {renderPaymentStatusBadge(item.status)}
                              </td>
                            )}
                            <td className="whitespace-nowrap text-right print:hidden">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openInvoiceModal(item)}
                                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition"
                                  title="Cetak Faktur / Bukti Tagihan Vendor"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                {!isLunas && (
                                  <button
                                    type="button"
                                    onClick={() => openPaymentModal(item)}
                                    className="btn-primary !px-2.5 !py-1 !text-xs"
                                    title="Catat Pembayaran"
                                  >
                                    <DollarSign className="h-3.5 w-3.5" />
                                    Bayar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openHistoryModal(item)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                  title="Lihat Riwayat Pembayaran"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {Number(item.total_dibayar) === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => deletePayable(item)}
                                    className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                                    title="Hapus Data Utang"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="print:hidden">
                  <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    onPage={setPage}
                    totalItems={payables.length}
                    pageSize={pageSize}
                    onPageSize={(s) => {
                      setPageSize(s);
                      setPage(1);
                    }}
                    label="utang"
                  />
                </div>

                {/* Blok Tanda Tangan Saat Dicetak / Export PDF Rekapitulasi */}
                <div className="hidden print:block avoid-break mt-6">
                  <PrintableReportSignatures
                    show={reportConfig.showSignatures}
                    showSignatures={reportConfig.showSignatures}
                    city={reportConfig.signatureCity}
                    date={reportConfig.signatureDate}
                    signer1={reportConfig.signer1}
                    signer2={reportConfig.signer2}
                    signer3={reportConfig.signer3}
                    companyStamp={reportConfig.companyStamp}
                    showStamp={reportConfig.showStamp}
                    stampPosition={reportConfig.stampPosition}
                    footerNote={reportConfig.footerNote}
                  />
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* --- Modal Catat Pembayaran --- */}
      <Modal
        isOpen={paymentModal}
        title={`Catat Pembayaran Utang - ${selectedPayable?.no_tagihan || ''}`}
        onClose={() => setPaymentModal(false)}
      >
        <form onSubmit={submitPayment} className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier:</span>
              <span className="font-semibold text-slate-800">{selectedPayable?.nama_supplier || '-'}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Total Tagihan:</span>
              <span className="text-slate-700">{formatRupiah(selectedPayable?.total_tagihan)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Sudah Dibayar:</span>
              <span className="text-emerald-600">{formatRupiah(selectedPayable?.total_dibayar)}</span>
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2 flex justify-between items-center">
              <span className="font-medium text-slate-700">Sisa Utang:</span>
              <span className="text-lg font-bold text-rose-600">{formatRupiah(selectedPayable?.sisa_utang)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="pay-jumlah">
                Jumlah Bayar (Rp) *
              </label>
              <button
                type="button"
                onClick={handlePayFull}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Bayar Penuh
              </button>
            </div>
            <input
              id="pay-jumlah"
              type="number"
              step="any"
              min="1"
              max={selectedPayable?.sisa_utang}
              className="input text-lg font-bold text-slate-800"
              value={paymentForm.jumlah_bayar}
              onChange={(e) => setPaymentForm({ ...paymentForm, jumlah_bayar: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pay-tanggal">
                Tanggal Pembayaran *
              </label>
              <input
                id="pay-tanggal"
                type="date"
                className="input"
                value={paymentForm.tanggal_bayar}
                onChange={(e) => setPaymentForm({ ...paymentForm, tanggal_bayar: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="pay-metode">
                Metode Pembayaran
              </label>
              <select
                id="pay-metode"
                className="input"
                value={paymentForm.metode_pembayaran}
                onChange={(e) => setPaymentForm({ ...paymentForm, metode_pembayaran: e.target.value })}
              >
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Tunai">Tunai / Cash</option>
                <option value="Giro">Giro</option>
                <option value="Cek">Cek</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="pay-ref">
              No. Referensi / Bukti Transfer
            </label>
            <input
              id="pay-ref"
              type="text"
              className="input"
              value={paymentForm.referensi_bayar}
              onChange={(e) => setPaymentForm({ ...paymentForm, referensi_bayar: e.target.value })}
              placeholder="Contoh: No. Ref Bank BCA / No. Cek"
            />
          </div>

          <div>
            <label className="label" htmlFor="pay-catatan">
              Catatan Pembayaran
            </label>
            <textarea
              id="pay-catatan"
              rows="2"
              className="input"
              value={paymentForm.catatan}
              onChange={(e) => setPaymentForm({ ...paymentForm, catatan: e.target.value })}
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setPaymentModal(false)} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={savingPayment} className="btn-primary">
              {savingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Pembayaran
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Modal Riwayat Pembayaran --- */}
      <Modal
        isOpen={historyModal}
        title={`Riwayat Pembayaran - ${selectedPayable?.no_tagihan || ''}`}
        onClose={() => setHistoryModal(false)}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-semibold text-slate-800">{selectedPayable?.nama_supplier || 'Tanpa Supplier'}</div>
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
              <div>Total Tagihan: <span className="font-semibold text-slate-700">{formatRupiah(payableDetails?.total_tagihan || selectedPayable?.total_tagihan)}</span></div>
              <div>Sudah Dibayar: <span className="font-semibold text-emerald-600">{formatRupiah(payableDetails?.total_dibayar || selectedPayable?.total_dibayar)}</span></div>
              <div>Sisa Utang: <span className="font-semibold text-rose-600">{formatRupiah(payableDetails?.sisa_utang || selectedPayable?.sisa_utang)}</span></div>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center p-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="ml-2 text-sm">Memuat riwayat...</span>
            </div>
          ) : !payableDetails?.payments || payableDetails.payments.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Belum ada pembayaran yang dicatat untuk tagihan ini.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {payableDetails.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-800">{p.no_pembayaran}</div>
                    <div className="text-xs text-slate-500">
                      {formatDate(p.tanggal_bayar)} • {p.metode_pembayaran}
                      {p.referensi_bayar && ` • Ref: ${p.referensi_bayar}`}
                    </div>
                    {p.catatan && <p className="mt-0.5 text-xs text-slate-600 italic">"{p.catatan}"</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-700">{formatRupiah(p.jumlah_bayar)}</span>
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(p.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Batalkan pembayaran ini"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => openInvoiceModal(selectedPayable)}
              className="btn-secondary !text-xs flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" /> Cetak Faktur / Tagihan
            </button>
            <button type="button" onClick={() => setHistoryModal(false)} className="btn-secondary">
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* --- Modal Tambah Utang Manual --- */}
      <Modal
        isOpen={createModal}
        title="Catat Tagihan Utang Baru"
        onClose={() => setCreateModal(false)}
      >
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-tagihan">
                No. Tagihan / Faktur *
              </label>
              <input
                id="new-tagihan"
                type="text"
                className="input"
                placeholder="Otomatis (AP/...)"
                value={createForm.no_tagihan}
                onChange={(e) => setCreateForm({ ...createForm, no_tagihan: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="new-supplier">
                Supplier
              </label>
              <SearchableSelect
                id="new-supplier"
                value={createForm.supplier_id}
                onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                placeholder="-- Pilih Supplier --"
                searchPlaceholder="Cari supplier..."
                options={[
                  { value: '', label: '-- Pilih Supplier --' },
                  ...suppliers.map((s) => ({
                    value: s.id,
                    label: s.nama_supplier,
                    sublabel: s.kode_supplier,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="new-tanggal">
                Tanggal Faktur *
              </label>
              <input
                id="new-tanggal"
                type="date"
                className="input"
                value={createForm.tanggal}
                onChange={(e) => handleCreateTanggalChange(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="new-termin">
                Termin Pembayaran
              </label>
              <select
                id="new-termin"
                className="input"
                value={createForm.termin_hari}
                onChange={(e) => handleCreateTerminChange(e.target.value)}
              >
                <option value="0">Cash / COD (0 Hari)</option>
                <option value="7">Net 7 Hari</option>
                <option value="14">Net 14 Hari</option>
                <option value="30">Net 30 Hari</option>
                <option value="45">Net 45 Hari</option>
                <option value="60">Net 60 Hari</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="new-jatuh-tempo">
                Tanggal Jatuh Tempo *
              </label>
              <input
                id="new-jatuh-tempo"
                type="date"
                className="input font-semibold"
                value={createForm.jatuh_tempo}
                onChange={(e) => setCreateForm({ ...createForm, jatuh_tempo: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="new-total">
              Total Nominal Tagihan (Rp) *
            </label>
            <input
              id="new-total"
              type="number"
              step="any"
              min="0"
              className="input text-lg font-bold"
              value={createForm.total_tagihan}
              onChange={(e) => setCreateForm({ ...createForm, total_tagihan: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="new-ket">
              Keterangan
            </label>
            <textarea
              id="new-ket"
              rows="2"
              className="input"
              value={createForm.keterangan}
              onChange={(e) => setCreateForm({ ...createForm, keterangan: e.target.value })}
              placeholder="Catatan atau rincian utang (opsional)"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={savingCreate} className="btn-primary">
              {savingCreate && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Tagihan Utang
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Modal Cetak Faktur / Bukti Tagihan Pembelian (AP) --- */}
      <PrintableInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        type="AP"
        data={selectedInvoiceData}
        loading={loadingInvoice}
      />

      {/* --- Modal Kustomisasi Laporan Rekapitulasi Utang --- */}
      <ReportCustomizerModal
        isOpen={reportCustomizerOpen}
        onClose={() => setReportCustomizerOpen(false)}
        config={reportConfig}
        onChangeConfig={(cfg) => {
          setReportConfig(cfg);
          saveReportConfigToStorage(cfg, 'AP');
        }}
        onApplyAndPrint={() => {
          saveReportConfigToStorage(reportConfig, 'AP');
          window.print();
        }}
        menuKey="AP"
        activeReportTitle="Rekapitulasi Utang Usaha"
      />
    </div>
  );
}

