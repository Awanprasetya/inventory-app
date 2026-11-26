import { useEffect, useState } from 'react';
import {
  Truck,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileSpreadsheet,
  Phone,
  Mail,
  MapPin,
  Smartphone,
  FileText,
} from 'lucide-react';
import api, { getErrorMessage, formatDate, formatRupiah } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { useAuth } from '../context/AuthContext.jsx';
import { exportToExcel } from '../utils/exportHelper.js';

const emptySupplierForm = {
  kode_supplier: '',
  nama_supplier: '',
  nomor_hp: '',
  telepon: '',
  email: '',
  npwp: '',
  alamat_kantor: '',
  alamat_pengiriman: '',
  tenant_id: '',
};

const emptyCustomerForm = {
  kode_customer: '',
  nama_customer: '',
  jenis_customer: 'PT',
  nomor_hp: '',
  telepon: '',
  email: '',
  npwp: '',
  alamat_kantor: '',
  alamat_pengiriman: '',
  tenant_id: '',
};

const renderCustomerTypeBadge = (type) => {
  const t = (type || 'PT').toUpperCase();
  switch (t) {
    case 'PT':
      return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">PT</span>;
    case 'PERORANGAN':
      return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">Perorangan</span>;
    case 'RS':
      return <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">RS</span>;
    case 'KLINIK':
      return <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 border border-teal-200">Klinik</span>;
    case 'PUSKESMAS':
      return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">Puskesmas</span>;
    case 'LAB':
      return <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">LAB</span>;
    default:
      return <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">{t}</span>;
  }
};

const PAGE_SIZE = 10;

