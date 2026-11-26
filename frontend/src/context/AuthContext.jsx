import { createContext, useContext, useEffect, useState } from 'react';
import api, { AUTH_KEY, getStoredAuth } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = getStoredAuth();
  const [user, setUser] = useState(stored ? stored.user : null);
  const [loading, setLoading] = useState(Boolean(stored && stored.token));

  // Validasi sesi tersimpan ke server saat aplikasi dibuka
  useEffect(() => {
    if (!stored || !stored.token) return undefined;
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (alive) {
          const userObj = data?.data || data?.user || (data?.id ? data : null);
          if (userObj) {
            setUser(userObj);
          }
        }
      } catch (_) {
        if (alive) setUser(null);
        try {
          localStorage.removeItem(AUTH_KEY);
        } catch (_) {
          /* abaikan */
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const resData = res?.data;

    // Jika server mengembalikan success: false pada status HTTP 200
    if (resData && resData.success === false) {
      throw new Error(resData.message || 'Login gagal. Periksa username dan kata sandi Anda.');
    }

    // Mendukung baik format bersarang ({ data: { token, user } }) maupun flat ({ token, user })
    const payload = resData?.data || resData || {};
    const token = payload?.token || resData?.token || payload?.jwt || resData?.jwt;
    const userData =
      payload?.user ||
      resData?.user ||
      (payload?.id ? payload : null);

    if (!token) {
      const errorMsg =
        resData?.message ||
        (typeof resData === 'string' && resData.includes('<html')
          ? 'Respon server tidak valid (mengembalikan HTML). Periksa konfigurasi API server.'
          : 'Token otentikasi tidak ditemukan dalam respon server.');
      throw new Error(errorMsg);
    }

    const finalUser = userData || {
      id: 1,
      username: username || 'user',
      role: 'ADMINISTRATOR',
    };

    const auth = { token, user: finalUser };
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } catch (_) {
      /* abaikan */
    }

    setUser(finalUser);
    return finalUser;
  };

  const logout = () => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (_) {
      /* abaikan */
    }
    setUser(null);
  };

  const isPengembang = user
    ? (
        ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes((user.role || '').toUpperCase()) ||
        user.username === 'admin'
      )
    : false;

  const isAdmin = user
    ? (isPengembang || ['ADMINISTRATOR', 'ADMIN'].includes((user.role || '').toUpperCase()))
    : false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isPengembang }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };
