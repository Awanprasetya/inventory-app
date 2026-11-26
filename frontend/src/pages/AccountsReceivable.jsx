import { useEffect, useState } from 'react';
import {
  Wallet,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  ShoppingCart,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Users,
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
  customer_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  termin_hari: '30',
  jatuh_tempo: '',
  total_tagihan: '',
  keterangan: '',
};

export default function AccountsReceivable() {
  const [receivables, setReceivables] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal Terima Pembayaran
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [savingPayment, setSavingPayment] = useState(false);

  // Modal Riwayat Pembayaran
  const [historyModal, setHistoryModal] = useState(false);
  const [receivableDetails, setReceivableDetails] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal Buat Piutang Manual
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [savingCreate, setSavingCreate] = useState(false);

  // Modal Cetak Faktur / Invoice
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Modal Kustomisasi Laporan Rekap
  const [reportCustomizerOpen, setReportCustomizerOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState(() => loadSavedReportConfig('AR'));

  const openInvoiceModal = async (item) => {
    setSelectedInvoiceData(item);
    setInvoiceModalOpen(true);
    setLoadingInvoice(true);
    try {
      const { data } = await api.get(`/receivables/${item.id}`);
      setSelectedInvoiceData(data.data);
    } catch (_) {
      // jika gagal getById, tetap pakai item
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
      if (customerFilter) params.customer_id = customerFilter;
      if (search.trim()) params.search = search.trim();

      const [resList, resSum, resCust] = await Promise.all([
        api.get('/receivables', { params }),
        api.get('/receivables/summary'),
        api.get('/customers'),
      ]);

      setReceivables(resList.data.data);
      setSummary(resSum.data.data);
      setCustomers(resCust.data.data);
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
  }, [search, statusFilter, customerFilter]);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // --- Modal Terima Pembayaran ---
  const openPaymentModal = (item) => {
    setSelectedReceivable(item);
    setPaymentForm({
      ...emptyPaymentForm,
      jumlah_bayar: String(item.sisa_piutang),
      tanggal_bayar: new Date().toISOString().split('T')[0],
    });
    setPaymentModal(true);
  };

  const handlePayFull = () => {
    if (selectedReceivable) {
      setPaymentForm((prev) => ({ ...prev, jumlah_bayar: String(selectedReceivable.sisa_piutang) }));
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedReceivable) return;
    setSavingPayment(true);
    setError('');
    try {
      const { data } = await api.post(`/receivables/${selectedReceivable.id}/payments`, {
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
      alertError('Gagal Mencatat Penerimaan', msg);
    } finally {
      setSavingPayment(false);
    }
  };

  // --- Modal Riwayat ---
  const openHistoryModal = async (item) => {
    setSelectedReceivable(item);
    setHistoryModal(true);
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/receivables/${item.id}`);
      setReceivableDetails(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    const confirmed = await confirmDelete({
      title: 'Batalkan Penerimaan?',
      text: 'Batalkan riwayat penerimaan ini? Sisa piutang akan kembali bertambah.',
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/receivables/payments/${paymentId}`);
      toastSuccess(data.message);
      if (selectedReceivable) {
        const res = await api.get(`/receivables/${selectedReceivable.id}`);
        setReceivableDetails(res.data.data);
      }
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Membatalkan Penerimaan', msg);
    }
  };

  // --- Modal Tambah Piutang Manual ---
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
      const { data } = await api.post('/receivables', {
        no_tagihan: createForm.no_tagihan.trim() || undefined,
        customer_id: createForm.customer_id ? Number(createForm.customer_id) : null,
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
      alertError('Gagal Mencatat Piutang', msg);
    } finally {
      setSavingCreate(false);
    }
  };

  const deleteReceivable = async (item) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Catatan Piutang?',
      text: `Apakah Anda yakin ingin menghapus catatan piutang "${item.no_tagihan}"?`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/receivables/${item.id}`);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus Piutang', msg);
    }
  };

  const renderDueBadge = (item) => {
    if (item.status === 'LUNAS' || Number(item.sisa_piutang) <= 0) {
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
          title="LAPORAN REKAPITULASI PIUTANG USAHA (ACCOUNTS RECEIVABLE)"
          subtitle={`Status Filter: ${statusFilter !== 'ALL' ? statusFilter : 'Semua Status'} | Per Tanggal: ${formatDate(new Date())}`}
          docNo="REP-AR"
        />
      </div>

      {/* Header (Disembunyikan saat Cetak Rekap) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Piutang Usaha (Accounts Receivable)</h1>
          <p className="text-sm text-slate-500">
            Kelola tagihan penjualan ke customer, penerimaan termin pembayaran, dan pantau jatuh tempo.
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
              const headers = ['No. Invoice / Tagihan', 'Customer', 'Kode Customer', 'Tanggal', 'Jatuh Tempo', 'Total Tagihan (Rp)', 'Sudah Diterima (Rp)', 'Sisa Piutang (Rp)', 'Status'];
              const rows = receivables.map((item) => [
                item.no_tagihan + (item.no_so ? ` (${item.no_so})` : ''),
                item.nama_customer || '',
                item.kode_customer || '',
                formatDate(item.tanggal),
                formatDate(item.jatuh_tempo),
                item.total_tagihan || 0,
                item.total_dibayar || 0,
                item.sisa_piutang || 0,
                item.status || '',
              ]);
              exportToExcel('Rekap_Piutang_Usaha_AR', headers, rows);
            }}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Export Data Rekap Piutang ke Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Cetak Dokumen Rekapitulasi Piutang ke PDF"
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
            <Plus className="h-4 w-4" /> Catat Piutang Baru
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
              Total Sisa Piutang
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-800">
            {formatRupiah(summary?.sisa_piutang || 0)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Dari {summary?.count_belum_lunas || 0} tagihan aktif
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
            {formatRupiah(summary?.piutang_overdue || 0)}
          </div>
          <p className="mt-1 text-xs font-medium text-rose-600">
            {summary?.count_overdue || 0} tagihan customer telah melewati batas tempo
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
            {formatRupiah(summary?.piutang_due_soon || 0)}
          </div>
          <p className="mt-1 text-xs text-amber-600">
            {summary?.count_due_soon || 0} tagihan customer mendekati tempo
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Sudah Diterima
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-800">
            {formatRupiah(summary?.total_dibayar || 0)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {summary?.count_lunas || 0} tagihan telah lunas diterima
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
                id="filter-customer"
                value={customerFilter}
                onChange={(e) => {
                  setCustomerFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Semua Customer"
                searchPlaceholder="Cari customer..."
                options={[
                  { value: '', label: 'Semua Customer' },
                  ...customers.map((c) => ({
                    value: c.id,
                    label: c.nama_customer,
                    sublabel: c.kode_customer,
                  })),
                ]}
              />
            </div>

            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input pl-9 text-xs"
                placeholder="Cari invoice, SO, customer..."
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
        {loading && receivables.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm">Memuat data piutang...</span>
          </div>
        ) : receivables.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Tidak ada data piutang yang cocok dengan filter.
          </div>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(receivables, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="table-base print:w-full">
                    <thead>
                      <tr>
                        {reportConfig.columns?.no_tagihan !== false && <th className="print:w-[18%]">No. Invoice / Tagihan</th>}
                        {reportConfig.columns?.customer !== false && <th className="print:w-[20%]">Customer</th>}
                        {reportConfig.columns?.tanggal !== false && <th className="print:w-[12%]">Tanggal</th>}
                        {reportConfig.columns?.jatuh_tempo !== false && <th className="print:w-[14%]">Jatuh Tempo</th>}
                        {reportConfig.columns?.total_tagihan !== false && <th className="text-right print:w-[13%]">Total Tagihan</th>}
                        {reportConfig.columns?.total_dibayar !== false && <th className="text-right print:w-[10%]">Sudah Diterima</th>}
                        {reportConfig.columns?.sisa_piutang !== false && <th className="text-right print:w-[13%]">Sisa Piutang</th>}
                        {reportConfig.columns?.status !== false && <th className="text-center print:w-[10%]">Status</th>}
                        <th className="text-right print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivables.map((item, index) => {
                        const isCurrentPage = index >= (safePage - 1) * pageSize && index < safePage * pageSize;
                        const isLunas = item.status === 'LUNAS' || Number(item.sisa_piutang) <= 0;
                        return (
                          <tr key={item.id} className={`hover:bg-slate-50 ${isCurrentPage ? '' : 'hidden print:table-row'}`}>
                            {reportConfig.columns?.no_tagihan !== false && (
                              <td>
                                <div className="font-semibold text-slate-800">{item.no_tagihan}</div>
                                {item.no_so && (
                                  <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                    <ShoppingCart className="h-3 w-3" /> {item.no_so}
                                  </div>
                                )}
                              </td>
                            )}
                            {reportConfig.columns?.customer !== false && (
                              <td>
                                <div className="font-medium text-slate-800">
                                  {item.nama_customer || <span className="text-slate-400">-</span>}
                                </div>
                                {item.kode_customer && (
                                  <div className="text-xs text-slate-500">{item.kode_customer}</div>
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
                            {reportConfig.columns?.sisa_piutang !== false && (
                              <td className="whitespace-nowrap text-right font-bold text-slate-900">
                                {formatRupiah(item.sisa_piutang)}
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
                                  title="Cetak Faktur / Invoice Penjualan"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                {!isLunas && (
                                  <button
                                    type="button"
                                    onClick={() => openPaymentModal(item)}
                                    className="btn-primary !px-2.5 !py-1 !text-xs"
                                    title="Catat Penerimaan Pembayaran"
                                  >
                                    <DollarSign className="h-3.5 w-3.5" />
                                    Terima Bayar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openHistoryModal(item)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                  title="Lihat Riwayat Penerimaan"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {Number(item.total_dibayar) === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => deleteReceivable(item)}
                                    className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                                    title="Hapus Data Piutang"
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
                    totalItems={receivables.length}
                    pageSize={pageSize}
                    onPageSize={(s) => {
                      setPageSize(s);
                      setPage(1);
                    }}
                    label="piutang"
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

      {/* --- Modal Catat Penerimaan Pembayaran --- */}
      <Modal
        isOpen={paymentModal}
        title={`Catat Penerimaan Pembayaran - ${selectedReceivable?.no_tagihan || ''}`}
        onClose={() => setPaymentModal(false)}
      >
        <form onSubmit={submitPayment} className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-semibold text-slate-800">{selectedReceivable?.nama_customer || '-'}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Total Tagihan:</span>
              <span className="text-slate-700">{formatRupiah(selectedReceivable?.total_tagihan)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Sudah Diterima:</span>
              <span className="text-emerald-600">{formatRupiah(selectedReceivable?.total_dibayar)}</span>
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2 flex justify-between items-center">
              <span className="font-medium text-slate-700">Sisa Piutang:</span>
              <span className="text-lg font-bold text-rose-600">{formatRupiah(selectedReceivable?.sisa_piutang)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="rec-jumlah">
                Jumlah Diterima (Rp) *
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
              id="rec-jumlah"
              type="number"
              step="any"
              min="1"
              max={selectedReceivable?.sisa_piutang}
              className="input text-lg font-bold text-slate-800"
              value={paymentForm.jumlah_bayar}
              onChange={(e) => setPaymentForm({ ...paymentForm, jumlah_bayar: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="rec-tanggal">
                Tanggal Penerimaan *
              </label>
              <input
                id="rec-tanggal"
                type="date"
                className="input"
                value={paymentForm.tanggal_bayar}
                onChange={(e) => setPaymentForm({ ...paymentForm, tanggal_bayar: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="rec-metode">
                Metode Pembayaran
              </label>
              <select
                id="rec-metode"
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
            <label className="label" htmlFor="rec-ref">
              No. Referensi / Bukti Transfer
            </label>
            <input
              id="rec-ref"
              type="text"
              className="input"
              value={paymentForm.referensi_bayar}
              onChange={(e) => setPaymentForm({ ...paymentForm, referensi_bayar: e.target.value })}
              placeholder="Contoh: No. Ref Bank BCA / No. Cek"
            />
          </div>

          <div>
            <label className="label" htmlFor="rec-catatan">
              Catatan Penerimaan
            </label>
            <textarea
              id="rec-catatan"
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
              Simpan Penerimaan
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Modal Riwayat Penerimaan --- */}
      <Modal
        isOpen={historyModal}
        title={`Riwayat Penerimaan - ${selectedReceivable?.no_tagihan || ''}`}
        onClose={() => setHistoryModal(false)}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-semibold text-slate-800">{selectedReceivable?.nama_customer || 'Tanpa Customer'}</div>
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
              <div>Total Tagihan: <span className="font-semibold text-slate-700">{formatRupiah(receivableDetails?.total_tagihan || selectedReceivable?.total_tagihan)}</span></div>
              <div>Sudah Diterima: <span className="font-semibold text-emerald-600">{formatRupiah(receivableDetails?.total_dibayar || selectedReceivable?.total_dibayar)}</span></div>
              <div>Sisa Piutang: <span className="font-semibold text-rose-600">{formatRupiah(receivableDetails?.sisa_piutang || selectedReceivable?.sisa_piutang)}</span></div>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center p-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="ml-2 text-sm">Memuat riwayat...</span>
            </div>
          ) : !receivableDetails?.payments || receivableDetails.payments.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              Belum ada pembayaran yang diterima untuk tagihan ini.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {receivableDetails.payments.map((p) => (
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
                      title="Batalkan penerimaan ini"
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
              onClick={() => openInvoiceModal(selectedReceivable)}
              className="btn-secondary !text-xs flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" /> Cetak Faktur / Invoice
            </button>
            <button type="button" onClick={() => setHistoryModal(false)} className="btn-secondary">
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* --- Modal Tambah Piutang Manual --- */}
      <Modal
        isOpen={createModal}
        title="Catat Tagihan Piutang Baru"
        onClose={() => setCreateModal(false)}
      >
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-tagihan-ar">
                No. Invoice / Tagihan *
              </label>
              <input
                id="new-tagihan-ar"
                type="text"
                className="input"
                placeholder="Otomatis (AR/...)"
                value={createForm.no_tagihan}
                onChange={(e) => setCreateForm({ ...createForm, no_tagihan: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="new-customer">
                Customer
              </label>
              <SearchableSelect
                id="new-customer"
                value={createForm.customer_id}
                onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                placeholder="-- Pilih Customer --"
                searchPlaceholder="Cari customer..."
                options={[
                  { value: '', label: '-- Pilih Customer --' },
                  ...customers.map((c) => ({
                    value: c.id,
                    label: c.nama_customer,
                    sublabel: c.kode_customer,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="new-tanggal-ar">
                Tanggal Invoice *
              </label>
              <input
                id="new-tanggal-ar"
                type="date"
                className="input"
                value={createForm.tanggal}
                onChange={(e) => handleCreateTanggalChange(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="new-termin-ar">
                Termin Pembayaran
              </label>
              <select
                id="new-termin-ar"
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
              <label className="label" htmlFor="new-jatuh-tempo-ar">
                Tanggal Jatuh Tempo *
              </label>
              <input
                id="new-jatuh-tempo-ar"
                type="date"
                className="input font-semibold"
                value={createForm.jatuh_tempo}
                onChange={(e) => setCreateForm({ ...createForm, jatuh_tempo: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="new-total-ar">
              Total Nominal Tagihan (Rp) *
            </label>
            <input
              id="new-total-ar"
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
            <label className="label" htmlFor="new-ket-ar">
              Keterangan
            </label>
            <textarea
              id="new-ket-ar"
              rows="2"
              className="input"
              value={createForm.keterangan}
              onChange={(e) => setCreateForm({ ...createForm, keterangan: e.target.value })}
              placeholder="Catatan atau rincian piutang (opsional)"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={savingCreate} className="btn-primary">
              {savingCreate && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Tagihan Piutang
            </button>
          </div>
        </form>
      </Modal>

      {/* --- Modal Cetak Faktur / Invoice Penjualan --- */}
      <PrintableInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        type="AR"
        data={selectedInvoiceData}
        loading={loadingInvoice}
      />

      {/* --- Modal Kustomisasi Laporan Rekapitulasi Piutang --- */}
      <ReportCustomizerModal
        isOpen={reportCustomizerOpen}
        onClose={() => setReportCustomizerOpen(false)}
        config={reportConfig}
        onChangeConfig={(cfg) => {
          setReportConfig(cfg);
          saveReportConfigToStorage(cfg, 'AR');
        }}
        onApplyAndPrint={() => {
          saveReportConfigToStorage(reportConfig, 'AR');
          window.print();
        }}
        menuKey="AR"
        activeReportTitle="Rekapitulasi Piutang Usaha"
      />
    </div>
  );
}

