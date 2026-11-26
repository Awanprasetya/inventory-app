import axios from 'axios';

// Instance axios tunggal untuk seluruh panggilan API ke backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Kunci penyimpanan sesi di localStorage
export const AUTH_KEY = 'inventory_auth';

// Baca sesi tersimpan (aman untuk SSR / storage kosong)
export const getStoredAuth = () => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

// Sisipkan Bearer token pada setiap request
api.interceptors.request.use((config) => {
  const auth = getStoredAuth();
  if (auth && auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

// 401 -> buang sesi dan pindah ke halaman login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response && error.response.status;
    const onLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
    if (status === 401 && !onLoginPage && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_KEY);
      } catch (_) {
        /* abaikan */
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Ambil pesan error dari respons backend, fallback ke pesan jaringan
export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Terjadi kesalahan, coba lagi';

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  const d = new Date(str.replace(' ', 'T'));
  return d;
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (value) => {
  if (!value) return '-';
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID');

// Format angka menjadi Rupiah, cth: 14500 -> "Rp14.500"
export const formatRupiah = (value) => {
  const num = Number(value || 0);
  return `Rp${num.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
};

export default api;
