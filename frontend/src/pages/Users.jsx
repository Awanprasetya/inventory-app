import React, { useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Save,
  CheckSquare,
  Square,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatDate } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePermissions } from '../context/PermissionsContext.jsx';
import { menuGroups, ALL_ROLES } from '../config/menuConfig.js';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const emptyForm = { nama_lengkap: '', username: '', password: '', role: 'ADMIN_OPERATIONAL', tenant_id: '', warehouse_id: '' };
const PAGE_SIZE = 10;

const roleHint = {
  PENGEMBANG: 'Pengembang System / SuperAdmin (Full Akses Seluruh Klien & Pengaturan SaaS)',
  DEVELOPER: 'Pengembang System / SuperAdmin (Full Akses Seluruh Klien & Pengaturan SaaS)',
  ADMINISTRATOR: 'Akses penuh ke semua modul perusahaan & manajemen user',
  ADMIN_OPERASIONAL: 'Operasional komersial (PO, SO, DO, Retur, Supplier/Customer) & lihat stok',
  ADMIN_OPERATIONAL: 'Operasional komersial (PO, SO, DO, Retur, Supplier/Customer) & lihat stok',
  ADMIN_KEUANGAN: 'Keuangan & Akuntansi (AP, AR, Kas/Bank, Jurnal, COA, Laporan, Pajak, Budget)',
  ADMIN_AKUNTANSI: 'Keuangan & Akuntansi (AP, AR, Kas/Bank, Jurnal, COA, Laporan, Pajak, Budget)',
  ADMIN_GUDANG: 'Stok fisik gudang, barang masuk/keluar, opname, rack & batch lot',
};

const getRoleBadge = (role) => {
  const r = (role || '').toUpperCase();
  switch (r) {
    case 'PENGEMBANG':
    case 'DEVELOPER':
    case 'SUPERADMIN':
      return 'badge bg-red-100 text-red-700 border border-red-200';
    case 'ADMINISTRATOR':
    case 'ADMIN':
      return 'badge bg-blue-100 text-blue-700 border border-blue-200';
    case 'ADMIN_OPERASIONAL':
    case 'ADMIN_OPERATIONAL':
      return 'badge bg-purple-100 text-purple-700 border border-purple-200';
    case 'ADMIN_KEUANGAN':
    case 'ADMIN_AKUNTANSI':
      return 'badge bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'ADMIN_GUDANG':
      return 'badge bg-amber-100 text-amber-700 border border-amber-200';
    default:
      return 'badge bg-slate-100 text-slate-700';
  }
};

