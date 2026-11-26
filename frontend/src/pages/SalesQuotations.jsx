import { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Send,
  XCircle,
  ShoppingCart,
  Trash2,
  DollarSign,
  Tag,
  Building,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 10;

const STATUS_BADGES = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  SENT: { label: 'Terkirim', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ACCEPTED: { label: 'Disetujui', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-50 text-red-700 border-red-200' },
  CONVERTED_TO_SO: { label: 'Sudah Jadi SO', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function SalesQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    berlaku_sampai: () => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    },
    termin_pembayaran: 'NET 30',
    pajak_persen: '11',
    diskon_nominal: '0',
    catatan: '',
    items: [],
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sqRes, custRes, prodRes] = await Promise.all([
        api.get('/sales-quotations'),
        api.get('/customers'),
        api.get('/products'),
      ]);

      if (sqRes.data.success) setQuotations(sqRes.data.data || []);
      if (custRes.data.success) setCustomers(custRes.data.data || []);
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

  const handleOpenAddModal = () => {
    const defaultCust = customers[0]?.id ? String(customers[0].id) : '';
    const defaultProd = products[0]?.id ? String(products[0].id) : '';
    const d = new Date();
    d.setDate(d.getDate() + 14);

    setForm({
      customer_id: defaultCust,
      tanggal: new Date().toISOString().split('T')[0],
      berlaku_sampai: d.toISOString().split('T')[0],
      termin_pembayaran: 'NET 30',
      pajak_persen: '11',
      diskon_nominal: '0',
      catatan: '',
      items: defaultProd
        ? [
            {
              product_id: defaultProd,
              qty: 1,
              harga_satuan: products[0]?.harga || 0,
              diskon_nominal: 0,
              catatan: '',
            },
          ]
        : [],
    });
    setModalOpen(true);
  };

  const handleAddItemRow = () => {
    const defaultProd = products[0]?.id ? String(products[0].id) : '';
    const prodObj = products[0] || {};
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: defaultProd,
          qty: 1,
          harga_satuan: prodObj.harga || 0,
          diskon_nominal: 0,
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
    const matched = products.find((p) => String(p.id) === String(productId));
    setForm((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        product_id: productId,
        harga_satuan: matched?.harga || 0,
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

  const handleSaveQuotation = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      alertError('Peringatan', 'Pilih customer / rumah sakit tujuan penawaran!');
      return;
    }
    if (form.items.length === 0) {
      alertError('Peringatan', 'Tambahkan minimal 1 produk penawaran!');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        customer_id: Number(form.customer_id),
        diskon_nominal: Number(form.diskon_nominal || 0),
        pajak_persen: Number(form.pajak_persen || 0),
        items: form.items.map((it) => ({
          product_id: Number(it.product_id),
          qty: Number(it.qty),
          harga_satuan: Number(it.harga_satuan || 0),
          diskon_nominal: Number(it.diskon_nominal || 0),
          catatan: it.catatan,
        })),
      };

      const res = await api.post('/sales-quotations', payload);
      toastSuccess('Penawaran Terbit!', res.data.message);
      setModalOpen(false);
      loadData();
    } catch (err) {
      alertError('Gagal Menyimpan Penawaran', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (sq, newStatus) => {
    try {
      const res = await api.put(`/sales-quotations/${sq.id}/status`, { status: newStatus });
      toastSuccess('Status Berubah', res.data.message);
      loadData();
    } catch (err) {
      alertError('Gagal Mengubah Status', getErrorMessage(err));
    }
  };

  const handleConvertToSO = async (sq) => {
    try {
      const res = await api.post(`/sales-quotations/${sq.id}/convert-to-so`);
      toastSuccess('Sukses!', res.data.message);
      loadData();
    } catch (err) {
      alertError('Gagal Mengonversi ke SO', getErrorMessage(err));
    }
  };

  // Calculations for Add Form
  const subtotalForm = form.items.reduce((sum, it) => {
    const lineSub = Number(it.qty || 0) * Number(it.harga_satuan || 0) - Number(it.diskon_nominal || 0);
    return sum + Math.max(0, lineSub);
  }, 0);
  const afterDiscountForm = Math.max(0, subtotalForm - Number(form.diskon_nominal || 0));
  const taxForm = Math.round((afterDiscountForm * Number(form.pajak_persen || 0)) / 100);
  const grandTotalForm = afterDiscountForm + taxForm;

  // Filtered
  const filteredQuotations = quotations.filter((q) => {
    const matchSearch =
      (q.no_quotation || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.nama_customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.catatan || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { pageItems: paginatedQuotations, totalPages, safePage } = paginate(
    filteredQuotations,
    page,
    pageSize
  );

  // KPIs
  const totalPipeline = quotations.reduce((sum, q) => sum + Number(q.grand_total || 0), 0);
  const totalConverted = quotations.filter((q) => q.status === 'CONVERTED_TO_SO').length;
  const totalAccepted = quotations.filter((q) => q.status === 'ACCEPTED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <FileText className="h-7 w-7 text-sky-600" />
            Surat Penawaran Harga (Sales Quotation)
          </h1>
          <p className="text-sm text-slate-500">
            Penerbitan surat penawaran harga resmi komersial ke Rumah Sakit, Klinik, dan Dinkes sebelum disetujui menjadi Sales Order (SO).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const headers = ['No. Penawaran (SQ)', 'Customer', 'Tanggal SQ', 'Berlaku Hingga', 'Subtotal (Rp)', 'Total Penawaran (Rp)', 'Status'];
              const rows = quotations.map((q) => [
                q.no_sq || '',
                q.nama_customer || '',
                formatDate(q.tanggal_sq),
                formatDate(q.berlaku_hingga),
                q.subtotal || 0,
                q.total_harga || 0,
                q.status || '',
              ]);
              exportToExcel('Rekap_Penawaran_Sales_Quotations_SQ', headers, rows);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            title="Export Penawaran Harga ke Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            title="Cetak Penawaran Harga ke PDF"
          >
            <Printer className="h-4 w-4 text-blue-600" />
            Cetak PDF
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
            Segarkan
          </button>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition"
          >
            <Plus className="h-4 w-4" />
            Buat Penawaran Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Penawaran Terbit</span>
            <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{quotations.length} Dokumen</div>
          <p className="mt-1 text-xs text-slate-500">Seluruh surat penawaran aktif</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Nilai Pipeline Penawaran</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{formatRupiah(totalPipeline)}</div>
          <p className="mt-1 text-xs text-slate-500">Potensi pendapatan komersial</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Disetujui RS / Customer</span>
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-teal-700">{totalAccepted} Dokumen</div>
          <p className="mt-1 text-xs text-slate-500">Siap dikonversi ke Sales Order</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Terkonversi Menjadi SO</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{totalConverted} Dokumen</div>
          <p className="mt-1 text-xs text-slate-500">Telah resmi diproses gudang & pengiriman</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor penawaran, nama rumah sakit, atau catatan..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="w-52">
          <SearchableSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e?.target ? e.target.value : e);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Status' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SENT', label: 'Terkirim (Sent)' },
              { value: 'ACCEPTED', label: 'Disetujui (Accepted)' },
              { value: 'REJECTED', label: 'Ditolak' },
              { value: 'CONVERTED_TO_SO', label: 'Sudah Jadi SO' },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat daftar surat penawaran...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Penawaran Harga</p>
            <p className="text-sm mt-1">Terbitkan surat penawaran komersial untuk pelanggan dan rekanan rumah sakit.</p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" />
              Buat Penawaran Pertama
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">No Penawaran & Tgl</th>
                    <th className="px-4 py-3">Customer / Rekanan RS</th>
                    <th className="px-4 py-3">Berlaku Sampai</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    <th className="px-4 py-3 text-right">Grand Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi & Konversi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedQuotations.map((sq) => {
                    const badge = STATUS_BADGES[sq.status] || { label: sq.status, color: 'bg-slate-100 text-slate-700' };

                    return (
                      <tr key={sq.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{sq.no_quotation}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{formatDate(sq.tanggal)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">{sq.nama_customer}</div>
                          <div className="text-xs text-slate-400 font-mono">{sq.kode_customer}</div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-700">
                          {formatDate(sq.berlaku_sampai)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-800">
                          {formatRupiah(sq.subtotal)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-sky-700">
                          {formatRupiah(sq.grand_total)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {sq.status !== 'CONVERTED_TO_SO' && (
                              <button
                                onClick={() => handleConvertToSO(sq)}
                                className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 transition"
                                title="Konversi Penawaran Menjadi Sales Order (SO)"
                              >
                                <ShoppingCart className="h-3 w-3" /> Jadi SO
                              </button>
                            )}

                            {sq.status === 'DRAFT' && (
                              <button
                                onClick={() => handleUpdateStatus(sq, 'SENT')}
                                className="rounded p-1 text-blue-600 hover:bg-blue-50"
                                title="Tandai Terkirim"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {sq.status === 'SENT' && (
                              <button
                                onClick={() => handleUpdateStatus(sq, 'ACCEPTED')}
                                className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                title="Tandai Disetujui"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
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

            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPage={setPage}
                totalItems={filteredQuotations.length}
                pageSize={pageSize}
                onPageSize={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                label="penawaran harga"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Buat Surat Penawaran Harga Baru */}
      <Modal
        isOpen={modalOpen}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Formulir Surat Penawaran Harga (Sales Quotation)"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveQuotation} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Customer / Rumah Sakit <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e?.target ? e.target.value : e })}
                options={customers.map((c) => ({
                  value: String(c.id),
                  label: `${c.kode_customer} - ${c.nama_customer}`,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tanggal Penawaran <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Berlaku Sampai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.berlaku_sampai}
                onChange={(e) => setForm({ ...form, berlaku_sampai: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Termin Pembayaran
              </label>
              <SearchableSelect
                value={form.termin_pembayaran}
                onChange={(e) => setForm({ ...form, termin_pembayaran: e?.target ? e.target.value : e })}
                options={[
                  { value: 'NET 14', label: '14 Hari (NET 14)' },
                  { value: 'NET 30', label: '30 Hari (NET 30)' },
                  { value: 'NET 60', label: '60 Hari (NET 60)' },
                  { value: 'COD', label: 'Cash on Delivery (COD)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                PPN (%)
              </label>
              <input
                type="number"
                value={form.pajak_persen}
                onChange={(e) => setForm({ ...form, pajak_persen: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Diskon Global (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={form.diskon_nominal}
                onChange={(e) => setForm({ ...form, diskon_nominal: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dynamic Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Rincian Produk & Harga yang Ditawarkan
              </h4>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="inline-flex items-center gap-1 rounded bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Produk
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {form.items.map((item, idx) => {
                const sub = Number(item.qty || 0) * Number(item.harga_satuan || 0);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                  >
                    <div className="col-span-5">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Produk</label>
                      <SearchableSelect
                        value={item.product_id}
                        onChange={(e) => handleProductChange(idx, e?.target ? e.target.value : e)}
                        options={products.map((p) => ({
                          value: String(p.id),
                          label: `${p.kode_produk} - ${p.nama_produk}`,
                          sublabel: Number(p.isi_per_kemasan) > 1 ? `1 ${p.satuan_besar || 'BOX'} = ${p.isi_per_kemasan} ${p.satuan}` : undefined,
                        }))}
                      />
                      {(() => {
                        const pObj = products.find((p) => String(p.id) === String(item.product_id));
                        if (pObj && Number(pObj.isi_per_kemasan) > 1) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 mt-1">
                              1 {pObj.satuan_besar || 'BOX'} = {pObj.isi_per_kemasan} {pObj.satuan}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div className="col-span-2 flex flex-col items-center">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Qty</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.qty}
                        onChange={(e) => handleItemFieldChange(idx, 'qty', e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-center font-bold text-indigo-700"
                      />
                      {(() => {
                        const pObj = products.find((p) => String(p.id) === String(item.product_id));
                        const isi = Number(pObj?.isi_per_kemasan) || 1;
                        if (pObj && isi > 1) {
                          const boxVal = (Number(item.qty || 0) / isi).toFixed(2).replace(/\.00$/, '');
                          return (
                            <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={boxVal}
                                onChange={(e) => {
                                  const boxNum = Number(e.target.value) || 0;
                                  const calcQty = Math.round(boxNum * isi * 100) / 100;
                                  handleItemFieldChange(idx, 'qty', calcQty);
                                }}
                                className="w-10 px-1 py-0.5 text-[10px] text-center border border-indigo-200 rounded font-bold bg-white text-indigo-800"
                              />
                              <span>{pObj.satuan_besar || 'BOX'}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Harga Satuan (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={item.harga_satuan}
                        onChange={(e) => handleItemFieldChange(idx, 'harga_satuan', e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-medium"
                      />
                    </div>

                    <div className="col-span-2 text-right pr-2">
                      <div className="text-[10px] text-slate-500">Subtotal</div>
                      <div className="text-xs font-bold text-slate-900">{formatRupiah(sub)}</div>
                    </div>

                    <div className="col-span-12 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={form.items.length <= 1}
                        className="text-xs text-red-600 hover:underline flex items-center gap-1 disabled:opacity-30"
                      >
                        <Trash2 className="h-3 w-3" /> Hapus Baris
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Summary */}
            <div className="rounded-lg bg-sky-50 p-3 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal Barang:</span>
                <span className="font-semibold">{formatRupiah(subtotalForm)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pajak PPN ({form.pajak_persen}%):</span>
                <span className="font-semibold">{formatRupiah(taxForm)}</span>
              </div>
              <div className="flex justify-between border-t border-sky-200 pt-1 text-sm font-bold text-sky-900">
                <span>Grand Total Penawaran:</span>
                <span>{formatRupiah(grandTotalForm)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Catatan Penawaran / Ketentuan Garansi
            </label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              placeholder="Garansi resmi 1 tahun, harga sudah termasuk ongkos kirim..."
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
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Terbitkan Surat Penawaran
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

