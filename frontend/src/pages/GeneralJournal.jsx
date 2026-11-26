import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Calendar,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
  SlidersHorizontal,
  Printer,
  Sliders,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';
import ReportCustomizerModal, {
  loadSavedReportConfig,
  saveReportConfigToStorage,
} from '../components/ReportCustomizerModal.jsx';
import PrintableReportHeader from '../components/PrintableReportHeader.jsx';
import PrintableReportSignatures from '../components/PrintableReportSignatures.jsx';

const PAGE_SIZE = 10;

const REF_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Semua Sumber Transaksi' },
  { value: 'MANUAL', label: 'MANUAL (Jurnal Penyesuaian/Umum)' },
  { value: 'PO', label: 'PO (Pembelian Barang)' },
  { value: 'SO', label: 'SO (Penjualan Barang)' },
  { value: 'OUTBOUND', label: 'OUTBOUND (HPP Barang Keluar)' },
  { value: 'AP_PAYMENT', label: 'AP_PAYMENT (Pembayaran Utang)' },
  { value: 'AR_PAYMENT', label: 'AR_PAYMENT (Penerimaan Piutang)' },
  { value: 'EXPENSE', label: 'EXPENSE (Biaya Operasional)' },
  { value: 'CASH_IN', label: 'CASH_IN (Penerimaan Kas Lain)' },
];

