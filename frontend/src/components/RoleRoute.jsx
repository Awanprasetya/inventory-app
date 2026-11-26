import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePermissions } from '../context/PermissionsContext.jsx';

// Batasi halaman berdasarkan role, menu permissions & level SuperAdmin
export default function RoleRoute({ allow = [], superAdminOnly = false, children }) {
  const { user, isPengembang, loading: authLoading } = useAuth();
  const { isMenuAllowed, loading: permLoading } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  if (authLoading || permLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const userIsPengembang = isPengembang || (user && (
    ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes((user.role || '').toUpperCase())
  ));

  // Pengembang / SuperAdmin selalu diizinkan mengakses seluruh halaman!
  if (userIsPengembang) {
    return children;
  }

  const superAdminAllowed = !superAdminOnly || userIsPengembang || user?.username === 'admin';
  const roleAllowed = allow.length === 0 || allow.includes(user ? user.role : '');
  const menuAllowed = isMenuAllowed(location.pathname, user ? user.role : '');

  if (!roleAllowed || !superAdminAllowed || !menuAllowed) {
    return (
      <div className="card mx-auto mt-12 max-w-lg p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-lg font-semibold text-slate-800">403 &mdash; Akses Ditolak</h2>
        <p className="mt-2 text-sm text-slate-500">
          Anda tidak memiliki izin hak akses menu untuk membuka halaman ini. Silakan hubungi Administrator Perusahaan.
        </p>
        <button type="button" onClick={() => navigate('/')} className="btn-primary mt-5">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </button>
      </div>
    );
  }

  return children;
}
