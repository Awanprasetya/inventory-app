import { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  XCircle,
  Printer,
  Sliders,
  RefreshCw,
  FileSpreadsheet,
  FileCheck,
  FileText,
} from 'lucide-react';
import api, { getErrorMessage, formatDate, formatNumber, formatRupiah } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';
import { getProductUnits, getUnitDropdownOptions, convertToPcs, getConversionPreviewText, formatMultiTierBreakdown } from '../utils/unitHelper.js';
import ReportCustomizerModal, {
  loadSavedReportConfig,
} from '../components/ReportCustomizerModal.jsx';
import PrintableReportHeader from '../components/PrintableReportHeader.jsx';
import PrintableReportSignatures from '../components/PrintableReportSignatures.jsx';
import PrintableInvoiceModal from '../components/PrintableInvoiceModal.jsx';

const PAGE_SIZE = 10;

const statusBadges = {
  OPEN: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const calculateDueDate = (dateStr, days) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
};

const emptySoForm = {
  no_so: '',
  customer_id: '',
  tanggal_so: new Date().toISOString().split('T')[0],
  termin_hari: 30,
  jatuh_tempo: calculateDueDate(new Date().toISOString().split('T')[0], 30),
  keterangan: '',
  diskon_persen: 0,
  pajak_persen: 11,
  items: [{ kode_produk: '', satuan_order: 'BOX', qty_order: 1, qty_pesanan: 1, harga_satuan: 0, diskon_persen: 0, diskon: 0 }],
};

