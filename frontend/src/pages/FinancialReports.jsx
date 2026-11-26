import { useEffect, useState } from 'react';
import {
  TrendingUp,
  Scale,
  BookMarked,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  DollarSign,
  PieChart,
  FileText,
  BarChart3,
  Layers,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Download,
  Filter,
} from 'lucide-react';
import api, { getErrorMessage, formatRupiah, formatDate } from '../services/api.js';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import PrintableReportHeader from '../components/PrintableReportHeader.jsx';
import PrintableReportSignatures from '../components/PrintableReportSignatures.jsx';
import ReportCustomizerModal, {
  loadSavedReportConfig,
  saveReportConfigToStorage,
  DEFAULT_REPORT_CONFIG,
} from '../components/ReportCustomizerModal.jsx';

export default function FinancialReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pnl');
  // 'pnl' | 'balance_sheet' | 'cash_flow' | 'general_ledger' | 'trial_balance' | 'gl_reconciliation' | 'aging'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Date filters
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [asOfDate, setAsOfDate] = useState(today);

  // Accounts list (for General Ledger selection)
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Data states
  const [pnlData, setPnlData] = useState(null);
  const [bsData, setBsData] = useState(null);
  const [cfData, setCfData] = useState(null);
  const [glData, setGlData] = useState(null);
  const [tbData, setTbData] = useState(null);
  const [reconcileData, setReconcileData] = useState(null);
  const [agingApData, setAgingApData] = useState(null);
  const [agingArData, setAgingArData] = useState(null);

  // Customization Configuration
  const [customConfig, setCustomConfig] = useState(() => {
    const saved = loadSavedReportConfig('FINANCE');
    if (user?.tenant_name && saved.companyName === DEFAULT_REPORT_CONFIG.companyName) {
      return { ...saved, companyName: user.tenant_name };
    }
    return saved;
  });
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // Default title per tab
  const reportTitles = {
    pnl: 'LAPORAN LABA RUGI (INCOME STATEMENT)',
    balance_sheet: 'NERACA KEUANGAN (BALANCE SHEET)',
    cash_flow: 'LAPORAN ARUS KAS (CASH FLOW STATEMENT)',
    general_ledger: 'BUKU BESAR (GENERAL LEDGER)',
    trial_balance: 'NERACA SALDO (TRIAL BALANCE)',
    gl_reconciliation: 'REKONSILIASI BUKU BESAR (GL) VS SUB-LEDGER',
    aging: 'ANALISIS UMUR PIUTANG & UTANG USAHA (AGING)',
  };

  const currentReportTitle = customConfig.reportTitle || reportTitles[activeTab] || 'Laporan Keuangan';

  // Load account list once
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/accounting/accounts');
        setAccounts(data.data);
        if (data.data.length > 0) {
          setSelectedAccountId(String(data.data[0].id));
        }
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
  }, []);

  // Fetch report data based on active tab
  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'pnl') {
        const { data } = await api.get('/accounting/reports/profit-and-loss', {
          params: { startDate, endDate },
        });
        setPnlData(data.data);
      } else if (activeTab === 'balance_sheet') {
        const { data } = await api.get('/accounting/reports/balance-sheet', {
          params: { asOfDate },
        });
        setBsData(data.data);
      } else if (activeTab === 'cash_flow') {
        const { data } = await api.get('/accounting/reports/cash-flow', {
          params: { startDate, endDate },
        });
        setCfData(data.data);
      } else if (activeTab === 'general_ledger') {
        if (!selectedAccountId) return;
        const { data } = await api.get('/accounting/reports/general-ledger', {
          params: { accountId: selectedAccountId, startDate, endDate },
        });
        setGlData(data.data);
      } else if (activeTab === 'trial_balance') {
        const { data } = await api.get('/accounting/reports/trial-balance', {
          params: { startDate, endDate },
        });
        setTbData(data.data);
      } else if (activeTab === 'gl_reconciliation') {
        const { data } = await api.get('/accounting/reports/gl-reconciliation');
        setReconcileData(data.data);
      } else if (activeTab === 'aging') {
        const [resAp, resAr] = await Promise.all([
          api.get('/accounting/reports/aging-ap'),
          api.get('/accounting/reports/aging-ar'),
        ]);
        setAgingApData(resAp.data.data);
        setAgingArData(resAr.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, startDate, endDate, asOfDate, selectedAccountId]);

  // Clean Print / Save PDF Handler
  const handlePrint = (overrideConfig = null) => {
    const cfg = overrideConfig || customConfig;
    const originalTitle = document.title;
    const tabNameMap = {
      pnl: 'Laba_Rugi',
      balance_sheet: 'Neraca_Keuangan',
      cash_flow: 'Arus_Kas',
      general_ledger: `Buku_Besar_${glData?.account?.kode_akun || ''}`,
      trial_balance: 'Neraca_Saldo',
      gl_reconciliation: 'Rekonsiliasi_GL',
      aging: 'Aging_Piutang_Hutang',
    };
    const cleanCompany = (cfg.companyName || 'Perusahaan').replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = activeTab === 'balance_sheet' ? asOfDate : endDate;
    document.title = `${cleanCompany}_${tabNameMap[activeTab] || 'Laporan'}_${safeDate}`;

    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Quick Period Filters
  const setQuickPeriod = (type) => {
    const now = new Date();
    if (type === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(today);
      setAsOfDate(today);
    } else if (type === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
      setAsOfDate(end);
    } else if (type === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(today);
      setAsOfDate(today);
    }
  };

  const accountSelectOptions = accounts.map((a) => ({
    value: String(a.id),
    label: `${a.kode_akun} - ${a.nama_akun}`,
    sublabel: `${a.kategori} | Normal: ${a.saldo_normal}`,
  }));

  // Helper filter zero balances
  const filterZero = (items = [], valKey = 'nominal') => {
    if (!customConfig.hideZeroBalances) return items;
    return items.filter((it) => Math.abs(Number(it[valKey] || 0)) > 0.0001);
  };

  const currentUserName = user?.nama_lengkap || user?.username || 'Administrator Keuangan';

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Laporan Keuangan ERP (Financial Statements)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan resmi Laba Rugi, Neraca, Arus Kas, Buku Besar, Neraca Saldo, Rekonsiliasi, dan Analisis Umur Hutang/Piutang
          </p>
        </div>

        {/* Action Buttons: Kustomisasi & Export PDF */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              let headers = ['Kategori / Keterangan', 'Kode / Detail', 'Nominal (Rp)'];
              let rows = [];
              let name = `Laporan_${activeTab}`;

              if (activeTab === 'pnl' && pnlData) {
                name = `Laporan_Laba_Rugi_${startDate}_s/d_${endDate}`;
                rows.push(['--- PENDAPATAN ---', '', '']);
                (pnlData.revenues || []).forEach((r) => rows.push([r.nama_akun, r.kode_akun, r.nominal]));
                rows.push(['TOTAL PENDAPATAN', '', pnlData.totalRevenue]);
                rows.push(['--- HARGA POKOK PENJUALAN (HPP) ---', '', '']);
                (pnlData.cogs || []).forEach((c) => rows.push([c.nama_akun, c.kode_akun, c.nominal]));
                rows.push(['TOTAL HPP', '', pnlData.totalCogs]);
                rows.push(['LABA KOTOR', '', pnlData.grossProfit]);
                rows.push(['--- BEBAN OPERASIONAL ---', '', '']);
                (pnlData.expenses || []).forEach((e) => rows.push([e.nama_akun, e.kode_akun, e.nominal]));
                rows.push(['TOTAL BEBAN OPERASIONAL', '', pnlData.totalExpenses]);
                rows.push(['LABA BERSIH (NET INCOME)', '', pnlData.netIncome]);
              } else if (activeTab === 'balance_sheet' && bsData) {
                name = `Neraca_Keuangan_per_${asOfDate}`;
                headers = ['Kategori Akun', 'Kode Akun', 'Nama Akun', 'Saldo (Rp)'];
                (bsData.assets || []).forEach((a) => rows.push(['ASET', a.kode_akun, a.nama_akun, a.saldo]));
                rows.push(['TOTAL ASET', '', '', bsData.totalAssets]);
                (bsData.liabilities || []).forEach((l) => rows.push(['LIABILITAS', l.kode_akun, l.nama_akun, l.saldo]));
                rows.push(['TOTAL LIABILITAS', '', '', bsData.totalLiabilities]);
                (bsData.equity || []).forEach((e) => rows.push(['EKUITAS', e.kode_akun, e.nama_akun, e.saldo]));
                rows.push(['TOTAL EKUITAS', '', '', bsData.totalEquity]);
              } else if (activeTab === 'general_ledger' && glData) {
                name = `Buku_Besar_${startDate}_s/d_${endDate}`;
                headers = ['Tanggal', 'No. Jurnal', 'Kode Akun', 'Nama Akun', 'Keterangan', 'Debit (Rp)', 'Kredit (Rp)', 'Saldo Akhir (Rp)'];
                (glData.entries || []).forEach((g) => rows.push([g.tanggal, g.no_jurnal, g.kode_akun, g.nama_akun, g.keterangan, g.debit, g.kredit, g.saldo_kumulatif]));
              }

              import('../utils/exportHelper.js').then((mod) => mod.exportToCSV(name, headers, rows));
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 shadow-sm transition"
            title="Unduh laporan aktif ke file Excel (CSV)"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Export Excel (CSV)
          </button>

          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 shadow-sm transition"
            title="Atur kop surat, sembunyikan saldo nol, tanda tangan pengesahan, dan orientasi cetak"
          >
            <Sliders className="h-4 w-4 text-blue-600" />
            Kustomisasi Laporan
          </button>

          <button
            type="button"
            onClick={() => handlePrint()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition"
            title="Cetak atau Unduh Dokumen sebagai PDF"
          >
            <Printer className="h-4 w-4" />
            Cetak / Export PDF
          </button>
        </div>
      </div>

      {/* Active Customization Indicator Badges (Print: Hidden) */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200 print:hidden">
        <span className="font-semibold text-slate-700 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          Status Tampilan:
        </span>
        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
          Entitas: <strong>{customConfig.companyName}</strong>
        </span>
        <span className={`px-2 py-0.5 rounded border ${customConfig.hideZeroBalances ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' : 'bg-white border-slate-200 text-slate-600'}`}>
          Saldo Rp 0: {customConfig.hideZeroBalances ? 'Disembunyikan' : 'Ditampilkan'}
        </span>
        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
          Kode Akun: {customConfig.showAccountCodes ? 'Aktif' : 'Disembunyikan'}
        </span>
        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
          Pengesahan: {customConfig.showSignatures ? '3 Pihak' : 'Nonaktif'}
        </span>
        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 uppercase">
          Kertas: A4 {customConfig.orientation}
        </span>
      </div>

      {/* Report Tab Navigation */}
      <div className="flex border-b border-slate-200 print:hidden overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('pnl')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'pnl'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Laba Rugi (P&L)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('balance_sheet')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'balance_sheet'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Scale className="h-4 w-4" /> Neraca (Balance Sheet)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cash_flow')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'cash_flow'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <DollarSign className="h-4 w-4" /> Arus Kas (Cash Flow)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('general_ledger')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'general_ledger'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookMarked className="h-4 w-4" /> Buku Besar (GL)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trial_balance')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'trial_balance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="h-4 w-4" /> Neraca Saldo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gl_reconciliation')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'gl_reconciliation'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> Rekonsiliasi GL & Sub-Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('aging')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'aging'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="h-4 w-4" /> Aging Piutang & Hutang
        </button>
      </div>

      {/* Filter Control Box */}
      <div className="card p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {activeTab === 'balance_sheet' ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Per Tanggal (As of Date):</span>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="input text-xs w-44"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAsOfDate(today)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
                    setAsOfDate(lastMonthEnd);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Akhir Bulan Lalu
                </button>
              </div>
            </div>
          ) : activeTab === 'gl_reconciliation' || activeTab === 'aging' ? (
            <div className="text-xs text-slate-500 italic">
              Laporan rekonsiliasi dan analisis umur piutang/hutang dihitung secara otomatis berdasarkan status mutasi terkini.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Periode:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input text-xs w-36"
                />
                <span className="text-xs text-slate-400">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input text-xs w-36"
                />
              </div>

              {/* Quick Period Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickPeriod('this_month')}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPeriod('last_month')}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Bulan Lalu
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPeriod('this_year')}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Tahun Berjalan
                </button>
              </div>

              {activeTab === 'general_ledger' && (
                <div className="w-72">
                  <SearchableSelect
                    id="gl-account-select"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e?.target ? e.target.value : e)}
                    options={accountSelectOptions}
                    placeholder="Pilih Akun Buku Besar..."
                    isClearable={false}
                  />
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-slate-400 italic">
            Klik Cetak/Export PDF untuk melihat hasil dokumen A4 resmi.
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Menghitung data laporan akuntansi...
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: LABA RUGI (INCOME STATEMENT) */}
      {/* ==================================================================== */}
      {!loading && activeTab === 'pnl' && pnlData && (
        <div className={`card p-6 sm:p-8 space-y-6 max-w-4xl mx-auto bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full print:max-w-none ${customConfig.orientation === 'landscape' ? 'print-landscape' : ''}`}>
          <PrintableReportHeader
            companyName={customConfig.companyName}
            companyAddress={customConfig.companyAddress}
            companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
            showCompanyHeader={customConfig.showCompanyHeader}
            title={currentReportTitle}
            subtitle={`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`}
            docNo={customConfig.docNo || 'RPT-PNL/2026/10'}
            printedBy={currentUserName}
          />

          <div className="space-y-6 text-sm">
            {/* 1. Pendapatan */}
            <div>
              <div className="flex justify-between border-b-2 border-slate-900 pb-1 font-bold text-slate-900 uppercase">
                <span>1. PENDAPATAN USAHA (REVENUE)</span>
                <span>(IDR)</span>
              </div>
              <div className="divide-y divide-slate-100 py-1 space-y-0.5">
                {filterZero(pnlData.revenue.items, 'nominal').length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 italic pl-4">Tidak ada pendapatan aktif dalam periode ini.</p>
                ) : (
                  filterZero(pnlData.revenue.items, 'nominal').map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 text-slate-700">
                      <span className="pl-4">
                        {customConfig.showAccountCodes && (
                          <span className="font-mono text-xs text-slate-500 mr-2">{item.kode_akun}</span>
                        )}
                        {item.nama_akun}
                      </span>
                      <span className="font-mono tabular-nums font-medium">{formatRupiah(item.nominal)}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-between border-t-2 border-slate-300 pt-2 font-bold text-slate-900">
                <span>TOTAL PENDAPATAN USAHA</span>
                <span className="font-mono tabular-nums text-blue-800 text-base">{formatRupiah(pnlData.revenue.total)}</span>
              </div>
            </div>

            {/* 2. HPP / COGS */}
            <div>
              <div className="flex justify-between border-b-2 border-slate-900 pb-1 font-bold text-slate-900 uppercase">
                <span>2. BEBAN POKOK PENJUALAN (COGS / HPP)</span>
                <span>(IDR)</span>
              </div>
              <div className="divide-y divide-slate-100 py-1 space-y-0.5">
                {filterZero(pnlData.cogs.items, 'nominal').length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 italic pl-4">Tidak ada beban pokok tercatat.</p>
                ) : (
                  filterZero(pnlData.cogs.items, 'nominal').map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 text-slate-700">
                      <span className="pl-4">
                        {customConfig.showAccountCodes && (
                          <span className="font-mono text-xs text-slate-500 mr-2">{item.kode_akun}</span>
                        )}
                        {item.nama_akun}
                      </span>
                      <span className="font-mono tabular-nums text-rose-600 font-medium">({formatRupiah(item.nominal)})</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-between border-t-2 border-slate-300 pt-2 font-bold text-slate-900">
                <span>TOTAL BEBAN POKOK PENJUALAN</span>
                <span className="font-mono tabular-nums text-rose-600 text-base">({formatRupiah(pnlData.cogs.total)})</span>
              </div>
            </div>

            {/* Subtotal Laba Kotor */}
            <div className="rounded-lg bg-slate-100/80 p-3.5 border border-slate-300 flex justify-between font-bold text-base text-slate-900 print:bg-slate-50">
              <span>LABA KOTOR (GROSS PROFIT)</span>
              <span className={`font-mono tabular-nums ${pnlData.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatRupiah(pnlData.grossProfit)}
              </span>
            </div>

            {/* 3. Beban Operasional */}
            <div>
              <div className="flex justify-between border-b-2 border-slate-900 pb-1 font-bold text-slate-900 uppercase">
                <span>3. BEBAN OPERASIONAL (OPERATING EXPENSES)</span>
                <span>(IDR)</span>
              </div>
              <div className="divide-y divide-slate-100 py-1 space-y-0.5">
                {filterZero(pnlData.expenses.items, 'nominal').length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 italic pl-4">Tidak ada beban operasional tercatat.</p>
                ) : (
                  filterZero(pnlData.expenses.items, 'nominal').map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 text-slate-700">
                      <span className="pl-4">
                        {customConfig.showAccountCodes && (
                          <span className="font-mono text-xs text-slate-500 mr-2">{item.kode_akun}</span>
                        )}
                        {item.nama_akun}
                      </span>
                      <span className="font-mono tabular-nums text-rose-600 font-medium">({formatRupiah(item.nominal)})</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-between border-t-2 border-slate-300 pt-2 font-bold text-slate-900">
                <span>TOTAL BEBAN OPERASIONAL</span>
                <span className="font-mono tabular-nums text-rose-600 text-base">({formatRupiah(pnlData.expenses.total)})</span>
              </div>
            </div>

            {/* Grand Total Laba/Rugi Bersih */}
            <div
              className={`rounded-lg p-4 border-2 flex justify-between font-extrabold text-lg ${
                pnlData.netIncome >= 0
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900 print:bg-white'
                  : 'bg-rose-50 border-rose-400 text-rose-900 print:bg-white'
              }`}
            >
              <span>LABA / (RUGI) BERSIH OPERASIONAL</span>
              <span className="font-mono tabular-nums underline decoration-double underline-offset-4">
                {formatRupiah(pnlData.netIncome)}
              </span>
            </div>
          </div>

          <PrintableReportSignatures
            show={customConfig.showSignatures}
            city={customConfig.signatureCity}
            date={customConfig.signatureDate}
            signer1={customConfig.signer1}
            signer2={customConfig.signer2}
            signer3={customConfig.signer3}
            companyStamp={customConfig.companyStamp}
            showStamp={customConfig.showStamp}
            stampPosition={customConfig.stampPosition}
            footerNote={customConfig.footerNote}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: NERACA (BALANCE SHEET) */}
      {/* ==================================================================== */}
      {!loading && activeTab === 'balance_sheet' && bsData && (
        <div className={`card p-6 sm:p-8 space-y-6 max-w-5xl mx-auto bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full print:max-w-none ${customConfig.orientation === 'landscape' ? 'print-landscape' : ''}`}>
          <PrintableReportHeader
            companyName={customConfig.companyName}
            companyAddress={customConfig.companyAddress}
            companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
            showCompanyHeader={customConfig.showCompanyHeader}
            title={currentReportTitle}
            subtitle={`Per Tanggal: ${formatDate(asOfDate)}`}
            docNo={customConfig.docNo || 'RPT-BAL/2026/10'}
            printedBy={currentUserName}
            badge={
              bsData.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> NERACA SEIMBANG (AKTIVA = PASIVA)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-200">
                  <AlertCircle className="h-3.5 w-3.5" /> PERHATIAN: NERACA BELUM SEIMBANG
                </span>
              )
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            {/* Sisi Kiri: AKTIVA / ASET */}
            <div className="space-y-4">
              <div className="border-b-2 border-blue-900 pb-1 font-bold text-blue-950 flex justify-between uppercase">
                <span>AKTIVA / ASET</span>
                <span>(IDR)</span>
              </div>
              <div className="space-y-1 divide-y divide-slate-100">
                {filterZero(bsData.assets.items, 'balance').map((item) => (
                  <div key={item.id} className="flex justify-between py-1.5 text-slate-700">
                    <div>
                      {customConfig.showAccountCodes && (
                        <span className="font-mono text-xs text-slate-500 mr-2">{item.kode_akun}</span>
                      )}
                      <span>{item.nama_akun}</span>
                    </div>
                    <span className="font-mono tabular-nums font-medium">{formatRupiah(item.balance)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-blue-50/80 border-2 border-blue-200 p-3 flex justify-between font-extrabold text-blue-950 mt-4 text-base print:bg-white">
                <span>TOTAL AKTIVA / ASET</span>
                <span className="font-mono tabular-nums underline decoration-double underline-offset-4">
                  {formatRupiah(bsData.assets.total)}
                </span>
              </div>
            </div>

            {/* Sisi Kanan: KEWAJIBAN & EKUITAS */}
            <div className="space-y-6">
              {/* Kewajiban */}
              <div className="space-y-2">
                <div className="border-b-2 border-amber-900 pb-1 font-bold text-amber-950 flex justify-between uppercase">
                  <span>KEWAJIBAN / UTANG (LIABILITIES)</span>
                  <span>(IDR)</span>
                </div>
                <div className="space-y-1 divide-y divide-slate-100">
                  {filterZero(bsData.liabilities.items, 'balance').map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 text-slate-700">
                      <div>
                        {customConfig.showAccountCodes && (
                          <span className="font-mono text-xs text-slate-500 mr-2">{item.kode_akun}</span>
                        )}
                        <span>{item.nama_akun}</span>
                      </div>
                      <span className="font-mono tabular-nums font-medium">{formatRupiah(item.balance)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-1.5 font-bold text-slate-900">
                  <span>Total Kewajiban</span>
                  <span className="font-mono tabular-nums text-amber-800">{formatRupiah(bsData.liabilities.total)}</span>
                </div>
              </div>

              {/* Ekuitas */}
              <div className="space-y-2">
                <div className="border-b-2 border-purple-900 pb-1 font-bold text-purple-950 flex justify-between uppercase">
                  <span>EKUITAS / MODAL (EQUITY)</span>
                  <span>(IDR)</span>
                </div>
                <div className="space-y-1 divide-y divide-slate-100">
                  {filterZero(bsData.equity.items, 'balance').map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 text-slate-700">
                      <div>
                        {customConfig.showAccountCodes && (
                          <span className="font-mono text-xs text-slate-500 mr-2">{item.kode_akun}</span>
                        )}
                        <span>{item.nama_akun}</span>
                      </div>
                      <span className="font-mono tabular-nums font-medium">{formatRupiah(item.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 text-slate-700 bg-purple-50/60 px-2 rounded font-medium">
                    <span className="italic">Laba Periode Berjalan</span>
                    <span className="font-mono tabular-nums text-purple-800">
                      {formatRupiah(bsData.equity.currentYearEarnings)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-1.5 font-bold text-slate-900">
                  <span>Total Ekuitas</span>
                  <span className="font-mono tabular-nums text-purple-800">{formatRupiah(bsData.equity.total)}</span>
                </div>
              </div>

              {/* Total Pasiva */}
              <div className="rounded-lg bg-slate-100/90 border-2 border-slate-300 p-3 flex justify-between font-extrabold text-slate-950 mt-4 text-base print:bg-white">
                <span>TOTAL KEWAJIBAN & EKUITAS</span>
                <span className="font-mono tabular-nums underline decoration-double underline-offset-4">
                  {formatRupiah(bsData.totalLiabilityAndEquity)}
                </span>
              </div>
            </div>
          </div>

          <PrintableReportSignatures
            show={customConfig.showSignatures}
            city={customConfig.signatureCity}
            date={customConfig.signatureDate}
            signer1={customConfig.signer1}
            signer2={customConfig.signer2}
            signer3={customConfig.signer3}
            companyStamp={customConfig.companyStamp}
            showStamp={customConfig.showStamp}
            stampPosition={customConfig.stampPosition}
            footerNote={customConfig.footerNote}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: ARUS KAS (CASH FLOW STATEMENT) */}
      {/* ==================================================================== */}
      {!loading && activeTab === 'cash_flow' && cfData && (
        <div className={`card p-6 sm:p-8 space-y-6 max-w-4xl mx-auto bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full print:max-w-none ${customConfig.orientation === 'landscape' ? 'print-landscape' : ''}`}>
          <PrintableReportHeader
            companyName={customConfig.companyName}
            companyAddress={customConfig.companyAddress}
            companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
            showCompanyHeader={customConfig.showCompanyHeader}
            title={currentReportTitle}
            subtitle={`Metode Langsung · Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`}
            docNo={customConfig.docNo || 'RPT-CF/2026/10'}
            printedBy={currentUserName}
          />

          <div className="space-y-6 text-sm">
            {/* 1. Aktivitas Operasi */}
            <div>
              <div className="border-b-2 border-slate-900 pb-1 font-bold text-slate-900 uppercase flex justify-between">
                <span>1. ARUS KAS DARI AKTIVITAS OPERASI</span>
                <span>(IDR)</span>
              </div>
              <div className="py-2 space-y-2 text-slate-700">
                <div className="flex justify-between pl-4">
                  <span>Penerimaan Kas dari Pelanggan (Pelunasan Piutang & Penjualan Tunai)</span>
                  <span className="font-mono tabular-nums text-emerald-600 font-medium">
                    +{formatRupiah(cfData.operating.penerimaanPelanggan)}
                  </span>
                </div>
                <div className="flex justify-between pl-4">
                  <span>Penerimaan Kas Operasional Lainnya</span>
                  <span className="font-mono tabular-nums text-emerald-600 font-medium">
                    +{formatRupiah(cfData.operating.penerimaanLain)}
                  </span>
                </div>
                <div className="flex justify-between pl-4">
                  <span>Pembayaran Kas ke Pemasok (Pelunasan Hutang Pembelian)</span>
                  <span className="font-mono tabular-nums text-rose-600 font-medium">
                    -{formatRupiah(cfData.operating.pembayaranPemasok)}
                  </span>
                </div>
                <div className="flex justify-between pl-4">
                  <span>Pembayaran Kas untuk Beban Operasional & Biaya Umum</span>
                  <span className="font-mono tabular-nums text-rose-600 font-medium">
                    -{formatRupiah(cfData.operating.pembayaranOperasional)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between border-t-2 border-slate-300 pt-2 font-bold text-slate-900">
                <span>Arus Kas Bersih dari Aktivitas Operasi</span>
                <span className={`font-mono tabular-nums text-base ${cfData.operating.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatRupiah(cfData.operating.net)}
                </span>
              </div>
            </div>

            {/* 2. Aktivitas Investasi */}
            <div>
              <div className="border-b-2 border-slate-900 pb-1 font-bold text-slate-900 uppercase flex justify-between">
                <span>2. ARUS KAS DARI AKTIVITAS INVESTASI</span>
                <span>(IDR)</span>
              </div>
              <div className="py-2 text-slate-700 pl-4 flex justify-between">
                <span>Perolehan / Pembelian Aset Tetap & Peralatan Usaha</span>
                <span className="font-mono tabular-nums text-slate-900 font-medium">{formatRupiah(cfData.investing.total)}</span>
              </div>
            </div>

            {/* 3. Aktivitas Pendanaan */}
            <div>
              <div className="border-b-2 border-slate-900 pb-1 font-bold text-slate-900 uppercase flex justify-between">
                <span>3. ARUS KAS DARI AKTIVITAS PENDANAAN</span>
                <span>(IDR)</span>
              </div>
              <div className="py-2 text-slate-700 pl-4 flex justify-between">
                <span>Setoran / Penarikan Modal Pemilik (Ekuitas)</span>
                <span className="font-mono tabular-nums text-slate-900 font-medium">{formatRupiah(cfData.financing.total)}</span>
              </div>
            </div>

            {/* Rekonsiliasi Saldo Kas */}
            <div className="rounded-xl border-2 border-slate-300 bg-slate-50/80 p-4 space-y-2.5 font-semibold text-slate-900 print:bg-white">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Kenaikan / (Penurunan) Kas Bersih Periode Berjalan</span>
                <span className={`font-mono tabular-nums font-bold ${cfData.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatRupiah(cfData.netCashFlow)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Saldo Kas & Bank Pada Awal Periode</span>
                <span className="font-mono tabular-nums text-slate-900">{formatRupiah(cfData.beginningCash)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-blue-950 border-t-2 border-slate-300 pt-2">
                <span>SALDO KAS & BANK PADA AKHIR PERIODE</span>
                <span className="font-mono tabular-nums underline decoration-double underline-offset-4">
                  {formatRupiah(cfData.endingCash)}
                </span>
              </div>
            </div>
          </div>

          <PrintableReportSignatures
            show={customConfig.showSignatures}
            city={customConfig.signatureCity}
            date={customConfig.signatureDate}
            signer1={customConfig.signer1}
            signer2={customConfig.signer2}
            signer3={customConfig.signer3}
            companyStamp={customConfig.companyStamp}
            showStamp={customConfig.showStamp}
            stampPosition={customConfig.stampPosition}
            footerNote={customConfig.footerNote}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: BUKU BESAR (GENERAL LEDGER) */}
      {/* ==================================================================== */}
      {!loading && activeTab === 'general_ledger' && glData && (
        <div className={`card p-6 sm:p-8 space-y-4 max-w-5xl mx-auto bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full print:max-w-none ${customConfig.orientation === 'landscape' ? 'print-landscape' : ''}`}>
          <PrintableReportHeader
            companyName={customConfig.companyName}
            companyAddress={customConfig.companyAddress}
            companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
            showCompanyHeader={customConfig.showCompanyHeader}
            title={`${currentReportTitle} - ${glData.account.nama_akun}`}
            subtitle={`Kode Akun: ${glData.account.kode_akun} | Kategori: ${glData.account.kategori} | Normal: ${glData.account.saldo_normal} | Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`}
            docNo={customConfig.docNo || `RPT-GL/${glData.account.kode_akun}`}
            printedBy={currentUserName}
          />

          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0 mb-3">
            <div>
              <span className="text-xs text-slate-500 block">Akun Buku Besar:</span>
              <span className="text-sm font-bold text-slate-800">{glData.account.nama_akun} ({glData.account.kode_akun})</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Saldo Akhir Periode:</span>
              <span className="text-base font-extrabold font-mono tabular-nums text-blue-900">
                {formatRupiah(glData.saldoAkhir)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-base text-xs w-full">
              <thead>
                <tr className="border-b-2 border-slate-800">
                  <th className="w-24">Tanggal</th>
                  <th className="w-28">No Jurnal</th>
                  <th>No Referensi</th>
                  <th>Keterangan Transaksi</th>
                  <th className="text-right w-28">Debit</th>
                  <th className="text-right w-28">Kredit</th>
                  <th className="text-right w-32 font-bold">Saldo Berjalan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50 font-bold print:bg-transparent">
                  <td colSpan={4} className="py-2.5 px-3 text-slate-800">
                    Saldo Awal Per {formatDate(startDate || 'Awal')}
                  </td>
                  <td className="text-right font-mono py-2.5 px-3">-</td>
                  <td className="text-right font-mono py-2.5 px-3">-</td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-blue-900 font-extrabold">
                    {formatRupiah(glData.saldoAwal)}
                  </td>
                </tr>

                {glData.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                      Tidak ada pergerakan / mutasi transaksi akun ini dalam periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  glData.entries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="text-slate-600">{formatDate(e.tanggal)}</td>
                      <td className="font-mono font-medium text-slate-800">{e.no_jurnal}</td>
                      <td className="font-mono text-slate-600">{e.no_referensi || '-'}</td>
                      <td className="text-slate-800 max-w-xs">{e.keterangan}</td>
                      <td className="text-right font-mono tabular-nums text-slate-800">
                        {e.debit > 0 ? formatRupiah(e.debit) : '-'}
                      </td>
                      <td className="text-right font-mono tabular-nums text-slate-800">
                        {e.credit > 0 ? formatRupiah(e.credit) : '-'}
                      </td>
                      <td className="text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatRupiah(e.saldo_akhir)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-800 font-bold bg-slate-50 text-slate-900 print:bg-transparent">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right">
                    Total Mutasi Periode & Saldo Akhir:
                  </td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-blue-800">
                    {formatRupiah(glData.totalDebit)}
                  </td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-blue-800">
                    {formatRupiah(glData.totalKredit)}
                  </td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-blue-950 font-extrabold text-sm underline decoration-double">
                    {formatRupiah(glData.saldoAkhir)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <PrintableReportSignatures
            show={customConfig.showSignatures}
            city={customConfig.signatureCity}
            date={customConfig.signatureDate}
            signer1={customConfig.signer1}
            signer2={customConfig.signer2}
            signer3={customConfig.signer3}
            companyStamp={customConfig.companyStamp}
            showStamp={customConfig.showStamp}
            stampPosition={customConfig.stampPosition}
            footerNote={customConfig.footerNote}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: NERACA SALDO (TRIAL BALANCE) */}
      {/* ==================================================================== */}
      {!loading && activeTab === 'trial_balance' && tbData && (
        <div className={`card p-6 sm:p-8 space-y-4 max-w-5xl mx-auto bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full print:max-w-none ${customConfig.orientation === 'landscape' ? 'print-landscape' : ''}`}>
          <PrintableReportHeader
            companyName={customConfig.companyName}
            companyAddress={customConfig.companyAddress}
            companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
            showCompanyHeader={customConfig.showCompanyHeader}
            title={currentReportTitle}
            subtitle={`Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`}
            docNo={customConfig.docNo || 'RPT-TB/2026/10'}
            printedBy={currentUserName}
            badge={
              tbData.isBalanced ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> NERACA SALDO SEIMBANG (DEBIT = KREDIT)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-200">
                  <AlertCircle className="h-3.5 w-3.5" /> NERACA SALDO BELUM SEIMBANG
                </span>
              )
            }
          />

          <div className="overflow-x-auto">
            <table className="table-base text-xs w-full">
              <thead>
                <tr className="border-b-2 border-slate-800">
                  {customConfig.showAccountCodes && <th className="w-24">Kode Akun</th>}
                  <th>Nama Akun Perkiraan</th>
                  <th>Kategori</th>
                  <th className="text-right">Mutasi Debit</th>
                  <th className="text-right">Mutasi Kredit</th>
                  <th className="text-right font-bold text-slate-900">Saldo Akhir Debit</th>
                  <th className="text-right font-bold text-slate-900">Saldo Akhir Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tbData.rows
                  .filter((row) => {
                    if (!customConfig.hideZeroBalances) return true;
                    return (
                      Math.abs(Number(row.debit_mutasi || 0)) > 0.0001 ||
                      Math.abs(Number(row.kredit_mutasi || 0)) > 0.0001 ||
                      Math.abs(Number(row.debit_akhir || 0)) > 0.0001 ||
                      Math.abs(Number(row.kredit_akhir || 0)) > 0.0001
                    );
                  })
                  .map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      {customConfig.showAccountCodes && (
                        <td className="font-mono font-medium text-slate-800">{row.kode_akun}</td>
                      )}
                      <td className="font-medium text-slate-800">{row.nama_akun}</td>
                      <td className="text-slate-500">{row.kategori}</td>
                      <td className="text-right font-mono tabular-nums text-slate-700">
                        {row.debit_mutasi > 0 ? formatRupiah(row.debit_mutasi) : '-'}
                      </td>
                      <td className="text-right font-mono tabular-nums text-slate-700">
                        {row.kredit_mutasi > 0 ? formatRupiah(row.kredit_mutasi) : '-'}
                      </td>
                      <td className="text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.debit_akhir > 0 ? formatRupiah(row.debit_akhir) : '-'}
                      </td>
                      <td className="text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.kredit_akhir > 0 ? formatRupiah(row.kredit_akhir) : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-800 font-extrabold bg-slate-50 text-slate-950 print:bg-transparent">
                <tr>
                  <td colSpan={customConfig.showAccountCodes ? 3 : 2} className="py-2.5 px-3 text-right">
                    TOTAL KESELURUHAN:
                  </td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-slate-800">
                    {formatRupiah(tbData.totalMutasiDebit)}
                  </td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-slate-800">
                    {formatRupiah(tbData.totalMutasiKredit)}
                  </td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-blue-900 underline decoration-double">
                    {formatRupiah(tbData.totalDebitAkhir)}
                  </td>
                  <td className="text-right font-mono tabular-nums py-2.5 px-3 text-blue-900 underline decoration-double">
                    {formatRupiah(tbData.totalKreditAkhir)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <PrintableReportSignatures
            show={customConfig.showSignatures}
            city={customConfig.signatureCity}
            date={customConfig.signatureDate}
            signer1={customConfig.signer1}
            signer2={customConfig.signer2}
            signer3={customConfig.signer3}
            companyStamp={customConfig.companyStamp}
            showStamp={customConfig.showStamp}
            stampPosition={customConfig.stampPosition}
            footerNote={customConfig.footerNote}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: REKONSILIASI GL VS SUB-LEDGER */}
      {/* ==================================================================== */}
      {!loading && activeTab === 'gl_reconciliation' && reconcileData && (
        <div className={`card p-6 sm:p-8 space-y-6 max-w-5xl mx-auto bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full print:max-w-none ${customConfig.orientation === 'landscape' ? 'print-landscape' : ''}`}>
          <PrintableReportHeader
            companyName={customConfig.companyName}
            companyAddress={customConfig.companyAddress}
            companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
            showCompanyHeader={customConfig.showCompanyHeader}
            title={currentReportTitle}
            subtitle={`Verifikasi Integritas Akun Kontrol GL vs Operasional · Per Tanggal: ${formatDate(today)}`}
            docNo={customConfig.docNo || 'RPT-REC/2026/10'}
            printedBy={currentUserName}
          />

          <div className="space-y-4">
            {reconcileData.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors avoid-break print:border-slate-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    {customConfig.showAccountCodes && (
                      <span className="text-xs font-mono font-bold text-blue-600 block">{item.kodeAkun}</span>
                    )}
                    <h4 className="text-base font-bold text-slate-800">{item.kategori}</h4>
                    <p className="text-xs text-slate-500">{item.catatan}</p>
                  </div>
                  <div>
                    {item.isMatched ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4" /> RECONCILED (COCOK)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                        <AlertTriangle className="h-4 w-4" /> ADA SELISIH AUDIT
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 print:bg-white print:border-slate-300">
                    <span className="text-slate-500 block">Saldo Akun di Buku Besar (GL)</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-800 mt-0.5 block">
                      {formatRupiah(item.glBalance)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 print:bg-white print:border-slate-300">
                    <span className="text-slate-500 block">Total di Sub-Ledger / Fisik</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-800 mt-0.5 block">
                      {formatRupiah(item.subledgerBalance)}
                    </span>
                  </div>
                  <div
                    className={`rounded-lg p-2.5 border ${
                      item.isMatched ? 'bg-emerald-50/60 border-emerald-100 print:bg-white' : 'bg-rose-50/60 border-rose-100 print:bg-white'
                    }`}
                  >
                    <span className="text-slate-500 block">Selisih Rekonsiliasi</span>
                    <span
                      className={`text-sm font-bold font-mono tabular-nums mt-0.5 block ${
                        item.isMatched ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatRupiah(item.selisih)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <PrintableReportSignatures
            show={customConfig.showSignatures}
            city={customConfig.signatureCity}
            date={customConfig.signatureDate}
            signer1={customConfig.signer1}
            signer2={customConfig.signer2}
            signer3={customConfig.signer3}
            companyStamp={customConfig.companyStamp}
            showStamp={customConfig.showStamp}
            stampPosition={customConfig.stampPosition}
            footerNote={customConfig.footerNote}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: AGING PIUTANG & HUTANG (AGING SCHEDULE) */}
      {/* ==================================================================== */}
      {!loading && activeTab === 'aging' && agingApData && agingArData && (
        <div className={`space-y-6 max-w-5xl mx-auto ${customConfig.orientation === 'landscape' ? 'print-landscape' : ''}`}>
          {/* Aging Piutang (AR) */}
          <div className="card p-6 sm:p-8 space-y-4 bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full">
            <PrintableReportHeader
              companyName={customConfig.companyName}
              companyAddress={customConfig.companyAddress}
              companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
              showCompanyHeader={customConfig.showCompanyHeader}
              title="ANALISIS UMUR PIUTANG USAHA (AGING AR)"
              subtitle={`Pemantauan Faktur Pelanggan Tertunggak · Per Tanggal: ${formatDate(today)}`}
              docNo={customConfig.docNo || 'RPT-AGAR/2026/10'}
              printedBy={currentUserName}
            />

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Ringkasan Kelompok Umur Piutang:</span>
              <span className="text-sm font-bold font-mono tabular-nums text-blue-700">
                Total Tagihan: {formatRupiah(agingArData.summary.total)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-100 print:bg-white print:border-slate-300">
                <span className="text-emerald-700 font-semibold block">0 - 30 Hari (Lancar)</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingArData.summary.current)}
                </span>
              </div>
              <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-100 print:bg-white print:border-slate-300">
                <span className="text-blue-700 font-semibold block">31 - 60 Hari</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingArData.summary.overdue30)}
                </span>
              </div>
              <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-100 print:bg-white print:border-slate-300">
                <span className="text-amber-700 font-semibold block">61 - 90 Hari</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingArData.summary.overdue60)}
                </span>
              </div>
              <div className="rounded-lg bg-orange-50 p-2.5 border border-orange-100 print:bg-white print:border-slate-300">
                <span className="text-orange-700 font-semibold block">&gt; 90 Hari</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingArData.summary.overdue90)}
                </span>
              </div>
              <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-100 print:bg-white print:border-slate-300">
                <span className="text-rose-700 font-semibold block">&gt; 120 Hari (Kritis)</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingArData.summary.overdueAbove90)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto pt-2">
              <table className="table-base text-xs w-full">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th>No Tagihan</th>
                    <th>Customer / Rumah Sakit</th>
                    <th>Jatuh Tempo</th>
                    <th>Status Keterlambatan</th>
                    <th className="text-right">Sisa Piutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingArData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-slate-400 italic">Tidak ada piutang terbuka saat ini.</td>
                    </tr>
                  ) : (
                    agingArData.items.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono font-medium text-slate-800">{r.no_tagihan}</td>
                        <td className="font-medium text-slate-800">{r.nama_customer || '-'}</td>
                        <td className="text-slate-600">{formatDate(r.jatuh_tempo)}</td>
                        <td>
                          {r.days_overdue > 0 ? (
                            <span className="text-rose-600 font-bold">Lewat {r.days_overdue} hari</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Belum jatuh tempo</span>
                          )}
                        </td>
                        <td className="text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatRupiah(r.sisa_piutang)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="border-t-2 border-slate-800 font-bold bg-slate-50 text-slate-900 print:bg-transparent">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right">
                      Total Seluruh Piutang:
                    </td>
                    <td className="text-right font-mono tabular-nums py-2.5 px-3 text-blue-900 font-extrabold text-sm underline decoration-double">
                      {formatRupiah(agingArData.summary.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <PrintableReportSignatures
              show={customConfig.showSignatures}
              city={customConfig.signatureCity}
              date={customConfig.signatureDate}
              signer1={customConfig.signer1}
              signer2={customConfig.signer2}
              signer3={customConfig.signer3}
              companyStamp={customConfig.companyStamp}
              showStamp={customConfig.showStamp}
              stampPosition={customConfig.stampPosition}
              footerNote={customConfig.footerNote}
            />
          </div>

          {/* Aging Hutang (AP) */}
          <div className="card p-6 sm:p-8 space-y-4 bg-white shadow-sm print:shadow-none print:p-0 print:border-none print:w-full mt-8">
            <PrintableReportHeader
              companyName={customConfig.companyName}
              companyAddress={customConfig.companyAddress}
              companyContact={customConfig.companyContact}
            companyLogo={customConfig.companyLogo}
              showCompanyHeader={customConfig.showCompanyHeader}
              title="ANALISIS UMUR UTANG USAHA (AGING AP)"
              subtitle={`Pemantauan Kewajiban Pembayaran Supplier · Per Tanggal: ${formatDate(today)}`}
              docNo={customConfig.docNo || 'RPT-AGAP/2026/10'}
              printedBy={currentUserName}
            />

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Ringkasan Kelompok Umur Utang:</span>
              <span className="text-sm font-bold font-mono tabular-nums text-rose-700">
                Total Kewajiban: {formatRupiah(agingApData.summary.total)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-100 print:bg-white print:border-slate-300">
                <span className="text-emerald-700 font-semibold block">0 - 30 Hari (Lancar)</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingApData.summary.current)}
                </span>
              </div>
              <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-100 print:bg-white print:border-slate-300">
                <span className="text-blue-700 font-semibold block">31 - 60 Hari</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingApData.summary.overdue30)}
                </span>
              </div>
              <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-100 print:bg-white print:border-slate-300">
                <span className="text-amber-700 font-semibold block">61 - 90 Hari</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingApData.summary.overdue60)}
                </span>
              </div>
              <div className="rounded-lg bg-orange-50 p-2.5 border border-orange-100 print:bg-white print:border-slate-300">
                <span className="text-orange-700 font-semibold block">&gt; 90 Hari</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingApData.summary.overdue90)}
                </span>
              </div>
              <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-100 print:bg-white print:border-slate-300">
                <span className="text-rose-700 font-semibold block">&gt; 120 Hari (Kritis)</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-xs mt-1 block">
                  {formatRupiah(agingApData.summary.overdueAbove90)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto pt-2">
              <table className="table-base text-xs w-full">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th>No Tagihan</th>
                    <th>Supplier / Vendor</th>
                    <th>Jatuh Tempo</th>
                    <th>Status Keterlambatan</th>
                    <th className="text-right">Sisa Utang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingApData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-slate-400 italic">Tidak ada utang terbuka saat ini.</td>
                    </tr>
                  ) : (
                    agingApData.items.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono font-medium text-slate-800">{r.no_tagihan}</td>
                        <td className="font-medium text-slate-800">{r.nama_supplier || '-'}</td>
                        <td className="text-slate-600">{formatDate(r.jatuh_tempo)}</td>
                        <td>
                          {r.days_overdue > 0 ? (
                            <span className="text-rose-600 font-bold">Lewat {r.days_overdue} hari</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Belum jatuh tempo</span>
                          )}
                        </td>
                        <td className="text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatRupiah(r.sisa_utang)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="border-t-2 border-slate-800 font-bold bg-slate-50 text-slate-900 print:bg-transparent">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right">
                      Total Seluruh Utang:
                    </td>
                    <td className="text-right font-mono tabular-nums py-2.5 px-3 text-rose-800 font-extrabold text-sm underline decoration-double">
                      {formatRupiah(agingApData.summary.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <PrintableReportSignatures
              show={customConfig.showSignatures}
              city={customConfig.signatureCity}
              date={customConfig.signatureDate}
              signer1={customConfig.signer1}
              signer2={customConfig.signer2}
              signer3={customConfig.signer3}
              companyStamp={customConfig.companyStamp}
              showStamp={customConfig.showStamp}
              stampPosition={customConfig.stampPosition}
              footerNote={customConfig.footerNote}
            />
          </div>
        </div>
      )}

      {/* Modal Kustomisasi & Pengaturan Cetak Laporan */}
      <ReportCustomizerModal
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        config={customConfig}
        onChangeConfig={(updated) => setCustomConfig(updated)}
        onApplyAndPrint={(appliedConfig) => {
          setCustomConfig(appliedConfig);
          handlePrint(appliedConfig);
        }}
        menuKey="FINANCE"
        activeReportTitle={currentReportTitle}
      />
    </div>
  );
}
