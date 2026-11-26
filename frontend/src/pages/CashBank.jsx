import { useEffect, useState } from 'react';
import {
  Landmark,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Search,
  Calendar,
  Trash2,
  AlertCircle,
  Loader2,
  DollarSign,
  Wallet,
  Receipt,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const PAGE_SIZE = 10;

const emptyTransactionForm = {
  tipe: 'KELUAR', // KELUAR = Biaya, MASUK = Penerimaan
  tanggal: new Date().toISOString().split('T')[0],
  account_kas_id: '',
  account_lawan_id: '',
  nominal: '',
  penerima_penyetor: '',
  metode_pembayaran: 'Kas Tunai',
  referensi: '',
  keterangan: '',
};

export default function CashBank() {
  const [transactions, setTransactions] = useState([]);
  const [cashSummary, setCashSummary] = useState({ accounts: [], total: 0 });
  const [kasAccounts, setKasAccounts] = useState([]);
  const [lawanAccounts, setLawanAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [tipeFilter, setTipeFilter] = useState('ALL');
  const [selectedKasFilter, setSelectedKasFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTransactionForm);
  const [saving, setSaving] = useState(false);

  // Fund Transfer State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferForm, setTransferForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    from_account_id: '',
    to_account_id: '',
    nominal: '',
    referensi: '',
    keterangan: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (tipeFilter !== 'ALL') params.tipe = tipeFilter;
      if (selectedKasFilter) params.accountKasId = selectedKasFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search.trim()) params.search = search.trim();

      const [resTrans, resSummary, resAccounts] = await Promise.all([
        api.get('/accounting/cash-transactions', { params }),
        api.get('/accounting/cash-summary'),
        api.get('/accounting/accounts', { params: { is_active: true } }),
      ]);

      setTransactions(resTrans.data.data);
      setCashSummary(resSummary.data.data);

      const allAccs = resAccounts.data.data;
      setKasAccounts(allAccs.filter((a) => a.is_kas_bank));
      setLawanAccounts(allAccs);
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
  }, [tipeFilter, selectedKasFilter, startDate, endDate, search]);

  const openModal = (tipe) => {
    // Default akun kas ke akun pertama jika ada
    const defaultKas = kasAccounts.length > 0 ? String(kasAccounts[0].id) : '';
    setForm({
      ...emptyTransactionForm,
      tipe,
      account_kas_id: defaultKas,
      tanggal: new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { data } = await api.post('/accounting/cash-transactions', {
        ...form,
        nominal: Number(form.nominal),
      });

      toastSuccess(data.message);
      setModalOpen(false);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Transaksi Kas', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (trans) => {
    const confirmed = await confirmDelete({
      title: 'Batalkan Transaksi Kas?',
      text: `Apakah Anda yakin ingin membatalkan transaksi "${trans.no_transaksi}" (${formatRupiah(
        trans.nominal
      )})? Jurnal terkait akan dihapus dan saldo kas dikembalikan.`,
    });
    if (!confirmed) return;

    try {
      const { data } = await api.delete(`/accounting/cash-transactions/${trans.id}`);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Membatalkan Transaksi', msg);
    }
  };

  const openTransferModal = () => {
    setTransferForm({
      tanggal: new Date().toISOString().split('T')[0],
      from_account_id: kasAccounts[0]?.id ? String(kasAccounts[0].id) : '',
      to_account_id: kasAccounts[1]?.id ? String(kasAccounts[1].id) : '',
      nominal: '',
      referensi: `TRF-${Date.now().toString().slice(-4)}`,
      keterangan: '',
    });
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferForm.from_account_id || !transferForm.to_account_id) {
      alertError('Peringatan', 'Rekening asal dan rekening tujuan wajib dipilih!');
      return;
    }
    if (transferForm.from_account_id === transferForm.to_account_id) {
      alertError('Peringatan', 'Rekening asal dan tujuan tidak boleh sama!');
      return;
    }
    if (Number(transferForm.nominal) <= 0) {
      alertError('Peringatan', 'Nominal transfer harus lebih dari 0!');
      return;
    }

    setTransferSaving(true);
    try {
      const res = await api.post('/accounting/fund-transfer', {
        ...transferForm,
        from_account_id: Number(transferForm.from_account_id),
        to_account_id: Number(transferForm.to_account_id),
        nominal: Number(transferForm.nominal),
      });

      if (res.data.success) {
        toastSuccess('Transfer Sukses!', res.data.message);
        setTransferModalOpen(false);
        loadData();
      }
    } catch (err) {
      alertError('Gagal Transfer Dana', getErrorMessage(err));
    } finally {
      setTransferSaving(false);
    }
  };

  // Filter pilihan akun lawan berdasarkan tipe transaksi
  // Jika KELUAR -> prioritaskan EXPENSE / LIABILITIES
  // Jika MASUK -> prioritaskan REVENUE / EQUITY
  const filteredLawanAccounts = lawanAccounts.filter((a) => {
    if (a.is_kas_bank) return false; // Jangan transfer ke kas sendiri di menu ini
    if (form.tipe === 'KELUAR') {
      return ['EXPENSE', 'LIABILITY', 'ASSET'].includes(a.kategori);
    }
    return ['REVENUE', 'EQUITY', 'LIABILITY'].includes(a.kategori);
  });

  const kasSelectOptions = kasAccounts.map((a) => ({
    value: String(a.id),
    label: `${a.kode_akun} - ${a.nama_akun}`,
    sublabel: `Saldo Akun: ${formatRupiah(a.saldo || 0)}`,
  }));

  const lawanSelectOptions = filteredLawanAccounts.map((a) => ({
    value: String(a.id),
    label: `${a.kode_akun} - ${a.nama_akun}`,
    sublabel: `${a.kategori} | ${a.subkategori || '-'}`,
  }));

  const handleExportExcel = () => {
    const headers = [
      'No. Transaksi',
      'Tanggal',
      'Tipe Transaksi',
      'Akun Kas / Bank',
      'Akun Lawan',
      'Penerima / Penyetor',
      'Referensi',
      'Nominal (Rp)',
      'Keterangan',
    ];

    const data = (transactions || []).map((t) => [
      t.no_transaksi || '',
      formatDate(t.tanggal),
      t.tipe === 'MASUK' ? 'Kas Masuk (BKM)' : t.tipe === 'KELUAR' ? 'Kas Keluar (BKK)' : 'Transfer Fund',
      t.AccountKas ? `${t.AccountKas.kode_akun} - ${t.AccountKas.nama_akun}` : '',
      t.AccountLawan ? `${t.AccountLawan.kode_akun} - ${t.AccountLawan.nama_akun}` : '',
      t.penerima_penyetor || '',
      t.referensi || '',
      t.nominal ?? 0,
      t.keterangan || '',
    ]);

    exportToExcel('Rekap_Transaksi_Kas_Bank', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="h-6 w-6 text-blue-600" />
            Kas & Biaya Operasional (Cash & Bank)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan kas operasional, pengeluaran beban kantor/gudang, dan penerimaan kas lainnya
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            title="Export ke Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={openTransferModal}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            <ArrowLeftRight className="h-4 w-4" /> Transfer Antar Rekening
          </button>
          <button
            type="button"
            onClick={() => openModal('MASUK')}
            className="btn-secondary flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <ArrowDownRight className="h-4 w-4" /> Catat Kas Masuk (BKM)
          </button>
          <button
            type="button"
            onClick={() => openModal('KELUAR')}
            className="btn-primary flex items-center gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700"
          >
            <ArrowUpRight className="h-4 w-4" /> Catat Biaya Operasional (BKK)
          </button>
        </div>
      </div>

      {/* Alert Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Real-time Cash & Bank Balances */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cashSummary.accounts.map((acc) => (
          <div
            key={acc.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 font-mono">{acc.kode_akun}</span>
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs font-medium text-slate-700 mt-1 line-clamp-1">{acc.nama_akun}</p>
            <p className="text-lg font-bold text-slate-900 mt-2 font-mono">
              {formatRupiah(acc.saldo)}
            </p>
          </div>
        ))}

        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              Total Likuiditas Kas & Bank
            </span>
            <DollarSign className="h-4 w-4 text-blue-700" />
          </div>
          <p className="text-xs text-blue-600 mt-1">Gabungan seluruh kas & rekening</p>
          <p className="text-xl font-extrabold text-blue-900 mt-2 font-mono">
            {formatRupiah(cashSummary.total)}
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => {
              setTipeFilter('ALL');
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tipeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Mutasi
          </button>
          <button
            type="button"
            onClick={() => {
              setTipeFilter('KELUAR');
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              tipeFilter === 'KELUAR'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Biaya / Kas Keluar (BKK)
          </button>
          <button
            type="button"
            onClick={() => {
              setTipeFilter('MASUK');
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              tipeFilter === 'MASUK'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ArrowDownRight className="h-3.5 w-3.5" /> Penerimaan / Kas Masuk (BKM)
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No Transaksi / Keterangan..."
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
              id="filter-kas"
              value={selectedKasFilter}
              onChange={(e) => {
                setSelectedKasFilter(e.target.value);
                setPage(1);
              }}
              options={[{ value: '', label: 'Semua Akun Kas/Bank' }, ...kasSelectOptions]}
              isClearable={false}
              searchPlaceholder="Pilih kas..."
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

      {/* Table Mutasi Kas */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat data transaksi kas...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Tidak ada transaksi kas & bank yang ditemukan.
          </div>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(transactions, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th className="w-28">No Bukti</th>
                        <th className="w-24">Tanggal</th>
                        <th>Tipe</th>
                        <th>Rekening Kas</th>
                        <th>Kategori / Akun Lawan</th>
                        <th className="text-right">Nominal</th>
                        <th>Pihak / Penerima</th>
                        <th>Metode Bayar</th>
                        <th>Keterangan</th>
                        <th className="text-right w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="font-mono font-semibold text-xs text-slate-800">
                            {item.no_transaksi}
                          </td>
                          <td className="text-xs text-slate-600">{formatDate(item.tanggal)}</td>
                          <td>
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${
                                item.tipe === 'KELUAR'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {item.tipe === 'KELUAR' ? (
                                <>
                                  <ArrowUpRight className="h-3 w-3" /> BKK (Biaya)
                                </>
                              ) : (
                                <>
                                  <ArrowDownRight className="h-3 w-3" /> BKM (Masuk)
                                </>
                              )}
                            </span>
                          </td>
                          <td className="text-xs font-medium text-slate-800">
                            {item.nama_kas}
                            <span className="block font-mono text-[11px] text-slate-400">
                              {item.kode_kas}
                            </span>
                          </td>
                          <td className="text-xs font-medium text-slate-800">
                            {item.nama_lawan}
                            <span className="block font-mono text-[11px] text-slate-400">
                              {item.kode_lawan}
                            </span>
                          </td>
                          <td
                            className={`text-right font-mono font-bold text-xs ${
                              item.tipe === 'KELUAR' ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {item.tipe === 'KELUAR' ? '-' : '+'}
                            {formatRupiah(item.nominal)}
                          </td>
                          <td className="text-xs text-slate-600">
                            {item.penerima_penyetor || '-'}
                          </td>
                          <td className="text-xs text-slate-600">{item.metode_pembayaran}</td>
                          <td className="text-xs text-slate-600 max-w-xs truncate">
                            {item.keterangan}
                            {item.referensi && (
                              <span className="block text-[11px] text-slate-400">Ref: {item.referensi}</span>
                            )}
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                              title="Batalkan Transaksi Kas"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  onPage={setPage}
                  totalItems={transactions.length}
                  pageSize={pageSize}
                  onPageSize={(s) => {
                    setPageSize(s);
                    setPage(1);
                  }}
                  label="transaksi kas"
                />
              </>
            );
          })()
        )}
      </div>

      {/* Modal Catat Transaksi Kas */}
      <Modal
        isOpen={modalOpen}
        title={
          form.tipe === 'KELUAR'
            ? 'Catat Biaya Operasional / Kas Keluar (BKK)'
            : 'Catat Penerimaan Kas / Kas Masuk (BKM)'
        }
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="kas_tanggal">
                Tanggal Transaksi *
              </label>
              <input
                id="kas_tanggal"
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="kas_metode">
                Metode Pembayaran *
              </label>
              <SearchableSelect
                id="kas_metode"
                value={form.metode_pembayaran}
                onChange={(e) => setForm({ ...form, metode_pembayaran: e.target.value })}
                options={[
                  { value: 'Kas Tunai', label: 'Kas Tunai' },
                  { value: 'Transfer Bank', label: 'Transfer Bank' },
                  { value: 'Cek / Giro', label: 'Cek / Giro' },
                ]}
                isClearable={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="account_kas">
                {form.tipe === 'KELUAR' ? 'Keluar Dari Rekening Kas/Bank *' : 'Masuk Ke Rekening Kas/Bank *'}
              </label>
              <SearchableSelect
                id="account_kas"
                value={form.account_kas_id}
                onChange={(e) => setForm({ ...form, account_kas_id: e.target.value })}
                options={kasSelectOptions}
                placeholder="Pilih rekening kas/bank..."
                isClearable={false}
              />
            </div>

            <div>
              <label className="label" htmlFor="account_lawan">
                {form.tipe === 'KELUAR' ? 'Kategori Beban / Keperluan *' : 'Sumber / Kategori Penerimaan *'}
              </label>
              <SearchableSelect
                id="account_lawan"
                value={form.account_lawan_id}
                onChange={(e) => setForm({ ...form, account_lawan_id: e.target.value })}
                options={lawanSelectOptions}
                placeholder="Pilih akun beban/kategori..."
                isClearable={false}
                searchPlaceholder="Cari kategori beban..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="kas_nominal">
                Nominal Transaksi (Rp) *
              </label>
              <input
                id="kas_nominal"
                type="number"
                min="1"
                step="any"
                value={form.nominal}
                onChange={(e) => setForm({ ...form, nominal: e.target.value })}
                placeholder="Contoh: 250000"
                className="input font-mono font-semibold"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="kas_pihak">
                {form.tipe === 'KELUAR' ? 'Penerima Pembayaran' : 'Penyetor Uang'}
              </label>
              <input
                id="kas_pihak"
                type="text"
                value={form.penerima_penyetor}
                onChange={(e) => setForm({ ...form, penerima_penyetor: e.target.value })}
                placeholder="Contoh: PLN / Toko ATK / Budi Santoso"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="kas_ref">
              Nomor Referensi / Nomor Faktur / Struk (Opsional)
            </label>
            <input
              id="kas_ref"
              type="text"
              value={form.referensi}
              onChange={(e) => setForm({ ...form, referensi: e.target.value })}
              placeholder="Contoh: STRUK-2026/01 atau No Rekening Listrik"
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="kas_keterangan">
              Keterangan Transaksi *
            </label>
            <textarea
              id="kas_keterangan"
              rows={2}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Jelaskan keperluan pengeluaran atau rincian penerimaan kas..."
              className="input resize-none"
              required
            />
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
              disabled={saving}
              className={`btn-primary ${
                form.tipe === 'KELUAR' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan & Terbitkan Jurnal
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Transfer Dana Antar Rekening Kas/Bank */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Dana Antar Rekening Kas & Bank"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Tanggal Transfer *
            </label>
            <input
              type="date"
              required
              value={transferForm.tanggal}
              onChange={(e) => setTransferForm({ ...transferForm, tanggal: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Dari Rekening Kas/Bank Asal *
              </label>
              <SearchableSelect
                value={transferForm.from_account_id}
                onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })}
                options={kasAccounts.map((a) => ({
                  value: String(a.id),
                  label: `${a.kode_akun} - ${a.nama_akun}`,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Ke Rekening Kas/Bank Tujuan *
              </label>
              <SearchableSelect
                value={transferForm.to_account_id}
                onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })}
                options={kasAccounts.map((a) => ({
                  value: String(a.id),
                  label: `${a.kode_akun} - ${a.nama_akun}`,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nominal Transfer (Rp) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={transferForm.nominal}
                onChange={(e) => setTransferForm({ ...transferForm, nominal: e.target.value })}
                className="input"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                No Referensi Transfer
              </label>
              <input
                type="text"
                value={transferForm.referensi}
                onChange={(e) => setTransferForm({ ...transferForm, referensi: e.target.value })}
                className="input"
                placeholder="TRF-001"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Keterangan Transfer
            </label>
            <textarea
              rows={2}
              value={transferForm.keterangan}
              onChange={(e) => setTransferForm({ ...transferForm, keterangan: e.target.value })}
              className="input resize-none"
              placeholder="Contoh: Pengisian kas kecil mingguan atau transfer ke rekening giro..."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setTransferModalOpen(false)}
              className="btn-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={transferSaving}
              className="btn-primary bg-blue-600 hover:bg-blue-700"
            >
              {transferSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Eksekusi Transfer & Posting Jurnal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