export default function Users() {
  const { user: me } = useAuth();
  const { isMenuAllowed, fetchPermissions } = usePermissions();
  
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'matrix'
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // State untuk Matriks Hak Akses RBAC
  const [matrixState, setMatrixState] = useState({});
  const [savingMatrix, setSavingMatrix] = useState(false);

  // Kumpulkan seluruh item menu dari menuGroups
  const allMenuItems = [];
  menuGroups.forEach((group) => {
    group.items.forEach((item) => {
      allMenuItems.push({
        groupTitle: group.title,
        menuKey: item.to,
        label: item.label,
        superAdminOnly: item.superAdminOnly,
        adminOnly: item.adminOnly,
      });
    });
  });

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, whRes] = await Promise.all([
        api.get('/users'),
        api.get('/warehouses', {
          params: me?.tenant_id === 1 ? { include_other_tenants: '1' } : undefined,
        }).catch(() => ({ data: { data: [] } })),
      ]);
      setUsers(usersRes.data.data || []);
      setWarehouses(whRes.data?.data || []);

      if (me?.tenant_id === 1) {
        try {
          const res = await api.get('/superadmin/tenants');
          if (res.data.success) setTenants(res.data.data || []);
        } catch (_) {}
      }

      // Load matrix permissions saat ini
      const permRes = await api.get('/rbac/permissions');
      const dbPerms = permRes.data?.data || [];

      // Susun initial matrix state { `${role}:${menuKey}`: boolean }
      const newMatrix = {};
      ALL_ROLES.forEach((roleObj) => {
        allMenuItems.forEach((menu) => {
          const key = `${roleObj.id}:${menu.menuKey}`;
          const dbMatch = dbPerms.find(
            (p) => p.role.toUpperCase() === roleObj.id && p.menu_key === menu.menuKey
          );
          if (dbMatch !== undefined) {
            newMatrix[key] = Number(dbMatch.is_allowed) === 1 || dbMatch.is_allowed === true;
          } else {
            // Gunakan status default dari isMenuAllowed
            newMatrix[key] = isMenuAllowed(menu.menuKey, roleObj.id);
          }
        });
      });
      setMatrixState(newMatrix);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, tenant_id: tenants[0] ? String(tenants[0].id) : '1', warehouse_id: '' });
    setModal(true);
  };

  const openEdit = (u) => {
    setEditingId(u.id);
    setForm({
      nama_lengkap: u.nama_lengkap,
      username: u.username,
      password: '',
      role: u.role,
      tenant_id: u.tenant_id ? String(u.tenant_id) : '1',
      warehouse_id: u.warehouse_id ? String(u.warehouse_id) : '',
    });
    setModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        nama_lengkap: form.nama_lengkap.trim(),
        username: form.username.trim(),
        role: form.role,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
      };
      if (form.password) payload.password = form.password;
      if (me?.tenant_id === 1 && form.tenant_id) {
        payload.tenant_id = Number(form.tenant_id);
      }

      let msg = '';
      if (editingId) {
        const { data } = await api.put(`/users/${editingId}`, payload);
        msg = data.message;
      } else {
        const { data } = await api.post('/users', {
          ...payload,
          password: form.password,
        });
        msg = data.message;
      }
      toastSuccess(msg);
      setModal(false);
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan User', msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    const confirmed = await confirmDelete({
      title: 'Hapus User?',
      text: `Apakah Anda yakin ingin menghapus user "${u.username}" (${u.nama_lengkap})?`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/users/${u.id}`);
      toastSuccess(data.message);
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus User', msg);
    }
  };

  // Toggle satu checkbox cell pada matriks
  const toggleMatrixCell = (roleId, menuKey) => {
    const key = `${roleId}:${menuKey}`;
    setMatrixState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Toggle seluruh kolom role
  const toggleRoleColumn = (roleId, value) => {
    setMatrixState((prev) => {
      const updated = { ...prev };
      allMenuItems.forEach((menu) => {
        updated[`${roleId}:${menu.menuKey}`] = value;
      });
      return updated;
    });
  };

  // Simpan matriks hak akses ke backend
  const saveMatrix = async () => {
    setSavingMatrix(true);
    try {
      const permissionsPayload = [];
      ALL_ROLES.forEach((roleObj) => {
        allMenuItems.forEach((menu) => {
          const key = `${roleObj.id}:${menu.menuKey}`;
          permissionsPayload.push({
            role: roleObj.id,
            menu_key: menu.menuKey,
            is_allowed: Boolean(matrixState[key]),
          });
        });
      });

      const { data } = await api.put('/rbac/permissions', {
        permissions: permissionsPayload,
      });

      toastSuccess(data.message || 'Hak akses per menu berhasil disimpan!');
      fetchPermissions(); // Refresh context
    } catch (err) {
      alertError('Gagal Simpan Hak Akses', getErrorMessage(err));
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleExportUsers = () => {
    const headers = [
      'Nama Lengkap',
      'Username',
      'Perusahaan Klien / PT',
      'Role Hak Akses',
      'Gudang Penugasan',
      'Tanggal Terdaftar',
    ];
    const data = users.map((u) => [
      u.nama_lengkap || '',
      u.username || '',
      u.Tenant?.nama_perusahaan || u.tenant_name || '-',
      u.role || '',
      u.nama_gudang ? `${u.kode_gudang || ''} - ${u.nama_gudang}` : 'Semua Gudang',
      formatDate(u.created_at || u.createdAt),
    ]);
    exportToExcel('Master_Daftar_Pengguna_User', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Header & Tab Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Manajemen User & Hak Akses Per Menu</h1>
          <p className="text-xs text-slate-500">
            Kelola akun pengguna, penetapan role, dan atur hak akses spesifik per menu aplikasi.
          </p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UsersIcon className="h-4 w-4" />
            <span>Daftar User & Akun</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'matrix'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Hak Akses & Permission Per Menu</span>
          </button>
        </div>
      </div>

      {/* Notifikasi */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: DAFTAR USER */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Daftar Akun User</h2>
                <p className="text-xs text-slate-500">{users.length} akun terdaftar dalam tenant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportUsers}
                className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
                title="Export ke Excel"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
              </button>
              <button type="button" onClick={openAdd} className="btn-primary">
                <Plus className="h-4 w-4" /> Tambah User
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat data user...
            </div>
          ) : users.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Belum ada user.</p>
          ) : (
            (() => {
              const { pageItems, totalPages, safePage } = paginate(users, userPage, pageSize);
              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th>Nama Lengkap</th>
                          <th>Username</th>
                          {me?.tenant_id === 1 && <th>Perusahaan Klien</th>}
                          <th>Role</th>
                          <th>Gudang Penugasan</th>
                          <th>Terdaftar</th>
                          <th>
                            <span className="sr-only">Aksi</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <p className="font-medium text-slate-700">{u.nama_lengkap}</p>
                              {me && u.id === me.id && (
                                <span className="text-xs text-slate-400">(Anda)</span>
                              )}
                            </td>
                            <td>{u.username}</td>
                            {me?.tenant_id === 1 && (
                              <td className="text-xs text-slate-600 font-medium">
                                {u.nama_perusahaan || 'PT Default'}
                              </td>
                            )}
                            <td>
                              <span className={getRoleBadge(u.role)}>{u.role}</span>
                            </td>
                            <td className="text-xs">
                              {u.warehouse_id && u.nama_gudang ? (
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                                  {u.kode_gudang} — {u.nama_gudang}
                                </span>
                              ) : (
                                <span className="text-slate-400">Semua Gudang</span>
                              )}
                            </td>
                            <td className="text-xs text-slate-500">{formatDate(u.created_at)}</td>
                            <td>
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(u)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                  aria-label={`Edit ${u.username}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {!(me && u.id === me.id) && (
                                  <button
                                    type="button"
                                    onClick={() => remove(u)}
                                    className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                    aria-label={`Hapus ${u.username}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    onPage={setUserPage}
                    totalItems={users.length}
                    pageSize={pageSize}
                    onPageSize={(s) => {
                      setPageSize(s);
                      setUserPage(1);
                    }}
                    label="user"
                  />
                </>
              );
            })()
          )}
        </div>
      )}

      {/* TAB 2: MATRIKS HAK AKSES PER MENU */}
      {activeTab === 'matrix' && (
        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                Matriks Pengaturan Hak Akses Per Menu ERP
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Centang/Buka centang menu di bawah untuk mengizinkan atau memblokir akses menu untuk tiap role pengguna.
              </p>
            </div>
            <button
              type="button"
              onClick={saveMatrix}
              disabled={savingMatrix}
              className="btn-primary flex items-center gap-2 shadow-sm"
            >
              {savingMatrix ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Simpan Perubahan Hak Akses</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 min-w-[220px]">Kategori & Menu ERP</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-400">Path / Route</th>
                  {ALL_ROLES.map((r) => (
                    <th key={r.id} className="px-4 py-3 text-center border-l border-slate-200 min-w-[140px]">
                      <div>{r.label}</div>
                      <div className="mt-1.5 flex justify-center gap-2 text-[10px] normal-case font-normal">
                        <button
                          type="button"
                          onClick={() => toggleRoleColumn(r.id, true)}
                          className="text-blue-600 hover:underline"
                        >
                          Semua
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => toggleRoleColumn(r.id, false)}
                          className="text-red-500 hover:underline"
                        >
                          Kosongkan
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menuGroups.map((group) => (
                  <React.Fragment key={`group-frag-${group.title}`}>
                    <tr key={`group-header-${group.title}`} className="bg-slate-100/70 font-bold text-slate-800 text-xs uppercase tracking-wider">
                      <td colSpan={2 + ALL_ROLES.length} className="px-4 py-2.5 bg-slate-100">
                        {group.title}
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr key={`item-${item.to}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.label}
                          {item.superAdminOnly && (
                            <span className="ml-2 badge bg-red-100 text-red-700 text-[10px]">SuperAdmin</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs font-mono text-slate-400">{item.to}</td>
                        {ALL_ROLES.map((r) => {
                          const key = `${r.id}:${item.to}`;
                          const isChecked = Boolean(matrixState[key]);
                          return (
                            <td
                              key={`cell-${r.id}-${item.to}`}
                              className="px-4 py-3 text-center border-l border-slate-100 hover:bg-blue-50/30"
                            >
                              <label className="flex items-center justify-center cursor-pointer w-full h-full py-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMatrixCell(r.id, item.to)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={saveMatrix}
              disabled={savingMatrix}
              className="btn-primary flex items-center gap-2"
            >
              {savingMatrix ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Simpan Perubahan Hak Akses</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal user */}
      <Modal
        isOpen={modal}
        title={editingId ? `Edit User: ${form.username}` : 'Tambah User'}
        onClose={() => setModal(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {me?.tenant_id === 1 && (
            <div>
              <label className="label" htmlFor="tenant-user">
                Perusahaan Klien / Tenant *
              </label>
              <SearchableSelect
                id="tenant-user"
                value={form.tenant_id}
                onChange={(e) => {
                  const newTenantId = e.target ? e.target.value : e;
                  const currentWh = warehouses.find((w) => String(w.id) === String(form.warehouse_id));
                  const keepWh = currentWh && String(currentWh.tenant_id) === String(newTenantId);
                  setForm({
                    ...form,
                    tenant_id: newTenantId,
                    warehouse_id: keepWh ? form.warehouse_id : '',
                  });
                }}
                isClearable={false}
                searchPlaceholder="Cari perusahaan..."
                options={tenants.map((t) => ({
                  value: String(t.id),
                  label: `${t.nama_perusahaan} (${t.kode_tenant})`,
                  sublabel: `Email: ${t.email_pemilik || '-'} | Status: ${t.status}`,
                }))}
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="nama_lengkap">
              Nama Lengkap *
            </label>
            <input
              id="nama_lengkap"
              className="input"
              value={form.nama_lengkap}
              onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
              placeholder="Contoh: Budi Santoso"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="username-user">
              Username *
            </label>
            <input
              id="username-user"
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Contoh: gudang02"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password-user">
              {editingId ? 'Password Baru' : 'Password *'}
            </label>
            <input
              id="password-user"
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editingId ? 'Kosongkan jika tidak diganti' : 'Minimal 6 karakter'}
              required={!editingId}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="role-user">
              Role *
            </label>
            <SearchableSelect
              id="role-user"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target ? e.target.value : e })}
              isClearable={false}
              searchPlaceholder="Cari role..."
              options={[
                ...(me?.tenant_id === 1 || me?.username === 'admin'
                  ? [{ value: 'PENGEMBANG', label: 'PENGEMBANG (SuperAdmin / Dev System)', sublabel: roleHint.PENGEMBANG }]
                  : []),
                { value: 'ADMINISTRATOR', label: 'ADMINISTRATOR (Admin Perusahaan / Full Tenant)', sublabel: roleHint.ADMINISTRATOR },
                { value: 'ADMIN_KEUANGAN', label: 'ADMIN_KEUANGAN (Admin Keuangan & Akuntansi)', sublabel: roleHint.ADMIN_KEUANGAN },
                { value: 'ADMIN_GUDANG', label: 'ADMIN_GUDANG (Admin Gudang & Stok)', sublabel: roleHint.ADMIN_GUDANG },
                { value: 'ADMIN_OPERASIONAL', label: 'ADMIN_OPERASIONAL (Admin Operasional & Sales)', sublabel: roleHint.ADMIN_OPERASIONAL },
              ]}
            />
            <p className="mt-1 text-xs text-slate-500">{roleHint[form.role]}</p>
          </div>
          <div>
            <label className="label" htmlFor="warehouse-user">
              Gudang Penugasan (Khusus Admin Gudang)
            </label>
            <SearchableSelect
              id="warehouse-user"
              value={form.warehouse_id}
              onChange={(e) => setForm({ ...form, warehouse_id: e.target ? e.target.value : e })}
              searchPlaceholder="Cari gudang..."
              options={[
                {
                  value: '',
                  label: '-- Semua Gudang (Kepala Gudang / Akses Penuh) --',
                  sublabel: 'Dapat mengajukan dan menyetujui transfer di semua gudang',
                },
                ...warehouses
                  .filter((w) => !form.tenant_id || String(w.tenant_id) === String(form.tenant_id))
                  .map((w) => ({
                    value: String(w.id),
                    label: `${w.kode_gudang} — ${w.nama_gudang}`,
                    sublabel: `Tipe: ${w.tipe_gudang || 'UTAMA'}${w.nama_perusahaan ? ` • ${w.nama_perusahaan}` : ''}`,
                  })),
              ]}
            />
            <p className="mt-1 text-xs text-slate-500">
              Jika dipilih untuk role ADMIN_GUDANG, user hanya bisa mengajukan transfer keluar dari gudang ini dan hanya bisa melakukan approval untuk barang yang masuk ke gudang ini.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Simpan Perubahan' : 'Tambah User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
