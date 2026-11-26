import { useEffect, useState } from 'react';
import {
  Percent,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  CheckCircle2,
  Clock,
  FileText,
  DollarSign,
  Tag,
  Building,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 10;

const TAX_TYPES = [
  { value: 'PPN_MASUKAN', label: 'PPN Masukan (Pembelian / Vendor)', defaultRate: 11 },
  { value: 'PPN_KELUARAN', label: 'PPN Keluaran (Penjualan / Customer)', defaultRate: 11 },
  { value: 'PPH_21', label: 'PPh Pasal 21 (Gaji & Tenaga Ahli)', defaultRate: 5 },
  { value: 'PPH_23', label: 'PPh Pasal 23 (Jasa & Sewa Alat)', defaultRate: 2 },
  { value: 'PPH_4_2', label: 'PPh Pasal 4(2) Final (Sewa Gedung & Konstruksi)', defaultRate: 10 },
];

const emptyTaxForm = {
  tipe_pajak: 'PPN_MASUKAN',
  tanggal: new Date().toISOString().split('T')[0],
  no_faktur_pajak: '',
  pihak_terkait: '',
  dpp: '',
  tarif_persen: '11',
  nominal_pajak: '',
  referensi: '',
  status_spt: 'BELUM_LAPOR',
  catatan: '',
};

export default function TaxManagement() {
  const [taxRecords, setTaxRecords] = useState([]);
  const [taxSummary, setTaxSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [tipeFilter, setTipeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTaxForm);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        api.get('/accounting/tax', {
          params: {
            tipePajak: tipeFilter === 'ALL' ? undefined : tipeFilter,
            statusSpt: statusFilter === 'ALL' ? undefined : statusFilter,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        }),
        api.get('/accounting/tax/summary', {
          params: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        }),
      ]);

      if (recordsRes.data.success) {
        setTaxRecords(recordsRes.data.data || []);
      }
      if (summaryRes.data.success) {
        setTaxSummary(summaryRes.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tipeFilter, statusFilter, startDate, endDate]);

  const handleTipeChange = (val) => {
    const matched = TAX_TYPES.find((t) => t.value === val);
    const newRate = matched ? String(matched.defaultRate) : '11';
    const numDpp = Number(form.dpp || 0);
    const calcTax = Math.round((numDpp * Number(newRate)) / 100);

    setForm({
      ...form,
      tipe_pajak: val,
      tarif_persen: newRate,
      nominal_pajak: calcTax > 0 ? String(calcTax) : '',
    });
  };

  const handleDppOrRateChange = (dppVal, rateVal) => {
    const numDpp = Number(dppVal || 0);
    const numRate = Number(rateVal || 0);
    const calcTax = Math.round((numDpp * numRate) / 100);

    setForm((prev) => ({
      ...prev,
      dpp: dppVal,
      tarif_persen: rateVal,
      nominal_pajak: calcTax > 0 ? String(calcTax) : '',
    }));
  };

  const handleSaveTaxRecord = async (e) => {
    e.preventDefault();
    if (!form.pihak_terkait.trim()) {
      alertError('Peringatan', 'Nama pihak terkait (vendor/customer/karyawan) wajib diisi!');
      return;
    }
    if (Number(form.dpp) <= 0) {
      alertError('Peringatan', 'Dasar Pengenaan Pajak (DPP) harus lebih dari 0!');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/accounting/tax', {
        ...form,
        dpp: Number(form.dpp),
        tarif_persen: Number(form.tarif_persen),
        nominal_pajak: Number(form.nominal_pajak),
      });

      if (res.data.success) {
        toastSuccess('Berhasil!', res.data.message || 'Pencatatan faktur pajak berhasil disimpan.');
        setModalOpen(false);
        setForm(emptyTaxForm);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Menyimpan Faktur Pajak', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (record, newStatus) => {
    try {
      const res = await api.put(`/accounting/tax/${record.id}/status`, {
        status_spt: newStatus,
      });
      if (res.data.success) {
        toastSuccess('Status Diperbarui', `Status SPT berhasil diubah ke ${newStatus}.`);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Memperbarui Status', getErrorMessage(err));
    }
  };

  const { pageItems: paginatedRecords, totalPages, safePage } = paginate(taxRecords, page, pageSize);

  const ppnMasukan = taxSummary?.ppnMasukan || 0;
  const ppnKeluaran = taxSummary?.ppnKeluaran || 0;
  const posisiPpn = taxSummary?.ppnNet ?? 0;
  const statusPosisi = taxSummary?.ppnStatus || (posisiPpn >= 0 ? 'KURANG_BAYAR' : 'LEBIH_BAYAR');
  const totalPph = taxSummary?.totalPph || 0;

  const handleExportExcel = () => {
    const headers = [
      'No. Faktur Pajak',
      'Tanggal',
      'Tipe Pajak',
      'Pihak Terkait (Vendor/Customer)',
      'Dasar Pengenaan Pajak - DPP (Rp)',
      'Tarif (%)',
      'Nominal Pajak (Rp)',
      'Referensi Dokumen',
      'Status Pelaporan SPT',
      'Catatan',
    ];

    const data = taxRecords.map((t) => {
      const typeObj = TAX_TYPES.find((item) => item.value === t.tipe_pajak);
      return [
        t.no_faktur_pajak || '-',
        formatDate(t.tanggal),
        typeObj ? typeObj.label : t.tipe_pajak,
        t.pihak_terkait || '-',
        t.dpp ?? 0,
        `${t.tarif_persen ?? 0}%`,
        t.nominal_pajak ?? 0,
        t.referensi || '-',
        t.status_spt === 'SUDAH_LAPOR' ? 'Sudah Dilaporkan' : 'Belum Lapor (Draft)',
        t.catatan || '-',
      ];
    });

    exportToExcel('Rekap_Faktur_Pajak_PPN_PPh', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Percent className="h-7 w-7 text-rose-600" />
            Manajemen Perpajakan (PPN & PPh)
          </h1>
          <p className="text-sm text-slate-500">
            Rekonsiliasi PPN Masukan vs PPN Keluaran, pemotongan PPh Pasal 21/23/4(2), dan administrasi Faktur Pajak / SPT Masa.
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
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-rose-600' : ''}`} />
            Segarkan
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 transition"
          >
            <Plus className="h-4 w-4" />
            Catat Faktur Pajak Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">PPN Masukan (Beli)</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{formatRupiah(ppnMasukan)}</div>
          <p className="mt-1 text-xs text-slate-500">Pajak masukan dapat dikreditkan</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">PPN Keluaran (Jual)</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">{formatRupiah(ppnKeluaran)}</div>
          <p className="mt-1 text-xs text-slate-500">Pajak dipungut dari customer</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Posisi Saldo PPN</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <Scale className="h-5 w-5" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-bold ${
              statusPosisi === 'KURANG_BAYAR'
                ? 'text-rose-700'
                : statusPosisi === 'LEBIH_BAYAR'
                ? 'text-emerald-700'
                : 'text-slate-700'
            }`}
          >
            {formatRupiah(Math.abs(posisiPpn))}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                statusPosisi === 'KURANG_BAYAR'
                  ? 'bg-rose-100 text-rose-800'
                  : statusPosisi === 'LEBIH_BAYAR'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {statusPosisi === 'KURANG_BAYAR'
                ? 'KURANG BAYAR KE KAS NEGARA'
                : statusPosisi === 'LEBIH_BAYAR'
                ? 'LEBIH BAYAR (RESTITUSI)'
                : 'NIHIL'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total PPh Terpotong</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{formatRupiah(totalPph)}</div>
          <p className="mt-1 text-xs text-slate-500">
            PPh 21 ({formatRupiah(taxSummary?.pph21 || 0)}) | 23 ({formatRupiah(taxSummary?.pph23 || 0)})
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-56">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Tipe Pajak
          </label>
          <SearchableSelect
            value={tipeFilter}
            onChange={(e) => {
              setTipeFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Pajak' },
              ...TAX_TYPES.map((t) => ({ value: t.value, label: t.label })),
            ]}
          />
        </div>

        <div className="w-44">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Status SPT
          </label>
          <SearchableSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Status' },
              { value: 'BELUM_LAPOR', label: 'Belum Lapor' },
              { value: 'SUDAH_BAYAR', label: 'Sudah Bayar' },
              { value: 'SUDAH_LAPOR', label: 'Sudah Lapor SPT' },
            ]}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Tanggal Dari
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-rose-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Tanggal Sampai
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-rose-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat data perpajakan...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : taxRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Percent className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Faktur Pajak Tercatat</p>
            <p className="text-sm mt-1">
              Catat faktur pajak masukan/keluaran atau bukti potong PPh untuk memantau kewajiban perpajakan.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
            >
              <Plus className="h-4 w-4" />
              Catat Faktur Pajak
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Transaksi & Tgl</th>
                    <th className="px-4 py-3">Tipe Pajak</th>
                    <th className="px-4 py-3">No Faktur / Bupot</th>
                    <th className="px-4 py-3">Pihak Terkait</th>
                    <th className="px-4 py-3 text-right">DPP (Dasar Pajak)</th>
                    <th className="px-4 py-3 text-right">Tarif & Pajak</th>
                    <th className="px-4 py-3 text-center">Status SPT</th>
                    <th className="px-4 py-3 text-center">Ubah Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map((r) => {
                    const isMasukan = r.tipe_pajak === 'PPN_MASUKAN';
                    const isKeluaran = r.tipe_pajak === 'PPN_KELUARAN';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{r.no_transaksi}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{formatDate(r.tanggal)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isMasukan
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isKeluaran
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {r.tipe_pajak}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {r.no_faktur_pajak ? (
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {r.no_faktur_pajak}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Tidak ada</span>
                          )}
                          {r.referensi && (
                            <div className="text-[11px] text-slate-400 mt-0.5">Ref: {r.referensi}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">{r.pihak_terkait}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                          {formatRupiah(r.dpp)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-bold text-rose-700">{formatRupiah(r.nominal_pajak)}</div>
                          <div className="text-[11px] text-slate-400">{r.tarif_persen}% DPP</div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              r.status_spt === 'SUDAH_LAPOR'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : r.status_spt === 'SUDAH_BAYAR'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {r.status_spt === 'SUDAH_LAPOR' && <CheckCircle2 className="h-3 w-3" />}
                            {r.status_spt === 'BELUM_LAPOR' && <Clock className="h-3 w-3" />}
                            {r.status_spt}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <select
                            value={r.status_spt}
                            onChange={(e) => handleUpdateStatus(r, e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-rose-500 focus:outline-none"
                          >
                            <option value="BELUM_LAPOR">Belum Lapor</option>
                            <option value="SUDAH_BAYAR">Sudah Bayar</option>
                            <option value="SUDAH_LAPOR">Sudah Lapor</option>
                          </select>
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
                totalItems={taxRecords.length}
                pageSize={pageSize}
                onPageSize={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                label="faktur pajak"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Catat Faktur Pajak Baru */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Catat Faktur Pajak / Bukti Potong Baru"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveTaxRecord} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tipe Pajak <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.tipe_pajak}
                onChange={(e) => handleTipeChange(e.target.value)}
                options={TAX_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tanggal Faktur / Potong <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nomor Faktur Pajak / Bukti Potong
              </label>
              <input
                type="text"
                value={form.no_faktur_pajak}
                onChange={(e) => setForm({ ...form, no_faktur_pajak: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                placeholder="cth: 010.000-26.12345678"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nama Pihak Terkait (Vendor / Customer / WP) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.pihak_terkait}
                onChange={(e) => setForm({ ...form, pihak_terkait: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                placeholder="PT Mitra Medika / Dr. Sutomo, Sp.B"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                DPP (Dasar Pengenaan Pajak) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.dpp}
                onChange={(e) => handleDppOrRateChange(e.target.value, form.tarif_persen)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Tarif Pajak (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={form.tarif_persen}
                onChange={(e) => handleDppOrRateChange(form.dpp, e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                placeholder="11"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nominal Pajak (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={form.nominal_pajak}
                onChange={(e) => setForm({ ...form, nominal_pajak: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none font-bold text-rose-700"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Referensi Dokumen (No PO / SO / Invoice)
              </label>
              <input
                type="text"
                value={form.referensi}
                onChange={(e) => setForm({ ...form, referensi: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                placeholder="cth: PO-2026-0012 / INV-009"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Status Pelaporan SPT
              </label>
              <SearchableSelect
                value={form.status_spt}
                onChange={(e) => setForm({ ...form, status_spt: e.target.value })}
                options={[
                  { value: 'BELUM_LAPOR', label: 'Belum Lapor' },
                  { value: 'SUDAH_BAYAR', label: 'Sudah Bayar' },
                  { value: 'SUDAH_LAPOR', label: 'Sudah Lapor SPT' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Catatan Perpajakan
            </label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
              placeholder="Catatan pelaporan faktur masa..."
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
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Faktur Pajak
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