export default function SalesOrders() {
  const [sos, setSos] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Kustomisasi Laporan State
  const [reportCustomizerOpen, setReportCustomizerOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState(() => loadSavedReportConfig('SO'));

  // Detail Modal
  const [detailModal, setDetailModal] = useState(false);
  const [activeSo, setActiveSo] = useState(null);

  // Cetak Dokumen Detail SO Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Terbitkan Faktur & Piutang State
  const [invoicingId, setInvoicingId] = useState(null);

  // Add Modal state
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptySoForm);

  const handlePrintRow = async (so) => {
    setSelectedInvoiceData(so);
    setInvoiceModalOpen(true);
    setLoadingInvoice(true);
    try {
      const { data } = await api.get(`/sales-orders/${so.id}`);
      setSelectedInvoiceData(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleGenerateInvoice = async (so) => {
    setInvoicingId(so.id);
    try {
      const { data } = await api.post(`/sales-orders/${so.id}/invoice`);
      flash(data.message);
      toastSuccess(data.message);
      if (activeSo && activeSo.id === so.id) {
        setActiveSo((prev) => ({
          ...prev,
          ...data.data,
          ar_id: data.data.ar_id || prev.ar_id,
          no_tagihan: data.data.no_tagihan || prev.no_tagihan,
          status_pembayaran: data.data.status_pembayaran || 'BELUM_LUNAS',
        }));
      }
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menerbitkan Faktur', msg);
    } finally {
      setInvoicingId(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [soRes, custRes, prdRes] = await Promise.all([
        api.get('/sales-orders', {
          params: { status: statusFilter || undefined, search: search.trim() || undefined },
        }),
        api.get('/customers'),
        api.get('/products'),
      ]);
      setSos(soRes.data.data);
      setCustomers(custRes.data.data);
      setProducts(prdRes.data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 300);
    return () => clearTimeout(timer);
  }, [statusFilter, search]);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const openDetail = async (id) => {
    try {
      const { data } = await api.get(`/sales-orders/${id}`);
      setActiveSo(data.data);
      setDetailModal(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const changeStatus = async (id, newStatus) => {
    try {
      const { data } = await api.put(`/sales-orders/${id}/status`, { status: newStatus });
      flash(data.message);
      toastSuccess(data.message);
      if (activeSo && activeSo.id === id) {
        setActiveSo((prev) => ({ ...prev, status: newStatus }));
      }
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Mengubah Status', msg);
    }
  };

  const deleteSo = async (so) => {
    const confirmed = await confirmDelete({
      title: `Hapus Sales Order?`,
      text: `SO "${so.no_so}" beserta seluruh Delivery Order, mutasi pengeluaran barang, dan kartu stok terkait akan dibatalkan/dihapus permanen!`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/sales-orders/${so.id}`);
      flash(data.message);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus SO', msg);
    }
  };

  // --- Calculations ---
  const calculateTotals = (currentForm) => {
    const itemsSubtotal = (currentForm.items || []).reduce((sum, item) => {
      const q = Math.max(0, Number(item.qty_order !== undefined ? item.qty_order : item.qty_pesanan) || 0);
      const h = Math.max(0, Number(item.harga_satuan) || 0);
      const gross = q * h;
      const dPersen = Math.min(100, Math.max(0, Number(item.diskon_persen !== undefined ? item.diskon_persen : 0)));
      const dNominal = item.diskon_persen !== undefined && dPersen > 0
        ? Math.round((gross * dPersen) / 100)
        : Math.max(0, Number(item.diskon) || 0);
      return sum + Math.max(0, gross - dNominal);
    }, 0);

    const diskonPersen = Math.max(0, Number(currentForm.diskon_persen) || 0);
    const diskonNominal = Math.round((itemsSubtotal * diskonPersen) / 100);
    const dpp = Math.max(0, itemsSubtotal - diskonNominal);

    const pajakPersen = Math.max(0, Number(currentForm.pajak_persen) || 0);
    const pajakNominal = Math.round((dpp * pajakPersen) / 100);

    const totalHarga = dpp + pajakNominal;

    return {
      itemsSubtotal,
      diskonNominal,
      dpp,
      pajakNominal,
      totalHarga,
    };
  };

  // --- Add Form Item Handlers ---
  const addItemRow = () => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { kode_produk: '', satuan_order: 'BOX', qty_order: 1, qty_pesanan: 1, harga_satuan: 0, diskon_persen: 0, diskon: 0 }],
    }));
  };

  const removeItemRow = (idx) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  };

  const updateItemRow = (idx, field, val) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        const matched = products.find((p) => p.kode_produk === (field === 'kode_produk' ? val : item.kode_produk));

        if (field === 'kode_produk' && matched) {
          const u = getProductUnits(matched);
          const chosenUnit = u.hasBigUnit && u.isiBoxPcs > 1 ? u.bigUnit : u.baseUnit;
          const rasio = convertToPcs(1, chosenUnit, matched);
          updated.satuan_order = chosenUnit;
          updated.qty_order = 1;
          updated.qty_pesanan = rasio;
          if (matched.harga !== undefined) {
            updated.harga_satuan = Math.round(Number(matched.harga || 0) * rasio);
          }
        } else if ((field === 'qty_order' || field === 'satuan_order') && matched) {
          const chosenUnit = field === 'satuan_order' ? val : (updated.satuan_order || matched.satuan_besar || 'BOX');
          const rasio = convertToPcs(1, chosenUnit, matched);
          const qOrder = Number(field === 'qty_order' ? val : updated.qty_order) || 0;
          updated.qty_pesanan = Math.round(qOrder * rasio * 100) / 100;
          if (field === 'satuan_order' && matched.harga !== undefined) {
            updated.harga_satuan = Math.round(Number(matched.harga || 0) * rasio);
          }
        }
        return updated;
      }),
    }));
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      setError('Minimal 1 item produk');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const totals = calculateTotals(form);
      const { data } = await api.post('/sales-orders', {
        ...form,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        diskon_persen: Number(form.diskon_persen) || 0,
        diskon_nominal: totals.diskonNominal,
        pajak_persen: Number(form.pajak_persen) || 0,
        pajak_nominal: totals.pajakNominal,
        subtotal: totals.itemsSubtotal,
        total_harga: totals.totalHarga,
        items: form.items.map((i) => {
          const pObj = products.find((p) => p.kode_produk === i.kode_produk);
          const rasio = convertToPcs(1, i.satuan_order, pObj);
          const qOrder = Number(i.qty_order) || 1;
          const qPesanan = Number(i.qty_pesanan) || Math.round(qOrder * rasio);
          const h = Number(i.harga_satuan) || 0;
          const gross = qOrder * h;
          const dPersen = Math.min(100, Math.max(0, Number(i.diskon_persen !== undefined ? i.diskon_persen : 0)));
          const dNominal = i.diskon_persen !== undefined && dPersen > 0
            ? Math.round((gross * dPersen) / 100)
            : Math.max(0, Number(i.diskon) || 0);
          return {
            kode_produk: i.kode_produk,
            satuan_order: i.satuan_order || (pObj?.satuan_besar || 'BOX'),
            qty_order: qOrder,
            qty_pesanan: qPesanan,
            harga_satuan: h,
            diskon_persen: dPersen,
            diskon: dNominal,
            subtotal: Math.max(0, gross - dNominal),
          };
        }),
      });
      flash(data.message);
      toastSuccess(data.message);
      setAddModal(false);
      setForm(emptySoForm);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Membuat SO', msg);
    } finally {
      setSaving(false);
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
          title="LAPORAN REKAPITULASI SALES ORDER (PESANAN PENJUALAN)"
          subtitle={`Status: ${statusFilter || 'Semua Status'} | Per Tanggal: ${formatDate(new Date())}`}
          docNo="REP-SO"
        />
      </div>

      {/* Notifikasi */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 print:hidden">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* --- Tabel SO --- */}
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Sales Orders (SO)</h2>
              <p className="text-xs text-slate-500">{sos.length} dokumen SO</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchableSelect
              className="w-36"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="Semua Status"
              searchPlaceholder="Cari status..."
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'OPEN', label: 'OPEN' },
                { value: 'PROCESSING', label: 'PROCESSING' },
                { value: 'CLOSED', label: 'CLOSED' },
                { value: 'CANCELLED', label: 'CANCELLED' },
              ]}
            />
            <input
              className="input w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No SO / Customer..."
            />
            <button
              type="button"
              onClick={() => setReportCustomizerOpen(true)}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Kustomisasi Kop Perusahaan & Format Cetak"
            >
              <Sliders className="h-3.5 w-3.5 text-blue-600" />
              Kustomisasi
            </button>
            <button
              type="button"
              onClick={() => {
                const headers = ['No. SO', 'Customer', 'Tanggal SO', 'Jatuh Tempo', 'Total Tagihan (Rp)', 'Status Pembayaran', 'Status SO', 'Keterangan'];
                const rows = sos.map((so) => [
                  so.no_so || '',
                  so.nama_customer || '',
                  formatDate(so.tanggal_so),
                  formatDate(so.jatuh_tempo),
                  so.total_harga || 0,
                  !so.ar_id || so.status_pembayaran === 'BELUM_DITAGIH'
                    ? 'Belum Difakturkan'
                    : so.status_pembayaran || '',
                  so.status || '',
                  so.keterangan || '',
                ]);
                exportToExcel('Rekap_Sales_Orders_SO', headers, rows);
              }}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Export Sales Orders ke Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Cetak Laporan Sales Orders ke PDF"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" />
              Cetak / Export PDF
            </button>
            <button type="button" onClick={() => setAddModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Buat SO Baru
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data Sales Orders...
          </div>
        ) : sos.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Belum ada Sales Order.</p>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(sos, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="table-base print:w-full">
                    <thead>
                      <tr>
                        {reportConfig.columns?.no_so !== false && <th>No SO</th>}
                        {reportConfig.columns?.customer !== false && <th>Customer</th>}
                        {reportConfig.columns?.tanggal_so !== false && <th>Tanggal SO</th>}
                        {reportConfig.columns?.jatuh_tempo !== false && <th>Jatuh Tempo</th>}
                        {reportConfig.columns?.total_tagihan !== false && <th className="text-right">Total Tagihan</th>}
                        {reportConfig.columns?.status_bayar !== false && <th className="text-center">Status Bayar</th>}
                        {reportConfig.columns?.status_so !== false && <th>Status SO</th>}
                        {reportConfig.columns?.keterangan !== false && <th>Keterangan</th>}
                        <th className="print:hidden">
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sos.map((so, index) => {
                        const isCurrentPage = index >= (safePage - 1) * pageSize && index < safePage * pageSize;
                        return (
                          <tr key={so.id} className={`hover:bg-slate-50 ${isCurrentPage ? '' : 'hidden print:table-row'}`}>
                            {reportConfig.columns?.no_so !== false && (
                              <td className="font-medium text-slate-700">{so.no_so}</td>
                            )}
                            {reportConfig.columns?.customer !== false && (
                              <td>{so.nama_customer || '-'}</td>
                            )}
                            {reportConfig.columns?.tanggal_so !== false && (
                              <td className="text-xs text-slate-500">{formatDate(so.tanggal_so)}</td>
                            )}
                            {reportConfig.columns?.jatuh_tempo !== false && (
                              <td className="whitespace-nowrap">
                                <div className="text-xs font-medium text-slate-800">
                                  {formatDate(so.jatuh_tempo)}
                                </div>
                                {so.ar_id && so.status_pembayaran !== 'LUNAS' && Number(so.total_harga) > 0 && so.hari_terlewat_tempo !== null && (
                                  <div className="mt-0.5">
                                    {Number(so.hari_terlewat_tempo) > 0 ? (
                                      <span className="inline-block rounded bg-rose-50 px-1 py-0.2 text-[10px] font-bold text-rose-600">
                                        Lewat {so.hari_terlewat_tempo} hr
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">
                                        Sisa {Math.abs(Number(so.hari_terlewat_tempo))} hr
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                            {reportConfig.columns?.total_tagihan !== false && (
                              <td className="text-right text-xs font-semibold text-slate-800">
                                {formatRupiah(so.total_harga)}
                              </td>
                            )}
                            {reportConfig.columns?.status_bayar !== false && (
                              <td className="whitespace-nowrap text-center">
                                {!so.ar_id || so.status_pembayaran === 'BELUM_DITAGIH' ? (
                                  <div>
                                    <span className="badge bg-amber-100 text-amber-800">Belum Difakturkan</span>
                                    <div className="mt-1 print:hidden">
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateInvoice(so)}
                                        disabled={invoicingId === so.id}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                                        title="Terbitkan Faktur Penjualan & Catat Piutang"
                                      >
                                        {invoicingId === so.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <FileCheck className="h-3 w-3" />
                                        )}
                                        Buat Faktur
                                      </button>
                                    </div>
                                  </div>
                                ) : so.status_pembayaran === 'LUNAS' || Number(so.total_harga) <= 0 ? (
                                  <span className="badge bg-emerald-100 text-emerald-800">Lunas</span>
                                ) : so.status_pembayaran === 'SEBAGIAN' ? (
                                  <div>
                                    <span className="badge bg-blue-100 text-blue-800">Sebagian</span>
                                    <div className="text-[10px] text-slate-500">Sisa {formatRupiah(so.sisa_piutang)}</div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="badge bg-rose-100 text-rose-800">Belum Lunas</span>
                                    <div className="text-[10px] text-slate-500">Sisa {formatRupiah(so.sisa_piutang)}</div>
                                  </div>
                                )}
                              </td>
                            )}
                            {reportConfig.columns?.status_so !== false && (
                              <td>
                                <span className={`badge ${statusBadges[so.status] || 'bg-slate-100'}`}>
                                  {so.status}
                                </span>
                              </td>
                            )}
                            {reportConfig.columns?.keterangan !== false && (
                              <td className="max-w-xs truncate text-xs text-slate-500">
                                {so.keterangan || '-'}
                              </td>
                            )}
                            <td className="print:hidden">
                              <div className="flex justify-end gap-1">
                                {(!so.ar_id || so.status_pembayaran === 'BELUM_DITAGIH') && (
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateInvoice(so)}
                                    disabled={invoicingId === so.id}
                                    className="rounded p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition"
                                    title="Terbitkan Faktur Penjualan (Piutang & Jurnal)"
                                    aria-label={`Terbitkan Faktur ${so.no_so}`}
                                  >
                                    {invoicingId === so.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FileCheck className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handlePrintRow(so)}
                                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition"
                                  title="Cetak Surat Pesanan Penjualan (SO)"
                                  aria-label={`Cetak ${so.no_so}`}
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDetail(so.id)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                                  title="Lihat Detail SO"
                                  aria-label={`Detail ${so.no_so}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSo(so)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                                  title="Hapus SO"
                                  aria-label={`Hapus ${so.no_so}`}
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
                <div className="print:hidden">
                  <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    onPage={setPage}
                    totalItems={sos.length}
                    pageSize={pageSize}
                    onPageSize={(s) => {
                      setPageSize(s);
                      setPage(1);
                    }}
                    label="Sales Orders"
                  />
                </div>

                {/* Blok Tanda Tangan Cetak PDF */}
                <div className="hidden print:block avoid-break mt-6">
                  <PrintableReportSignatures
                    city={reportConfig.signatureCity}
                    date={reportConfig.signatureDate}
                    signer1={reportConfig.signer1}
                    signer2={reportConfig.signer2}
                    signer3={reportConfig.signer3}
                    companyStamp={reportConfig.companyStamp}
                    showStamp={reportConfig.showStamp}
                    stampPosition={reportConfig.stampPosition}
                    showSignatures={reportConfig.showSignatures}
                    footerNote={reportConfig.footerNote}
                  />
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* Modal Kustomisasi Laporan */}
      <ReportCustomizerModal
        isOpen={reportCustomizerOpen}
        onClose={() => setReportCustomizerOpen(false)}
        config={reportConfig}
        onChangeConfig={setReportConfig}
        menuKey="SO"
        activeReportTitle="Laporan Sales Orders (SO)"
      />

      {/* --- Modal Detail SO --- */}
      {activeSo && (
        <Modal
          isOpen={detailModal}
          title={`Detail SO: ${activeSo.no_so}`}
          onClose={() => setDetailModal(false)}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            {/* Status Faktur Penjualan Banner */}
            {!activeSo.ar_id || activeSo.status_pembayaran === 'BELUM_DITAGIH' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-900">Faktur Penjualan Belum Diterbitkan</h4>
                    <p className="text-[11px] text-amber-700">
                      Piutang usaha dan jurnal pendapatan belum dicatat. Faktur akan terbit otomatis saat Pengiriman (DO) berstatus SHIPPED / DELIVERED, atau Anda dapat menerbitkannya secara langsung.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateInvoice(activeSo)}
                  disabled={invoicingId === activeSo.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {invoicingId === activeSo.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileCheck className="h-3.5 w-3.5" />
                  )}
                  Terbitkan Faktur Sekarang
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-900">
                      Faktur Penjualan: <span className="font-mono text-emerald-800">{activeSo.no_tagihan || `INV-${activeSo.no_so}`}</span>
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Telah tercatat di Buku Piutang & Jurnal Pendapatan. Status: <span className="font-semibold">{activeSo.status_pembayaran}</span> {activeSo.sisa_piutang !== undefined && Number(activeSo.sisa_piutang) > 0 ? `(Sisa Piutang: ${formatRupiah(activeSo.sisa_piutang)})` : ''}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  Faktur Aktif
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
              <div>
                <span className="text-slate-500">Customer:</span>{' '}
                <strong className="block text-slate-700">{activeSo.nama_customer || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Tanggal SO:</span>{' '}
                <strong className="block text-slate-700">{formatDate(activeSo.tanggal_so)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Status Saat Ini:</span>{' '}
                <div className="mt-0.5">
                  <span className={`badge ${statusBadges[activeSo.status]}`}>
                    {activeSo.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500">Total Tagihan:</span>{' '}
                <strong className="block text-blue-700 text-sm">{formatRupiah(activeSo.total_harga)}</strong>
              </div>
              {activeSo.keterangan && (
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-slate-500">Keterangan:</span>{' '}
                  <span className="text-slate-700">{activeSo.keterangan}</span>
                </div>
              )}
            </div>

            {/* Ubah Status */}
            <div className="flex flex-wrap items-center gap-2 border-t border-b border-slate-100 py-3">
              <span className="text-xs font-medium text-slate-600">Ubah Status SO:</span>
              {['OPEN', 'PROCESSING', 'CLOSED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => changeStatus(activeSo.id, st)}
                  disabled={activeSo.status === st}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    activeSo.status === st
                      ? 'bg-slate-800 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-semibold uppercase text-slate-500">Detail Pesanan Barang</h3>
            <div className="overflow-x-auto">
              <table className="table-base text-xs">
                <thead>
                  <tr>
                    <th>Kode Produk</th>
                    <th>Nama Produk</th>
                    <th className="text-right">Qty Pesanan</th>
                    <th className="text-right">Harga Satuan</th>
                    <th className="text-right">Diskon</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Qty Terkirim</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSo.details?.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium text-slate-700">{d.kode_produk}</td>
                      <td>{d.nama_produk || '-'}</td>
                      <td className="text-right font-semibold">
                        {d.qty_order && d.satuan_order && d.satuan_order !== (d.satuan || 'PCS') ? (
                          <div>
                            <p className="text-slate-900">{formatNumber(d.qty_order)} {d.satuan_order}</p>
                            <p className="text-[11px] text-emerald-700 font-medium">
                              (= {formatNumber(d.qty_pesanan)} {d.satuan || 'PCS'})
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p>{formatNumber(d.qty_pesanan)} {d.satuan || 'PCS'}</p>
                            {(Number(d.isi_box_pcs) > 1 || Number(d.isi_per_kemasan) > 1) && (
                              <p className="text-[11px] text-indigo-600 font-medium">
                                ≈ {formatMultiTierBreakdown(d.qty_pesanan, d)}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-right">{formatRupiah(d.harga_satuan)}</td>
                      <td className="text-right text-red-600">
                        {Number(d.diskon_persen) > 0 ? (
                          <div>
                            <span className="font-semibold">{Number(d.diskon_persen)}%</span>
                            {Number(d.diskon) > 0 && (
                              <span className="block text-[10px] text-slate-500 font-normal">(-{formatRupiah(d.diskon)})</span>
                            )}
                          </div>
                        ) : Number(d.diskon) > 0 ? (
                          `-${formatRupiah(d.diskon)}`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="text-right font-semibold text-slate-800">{formatRupiah(d.subtotal)}</td>
                      <td className="text-right text-emerald-600 font-semibold">
                        <p>{formatNumber(d.qty_terkirim)} {d.satuan || ''}</p>
                        {Number(d.isi_per_kemasan) > 1 && (
                          <p className="text-[11px] text-emerald-700 font-medium">
                            ≈ {formatNumber(Number((d.qty_terkirim / d.isi_per_kemasan).toFixed(1)))} {d.satuan_besar || 'BOX'}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rincian Total Biaya */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-80 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Item:</span>
                  <span className="font-medium">{formatRupiah(activeSo.subtotal)}</span>
                </div>
                {Number(activeSo.diskon_nominal) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Diskon SO ({Number(activeSo.diskon_persen)}%):</span>
                    <span className="font-medium">-{formatRupiah(activeSo.diskon_nominal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Pajak PPN ({Number(activeSo.pajak_persen)}%):</span>
                  <span className="font-medium text-blue-600">+{formatRupiah(activeSo.pajak_nominal)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Total Tagihan SO:</span>
                  <span className="text-blue-700">{formatRupiah(activeSo.total_harga)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintRow(activeSo)}
                  className="btn-secondary !text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold"
                  title="Cetak Surat Pesanan Penjualan (SO) Resmi"
                >
                  <Printer className="h-4 w-4" /> Cetak Surat Pesanan (SO)
                </button>
                {(!activeSo.ar_id || activeSo.status_pembayaran === 'BELUM_DITAGIH') && (
                  <button
                    type="button"
                    onClick={() => handleGenerateInvoice(activeSo)}
                    disabled={invoicingId === activeSo.id}
                    className="btn-secondary !text-xs flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-semibold"
                    title="Terbitkan Faktur Penjualan"
                  >
                    {invoicingId === activeSo.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck className="h-4 w-4" />
                    )}
                    Terbitkan Faktur
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setDetailModal(false)} className="btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- Modal Buat SO Baru --- */}
      <Modal isOpen={addModal} title="Buat Sales Order Baru" onClose={() => setAddModal(false)} maxWidth="max-w-5xl">
        {(() => {
          const totals = calculateTotals(form);
          return (
            <form onSubmit={submitAdd} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="no_so">Nomor SO (opsional auto)</label>
                  <input
                    id="no_so"
                    className="input"
                    value={form.no_so}
                    onChange={(e) => setForm({ ...form, no_so: e.target.value })}
                    placeholder="Auto jika dikosongkan"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="customer_id">Customer</label>
                  <SearchableSelect
                    id="customer_id"
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    placeholder="-- Pilih Customer --"
                    searchPlaceholder="Cari kode atau nama customer..."
                    options={[
                      { value: '', label: '-- Pilih Customer --' },
                      ...customers.map((c) => ({
                        value: c.id,
                        label: `${c.kode_customer} — ${c.nama_customer}`,
                      })),
                    ]}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="tanggal_so">Tanggal SO *</label>
                  <input
                    id="tanggal_so"
                    type="date"
                    className="input"
                    value={form.tanggal_so}
                    onChange={(e) => {
                      const tgl = e.target.value;
                      setForm({
                        ...form,
                        tanggal_so: tgl,
                        jatuh_tempo: calculateDueDate(tgl, form.termin_hari),
                      });
                    }}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="termin_hari_so">Termin Bayar</label>
                    <select
                      id="termin_hari_so"
                      className="input"
                      value={form.termin_hari}
                      onChange={(e) => {
                        const days = Number(e.target.value);
                        setForm({
                          ...form,
                          termin_hari: days,
                          jatuh_tempo: calculateDueDate(form.tanggal_so, days),
                        });
                      }}
                    >
                      <option value="0">Cash / COD</option>
                      <option value="7">Net 7 Hari</option>
                      <option value="14">Net 14 Hari</option>
                      <option value="30">Net 30 Hari</option>
                      <option value="45">Net 45 Hari</option>
                      <option value="60">Net 60 Hari</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="jatuh_tempo_so">Jatuh Tempo *</label>
                    <input
                      id="jatuh_tempo_so"
                      type="date"
                      className="input font-semibold"
                      value={form.jatuh_tempo}
                      onChange={(e) => setForm({ ...form, jatuh_tempo: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="keterangan_so">Keterangan</label>
                  <input
                    id="keterangan_so"
                    className="input"
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    placeholder="Catatan SO"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Daftar Produk Pesanan</span>
                    <span className="text-[11px] text-slate-400">({form.items.length} item)</span>
                  </div>
                  <button type="button" onClick={addItemRow} className="btn-secondary py-1 text-xs">
                    <PlusCircle className="h-3.5 w-3.5" /> Tambah Baris
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-semibold tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3 min-w-[240px]">Produk *</th>
                          <th className="py-2.5 px-2.5 w-24 text-center">Qty *</th>
                          <th className="py-2.5 px-2.5 w-36">Satuan *</th>
                          <th className="py-2.5 px-3 w-36 text-right">Harga Satuan (Rp)</th>
                          <th className="py-2.5 px-3 w-28 text-right">Diskon (%)</th>
                          <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                          <th className="py-2.5 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {form.items.map((item, idx) => {
                          const qOrder = Number(item.qty_order !== undefined ? item.qty_order : item.qty_pesanan) || 0;
                          const hSatuan = Number(item.harga_satuan) || 0;
                          const lineGross = qOrder * hSatuan;
                          const dPersen = Math.min(100, Math.max(0, Number(item.diskon_persen !== undefined ? item.diskon_persen : 0)));
                          const lineDiscNominal = item.diskon_persen !== undefined && dPersen > 0
                            ? Math.round((lineGross * dPersen) / 100)
                            : Math.max(0, Number(item.diskon) || 0);
                          const lineSubtotal = Math.max(0, lineGross - lineDiscNominal);
                          const pObj = products.find((p) => p.kode_produk === item.kode_produk);
                          const unitOptions = getUnitDropdownOptions(pObj);
                          const qVal = item.qty_order !== undefined ? item.qty_order : item.qty_pesanan;
                          const prev = getConversionPreviewText(qVal, item.satuan_order, pObj);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              {/* Row Number */}
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] align-top pt-3.5">
                                {idx + 1}
                              </td>

                              {/* Produk */}
                              <td className="py-2.5 px-3 align-top">
                                <SearchableSelect
                                  className="w-full text-xs"
                                  size="sm"
                                  value={item.kode_produk}
                                  onChange={(e) => updateItemRow(idx, 'kode_produk', e.target.value)}
                                  required
                                  placeholder="-- Pilih Produk --"
                                  searchPlaceholder="Cari kode atau nama produk..."
                                  options={[
                                    { value: '', label: '-- Pilih Produk --' },
                                    ...products.map((p) => ({
                                      value: p.kode_produk,
                                      label: `${p.kode_produk} — ${p.nama_produk}`,
                                      sublabel: Number(p.isi_per_kemasan) > 1 || Number(p.isi_box_pcs) > 1
                                        ? (Number(p.isi_box_pack) > 1
                                            ? `1 ${p.satuan_besar || 'BOX'} = ${p.isi_box_pack} ${p.satuan_menengah || 'PACK'} = ${p.isi_box_pcs || p.isi_per_kemasan} ${p.satuan || 'PCS'}`
                                            : `1 ${p.satuan_besar || 'BOX'} = ${p.isi_box_pcs || p.isi_per_kemasan} ${p.satuan || 'PCS'}`)
                                        : p.harga ? `Harga master: ${formatRupiah(p.harga)}` : undefined,
                                    })),
                                  ]}
                                />
                                {pObj && (Number(pObj.isi_per_kemasan) > 1 || Number(pObj.isi_box_pcs) > 1) && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded px-1.5 py-0.5">
                                      {Number(pObj.isi_box_pack) > 1
                                        ? `1 ${pObj.satuan_besar || 'BOX'} = ${pObj.isi_box_pack} ${pObj.satuan_menengah || 'PACK'} = ${pObj.isi_box_pcs || pObj.isi_per_kemasan} ${pObj.satuan || 'PCS'}`
                                        : `1 ${pObj.satuan_besar || 'BOX'} = ${pObj.isi_box_pcs || pObj.isi_per_kemasan} ${pObj.satuan || 'PCS'}`}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Qty Order */}
                              <td className="py-2.5 px-2.5 align-top">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  className="input w-full text-xs px-2 py-1.5 text-center font-bold text-indigo-700"
                                  value={item.qty_order !== undefined ? item.qty_order : item.qty_pesanan}
                                  onChange={(e) => updateItemRow(idx, 'qty_order', e.target.value)}
                                  placeholder="Qty"
                                  required
                                />
                              </td>

                              {/* Satuan Order (SearchableSelect) */}
                              <td className="py-2.5 px-2.5 align-top">
                                <SearchableSelect
                                  size="sm"
                                  className="w-full text-xs font-semibold text-slate-700"
                                  value={item.satuan_order || (pObj?.satuan_besar || 'BOX')}
                                  onChange={(e) => updateItemRow(idx, 'satuan_order', e.target.value)}
                                  placeholder="Satuan"
                                  searchPlaceholder="Cari satuan..."
                                  options={unitOptions.map((opt) => ({
                                    value: opt.value,
                                    label: opt.shortLabel,
                                    sublabel: opt.label.includes('(')
                                      ? opt.label.slice(opt.label.indexOf('(') + 1, -1)
                                      : (opt.ratio > 1 ? `1 ${opt.shortLabel} = ${opt.ratio} ${pObj?.satuan || 'PCS'}` : 'Satuan Dasar'),
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

                              {/* Harga Satuan */}
                              <td className="py-2.5 px-3 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  className="input w-full text-xs px-2 py-1.5 text-right font-medium"
                                  value={item.harga_satuan}
                                  onChange={(e) => updateItemRow(idx, 'harga_satuan', e.target.value)}
                                  placeholder="0"
                                />
                              </td>

                              {/* Diskon Item (%) */}
                              <td className="py-2.5 px-3 align-top">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    className="input w-full text-xs pr-6 pl-2 py-1.5 text-right font-medium"
                                    value={item.diskon_persen !== undefined ? item.diskon_persen : (item.diskon || '')}
                                    onChange={(e) => updateItemRow(idx, 'diskon_persen', e.target.value)}
                                    placeholder="0"
                                  />
                                  <span className="absolute right-2 top-2 text-[11px] font-bold text-slate-400 pointer-events-none">
                                    %
                                  </span>
                                </div>
                                {lineDiscNominal > 0 && (
                                  <div className="mt-1 text-right">
                                    <span className="text-[10px] font-medium text-red-600 block">
                                      -{formatRupiah(lineDiscNominal)}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Subtotal */}
                              <td className="py-2.5 px-3 text-right font-bold text-xs text-slate-800 align-top pt-3.5 whitespace-nowrap">
                                {formatRupiah(lineSubtotal)}
                              </td>

                              {/* Hapus Baris */}
                              <td className="py-2.5 px-2 text-center align-top pt-2.5">
                                {form.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeItemRow(idx)}
                                    className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                                    aria-label="Hapus baris"
                                    title="Hapus baris ini"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Ringkasan Perhitungan Biaya */}
              <div className="flex justify-end border-t border-slate-100 pt-3">
                <div className="w-full sm:w-80 rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal Item:</span>
                    <span className="font-semibold">{formatRupiah(totals.itemsSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span>Diskon SO (%):</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input w-16 px-1.5 py-1 text-xs text-center"
                        value={form.diskon_persen}
                        onChange={(e) => setForm({ ...form, diskon_persen: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <span className="font-medium text-red-600">
                      {totals.diskonNominal > 0 ? `-${formatRupiah(totals.diskonNominal)}` : 'Rp0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span>Pajak PPN (%):</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input w-16 px-1.5 py-1 text-xs text-center"
                        value={form.pajak_persen}
                        onChange={(e) => setForm({ ...form, pajak_persen: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <span className="font-medium text-blue-600">
                      {totals.pajakNominal > 0 ? `+${formatRupiah(totals.pajakNominal)}` : 'Rp0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                    <span>Total Tagihan SO:</span>
                    <span className="text-blue-700 text-base">{formatRupiah(totals.totalHarga)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan SO
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>
      {/* Modal Cetak Dokumen Surat Pesanan Penjualan (SO) */}
      <PrintableInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        type="SO"
        data={selectedInvoiceData}
        loading={loadingInvoice}
      />
    </div>
  );
}

