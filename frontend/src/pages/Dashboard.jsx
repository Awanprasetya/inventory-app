import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Package,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Loader2,
  CreditCard,
  Wallet,
  Clock,
  ArrowRight,
  Landmark,
  TrendingUp,
  Plus,
  FileText,
  Truck,
  RotateCcw,
  Users,
  Building2,
  ShieldCheck,
  BookOpen,
  ShoppingCart,
  FileCheck2,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import api, { getErrorMessage, formatNumber, formatDate, formatRupiah } from '../services/api.js';

import { normalizeRole } from '../config/menuConfig.js';
import { useTour } from '../context/TourContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { isCompleted, startTour } = useTour();
  const [summary, setSummary] = useState(null);
  const [chart, setChart] = useState([]);
  const [cashSummary, setCashSummary] = useState(null);
  const [pnlSummary, setPnlSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState('');

  const normRole = normalizeRole(user?.role, user?.tenant_id, user?.username);
  const isSuperAdmin = normRole === 'PENGEMBANG';
  const isAdmin = normRole === 'ADMINISTRATOR';
  const isKeuangan = normRole === 'ADMIN_KEUANGAN';
  const isGudang = normRole === 'ADMIN_GUDANG';
  const isOperasional = normRole === 'ADMIN_OPERASIONAL';

  // Hanya role PENGEMBANG, ADMINISTRATOR, dan ADMIN_KEUANGAN yang berhak melihat data Akuntansi & Keuangan
  const canAccessAccounting = isSuperAdmin || isAdmin || isKeuangan;

  // Ambil daftar perusahaan jika role adalah Super Admin / Pengembang
  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/auth/tenants')
        .then((res) => setTenants(res.data.data || []))
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = isSuperAdmin && selectedTenantFilter ? { tenant_id: selectedTenantFilter } : {};
      const promises = [
        api.get('/dashboard/summary', { params }),
        api.get('/dashboard/chart', { params }),
      ];

      // Panggil endpoint keuangan hanya jika role user diizinkan mengakses modul Akuntansi
      if (canAccessAccounting) {
        promises.push(api.get('/accounting/cash-summary', { params }).catch(() => ({ data: { data: null } })));
        promises.push(api.get('/accounting/reports/profit-and-loss', { params }).catch(() => ({ data: { data: null } })));
      }

      const results = await Promise.all(promises);
      setSummary(results[0].data.data);
      setChart(results[1].data.data);

      if (canAccessAccounting) {
        setCashSummary(results[2]?.data?.data || null);
        setPnlSummary(results[3]?.data?.data || null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantFilter]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat data dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <button onClick={load} className="ml-3 font-semibold underline">
          Coba lagi
        </button>
      </div>
    );
  }

  const maxBar = Math.max(1, ...chart.map((d) => Math.max(d.masuk, d.keluar)));
  const totalMasuk7 = chart.reduce((s, d) => s + d.masuk, 0);
  const totalKeluar7 = chart.reduce((s, d) => s + d.keluar, 0);

  // Menentukan list Aksi Cepat berdasarkan Normalized Role
  const getQuickActions = () => {
    if (isGudang) {
      return [
        { label: 'Barang Masuk', to: '/inbound', icon: ArrowDownToLine, color: 'bg-emerald-100 text-emerald-700' },
        { label: 'Barang Keluar', to: '/outbound', icon: ArrowUpFromLine, color: 'bg-orange-100 text-orange-700' },
        { label: 'Delivery Order', to: '/delivery-orders', icon: Truck, color: 'bg-blue-100 text-blue-700' },
        { label: 'Retur Barang', to: '/returns', icon: RotateCcw, color: 'bg-rose-100 text-rose-700' },
        { label: 'Stok Opname', to: '/stock-adjustment', icon: ClipboardCheck, color: 'bg-purple-100 text-purple-700' },
        { label: 'Master Produk', to: '/products', icon: Package, color: 'bg-indigo-100 text-indigo-700' },
      ];
    }
    if (isOperasional) {
      return [
        { label: 'Penawaran (SQ)', to: '/sales-quotations', icon: FileCheck2, color: 'bg-cyan-100 text-cyan-700' },
        { label: 'Purchase Order (PO)', to: '/purchase-orders', icon: FileText, color: 'bg-indigo-100 text-indigo-700' },
        { label: 'Sales Order (SO)', to: '/sales-orders', icon: ShoppingCart, color: 'bg-violet-100 text-violet-700' },
        { label: 'Delivery Order (DO)', to: '/delivery-orders', icon: Truck, color: 'bg-blue-100 text-blue-700' },
        { label: 'Barang Masuk', to: '/inbound', icon: ArrowDownToLine, color: 'bg-emerald-100 text-emerald-700' },
        { label: 'Retur Jual & Beli', to: '/returns', icon: RotateCcw, color: 'bg-rose-100 text-rose-700' },
      ];
    }
    if (isKeuangan) {
      return [
        { label: 'Kas & Bank', to: '/cash-bank', icon: Landmark, color: 'bg-teal-100 text-teal-700' },
        { label: 'Utang Usaha (AP)', to: '/accounts-payable', icon: CreditCard, color: 'bg-rose-100 text-rose-700' },
        { label: 'Piutang Usaha (AR)', to: '/accounts-receivable', icon: Wallet, color: 'bg-blue-100 text-blue-700' },
        { label: 'Jurnal Umum', to: '/general-journal', icon: FileText, color: 'bg-indigo-100 text-indigo-700' },
        { label: 'Bagan Akun (COA)', to: '/chart-of-accounts', icon: BookOpen, color: 'bg-violet-100 text-violet-700' },
        { label: 'Laporan Keuangan', to: '/financial-reports', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700' },
      ];
    }
    // Default (Administrator / Developer / Pengembang)
    return [
      { label: 'Tambah Produk', to: '/products', icon: Plus, color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Barang Masuk', to: '/inbound', icon: ArrowDownToLine, color: 'bg-emerald-100 text-emerald-700' },
      { label: 'Delivery Order', to: '/delivery-orders', icon: Truck, color: 'bg-blue-100 text-blue-700' },
      { label: 'Buat Jurnal', to: '/general-journal', icon: FileText, color: 'bg-violet-100 text-violet-700' },
      { label: 'Utang Usaha', to: '/accounts-payable', icon: CreditCard, color: 'bg-rose-100 text-rose-700' },
      { label: 'Laporan ERP', to: '/financial-reports', icon: TrendingUp, color: 'bg-teal-100 text-teal-700' },
    ];
  };

  const getRoleLabel = () => {
    if (isSuperAdmin) return 'Pengembang (Super Admin)';
    if (isAdmin) return 'Administrator Perusahaan';
    if (isKeuangan) return 'Admin Keuangan & Akuntansi';
    if (isGudang) return 'Admin Gudang & Stok';
    if (isOperasional) return 'Admin Operasional & Sales';
    return user?.role || 'Pengguna';
  };

  const quickActions = getQuickActions();

  return (
    <div className="space-y-6">
      {/* Banner Header Sesuai Role */}
      <div id="tour-welcome" className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-sm border border-indigo-400/30">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Role: {getRoleLabel()}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-sm border border-emerald-400/30">
                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                Perusahaan: {isSuperAdmin ? (selectedTenantFilter ? (tenants.find((t) => String(t.id) === String(selectedTenantFilter))?.nama_perusahaan || 'Perusahaan Terpilih') : 'Semua Perusahaan (Konsolidasi)') : (user?.tenant_name || 'Perusahaan Utama')}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Selamat datang kembali, {user?.nama_lengkap || user?.username || 'Pengguna'}! 👋
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {isGudang
                ? 'Ringkasan operasional pergudangan, stok lot, mutasi barang, dan alur delivery order.'
                : isKeuangan
                ? 'Ringkasan posisi keuangan, kas & bank, arus utang-piutang, dan laporan laba rugi.'
                : isOperasional
                ? 'Ringkasan transaksi operasional pesanan (PO/SO), pengiriman barang (DO), retur, dan mitra bisnis.'
                : 'Panel kendali pusat manajemen stok, operasional bisnis, dan laporan keuangan perusahaan.'}
            </p>
          </div>

          {/* Filter Perusahaan Khusus Super Admin / Pengembang */}
          {isSuperAdmin && (
            <div className="flex flex-col sm:items-end gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-indigo-300" /> Filter Perusahaan (SaaS):
              </span>
              <select
                value={selectedTenantFilter}
                onChange={(e) => setSelectedTenantFilter(e.target.value)}
                className="rounded-lg border border-indigo-400/40 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-white shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="">Semua Perusahaan (Konsolidasi)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nama_perusahaan} ({t.kode_tenant})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Aksi Cepat (Quick Actions Bar) */}
      <div id="tour-quick-actions" className="card p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Aksi Cepat Menu</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs font-medium text-slate-700 transition hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 shadow-sm"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${action.color}`}>
                <action.icon className="h-4 w-4" />
              </span>
              <span className="truncate">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Kartu Ringkasan Stok & Operasional (Tampil untuk Admin Gudang, Admin Operasional, Administrator & SuperAdmin) */}
      {(!isKeuangan || isSuperAdmin || isAdmin) && (
        <div id="tour-kpi-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Package className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Produk</p>
              <p className="text-xl font-semibold text-slate-800">{formatNumber(summary.total_produk)}</p>
            </div>
          </div>

          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <Boxes className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Stok</p>
              <p className="text-xl font-semibold text-slate-800">{formatNumber(summary.total_stok)} unit</p>
            </div>
          </div>

          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <ArrowDownToLine className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Masuk Hari Ini</p>
              <p className="text-xl font-semibold text-slate-800">{formatNumber(summary.masuk_hari_ini)}</p>
            </div>
          </div>

          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <ArrowUpFromLine className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Keluar Hari Ini</p>
              <p className="text-xl font-semibold text-slate-800">{formatNumber(summary.keluar_hari_ini)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Kartu Ringkasan Keuangan (HANYA tampil untuk role yang berhak: Admin Keuangan, Administrator, & SuperAdmin) */}
      {canAccessAccounting && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Kas & Bank */}
          <div className="card p-5 border-l-4 border-l-teal-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                  <Landmark className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kas & Bank</p>
                  <p className="text-lg font-bold text-slate-800">
                    {cashSummary ? formatRupiah(cashSummary.total) : 'Rp0'}
                  </p>
                </div>
              </div>
              <Link
                to="/cash-bank"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-teal-600 hover:bg-teal-50"
              >
                Mutasi <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Saldo likuiditas tunai & giro bank</p>
          </div>

          {/* Laba Bersih */}
          <div className="card p-5 border-l-4 border-l-indigo-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Laba Bersih</p>
                  <p
                    className={`text-lg font-bold ${
                      pnlSummary && pnlSummary.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {pnlSummary ? formatRupiah(pnlSummary.netIncome) : 'Rp0'}
                  </p>
                </div>
              </div>
              <Link
                to="/financial-reports"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                Laporan <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Laba operasional periode berjalan</p>
          </div>

          {/* Utang Usaha (AP) */}
          <div className="card p-5 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                  <CreditCard className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utang Usaha (AP)</p>
                  <p className="text-lg font-bold text-slate-800">{formatRupiah(summary.total_utang_aktif)}</p>
                </div>
              </div>
              <Link
                to="/accounts-payable"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                Detail <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {summary.total_utang_overdue > 0 ? (
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-rose-700">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>{summary.count_utang_overdue} jatuh tempo ({formatRupiah(summary.total_utang_overdue)})</span>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">Semua utang dalam tempo normal</p>
            )}
          </div>

          {/* Piutang Usaha (AR) */}
          <div className="card p-5 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Piutang Usaha (AR)</p>
                  <p className="text-lg font-bold text-slate-800">{formatRupiah(summary.total_piutang_aktif)}</p>
                </div>
              </div>
              <Link
                to="/accounts-receivable"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                Detail <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {summary.total_piutang_overdue > 0 ? (
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>{summary.count_piutang_overdue} lewat tempo ({formatRupiah(summary.total_piutang_overdue)})</span>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">Tidak ada piutang jatuh tempo</p>
            )}
          </div>
        </div>
      )}

      {/* Grid Grafik dan Perhatian Stok */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Grafik 7 hari */}
        <div className="card xl:col-span-2">
          <div className="card-header flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Mutasi Stok 7 Hari Terakhir</h2>
              <p className="text-xs text-slate-500">
                Total masuk {formatNumber(totalMasuk7)} &middot; keluar {formatNumber(totalKeluar7)} unit
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-blue-500" /> Masuk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-orange-500" /> Keluar
              </span>
            </div>
          </div>
          <div className="p-5">
            <div className="flex h-56 items-end gap-2 sm:gap-4">
              {chart.map((d) => (
                <div key={d.tanggal} className="flex h-full flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full items-end justify-center gap-1">
                    <div
                      className="w-1/3 rounded-t bg-blue-500 transition-all"
                      style={{ height: `${d.masuk === 0 ? 0 : Math.max((d.masuk / maxBar) * 100, 4)}%` }}
                      title={`Masuk: ${d.masuk}`}
                    />
                    <div
                      className="w-1/3 rounded-t bg-orange-500 transition-all"
                      style={{ height: `${d.keluar === 0 ? 0 : Math.max((d.keluar / maxBar) * 100, 4)}%` }}
                      title={`Keluar: ${d.keluar}`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">{formatDate(d.tanggal)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Perhatian Stok (Stok Menipis / Habis) */}
        <div id="widget-perhatian-stok" className="card transition-all duration-300">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Perhatian Stok</h2>
            <span className="badge bg-amber-100 text-amber-700">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              {formatNumber(summary.stok_habis)} lot habis
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {summary.stok_menipis.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">
                Semua stok aman, tidak ada lot di bawah ambang batas.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.stok_menipis.map((lot) => (
                  <li key={lot.nomor_lot} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{lot.nama_produk}</p>
                      <p className="truncate text-xs text-slate-500">{lot.nomor_lot}</p>
                    </div>
                    <span
                      className={`badge ${lot.stok_qty === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
                    >
                      {formatNumber(lot.stok_qty)} {lot.satuan}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Widget Pengingat Jatuh Tempo (HANYA tampil untuk role yang berhak mengakses Akuntansi & Keuangan) */}
      {canAccessAccounting && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Pengingat Tagihan & Jatuh Tempo</h2>
                <p className="text-xs text-slate-500">Daftar tagihan yang sudah lewat atau mendekati jatuh tempo</p>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <Link to="/accounts-payable" className="font-semibold text-rose-600 hover:underline">
                Semua Utang
              </Link>
              <span className="text-slate-300">•</span>
              <Link to="/accounts-receivable" className="font-semibold text-blue-600 hover:underline">
                Semua Piutang
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            {!summary.upcoming_due || summary.upcoming_due.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Tidak ada tagihan utang atau piutang yang perlu perhatian saat ini.
              </p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Tipe</th>
                    <th>No. Tagihan</th>
                    <th>Pihak (Supplier / Customer)</th>
                    <th>Jatuh Tempo</th>
                    <th className="text-right">Sisa Tagihan</th>
                    <th>Status Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.upcoming_due.map((item, idx) => {
                    const isUtang = item.tipe === 'UTANG';
                    const days = Number(item.hari_terlewat);
                    return (
                      <tr key={`${item.tipe}-${item.id}-${idx}`} className="hover:bg-slate-50">
                        <td>
                          <span
                            className={`badge ${
                              isUtang ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isUtang ? 'Utang (AP)' : 'Piutang (AR)'}
                          </span>
                        </td>
                        <td className="font-medium text-slate-800">
                          <Link
                            to={isUtang ? '/accounts-payable' : '/accounts-receivable'}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {item.no_tagihan}
                          </Link>
                        </td>
                        <td className="text-slate-700">{item.pihak || '-'}</td>
                        <td className="whitespace-nowrap text-xs text-slate-600">{formatDate(item.jatuh_tempo)}</td>
                        <td className="whitespace-nowrap text-right font-bold text-slate-900">
                          {formatRupiah(item.nominal_sisa)}
                        </td>
                        <td className="whitespace-nowrap">
                          {days > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                              <AlertTriangle className="h-3 w-3" /> Lewat {days} hari
                            </span>
                          ) : days === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              <Clock className="h-3 w-3" /> Hari ini
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              Sisa {Math.abs(days)} hari
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
