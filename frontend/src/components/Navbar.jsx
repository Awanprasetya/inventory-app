import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  LogOut,
  Bell,
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePermissions } from '../context/PermissionsContext.jsx';
import { useTour } from '../context/TourContext.jsx';
import { menuGroups, normalizeRole } from '../config/menuConfig.js';
import api from '../services/api.js';
import logoImg from '../assets/logo.png';

export default function Navbar({ title, sidebarOpen, onToggle }) {
  const { user, logout, isAdmin } = useAuth();
  const { isMenuAllowed } = usePermissions();
  const { startTour } = useTour();
  const navigate = useNavigate();
  const location = useLocation();

  const userRole = user?.role || 'ADMINISTRATOR';
  const normRole = normalizeRole(userRole, user?.tenant_id, user?.username);
  const isSuperAdmin = normRole === 'PENGEMBANG';

  const [notifOpen, setNotifOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [alerts, setAlerts] = useState({ lowStock: 0, overdueAP: 0, overdueAR: 0, total: 0 });

  const notifRef = useRef(null);
  const navDropdownRef = useRef(null);

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const initials = (user && user.nama_lengkap ? user.nama_lengkap : '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Load pemberitahuan notifikasi
  const loadNotifs = async () => {
    if (!user) return;
    try {
      const res = await api.get('/dashboard/summary');
      if (res.data?.success) {
        const d = res.data?.data || {};
        const lowStock = Number(d.stok_habis || 0) + (Array.isArray(d.stok_menipis) ? d.stok_menipis.length : 0);
        const overdueAP = Number(d.count_utang_overdue || 0);
        const overdueAR = Number(d.count_piutang_overdue || 0);
        const total = lowStock + overdueAP + overdueAR;

        setAlerts({ lowStock, overdueAP, overdueAR, total });
      }
    } catch (_) {
      /* abaikan error notifikasi */
    }
  };

  useEffect(() => {
    loadNotifs();
  }, []);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tutup dropdown menu saat berpindah route
  useEffect(() => {
    setActiveDropdown(null);
    setNotifOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleNotifClick = (targetPath, targetWidgetId = null) => {
    setNotifOpen(false);
    if (targetWidgetId && window.location.pathname === '/') {
      const el = document.getElementById(targetWidgetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-400', 'shadow-lg');
        setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400', 'shadow-lg'), 2500);
        return;
      }
    }
    navigate(targetPath);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 print:hidden shadow-sm">
      {/* KIRI: Tombol Toggle Sidebar & Brand / Title */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Tombol Toggle Buka/Tutup Sidebar */}
        <button
          type="button"
          id="tour-sidebar-toggle"
          onClick={onToggle}
          className={`flex items-center gap-1.5 rounded-lg border p-1.5 text-xs font-semibold transition-all ${
            sidebarOpen
              ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-sm'
          }`}
          title={sidebarOpen ? 'Tutup Sidebar' : 'Buka Sidebar'}
          aria-label={sidebarOpen ? 'Tutup Sidebar' : 'Buka Sidebar'}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftOpen className="h-5 w-5 text-blue-600" />
              <span className="hidden sm:inline font-bold">Buka Sidebar</span>
            </>
          )}
        </button>

        {/* Jika Sidebar TERBUKA: Tampilkan Judul Halaman */}
        {sidebarOpen ? (
          <div className="border-l border-slate-200 pl-3">
            <h1 className="text-sm font-bold text-slate-800 md:text-base truncate max-w-[200px] xl:max-w-none">
              {title}
            </h1>
          </div>
        ) : (
          /* Jika Sidebar DITUTUP: Tampilkan Brand Logo & Name */
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <img src={logoImg} alt="Logo" className="h-6 w-auto object-contain" />
            <span className="text-sm font-extrabold tracking-tight text-slate-900 hidden sm:inline">
              {isSuperAdmin ? 'SyntesiaERP' : (user?.tenant_name || 'SyntesiaERP')}
            </span>
          </div>
        )}
      </div>

      {/* TENGAH: Menu Navigasi ERP Dropdown (HANYA tampil saat Sidebar DITUTUP) */}
      {!sidebarOpen && (
        <div className="hidden md:flex items-center gap-1 px-2 relative" ref={navDropdownRef}>
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter((m) => {
              if (m.adminOnly && !isAdmin && !isSuperAdmin) return false;
              if (m.superAdminOnly && !isSuperAdmin) return false;
              return isMenuAllowed(m.to, normRole);
            });

            if (visibleItems.length === 0) return null;

            // Menu Tunggal (Dashboard)
            if (group.isSingle) {
              const singleItem = visibleItems[0];
              const SingleIcon = singleItem.icon;
              return (
                <NavLink
                  key={singleItem.to}
                  to={singleItem.to}
                  end={singleItem.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all shrink-0 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <SingleIcon className="h-3.5 w-3.5" />
                  <span>{singleItem.label}</span>
                </NavLink>
              );
            }

            const isGroupActive = visibleItems.some((item) =>
              item.end ? location.pathname === item.to : location.pathname.startsWith(item.to) && item.to !== '/'
            );
            const isOpenDropdown = activeDropdown === group.title;
            const GroupIcon = group.icon;

            return (
              <div key={group.title} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(isOpenDropdown ? null : group.title)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                    isGroupActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : isOpenDropdown
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <GroupIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span className="truncate max-w-[130px]">{group.title}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${isOpenDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Popup */}
                {isOpenDropdown && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl z-50 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                      {group.title}
                    </div>
                    {visibleItems.map(({ to, label, icon: Icon, end }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        onClick={() => setActiveDropdown(null)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* KANAN: Tanggal, Notifikasi & Profile User */}
      <div className="flex items-center gap-2.5 text-sm text-slate-500 shrink-0">
        {/* Tombol Akses Cepat Buku Panduan & SOP Alur */}
        <button
          type="button"
          id="tour-sop-guide"
          onClick={() => navigate('/workflows')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all"
          title="Buka Buku Panduan & SOP Alur Kerja Sistem"
        >
          <BookOpen className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="hidden sm:inline">Panduan SOP</span>
        </button>

        {/* Tombol Akses Tur Panduan Aplikasi Interaktif */}
        <button
          type="button"
          id="tour-start-btn"
          onClick={() => startTour()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg shadow-sm hover:bg-blue-100 hover:border-blue-300 transition-all"
          title="Mulai Tur Panduan untuk Modul yang Sedang Dibuka"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="hidden sm:inline">Tur Panduan</span>
        </button>

        {/* Lonceng Notifikasi */}
        <div className="relative" ref={notifRef} id="tour-notifications">
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Pemberitahuan Sistem"
          >
            <Bell className="h-4 w-4" />
            {alerts.total > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                {alerts.total > 9 ? '9+' : alerts.total}
              </span>
            )}
          </button>

          {/* Panel Dropdown Notifikasi */}
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-blue-600" /> Notifikasi Sistem ERP
                </h3>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {alerts.total} Perhatian
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {alerts.lowStock > 0 && (
                  <button
                    type="button"
                    onClick={() => handleNotifClick('/batch-lots', 'widget-perhatian-stok')}
                    className="flex w-full items-center justify-between rounded-lg bg-amber-50 p-2.5 border border-amber-200/60 text-amber-900 hover:bg-amber-100/60 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">{alerts.lowStock} Lot Stok Menipis/Habis</p>
                        <p className="text-[11px] text-amber-700">Perlu pengadaan &amp; restok barang</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-amber-400 shrink-0" />
                  </button>
                )}

                {alerts.overdueAP > 0 && (
                  <button
                    type="button"
                    onClick={() => handleNotifClick('/accounts-payable')}
                    className="flex w-full items-center justify-between rounded-lg bg-rose-50 p-2.5 border border-rose-200/60 text-rose-900 hover:bg-rose-100/60 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-bold">{alerts.overdueAP} Utang Lewat Jatuh Tempo</p>
                        <p className="text-[11px] text-rose-700">Segera lakukan pembayaran tagihan</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-rose-400 shrink-0" />
                  </button>
                )}

                {alerts.overdueAR > 0 && (
                  <button
                    type="button"
                    onClick={() => handleNotifClick('/accounts-receivable')}
                    className="flex w-full items-center justify-between rounded-lg bg-blue-50 p-2.5 border border-blue-200/60 text-blue-900 hover:bg-blue-100/60 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                      <div>
                        <p className="font-bold">{alerts.overdueAR} Piutang Lewat Jatuh Tempo</p>
                        <p className="text-[11px] text-blue-700">Follow up penagihan ke customer</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-blue-400 shrink-0" />
                  </button>
                )}

                {alerts.total === 0 && (
                  <div className="p-4 text-center text-slate-500">
                    <p className="font-semibold text-emerald-600">Semua Kondisi Aman! 👍</p>
                    <p className="text-[11px] mt-0.5">Tidak ada tagihan jatuh tempo atau stok kritis saat ini.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div id="tour-user-profile" className="flex items-center gap-2.5">
          {user && (
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-xs font-semibold text-slate-700">{user.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500">
                <span
                  className={
                    user.role === 'ADMINISTRATOR' || user.role === 'PENGEMBANG'
                      ? 'font-semibold text-blue-600'
                      : 'font-semibold text-emerald-600'
                  }
                >
                  {user.role}
                </span>
              </p>
            </div>
          )}

          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {initials}
          </span>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Keluar dari aplikasi"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
