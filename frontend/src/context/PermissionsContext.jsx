import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api.js';
import { useAuth } from './AuthContext.jsx';
import { defaultRolePermissions, normalizeRole } from '../config/menuConfig.js';

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/rbac/permissions');
      if (res.data && res.data.success) {
        setPermissions(res.data.data || []);
      }
    } catch (err) {
      console.error('Gagal memuat dynamic permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    } else if (!authLoading) {
      setPermissions([]);
      setLoading(false);
    }
  }, [user, authLoading, fetchPermissions]);

  /**
   * Pengecekan apakah suatu menu (menuKey / path) diperbolehkan untuk user/role
   */
  const isMenuAllowed = useCallback(
    (menuKey, targetRole) => {
      const isTargetingOtherRole = targetRole && targetRole !== user?.role;
      const activeRole = targetRole || user?.role;
      const normRole = normalizeRole(
        activeRole,
        isTargetingOtherRole ? null : user?.tenant_id,
        isTargetingOtherRole ? null : user?.username
      );

      // 1. Pengembang / SuperAdmin selalu diizinkan di seluruh menu
      if (normRole === 'PENGEMBANG') return true;

      // 2. Cek apakah ada record di DB role_permissions untuk (normRole, menuKey)
      const record = permissions.find(
        (p) => normalizeRole(p.role) === normRole && p.menu_key === menuKey
      );

      if (record !== undefined) {
        return Number(record.is_allowed) === 1 || record.is_allowed === true;
      }

      // 3. Jika belum di-custom di DB, gunakan defaultRolePermissions
      const defaults = defaultRolePermissions[normRole];
      if (defaults) {
        return defaults.includes(menuKey);
      }

      // Default fallback administrator
      return normRole === 'ADMINISTRATOR';
    },
    [permissions, user]
  );

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading,
        fetchPermissions,
        isMenuAllowed,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions harus digunakan di dalam PermissionsProvider');
  }
  return context;
}
