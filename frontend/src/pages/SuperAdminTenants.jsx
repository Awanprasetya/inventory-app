import { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Layers,
  Edit,
  Trash2,
  UserPlus,
  Key,
} from 'lucide-react';
import api, { getErrorMessage, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';

const PAGE_SIZE = 10;

export default function SuperAdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);

  const defaultExpDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const [addForm, setAddForm] = useState({
    kode_tenant: '',
    nama_perusahaan: '',
    email_pemilik: '',
    telepon: '',
    status: 'ACTIVE',
    expired_at: defaultExpDate(),
    modules: ['MOD_INVENTORY', 'MOD_COMMERCIAL', 'MOD_ACCOUNTING'],
    admin_nama: '',
    admin_username: '',
    admin_password: '',
  });

  const [editForm, setEditForm] = useState({
    nama_perusahaan: '',
    email_pemilik: '',
    telepon: '',
    status: 'ACTIVE',
    expired_at: '',
    modules: [],
  });

  const loadTenants = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/superadmin/tenants');
      if (res.data.success) {
        setTenants(res.data.data || []);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleOpenAdd = () => {
    const randomCode = `TENANT-${Math.floor(100 + Math.random() * 900)}`;
    setAddForm({
      kode_tenant: randomCode,
      nama_perusahaan: '',
      email_pemilik: '',
      telepon: '',
      status: 'ACTIVE',
      expired_at: defaultExpDate(),
      modules: ['MOD_INVENTORY', 'MOD_COMMERCIAL', 'MOD_ACCOUNTING'],
      admin_nama: '',
      admin_username: 'admin',
      admin_password: 'admin123',
    });
    setAddModalOpen(true);
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!addForm.kode_tenant || !addForm.nama_perusahaan || !addForm.email_pemilik || !addForm.admin_username || !addForm.admin_password) {
      alertError('Peringatan', 'Kode tenant, nama perusahaan, email, username admin, dan password admin wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/superadmin/tenants', addForm);
      if (res.data.success) {
        toastSuccess('Berhasil!', res.data.message);
        setAddModalOpen(false);
        loadTenants();
      }
    } catch (err) {
      alertError('Gagal Mendaftarkan Klien', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (tenant) => {
    setSelectedTenant(tenant);
    setEditForm({
      nama_perusahaan: tenant.nama_perusahaan || '',
      email_pemilik: tenant.email_pemilik || '',
      telepon: tenant.telepon || '',
      status: tenant.status || 'ACTIVE',
      expired_at: tenant.expired_at ? tenant.expired_at.split('T')[0] : defaultExpDate(),
      modules: tenant.modules || ['MOD_INVENTORY'],
    });
    setEditModalOpen(true);
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setSaving(true);
    try {
      const res = await api.put(`/superadmin/tenants/${selectedTenant.id}`, editForm);
      if (res.data.success) {
        toastSuccess('Berhasil!', res.data.message);
        setEditModalOpen(false);
        loadTenants();
      }
    } catch (err) {
      alertError('Gagal Memperbarui Lisensi', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleModuleInAdd = (mod) => {
    setAddForm((prev) => {
      const exists = prev.modules.includes(mod);
      return {
        ...prev,
        modules: exists ? prev.modules.filter((m) => m !== mod) : [...prev.modules, mod],
      };
    });
  };

  const toggleModuleInEdit = (mod) => {
    setEditForm((prev) => {
      const exists = prev.modules.includes(mod);
      return {
        ...prev,
        modules: exists ? prev.modules.filter((m) => m !== mod) : [...prev.modules, mod],
      };
    });
  };

  // Filtered by local search
  const filteredTenants = tenants.filter((t) => {
    const matchSearch =
      (t.nama_perusahaan || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.kode_tenant || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.email_pemilik || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { pageItems: paginatedTenants, totalPages, safePage } = paginate(
    filteredTenants,
    page,
    pageSize
  );

  // KPIs
  const totalActive = tenants.filter((t) => t.status === 'ACTIVE').length;
  const totalTrial = tenants.filter((t) => t.status === 'TRIAL').length;
  const totalExpired = tenants.filter((t) => t.status === 'EXPIRED' || t.status === 'SUSPENDED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            Manajemen Perusahaan Klien & Lisensi SaaS
          </h1>
          <p className="text-sm text-slate-500">
            Kelola perusahaan sewa (tenants), perpanjangan masa sewa, status lisensi, serta kontrol modul aktif (Inventory, Commercial, ERP).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTenants}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Segarkan
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Daftarkan Perusahaan Klien Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Klien Aktif</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{totalActive} Perusahaan</div>
          <p className="mt-1 text-xs text-slate-500">Status sewa aktif & berlisensi</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Klien Masa Trial</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{totalTrial} Perusahaan</div>
          <p className="mt-1 text-xs text-slate-500">Uji coba sistem berjalan</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Expired / Suspended</span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600">{totalExpired} Perusahaan</div>
          <p className="mt-1 text-xs text-slate-500">Perlu perpanjangan masa sewa</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama perusahaan, kode tenant, atau email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">Semua Status Sewa</option>
          <option value="ACTIVE">Aktif (ACTIVE)</option>
          <option value="TRIAL">Masa Trial (TRIAL)</option>
          <option value="EXPIRED">Habis Masa Sewa (EXPIRED)</option>
          <option value="SUSPENDED">Ditangguhkan (SUSPENDED)</option>
        </select>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-600 font-medium">Memuat data penyewaan klien...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">Belum Ada Klien Terdaftar</p>
            <p className="text-sm mt-1">Daftarkan perusahaan klien penyewa aplikasi SaaS Anda.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Kode & Nama Perusahaan</th>
                    <th className="px-4 py-3">Email Pemilik & Kontak</th>
                    <th className="px-4 py-3">Modul Berlisensi</th>
                    <th className="px-4 py-3">Masa Sewa Berakhir</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{t.nama_perusahaan}</div>
                        <div className="text-xs font-mono text-blue-600 font-semibold">{t.kode_tenant}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-slate-800 font-medium">{t.email_pemilik}</div>
                        <div className="text-xs text-slate-400">{t.telepon || '-'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {t.modules.includes('MOD_INVENTORY') && (
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                              Inventory
                            </span>
                          )}
                          {t.modules.includes('MOD_COMMERCIAL') && (
                            <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                              Commercial
                            </span>
                          )}
                          {t.modules.includes('MOD_ACCOUNTING') && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                              ERP Akuntansi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 font-medium">
                        {formatDate(t.expired_at)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.status === 'TRIAL'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                        >
                          <Edit className="h-3.5 w-3.5" /> Edit Lisensi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPage={setPage}
                totalItems={filteredTenants.length}
                pageSize={pageSize}
                onPageSize={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                label="perusahaan klien"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Tambah Perusahaan Klien Baru */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Daftarkan Perusahaan Klien SaaS Baru"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateTenant} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Kode Tenant <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.kode_tenant}
                onChange={(e) => setAddForm({ ...addForm, kode_tenant: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="TENANT-002"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nama Perusahaan Klien <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.nama_perusahaan}
                onChange={(e) => setAddForm({ ...addForm, nama_perusahaan: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="PT Medika Sehat Utama"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Email Pemilik / Kontak <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={addForm.email_pemilik}
                onChange={(e) => setAddForm({ ...addForm, email_pemilik: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="owner@medikasehat.co.id"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Nomor Telepon
              </label>
              <input
                type="text"
                value={addForm.telepon}
                onChange={(e) => setAddForm({ ...addForm, telepon: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="021-5551234"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Status Sewa
              </label>
              <select
                value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="ACTIVE">Aktif (ACTIVE)</option>
                <option value="TRIAL">Uji Coba (TRIAL)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Masa Sewa Berakhir (Expired Date)
              </label>
              <input
                type="date"
                required
                value={addForm.expired_at}
                onChange={(e) => setAddForm({ ...addForm, expired_at: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
              Pilih Modul Berlisensi (Sesuai Paket Sewa)
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.modules.includes('MOD_INVENTORY')}
                  onChange={() => toggleModuleInAdd('MOD_INVENTORY')}
                  className="rounded text-blue-600"
                />
                <span className="text-xs font-semibold text-slate-800">Inventory Basic</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.modules.includes('MOD_COMMERCIAL')}
                  onChange={() => toggleModuleInAdd('MOD_COMMERCIAL')}
                  className="rounded text-blue-600"
                />
                <span className="text-xs font-semibold text-purple-800">Commercial & FEFO</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.modules.includes('MOD_ACCOUNTING')}
                  onChange={() => toggleModuleInAdd('MOD_ACCOUNTING')}
                  className="rounded text-blue-600"
                />
                <span className="text-xs font-semibold text-emerald-800">ERP Akuntansi</span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
              <Key className="h-4 w-4 text-blue-600" />
              Akun Administrator Utama Klien
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Username Login <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.admin_username}
                  onChange={(e) => setAddForm({ ...addForm, admin_username: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Password Login <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.admin_password}
                  onChange={(e) => setAddForm({ ...addForm, admin_password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Daftarkan Perusahaan Klien
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Lisensi & Masa Sewa */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Lisensi Sewa: ${selectedTenant?.nama_perusahaan}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateTenant} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Status Sewa Perusahaan
            </label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="ACTIVE">Aktif (ACTIVE)</option>
              <option value="TRIAL">Uji Coba (TRIAL)</option>
              <option value="EXPIRED">Habis Masa Sewa (EXPIRED)</option>
              <option value="SUSPENDED">Ditangguhkan (SUSPENDED)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Perpanjang Tanggal Masa Sewa (Expired Date)
            </label>
            <input
              type="date"
              required
              value={editForm.expired_at}
              onChange={(e) => setEditForm({ ...editForm, expired_at: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
              Modul Aktif
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.modules.includes('MOD_INVENTORY')}
                  onChange={() => toggleModuleInEdit('MOD_INVENTORY')}
                  className="rounded text-blue-600"
                />
                <span className="text-xs font-semibold text-slate-800">Modul Inventory Basic</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.modules.includes('MOD_COMMERCIAL')}
                  onChange={() => toggleModuleInEdit('MOD_COMMERCIAL')}
                  className="rounded text-blue-600"
                />
                <span className="text-xs font-semibold text-purple-800">Modul Commercial & FEFO</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.modules.includes('MOD_ACCOUNTING')}
                  onChange={() => toggleModuleInEdit('MOD_ACCOUNTING')}
                  className="rounded text-blue-600"
                />
                <span className="text-xs font-semibold text-emerald-800">Modul ERP Akuntansi</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Perubahan Lisensi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