const refTypeBadge = (tipe) => {
  switch (tipe) {
    case 'PO':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'SO':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'OUTBOUND':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'AP_PAYMENT':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'AR_PAYMENT':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'EXPENSE':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'CASH_IN':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

export default function GeneralJournal() {
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  // Modal Kustomisasi Laporan Jurnal
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState(() => loadSavedReportConfig('JOURNAL'));

  // Filters
  const [search, setSearch] = useState('');
  const [tipeReferensi, setTipeReferensi] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Modal Jurnal Manual State
  const [modalOpen, setModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    no_referensi: '',
    keterangan: '',
    lines: [
      { accountId: '', debit: '', credit: '', keterangan: '' },
      { accountId: '', debit: '', credit: '', keterangan: '' },
    ],
  });
  const [savingManual, setSavingManual] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (tipeReferensi !== 'ALL') params.tipeReferensi = tipeReferensi;
      if (search.trim()) params.search = search.trim();

      const [resJournals, resAccounts] = await Promise.all([
        api.get('/accounting/journals', { params }),
        api.get('/accounting/accounts', { params: { is_active: true } }),
      ]);

      setJournals(resJournals.data.data);
      setAccounts(resAccounts.data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 200);
    return () => clearTimeout(timer);
  }, [startDate, endDate, tipeReferensi, search]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSyncHistorical = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/accounting/sync');
      toastSuccess(data.message || 'Sinkronisasi berhasil!');
      loadData();
    } catch (err) {
      alertError('Gagal Sinkronisasi', getErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteJournal = async (journal) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Jurnal Umum?',
      text: `Apakah Anda yakin ingin menghapus jurnal "${journal.no_jurnal}"? Saldo akun akan kembali disesuaikan.`,
    });
    if (!confirmed) return;

    try {
      const { data } = await api.delete(`/accounting/journals/${journal.id}`);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      alertError('Gagal Menghapus Jurnal', getErrorMessage(err));
    }
  };

  // --- Handlers Modal Manual Journal ---
  const openAddManualModal = () => {
    setManualForm({
      tanggal: new Date().toISOString().split('T')[0],
      no_referensi: '',
      keterangan: '',
      lines: [
        { accountId: '', debit: '', credit: '', keterangan: '' },
        { accountId: '', debit: '', credit: '', keterangan: '' },
      ],
    });
    setModalOpen(true);
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...manualForm.lines];
    updated[index][field] = value;

    // Jika mengisi debit, kosongkan kredit (dan sebaliknya)
    if (field === 'debit' && Number(value) > 0) updated[index].credit = '';
    if (field === 'credit' && Number(value) > 0) updated[index].debit = '';

    setManualForm({ ...manualForm, lines: updated });
  };

  const addLine = () => {
    setManualForm({
      ...manualForm,
      lines: [...manualForm.lines, { accountId: '', debit: '', credit: '', keterangan: '' }],
    });
  };

  const removeLine = (index) => {
    if (manualForm.lines.length <= 2) {
      alertError('Perhatian', 'Jurnal harus memiliki minimal 2 baris transaksi akun.');
      return;
    }
    const updated = manualForm.lines.filter((_, i) => i !== index);
    setManualForm({ ...manualForm, lines: updated });
  };

  // Hitung total debit & kredit formulir manual
  const totalDebitManual = manualForm.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCreditManual = manualForm.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const isBalancedManual =
    totalDebitManual > 0 &&
    totalCreditManual > 0 &&
    Math.abs(totalDebitManual - totalCreditManual) < 0.01;

  const handleSubmitManual = async (e) => {
    e.preventDefault();
    if (!isBalancedManual) {
      alertError(
        'Jurnal Tidak Seimbang',
        `Total Debit (${formatRupiah(totalDebitManual)}) harus sama dengan Total Kredit (${formatRupiah(totalCreditManual)}).`
      );
      return;
    }

    setSavingManual(true);
    try {
      const payload = {
        tanggal: manualForm.tanggal,
        no_referensi: manualForm.no_referensi,
        keterangan: manualForm.keterangan,
        lines: manualForm.lines.map((l) => ({
          account_id: Number(l.accountId),
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          keterangan: l.keterangan,
        })),
      };

      const { data } = await api.post('/accounting/journals', payload);
      toastSuccess(data.message);
      setModalOpen(false);
      loadData();
    } catch (err) {
      alertError('Gagal Menyimpan Jurnal', getErrorMessage(err));
    } finally {
      setSavingManual(false);
    }
  };

  const accountSelectOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.kode_akun} - ${a.nama_akun}`,
    sublabel: `${a.kategori} | Normal: ${a.saldo_normal}`,
  }));

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
          title="BUKU JURNAL UMUM (GENERAL JOURNAL)"
          subtitle={`Periode: ${startDate ? formatDate(startDate) : 'Semua'} s/d ${endDate ? formatDate(endDate) : 'Sekarang'} | Filter Sumber: ${tipeReferensi === 'ALL' ? 'Semua' : tipeReferensi}`}
          docNo="REP-GJ-001"
        />
      </div>

      {/* Header (Disembunyikan saat Cetak) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            Jurnal Umum (General Journal)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Buku catatan seluruh mutasi debit-kredit terintegrasi dari pembelian, penjualan, kas, dan penyesuaian
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Kustomisasi Kop Perusahaan, Tanda Tangan & Format Cetak"
          >
            <Sliders className="h-3.5 w-3.5 text-blue-600" />
            Kustomisasi Laporan
          </button>
          <button
            type="button"
            onClick={() => {
              const headers = ['Tanggal', 'No. Jurnal', 'Sumber Ref', 'No. Ref', 'Keterangan Header', 'Kode Akun', 'Nama Akun', 'Keterangan Baris', 'Debit (Rp)', 'Kredit (Rp)'];
              const rows = [];
              journals.forEach((j) => {
                if (j.lines && j.lines.length > 0) {
                  j.lines.forEach((l) => {
                    rows.push([
                      formatDate(j.tanggal),
                      j.no_jurnal || '',
                      j.tipe_referensi || '',
                      j.no_referensi || '',
                      j.keterangan || '',
                      l.kode_akun || '',
                      l.nama_akun || '',
                      l.keterangan || '',
                      l.debit || 0,
                      l.credit || 0,
                    ]);
                  });
                } else {
                  rows.push([
                    formatDate(j.tanggal),
                    j.no_jurnal || '',
                    j.tipe_referensi || '',
                    j.no_referensi || '',
                    j.keterangan || '',
                    '',
                    '',
                    '',
                    j.total_debit || 0,
                    j.total_kredit || 0,
                  ]);
                }
              });
              exportToExcel('Jurnal_Umum_Ledger', headers, rows);
            }}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Export Buku Jurnal Umum ke Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Cetak Buku Jurnal Umum ke PDF"
          >
            <Printer className="h-3.5 w-3.5 text-blue-600" />
            Cetak / Export PDF
          </button>
          <button
            type="button"
            onClick={handleSyncHistorical}
            disabled={syncing}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Sinkronisasi transaksi PO/SO/Kas yang belum terbit jurnalnya"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Menyelaraskan...' : 'Sinkronkan Data ERP'}
          </button>
          <button
            type="button"
            onClick={openAddManualModal}
            className="btn-primary flex items-center gap-2 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" /> Buat Jurnal Penyesuaian
          </button>
        </div>
      </div>

      {/* Alert Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Card */}
      <div className="card p-4 space-y-3 print:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No Jurnal / Ref / Keterangan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-9"
            />
          </div>

          <div>
            <SearchableSelect
              id="ref-filter"
              value={tipeReferensi}
              onChange={(e) => {
                setTipeReferensi(e.target.value);
                setPage(1);
              }}
              options={REF_TYPE_OPTIONS}
              isClearable={false}
              searchPlaceholder="Pilih tipe sumber..."
            />
          </div>

          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="input text-xs"
              placeholder="Dari Tanggal"
            />
          </div>

          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="input text-xs"
              placeholder="Sampai Tanggal"
            />
          </div>
        </div>
      </div>

      {/* Table Journals */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat data jurnal umum...
          </div>
        ) : journals.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Belum ada transaksi jurnal yang tercatat dalam periode ini.
          </div>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(journals, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th className="w-10 print:hidden"></th>
                        {reportConfig.columns?.tanggal !== false && <th className="w-28">Tanggal</th>}
                        {reportConfig.columns?.no_jurnal !== false && <th>No Jurnal</th>}
                        {reportConfig.columns?.sumber_ref !== false && <th>Sumber Ref</th>}
                        {reportConfig.columns?.keterangan !== false && <th>Keterangan</th>}
                        {reportConfig.columns?.total_debit !== false && <th className="text-right">Total Debit</th>}
                        {reportConfig.columns?.total_kredit !== false && <th className="text-right">Total Kredit</th>}
                        <th className="text-right w-16 print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journals.map((j, index) => {
                        const isCurrentPage = index >= (safePage - 1) * pageSize && index < safePage * pageSize;
                        const isExpanded = expandedIds.has(j.id);
                        return (
                          <React.Fragment key={j.id}>
                            <tr
                              onClick={() => toggleExpand(j.id)}
                              className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                                isCurrentPage ? '' : 'hidden print:table-row'
                              }`}
                            >
                              <td className="text-center text-slate-400 print:hidden">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </td>
                              {reportConfig.columns?.tanggal !== false && (
                                <td className="text-xs text-slate-600 font-medium">
                                  {formatDate(j.tanggal)}
                                </td>
                              )}
                              {reportConfig.columns?.no_jurnal !== false && (
                                <td className="font-mono font-semibold text-slate-800 text-xs">
                                  {j.no_jurnal}
                                </td>
                              )}
                              {reportConfig.columns?.sumber_ref !== false && (
                                <td>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${refTypeBadge(
                                        j.tipe_referensi
                                      )}`}
                                    >
                                      {j.tipe_referensi}
                                    </span>
                                    {j.no_referensi && (
                                      <span className="font-mono text-xs text-slate-600">
                                        {j.no_referensi}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}
                              {reportConfig.columns?.keterangan !== false && (
                                <td className="text-xs text-slate-700 max-w-xs truncate font-medium">
                                  {j.keterangan}
                                </td>
                              )}
                              {reportConfig.columns?.total_debit !== false && (
                                <td className="text-right font-mono font-semibold text-xs text-slate-800">
                                  {formatRupiah(j.total_debit)}
                                </td>
                              )}
                              {reportConfig.columns?.total_kredit !== false && (
                                <td className="text-right font-mono font-semibold text-xs text-slate-800">
                                  {formatRupiah(j.total_kredit)}
                                </td>
                              )}
                              <td className="text-right print:hidden" onClick={(e) => e.stopPropagation()}>
                                {j.tipe_referensi === 'MANUAL' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteJournal(j)}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                                    title="Hapus Jurnal Manual"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* Sub-rows (Rincian Debit Kredit - Selalu Tampil di PDF Print) */}
                            <tr
                              className={`bg-slate-50/60 border-b border-slate-200 ${
                                isExpanded ? '' : 'hidden print:table-row'
                              } ${isCurrentPage ? '' : 'hidden print:table-row'}`}
                            >
                              <td colSpan={8} className="p-2 sm:p-3 print:p-1.5">
                                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-inner print:shadow-none print:border-slate-300">
                                  <table className="w-full text-xs print:w-full">
                                    <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600">
                                      <tr>
                                        <th className="py-1.5 px-3 text-left font-semibold print:py-1">Kode Akun</th>
                                        <th className="py-1.5 px-3 text-left font-semibold print:py-1">Nama Akun Perkiraan</th>
                                        <th className="py-1.5 px-3 text-left font-semibold print:py-1">Keterangan Baris</th>
                                        <th className="py-1.5 px-3 text-right font-semibold print:py-1">Debit</th>
                                        <th className="py-1.5 px-3 text-right font-semibold print:py-1">Kredit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {j.lines?.map((line) => (
                                        <tr key={line.id} className="hover:bg-slate-50/50">
                                          <td className="py-1.5 px-3 font-mono font-medium text-slate-700 print:py-1">
                                            {line.kode_akun}
                                          </td>
                                          <td className="py-1.5 px-3 font-medium text-slate-800 print:py-1">
                                            {line.debit > 0 ? (
                                              <span>{line.nama_akun}</span>
                                            ) : (
                                              <span className="pl-6 text-slate-600 italic">
                                                ↳ {line.nama_akun}
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-3 text-slate-500 print:py-1">
                                            {line.keterangan || '-'}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono text-slate-800 print:py-1">
                                            {line.debit > 0 ? formatRupiah(line.debit) : '-'}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono text-slate-800 print:py-1">
                                            {line.credit > 0 ? formatRupiah(line.credit) : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-800">
                                      <tr>
                                        <td colSpan={3} className="py-1.5 px-3 text-right print:py-1">
                                          Total:
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono text-blue-700 print:py-1">
                                          {formatRupiah(j.total_debit)}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono text-blue-700 print:py-1">
                                          {formatRupiah(j.total_kredit)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
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
                    totalItems={journals.length}
                    pageSize={pageSize}
                    onPageSize={(s) => {
                      setPageSize(s);
                      setPage(1);
                    }}
                    label="transaksi jurnal"
                  />
                </div>

                {/* Blok Tanda Tangan Saat Dicetak / Export PDF */}
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

      {/* Modal Jurnal Manual */}
      <Modal
        isOpen={modalOpen}
        title="Buat Jurnal Penyesuaian / Transaksi Umum"
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmitManual} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="manual_tanggal">
                Tanggal Jurnal *
              </label>
              <input
                id="manual_tanggal"
                type="date"
                value={manualForm.tanggal}
                onChange={(e) => setManualForm({ ...manualForm, tanggal: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="manual_no_ref">
                Nomor Referensi (Opsional)
              </label>
              <input
                id="manual_no_ref"
                type="text"
                value={manualForm.no_referensi}
                onChange={(e) => setManualForm({ ...manualForm, no_referensi: e.target.value })}
                placeholder="Cth: MEMO-001 / BUKTI-99"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="manual_keterangan">
              Keterangan Transaksi *
            </label>
            <input
              id="manual_keterangan"
              type="text"
              value={manualForm.keterangan}
              onChange={(e) => setManualForm({ ...manualForm, keterangan: e.target.value })}
              placeholder="Cth: Penyesuaian persediaan akhir periode / Beban penyusutan"
              className="input"
              required
            />
          </div>

          {/* Baris Akun Jurnal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">Rincian Akun (Debit & Kredit) *</span>
              <button
                type="button"
                onClick={addLine}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Baris
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {manualForm.lines.map((line, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Baris #{idx + 1}</span>
                    {manualForm.lines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-rose-500 hover:text-rose-700 p-0.5"
                        title="Hapus Baris"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="w-full">
                    <SearchableSelect
                      id={`line_acc_${idx}`}
                      value={line.accountId}
                      onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                      options={accountSelectOptions}
                      placeholder="Pilih Akun Perkiraan..."
                      searchPlaceholder="Cari kode atau nama akun..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">Debit (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={line.debit}
                        onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                        className="input text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">Kredit (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={line.credit}
                        onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                        className="input text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Catatan baris (opsional)..."
                      value={line.keterangan}
                      onChange={(e) => handleLineChange(idx, 'keterangan', e.target.value)}
                      className="input text-xs py-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Balance Indicator Footer */}
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Total Debit: <span className="font-mono text-blue-700">{formatRupiah(totalDebitManual)}</span></span>
              <span>Total Kredit: <span className="font-mono text-blue-700">{formatRupiah(totalCreditManual)}</span></span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
              <span className="text-xs text-slate-600">Status Keseimbangan:</span>
              {isBalancedManual ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> SEIMBANG (BALANCED)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Selisih: {formatRupiah(Math.abs(totalDebitManual - totalCreditManual))}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingManual || !isBalancedManual}
              className="btn-primary"
            >
              {savingManual && <Loader2 className="h-4 w-4 animate-spin" />}
              Posting Jurnal
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Kustomisasi Laporan Jurnal Umum */}
      <ReportCustomizerModal
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        config={reportConfig}
        onChangeConfig={(cfg) => {
          setReportConfig(cfg);
          saveReportConfigToStorage(cfg, 'JOURNAL');
        }}
        onApplyAndPrint={() => {
          saveReportConfigToStorage(reportConfig, 'JOURNAL');
          window.print();
        }}
        menuKey="JOURNAL"
        activeReportTitle="Buku Jurnal Umum"
      />
    </div>
  );
}

