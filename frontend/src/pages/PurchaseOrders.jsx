import { useEffect, useState } from 'react';
import {
  FileText,
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
  Settings,
  RotateCcw,
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
import PoFormatModal from '../components/PoFormatModal.jsx';
import {
  loadSavedPoFormat,
  savePoFormat,
  generateNextPoNumber,
  DEFAULT_PO_FORMAT,
} from '../utils/poNumberHelper.js';

const PAGE_SIZE = 10;

const statusBadges = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const calculateDueDate = (dateStr, days) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
};

const emptyPoForm = {
  no_po: '',
  supplier_id: '',
  tanggal_po: new Date().toISOString().split('T')[0],
  termin_hari: 30,
  jatuh_tempo: calculateDueDate(new Date().toISOString().split('T')[0], 30),
  keterangan: '',
  diskon_persen: 0,
  pajak_persen: 11,
  items: [{ kode_produk: '', satuan_order: 'BOX', qty_order: 1, qty_pesan: 1, harga_satuan: 0, diskon_persen: 0, diskon: 0 }],
};

export default function PurchaseOrders() {
  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
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
  const [reportConfig, setReportConfig] = useState(() => loadSavedReportConfig('PO'));

  // Detail Modal
  const [detailModal, setDetailModal] = useState(false);
  const [activePo, setActivePo] = useState(null);

  // Cetak Dokumen Detail PO Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Add Modal state
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyPoForm);

  // Konfigurasi Penomoran PO Otomatis & Kustom
  const [poFormat, setPoFormat] = useState(() => loadSavedPoFormat());
  const [poFormatModalOpen, setPoFormatModalOpen] = useState(false);

  const handleOpenAddModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const autoNoPo = generateNextPoNumber(today, pos, poFormat);
    setForm({
      ...emptyPoForm,
      tanggal_po: today,
      jatuh_tempo: calculateDueDate(today, 30),
      no_po: autoNoPo,
    });
    setAddModal(true);
  };

  const handleTanggalPoChange = (newDate) => {
    const currentAuto = generateNextPoNumber(form.tanggal_po, pos, poFormat);
    const shouldRegenerate = !form.no_po || form.no_po === currentAuto;
    const newAuto = shouldRegenerate ? generateNextPoNumber(newDate, pos, poFormat) : form.no_po;

    setForm({
      ...form,
      tanggal_po: newDate,
      jatuh_tempo: calculateDueDate(newDate, form.termin_hari),
      no_po: newAuto,
    });
  };

  const handleSavePoFormat = (newConfig) => {
    setPoFormat(newConfig);
    savePoFormat(newConfig);
    const targetDate = form.tanggal_po || new Date().toISOString().split('T')[0];
    const newNoPo = generateNextPoNumber(targetDate, pos, newConfig);
    setForm((prev) => ({ ...prev, no_po: newNoPo }));
    toastSuccess(`Format nomor PO berhasil disimpan: ${newNoPo}`);
  };

  const handleRegeneratePoNumber = () => {
    const targetDate = form.tanggal_po || new Date().toISOString().split('T')[0];
    const newNo = generateNextPoNumber(targetDate, pos, poFormat);
    setForm((prev) => ({ ...prev, no_po: newNo }));
    toastSuccess(`Nomor PO diperbarui: ${newNo}`);
  };

  const handlePrintRow = async (po) => {
    setSelectedInvoiceData(po);
    setInvoiceModalOpen(true);
    setLoadingInvoice(true);
    try {
      const { data } = await api.get(`/purchase-orders/${po.id}`);
      setSelectedInvoiceData(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingInvoice(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [poRes, supRes, prdRes] = await Promise.all([
        api.get('/purchase-orders', {
          params: { status: statusFilter || undefined, search: search.trim() || undefined },
        }),
        api.get('/suppliers'),
        api.get('/products'),
      ]);
      setPos(poRes.data.data);
      setSuppliers(supRes.data.data);
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
      const { data } = await api.get(`/purchase-orders/${id}`);
      setActivePo(data.data);
      setDetailModal(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const changeStatus = async (id, newStatus) => {
    try {
      const { data } = await api.put(`/purchase-orders/${id}/status`, { status: newStatus });
      flash(data.message);
      toastSuccess(data.message);
      if (activePo && activePo.id === id) {
        setActivePo((prev) => ({ ...prev, status: newStatus }));
      }
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Mengubah Status', msg);
    }
  };

  const deletePo = async (po) => {
    const confirmed = await confirmDelete({
      title: `Hapus Purchase Order?`,
      text: `PO "${po.no_po}" beserta mutasi penerimaan barang masuk dan kartu stok akan dibatalkan/dihapus permanen, dan stok lot akan disesuaikan kembali!`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/purchase-orders/${po.id}`);
      flash(data.message);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus PO', msg);
    }
  };

  // --- Calculations ---
  const calculateTotals = (currentForm) => {
    const itemsSubtotal = (currentForm.items || []).reduce((sum, item) => {
      const q = Math.max(0, Number(item.qty_order !== undefined ? item.qty_order : item.qty_pesan) || 0);
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
      items: [...f.items, { kode_produk: '', satuan_order: 'BOX', qty_order: 1, qty_pesan: 1, harga_satuan: 0, diskon_persen: 0, diskon: 0 }],
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
          updated.qty_pesan = rasio;
          if (matched.harga !== undefined) {
            updated.harga_satuan = Math.round(Number(matched.harga || 0) * rasio);
          }
        } else if ((field === 'qty_order' || field === 'satuan_order') && matched) {
          const chosenUnit = field === 'satuan_order' ? val : (updated.satuan_order || matched.satuan_besar || 'BOX');
          const rasio = convertToPcs(1, chosenUnit, matched);
          const qOrder = Number(field === 'qty_order' ? val : updated.qty_order) || 0;
          updated.qty_pesan = Math.round(qOrder * rasio * 100) / 100;
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
      const { data } = await api.post('/purchase-orders', {
        ...form,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
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
          const qPesan = Number(i.qty_pesan) || Math.round(qOrder * rasio);
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
            qty_pesan: qPesan,
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
      setForm(emptyPoForm);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Membuat PO', msg);
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
          title="LAPORAN REKAPITULASI PURCHASE ORDER (PESANAN PEMBELIAN)"
          subtitle={`Status: ${statusFilter || 'Semua Status'} | Per Tanggal: ${formatDate(new Date())}`}
          docNo="REP-PO"
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

      {/* --- Tabel PO --- */}
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Purchase Orders (PO)</h2>
              <p className="text-xs text-slate-500">{pos.length} dokumen PO</p>
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
                { value: 'PENDING', label: 'PENDING' },
                { value: 'APPROVED', label: 'APPROVED' },
                { value: 'COMPLETED', label: 'COMPLETED' },
                { value: 'CANCELLED', label: 'CANCELLED' },
              ]}
            />
            <input
              className="input w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No PO / Supplier..."
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
                const headers = ['No. PO', 'Supplier', 'Tanggal PO', 'Jatuh Tempo', 'Total Tagihan (Rp)', 'Status Pembayaran', 'Status PO', 'Keterangan'];
                const rows = pos.map((po) => [
                  po.no_po || '',
                  po.nama_supplier || '',
                  formatDate(po.tanggal_po),
                  formatDate(po.jatuh_tempo),
                  po.total_harga || 0,
                  po.status_pembayaran || '',
                  po.status || '',
                  po.keterangan || '',
                ]);
                exportToExcel('Rekap_Purchase_Orders_PO', headers, rows);
              }}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Export Purchase Orders ke Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Cetak Laporan Purchase Orders ke PDF"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" />
              Cetak / Export PDF
            </button>
            <button
              type="button"
              onClick={() => setPoFormatModalOpen(true)}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Atur Format Awalan & Penomoran PO"
            >
              <Settings className="h-3.5 w-3.5 text-slate-600" />
              Format No. PO
            </button>
            <button type="button" onClick={handleOpenAddModal} className="btn-primary">
              <Plus className="h-4 w-4" /> Buat PO Baru
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data Purchase Orders...
          </div>
        ) : pos.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Belum ada Purchase Order.</p>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(pos, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="table-base print:w-full">
                    <thead>
                      <tr>
                        {reportConfig.columns?.no_po !== false && <th>No PO</th>}
                        {reportConfig.columns?.supplier !== false && <th>Supplier</th>}
                        {reportConfig.columns?.tanggal_po !== false && <th>Tanggal PO</th>}
                        {reportConfig.columns?.jatuh_tempo !== false && <th>Jatuh Tempo</th>}
                        {reportConfig.columns?.total_tagihan !== false && <th className="text-right">Total Tagihan</th>}
                        {reportConfig.columns?.status_bayar !== false && <th className="text-center">Status Bayar</th>}
                        {reportConfig.columns?.status_po !== false && <th>Status PO</th>}
                        {reportConfig.columns?.keterangan !== false && <th>Keterangan</th>}
                        <th className="print:hidden">
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pos.map((po, index) => {
                        const isCurrentPage = index >= (safePage - 1) * pageSize && index < safePage * pageSize;
                        return (
                          <tr key={po.id} className={`hover:bg-slate-50 ${isCurrentPage ? '' : 'hidden print:table-row'}`}>
                            {reportConfig.columns?.no_po !== false && (
                              <td className="font-medium text-slate-700">{po.no_po}</td>
                            )}
                            {reportConfig.columns?.supplier !== false && (
                              <td>{po.nama_supplier || '-'}</td>
                            )}
                            {reportConfig.columns?.tanggal_po !== false && (
                              <td className="text-xs text-slate-500">{formatDate(po.tanggal_po)}</td>
                            )}
                            {reportConfig.columns?.jatuh_tempo !== false && (
                              <td className="whitespace-nowrap">
                                <div className="text-xs font-medium text-slate-800">
                                  {formatDate(po.jatuh_tempo)}
                                </div>
                                {po.status_pembayaran !== 'LUNAS' && Number(po.total_harga) > 0 && po.hari_terlewat_tempo !== null && (
                                  <div className="mt-0.5">
                                    {Number(po.hari_terlewat_tempo) > 0 ? (
                                      <span className="inline-block rounded bg-rose-50 px-1 py-0.2 text-[10px] font-bold text-rose-600">
                                        Lewat {po.hari_terlewat_tempo} hr
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">
                                        Sisa {Math.abs(Number(po.hari_terlewat_tempo))} hr
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                            {reportConfig.columns?.total_tagihan !== false && (
                              <td className="text-right text-xs font-semibold text-slate-800">
                                {formatRupiah(po.total_harga)}
                              </td>
                            )}
                            {reportConfig.columns?.status_bayar !== false && (
                              <td className="whitespace-nowrap text-center">
                                {po.status_pembayaran === 'LUNAS' || Number(po.total_harga) <= 0 ? (
                                  <span className="badge bg-emerald-100 text-emerald-800">Lunas</span>
                                ) : po.status_pembayaran === 'SEBAGIAN' ? (
                                  <div>
                                    <span className="badge bg-blue-100 text-blue-800">Sebagian</span>
                                    <div className="text-[10px] text-slate-500">Sisa {formatRupiah(po.sisa_utang)}</div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="badge bg-rose-100 text-rose-800">Belum Lunas</span>
                                    <div className="text-[10px] text-slate-500">Sisa {formatRupiah(po.sisa_utang)}</div>
                                  </div>
                                )}
                              </td>
                            )}
                            {reportConfig.columns?.status_po !== false && (
                              <td>
                                <span className={`badge ${statusBadges[po.status] || 'bg-slate-100'}`}>
                                  {po.status}
                                </span>
                              </td>
                            )}
                            {reportConfig.columns?.keterangan !== false && (
                              <td className="max-w-xs truncate text-xs text-slate-500">
                                {po.keterangan || '-'}
                              </td>
                            )}
                            <td className="print:hidden">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handlePrintRow(po)}
                                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition"
                                  title="Cetak Surat Pesanan (PO)"
                                  aria-label={`Cetak ${po.no_po}`}
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDetail(po.id)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                                  title="Lihat Detail PO"
                                  aria-label={`Detail ${po.no_po}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePo(po)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                                  title="Hapus PO"
                                  aria-label={`Hapus ${po.no_po}`}
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
                    totalItems={pos.length}
                    pageSize={pageSize}
                    onPageSize={(sz) => {
                      setPageSize(sz);
                      setPage(1);
                    }}
                    label="dokumen PO"
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
        menuKey="PO"
        activeReportTitle="Laporan Purchase Orders (PO)"
      />

      {/* --- Modal Detail PO --- */}
      {activePo && (
        <Modal
          isOpen={detailModal}
          title={`Detail PO: ${activePo.no_po}`}
          onClose={() => setDetailModal(false)}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
              <div>
                <span className="text-slate-500">Supplier:</span>{' '}
                <strong className="block text-slate-700">{activePo.nama_supplier || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Tanggal PO:</span>{' '}
                <strong className="block text-slate-700">{formatDate(activePo.tanggal_po)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Status Saat Ini:</span>{' '}
                <div className="mt-0.5">
                  <span className={`badge ${statusBadges[activePo.status]}`}>
                    {activePo.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-500">Total Tagihan:</span>{' '}
                <strong className="block text-blue-700 text-sm">{formatRupiah(activePo.total_harga)}</strong>
              </div>
              {activePo.keterangan && (
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-slate-500">Keterangan:</span>{' '}
                  <span className="text-slate-700">{activePo.keterangan}</span>
                </div>
              )}
            </div>

            {/* Ubah Status */}
            <div className="flex flex-wrap items-center gap-2 border-t border-b border-slate-100 py-3">
              <span className="text-xs font-medium text-slate-600">Ubah Status PO:</span>
              {['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => changeStatus(activePo.id, st)}
                  disabled={activePo.status === st}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    activePo.status === st
                      ? 'bg-slate-800 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-semibold uppercase text-slate-500">Detail Barang Pesanan</h3>
            <div className="overflow-x-auto">
              <table className="table-base text-xs">
                <thead>
                  <tr>
                    <th>Kode Produk</th>
                    <th>Nama Produk</th>
                    <th className="text-right">Qty Pesan</th>
                    <th className="text-right">Harga Satuan</th>
                    <th className="text-right">Diskon</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Qty Diterima</th>
                  </tr>
                </thead>
                <tbody>
                  {activePo.details?.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium text-slate-700">{d.kode_produk}</td>
                      <td>{d.nama_produk || '-'}</td>
                      <td className="text-right font-semibold">
                        {d.qty_order && d.satuan_order && d.satuan_order !== (d.satuan || 'PCS') ? (
                          <div>
                            <p className="text-slate-900">{formatNumber(d.qty_order)} {d.satuan_order}</p>
                            <p className="text-[11px] text-emerald-700 font-medium">
                              (= {formatNumber(d.qty_pesan)} {d.satuan || 'PCS'})
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p>{formatNumber(d.qty_pesan)} {d.satuan || 'PCS'}</p>
                            {(Number(d.isi_box_pcs) > 1 || Number(d.isi_per_kemasan) > 1) && (
                              <p className="text-[11px] text-indigo-600 font-medium">
                                ≈ {formatMultiTierBreakdown(d.qty_pesan, d)}
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
                      <td className="text-right text-emerald-600 font-semibold">{formatNumber(d.qty_diterima)} {d.satuan || ''}</td>
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
                  <span className="font-medium">{formatRupiah(activePo.subtotal)}</span>
                </div>
                {Number(activePo.diskon_nominal) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Diskon PO ({Number(activePo.diskon_persen)}%):</span>
                    <span className="font-medium">-{formatRupiah(activePo.diskon_nominal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Pajak PPN ({Number(activePo.pajak_persen)}%):</span>
                  <span className="font-medium text-blue-600">+{formatRupiah(activePo.pajak_nominal)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Total Tagihan PO:</span>
                  <span className="text-blue-700">{formatRupiah(activePo.total_harga)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => handlePrintRow(activePo)}
                className="btn-secondary !text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold"
                title="Cetak Surat Pesanan (PO) Resmi"
              >
                <Printer className="h-4 w-4" /> Cetak Surat Pesanan (PO)
              </button>
              <button type="button" onClick={() => setDetailModal(false)} className="btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- Modal Buat PO Baru --- */}
      <Modal isOpen={addModal} title="Buat Purchase Order Baru" onClose={() => setAddModal(false)} maxWidth="max-w-5xl">
        {(() => {
          const totals = calculateTotals(form);
          return (
            <form onSubmit={submitAdd} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label !mb-0 font-bold" htmlFor="no_po">
                      Nomor PO <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Otomatis</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPoFormatModalOpen(true)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold flex items-center gap-1"
                      title="Atur format awalan dan penomoran PO"
                    >
                      <Settings className="w-3.5 h-3.5" /> Atur Format
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="no_po"
                      className="input font-mono font-bold text-blue-900"
                      value={form.no_po}
                      onChange={(e) => setForm({ ...form, no_po: e.target.value })}
                      placeholder="Contoh: JPM/PO/10/0001"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleRegeneratePoNumber}
                      className="btn-secondary !p-2 shrink-0"
                      title="Generate ulang nomor urut otomatis"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Format aktif: <span className="font-mono font-semibold text-slate-700">{poFormat.prefix}/[Bulan]/[No]</span> (nomor urut bertambah otomatis, dapat diedit manual).
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="supplier_id">Supplier</label>
                  <SearchableSelect
                    id="supplier_id"
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    placeholder="-- Pilih Supplier --"
                    searchPlaceholder="Cari kode atau nama supplier..."
                    options={[
                      { value: '', label: '-- Pilih Supplier --' },
                      ...suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.kode_supplier} — ${s.nama_supplier}`,
                      })),
                    ]}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="tanggal_po">Tanggal PO *</label>
                  <input
                    id="tanggal_po"
                    type="date"
                    className="input"
                    value={form.tanggal_po}
                    onChange={(e) => handleTanggalPoChange(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="termin_hari">Termin Bayar</label>
                    <select
                      id="termin_hari"
                      className="input"
                      value={form.termin_hari}
                      onChange={(e) => {
                        const days = Number(e.target.value);
                        setForm({
                          ...form,
                          termin_hari: days,
                          jatuh_tempo: calculateDueDate(form.tanggal_po, days),
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
                    <label className="label" htmlFor="jatuh_tempo_po">Jatuh Tempo *</label>
                    <input
                      id="jatuh_tempo_po"
                      type="date"
                      className="input font-semibold"
                      value={form.jatuh_tempo}
                      onChange={(e) => setForm({ ...form, jatuh_tempo: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="keterangan_po">Keterangan</label>
                  <input
                    id="keterangan_po"
                    className="input"
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    placeholder="Catatan PO"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Daftar Barang Pesanan</span>
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
                          const qOrder = Number(item.qty_order !== undefined ? item.qty_order : item.qty_pesan) || 0;
                          const hSatuan = Number(item.harga_satuan) || 0;
                          const lineGross = qOrder * hSatuan;
                          const dPersen = Math.min(100, Math.max(0, Number(item.diskon_persen !== undefined ? item.diskon_persen : 0)));
                          const lineDiscNominal = item.diskon_persen !== undefined && dPersen > 0
                            ? Math.round((lineGross * dPersen) / 100)
                            : Math.max(0, Number(item.diskon) || 0);
                          const lineSubtotal = Math.max(0, lineGross - lineDiscNominal);
                          const pObj = products.find((p) => p.kode_produk === item.kode_produk);
                          const unitOptions = getUnitDropdownOptions(pObj);
                          const qVal = item.qty_order !== undefined ? item.qty_order : item.qty_pesan;
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
                                  value={item.qty_order !== undefined ? item.qty_order : item.qty_pesan}
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
                      <span>Diskon PO (%):</span>
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
                    <span>Total Tagihan PO:</span>
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
                  Simpan PO
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>
      {/* Modal Cetak Dokumen Surat Pesanan (PO) */}
      <PrintableInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        type="PO"
        data={selectedInvoiceData}
        loading={loadingInvoice}
      />
      {/* Modal Pengaturan Format Nomor PO */}
      <PoFormatModal
        isOpen={poFormatModalOpen}
        onClose={() => setPoFormatModalOpen(false)}
        formatConfig={poFormat}
        onSave={handleSavePoFormat}
        dateStr={form.tanggal_po}
        existingPos={pos}
      />
    </div>
  );
}

