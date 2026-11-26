import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePermissions } from '../context/PermissionsContext.jsx';
import { menuGroups, normalizeRole } from '../config/menuConfig.js';
import logoImg from '../assets/logo.png';

export default function Sidebar({ open, onClose }) {
  const { user, isAdmin } = useAuth();
  const { isMenuAllowed } = usePermissions();
  const userRole = user?.role || 'ADMINISTRATOR';
  const normRole = normalizeRole(userRole, user?.tenant_id, user?.username);
  const isSuperAdmin = normRole === 'PENGEMBANG';
  const location = useLocation();

  // State untuk melacak grup menu yang terbuka (dropdown accordion)
  const [openGroups, setOpenGroups] = useState(() => {
    const currentPath = location.pathname;
    const active = menuGroups.find((g) =>
      g.items.some((item) =>
        item.end ? currentPath === item.to : currentPath.startsWith(item.to) && item.to !== '/'
      )
    );
    return active ? [active.title] : ['OPERASIONAL GUDANG', 'UTAMA'];
  });

  // Otomatis buka grup jika pengguna menavigasi ke halaman tertentu
  useEffect(() => {
    const currentPath = location.pathname;
    const activeGroup = menuGroups.find((g) =>
      g.items.some((item) =>
        item.end ? currentPath === item.to : currentPath.startsWith(item.to) && item.to !== '/'
      )
    );
    if (activeGroup && !openGroups.includes(activeGroup.title)) {
      setOpenGroups((prev) => [...prev, activeGroup.title]);
    }
  }, [location.pathname]);

  const toggleGroup = (title) => {
    setOpenGroups((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  // Hanya tutup sidebar otomatis pada perangkat layar kecil / mobile (< 768px)
  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay untuk tampilan mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="tour-sidebar-menu"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-100 transition-transform duration-200 print:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 p-1 ring-1 ring-slate-700">
              <img src={logoImg} alt="SyntesiaERP Logo" className="h-7 w-auto object-contain" />
            </span>
            <div className="leading-tight">
              <p
                className="text-sm font-bold tracking-wide truncate max-w-[140px]"
                title={isSuperAdmin ? 'SyntesiaERP' : (user?.tenant_name || 'SyntesiaERP')}
              >
                {isSuperAdmin ? 'SyntesiaERP' : (user?.tenant_name || 'SyntesiaERP')}
              </p>
              <p className="text-xs text-slate-400">
                {isSuperAdmin ? 'Portal Pengembang' : 'Enterprise ERP'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-3">
          {menuGroups
            .map((group) => {
              // Filter item berdasarkan dynamic permission & role level
              const visibleItems = group.items.filter((m) => {
                if (m.adminOnly && !isAdmin && !isSuperAdmin) return false;
                if (m.superAdminOnly && !isSuperAdmin) return false;
                return isMenuAllowed(m.to, normRole);
              });

              if (visibleItems.length === 0) return null;

              // Menu Tunggal (Dashboard / UTAMA)
              if (group.isSingle) {
                const singleItem = visibleItems[0];
                const SingleIcon = singleItem.icon;
                return (
                  <NavLink
                    key={singleItem.to}
                    to={singleItem.to}
                    end={singleItem.end}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <SingleIcon className="h-4 w-4 shrink-0" />
                    <span>{singleItem.label}</span>
                  </NavLink>
                );
              }

              const isOpen = openGroups.includes(group.title);
              const GroupIcon = group.icon;
              const hasActiveChild = visibleItems.some((item) =>
                item.end ? location.pathname === item.to : location.pathname.startsWith(item.to) && item.to !== '/'
              );

              return (
                <div key={group.title} className="rounded-lg">
                  {/* Header Dropdown Group */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                      hasActiveChild
                        ? 'text-blue-400 bg-slate-800/60'
                        : isOpen
                        ? 'text-slate-200 bg-slate-800/30'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {GroupIcon && <GroupIcon className="h-4 w-4 shrink-0 text-slate-400" />}
                      <span className="truncate">{group.title}</span>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                  </button>

                  {/* Items Submenu */}
                  {isOpen && (
                    <div className="mt-1 space-y-1 border-l-2 border-slate-800 ml-4 pl-2 transition-all">
                      {visibleItems.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={handleNavClick}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>

        <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
          SyntesiaERP &bull; RBAC Active
        </div>
      </aside>
    </>
  );
}