export default function SuppliersCustomers() {
  const { user } = useAuth();
  const isSuperAdmin = user && (user.username === 'admin' || ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes((user.role || '').toUpperCase()));

  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierPageSize, setSupplierPageSize] = useState(PAGE_SIZE);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(PAGE_SIZE);

  // Supplier Modal state
  const [supplierModal, setSupplierModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);

  // Customer Modal state
  const [customerModal, setCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [supRes, custRes, tRes] = await Promise.all([
        api.get('/suppliers', { params: { tenant_id: selectedTenantFilter || undefined } }),
        api.get('/customers', { params: { tenant_id: selectedTenantFilter || undefined } }),
        api.get('/auth/tenants').catch(() => ({ data: { data: [] } })),
      ]);
      setSuppliers(supRes.data.data);
      setCustomers(custRes.data.data);
      if (tRes?.data?.data) {
        setTenants(tRes.data.data);
      }
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTenantFilter]);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // --- Supplier Handlers ---
  const openAddSupplier = () => {
    setEditingSupplierId(null);
    const defaultTenant = selectedTenantFilter || (user?.tenant_id ? String(user.tenant_id) : '1');
    setSupplierForm({
      ...emptySupplierForm,
      tenant_id: defaultTenant,
    });
    setSupplierModal(true);
  };

  const openEditSupplier = (s) => {
    setEditingSupplierId(s.id);
    setSupplierForm({
      kode_supplier: s.kode_supplier,
      nama_supplier: s.nama_supplier,
      nomor_hp: s.nomor_hp || '',
      telepon: s.telepon || '',
      email: s.email || '',
      npwp: s.npwp || '',
      alamat_kantor: s.alamat_kantor || s.alamat || '',
      alamat_pengiriman: s.alamat_pengiriman || '',
      tenant_id: s.tenant_id ? String(s.tenant_id) : (user?.tenant_id ? String(user.tenant_id) : '1'),
    });
    setSupplierModal(true);
  };

  const submitSupplier = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let msg = '';
      const tenantIdToSave = supplierForm.tenant_id ? Number(supplierForm.tenant_id) : (user?.tenant_id || 1);
      const payload = {
        ...supplierForm,
        tenant_id: tenantIdToSave,
      };
      if (editingSupplierId) {
        const { data } = await api.put(`/suppliers/${editingSupplierId}`, payload);
        msg = data.message;
      } else {
        const { data } = await api.post('/suppliers', payload);
        msg = data.message;
      }
      toastSuccess(msg);
      setSupplierModal(false);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Supplier', msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = async (s) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Supplier?',
      text: `Apakah Anda yakin ingin menghapus supplier "${s.nama_supplier}" (${s.kode_supplier})?`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/suppliers/${s.id}`);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus Supplier', msg);
    }
  };

  // --- Customer Handlers ---
  const openAddCustomer = () => {
    setEditingCustomerId(null);
    const defaultTenant = selectedTenantFilter || (user?.tenant_id ? String(user.tenant_id) : '1');
    setCustomerForm({
      ...emptyCustomerForm,
      tenant_id: defaultTenant,
    });
    setCustomerModal(true);
  };

  const openEditCustomer = (c) => {
    setEditingCustomerId(c.id);
    setCustomerForm({
      kode_customer: c.kode_customer,
      nama_customer: c.nama_customer,
      jenis_customer: c.jenis_customer || 'PT',
      nomor_hp: c.nomor_hp || '',
      telepon: c.telepon || '',
      email: c.email || '',
      npwp: c.npwp || '',
      alamat_kantor: c.alamat_kantor || '',
      alamat_pengiriman: c.alamat_pengiriman || '',
      tenant_id: c.tenant_id ? String(c.tenant_id) : (user?.tenant_id ? String(user.tenant_id) : '1'),
    });
    setCustomerModal(true);
  };

  const submitCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let msg = '';
      const tenantIdToSave = customerForm.tenant_id ? Number(customerForm.tenant_id) : (user?.tenant_id || 1);
      const payload = {
        ...customerForm,
        tenant_id: tenantIdToSave,
      };
      if (editingCustomerId) {
        const { data } = await api.put(`/customers/${editingCustomerId}`, payload);
        msg = data.message;
      } else {
        const { data } = await api.post('/customers', payload);
        msg = data.message;
      }
      toastSuccess(msg);
      setCustomerModal(false);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Customer', msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (c) => {
    const confirmed = await confirmDelete({
      title: 'Hapus Customer?',
      text: `Apakah Anda yakin ingin menghapus customer "${c.nama_customer}" (${c.kode_customer})?`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/customers/${c.id}`);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus Customer', msg);
    }
  };

  const handleExportSuppliers = () => {
    const headers = [
      'Kode Supplier',
      'Nama Supplier',
      'Perusahaan / PT',
      'No. HP / WA',
      'Telepon Kantor',
      'Email',
      'NPWP',
      'Alamat Kantor',
      'Alamat Pengiriman',
      'Sisa Utang (Rp)',
      'Tanggal Terdaftar',
    ];
    const data = suppliers.map((s) => [
      s.kode_supplier || '',
      s.nama_supplier || '',
      s.nama_perusahaan || s.tenant_name || '-',
      s.nomor_hp || '-',
      s.telepon || '-',
      s.email || '-',
      s.npwp || '-',
      s.alamat_kantor || s.alamat || '-',
      s.alamat_pengiriman || '-',
      s.total_sisa_utang ?? s.sisa_utang ?? 0,
      formatDate(s.created_at || s.createdAt),
    ]);
    exportToExcel('Master_Supplier', headers, data);
  };

  const handleExportCustomers = () => {
    const headers = [
      'Kode Customer',
      'Nama Customer',
      'Jenis Customer',
      'Perusahaan / PT',
      'No. HP / WA',
      'Telepon Kantor',
      'Email',
      'NPWP',
      'Alamat Kantor',
      'Alamat Pengiriman',
      'Sisa Piutang (Rp)',
      'Tanggal Terdaftar',
    ];
    const data = customers.map((c) => [
      c.kode_customer || '',
      c.nama_customer || '',
      c.jenis_customer || 'PT',
      c.nama_perusahaan || c.tenant_name || '-',
      c.nomor_hp || '-',
      c.telepon || '-',
      c.email || '-',
      c.npwp || '-',
      c.alamat_kantor || '-',
      c.alamat_pengiriman || '-',
      c.total_sisa_piutang ?? c.sisa_piutang ?? 0,
      formatDate(c.created_at || c.createdAt),
    ]);
    exportToExcel('Master_Customer', headers, data);
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* --- Tabel Supplier --- */}
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Master Supplier</h2>
              <p className="text-xs text-slate-500">{suppliers.length} supplier terdaftar</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && tenants.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={selectedTenantFilter}
                  onChange={(e) => setSelectedTenantFilter(e.target.value)}
                  className="input h-[38px] py-1 px-2.5 text-xs font-medium w-48 bg-white border-slate-300"
                  title="Filter berdasarkan Perusahaan / PT"
                >
                  <option value="">Semua Perusahaan / PT</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama_perusahaan}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isSuperAdmin && user?.tenant_name && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold text-slate-800">{user.tenant_name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleExportSuppliers}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Export ke Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
            </button>
            <button type="button" onClick={openAddSupplier} className="btn-primary">
              <Plus className="h-4 w-4" /> Tambah Supplier
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
          </div>
        ) : suppliers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Belum ada supplier.</p>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(suppliers, supplierPage, supplierPageSize);
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Kode Supplier</th>
                        <th>Nama Supplier</th>
                        <th>Perusahaan / PT</th>
                        <th>Kontak & NPWP</th>
                        <th>Alamat Kantor</th>
                        <th>Alamat Pengiriman</th>
                        <th className="text-right">Sisa Utang</th>
                        <th>Terdaftar</th>
                        <th>
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((s) => (
                        <tr key={s.id}>
                          <td className="font-medium text-slate-700">{s.kode_supplier}</td>
                          <td className="font-semibold text-slate-900">{s.nama_supplier}</td>
                          <td>
                            <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
                              {s.nama_perusahaan || '-'}
                            </span>
                          </td>
                          <td className="text-xs space-y-0.5 min-w-[140px]">
                            {(s.nomor_hp || s.telepon) && (
                              <div className="flex items-center gap-1 text-slate-800 font-medium">
                                <Smartphone className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span>{s.nomor_hp || s.telepon}</span>
                              </div>
                            )}
                            {s.telepon && s.nomor_hp && s.telepon !== s.nomor_hp && (
                              <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{s.telepon}</span>
                              </div>
                            )}
                            {s.email && (
                              <div className="flex items-center gap-1 text-blue-600 text-[11px] truncate max-w-[170px]" title={s.email}>
                                <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                                <span>{s.email}</span>
                              </div>
                            )}
                            {s.npwp && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                NPWP: {s.npwp}
                              </div>
                            )}
                            {!s.nomor_hp && !s.telepon && !s.email && !s.npwp && <span className="text-slate-400">-</span>}
                          </td>
                          <td className="max-w-[170px] truncate text-xs text-slate-600" title={s.alamat_kantor || s.alamat || '-'}>
                            {s.alamat_kantor || s.alamat || '-'}
                          </td>
                          <td className="max-w-[170px] truncate text-xs text-slate-600" title={s.alamat_pengiriman || '-'}>
                            {s.alamat_pengiriman || '-'}
                          </td>
                          <td className="whitespace-nowrap text-right">
                            {Number(s.total_sisa_utang) > 0 ? (
                              <div>
                                <div className="text-xs font-bold text-rose-700">{formatRupiah(s.total_sisa_utang)}</div>
                                {Number(s.total_utang_overdue) > 0 && (
                                  <span className="text-[10px] font-bold text-rose-600">
                                    Lewat: {formatRupiah(s.total_utang_overdue)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-emerald-600">Rp 0</span>
                            )}
                          </td>
                          <td className="text-xs text-slate-500">{formatDate(s.created_at)}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditSupplier(s)}
                                className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                aria-label={`Edit ${s.nama_supplier}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSupplier(s)}
                                className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Hapus ${s.nama_supplier}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                  onPage={setSupplierPage}
                  totalItems={suppliers.length}
                  pageSize={supplierPageSize}
                  onPageSize={(sz) => {
                    setSupplierPageSize(sz);
                    setSupplierPage(1);
                  }}
                  label="supplier"
                />
              </>
            );
          })()
        )}
      </div>

      {/* --- Tabel Customer --- */}
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Master Customer</h2>
              <p className="text-xs text-slate-500">{customers.length} customer terdaftar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCustomers}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Export ke Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
            </button>
            <button type="button" onClick={openAddCustomer} className="btn-secondary">
              <Plus className="h-4 w-4" /> Tambah Customer
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
          </div>
        ) : customers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Belum ada customer.</p>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(customers, customerPage, customerPageSize);
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Kode Customer</th>
                        <th>Nama Customer</th>
                        <th>Jenis</th>
                        <th>Perusahaan / PT</th>
                        <th>Kontak & NPWP</th>
                        <th>Alamat Kantor</th>
                        <th>Alamat Pengiriman</th>
                        <th className="text-right">Sisa Piutang</th>
                        <th>Terdaftar</th>
                        <th>
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((c) => (
                        <tr key={c.id}>
                          <td className="font-medium text-slate-700">{c.kode_customer}</td>
                          <td className="font-semibold text-slate-900">{c.nama_customer}</td>
                          <td>{renderCustomerTypeBadge(c.jenis_customer)}</td>
                          <td>
                            <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
                              {c.nama_perusahaan || '-'}
                            </span>
                          </td>
                          <td className="text-xs space-y-0.5 min-w-[140px]">
                            {(c.nomor_hp || c.telepon) && (
                              <div className="flex items-center gap-1 text-slate-800 font-medium">
                                <Smartphone className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span>{c.nomor_hp || c.telepon}</span>
                              </div>
                            )}
                            {c.telepon && c.nomor_hp && c.telepon !== c.nomor_hp && (
                              <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{c.telepon}</span>
                              </div>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-1 text-blue-600 text-[11px] truncate max-w-[170px]" title={c.email}>
                                <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                                <span>{c.email}</span>
                              </div>
                            )}
                            {c.npwp && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                NPWP: {c.npwp}
                              </div>
                            )}
                            {!c.nomor_hp && !c.telepon && !c.email && !c.npwp && <span className="text-slate-400">-</span>}
                          </td>
                          <td className="max-w-[170px] truncate text-xs text-slate-600" title={c.alamat_kantor || '-'}>
                            {c.alamat_kantor || '-'}
                          </td>
                          <td className="max-w-[170px] truncate text-xs text-slate-600" title={c.alamat_pengiriman || '-'}>
                            {c.alamat_pengiriman || '-'}
                          </td>
                          <td className="whitespace-nowrap text-right">
                            {Number(c.total_sisa_piutang) > 0 ? (
                              <div>
                                <div className="text-xs font-bold text-blue-700">{formatRupiah(c.total_sisa_piutang)}</div>
                                {Number(c.total_piutang_overdue) > 0 && (
                                  <span className="text-[10px] font-bold text-rose-600">
                                    Lewat: {formatRupiah(c.total_piutang_overdue)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-emerald-600">Rp 0</span>
                            )}
                          </td>
                          <td className="text-xs text-slate-500">{formatDate(c.created_at)}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditCustomer(c)}
                                className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                aria-label={`Edit ${c.nama_customer}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCustomer(c)}
                                className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Hapus ${c.nama_customer}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                  onPage={setCustomerPage}
                  totalItems={customers.length}
                  pageSize={customerPageSize}
                  onPageSize={(sz) => {
                    setCustomerPageSize(sz);
                    setCustomerPage(1);
                  }}
                  label="customer"
                />
              </>
            );
          })()
        )}
      </div>

      {/* --- Modal Supplier --- */}
      {(() => {
        const activeSupTenantId = supplierForm.tenant_id || (user?.tenant_id ? String(user.tenant_id) : '1');
        const tenantCompany = tenants.find((t) => String(t.id) === String(activeSupTenantId));
        const activeCompanyName = tenantCompany?.nama_perusahaan || user?.tenant_name || 'PT Utama';

        return (
          <Modal
            isOpen={supplierModal}
            title={editingSupplierId ? 'Edit Supplier' : 'Tambah Supplier'}
            onClose={() => setSupplierModal(false)}
            maxWidth="max-w-2xl"
          >
            <form onSubmit={submitSupplier} className="space-y-4">
              {isSuperAdmin ? (
                <div>
                  <label className="label" htmlFor="supplier_tenant_id">
                    Perusahaan / PT Pemilik *
                  </label>
                  <SearchableSelect
                    id="supplier_tenant_id"
                    value={String(activeSupTenantId)}
                    onChange={(val) => setSupplierForm({ ...supplierForm, tenant_id: val.target ? val.target.value : val })}
                    searchPlaceholder="Pilih PT..."
                    options={tenants.map((t) => ({
                      value: String(t.id),
                      label: t.nama_perusahaan,
                      sublabel: `Kode: ${t.kode_tenant || '-'}`,
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Supplier ini akan terdaftar khusus untuk PT yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-900">
                  <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-slate-500">Perusahaan / PT Pemilik:</span>{' '}
                    <strong className="text-blue-950 font-semibold">{activeCompanyName}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="kode_supplier">
                    Kode Supplier *
                  </label>
                  <input
                    id="kode_supplier"
                    className="input"
                    value={supplierForm.kode_supplier}
                    onChange={(e) => setSupplierForm({ ...supplierForm, kode_supplier: e.target.value })}
                    placeholder="Contoh: SUP-001"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="nama_supplier">
                    Nama Supplier *
                  </label>
                  <input
                    id="nama_supplier"
                    className="input"
                    value={supplierForm.nama_supplier}
                    onChange={(e) => setSupplierForm({ ...supplierForm, nama_supplier: e.target.value })}
                    placeholder="Contoh: PT. Sumber Makmur"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="nomor_hp_supplier">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    id="nomor_hp_supplier"
                    className="input"
                    value={supplierForm.nomor_hp}
                    onChange={(e) => setSupplierForm({ ...supplierForm, nomor_hp: e.target.value })}
                    placeholder="Contoh: 08123456789"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="telepon_supplier">
                    Telepon Kantor
                  </label>
                  <input
                    id="telepon_supplier"
                    className="input"
                    value={supplierForm.telepon}
                    onChange={(e) => setSupplierForm({ ...supplierForm, telepon: e.target.value })}
                    placeholder="Contoh: (021) 555-1234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="email_supplier">
                    Email
                  </label>
                  <input
                    id="email_supplier"
                    type="email"
                    className="input"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="Contoh: supplier@domain.com"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="npwp_supplier">
                    NPWP
                  </label>
                  <input
                    id="npwp_supplier"
                    className="input font-mono"
                    value={supplierForm.npwp}
                    onChange={(e) => setSupplierForm({ ...supplierForm, npwp: e.target.value })}
                    placeholder="Contoh: 01.234.567.8-901.000"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="alamat_kantor_supplier">
                  Alamat Kantor
                </label>
                <textarea
                  id="alamat_kantor_supplier"
                  rows="2"
                  className="input"
                  value={supplierForm.alamat_kantor}
                  onChange={(e) => setSupplierForm({ ...supplierForm, alamat_kantor: e.target.value, alamat: e.target.value })}
                  placeholder="Alamat kantor lengkap / operasional supplier"
                />
              </div>

              <div>
                <label className="label" htmlFor="alamat_pengiriman_supplier">
                  Alamat Pengiriman / Gudang
                </label>
                <textarea
                  id="alamat_pengiriman_supplier"
                  rows="2"
                  className="input"
                  value={supplierForm.alamat_pengiriman}
                  onChange={(e) => setSupplierForm({ ...supplierForm, alamat_pengiriman: e.target.value })}
                  placeholder="Alamat gudang / lokasi penyerahan barang supplier"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setSupplierModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingSupplierId ? 'Simpan Perubahan' : 'Tambah Supplier'}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* --- Modal Customer --- */}
      {(() => {
        const activeCustTenantId = customerForm.tenant_id || (user?.tenant_id ? String(user.tenant_id) : '1');
        const tenantCompany = tenants.find((t) => String(t.id) === String(activeCustTenantId));
        const activeCompanyName = tenantCompany?.nama_perusahaan || user?.tenant_name || 'PT Utama';

        return (
          <Modal
            isOpen={customerModal}
            title={editingCustomerId ? 'Edit Customer' : 'Tambah Customer'}
            onClose={() => setCustomerModal(false)}
            maxWidth="max-w-2xl"
          >
            <form onSubmit={submitCustomer} className="space-y-4">
              {isSuperAdmin ? (
                <div>
                  <label className="label" htmlFor="customer_tenant_id">
                    Perusahaan / PT Pemilik *
                  </label>
                  <SearchableSelect
                    id="customer_tenant_id"
                    value={String(activeCustTenantId)}
                    onChange={(val) => setCustomerForm({ ...customerForm, tenant_id: val.target ? val.target.value : val })}
                    searchPlaceholder="Pilih PT..."
                    options={tenants.map((t) => ({
                      value: String(t.id),
                      label: t.nama_perusahaan,
                      sublabel: `Kode: ${t.kode_tenant || '-'}`,
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Customer ini akan terdaftar khusus untuk PT yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
                  <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-slate-500">Perusahaan / PT Pemilik:</span>{' '}
                    <strong className="text-emerald-950 font-semibold">{activeCompanyName}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor="kode_customer">
                    Kode Customer *
                  </label>
                  <input
                    id="kode_customer"
                    className="input font-mono font-medium"
                    value={customerForm.kode_customer}
                    onChange={(e) => setCustomerForm({ ...customerForm, kode_customer: e.target.value })}
                    placeholder="Contoh: CUST-001"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="nama_customer">
                    Nama Customer *
                  </label>
                  <input
                    id="nama_customer"
                    className="input font-medium"
                    value={customerForm.nama_customer}
                    onChange={(e) => setCustomerForm({ ...customerForm, nama_customer: e.target.value })}
                    placeholder="Contoh: RS Hermina / PT Maju"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="jenis_customer">
                    Jenis Customer *
                  </label>
                  <select
                    id="jenis_customer"
                    className="select font-semibold text-slate-700"
                    value={customerForm.jenis_customer || 'PT'}
                    onChange={(e) => setCustomerForm({ ...customerForm, jenis_customer: e.target.value })}
                    required
                  >
                    <option value="PT">PT (Perseroan Terbatas)</option>
                    <option value="PERORANGAN">Perorangan</option>
                    <option value="RS">RS (Rumah Sakit)</option>
                    <option value="KLINIK">Klinik</option>
                    <option value="PUSKESMAS">Puskesmas</option>
                    <option value="LAB">LAB (Laboratorium)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="nomor_hp_customer">
                    Nomor HP / WhatsApp
                  </label>
                  <input
                    id="nomor_hp_customer"
                    className="input"
                    value={customerForm.nomor_hp}
                    onChange={(e) => setCustomerForm({ ...customerForm, nomor_hp: e.target.value })}
                    placeholder="Contoh: 08987654321"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="telepon_customer">
                    Telepon Kantor
                  </label>
                  <input
                    id="telepon_customer"
                    className="input"
                    value={customerForm.telepon}
                    onChange={(e) => setCustomerForm({ ...customerForm, telepon: e.target.value })}
                    placeholder="Contoh: (021) 777-8899"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="email_customer">
                    Email
                  </label>
                  <input
                    id="email_customer"
                    type="email"
                    className="input"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="Contoh: customer@domain.com"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="npwp_customer">
                    NPWP
                  </label>
                  <input
                    id="npwp_customer"
                    className="input font-mono"
                    value={customerForm.npwp}
                    onChange={(e) => setCustomerForm({ ...customerForm, npwp: e.target.value })}
                    placeholder="Contoh: 01.234.567.8-901.000"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="alamat_kantor_customer">
                  Alamat Kantor
                </label>
                <textarea
                  id="alamat_kantor_customer"
                  rows="2"
                  className="input"
                  value={customerForm.alamat_kantor}
                  onChange={(e) => setCustomerForm({ ...customerForm, alamat_kantor: e.target.value })}
                  placeholder="Alamat kantor lengkap / administrasi customer"
                />
              </div>

              <div>
                <label className="label" htmlFor="alamat_pengiriman">
                  Alamat Pengiriman
                </label>
                <textarea
                  id="alamat_pengiriman"
                  rows="2"
                  className="input"
                  value={customerForm.alamat_pengiriman}
                  onChange={(e) => setCustomerForm({ ...customerForm, alamat_pengiriman: e.target.value })}
                  placeholder="Alamat lengkap tujuan pengiriman pesanan barang"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setCustomerModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingCustomerId ? 'Simpan Perubahan' : 'Tambah Customer'}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}
    </div>
  );
}

