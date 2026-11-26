import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Warehouse,
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Building2,
  Filter,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import api, { getErrorMessage, formatNumber, formatDate, formatRupiah } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError } from '../utils/alert.js';
import { useAuth } from '../context/AuthContext.jsx';
import { exportToExcel } from '../utils/exportHelper.js';
import HelpTooltip from '../components/HelpTooltip.jsx';
import { getProductUnits, formatMultiTierBreakdown } from '../utils/unitHelper.js';

const emptyProductForm = {
  kode_produk: '',
  nama_produk: '',
  kategori_produk: 'BARANG_JADI',
  satuan: 'PCS',
  harga: '',
  rack_id: '',
  tenant_id: '',
  satuan_besar: 'BOX',
  satuan_menengah: 'PACK',
  isi_pack_pcs: '1',
  isi_box_pack: '1',
  isi_box_pcs: '1',
  isi_per_kemasan: '1',
  barcode_kemasan: '',
  jenis_izin: '',
  custom_jenis_izin: '',
  nomor_izin: '',
  metode_stok: 'FIFO',
};
const emptyRackForm = { kode_rak: '', keterangan: '', tenant_id: '' };

const PAGE_SIZE = 10;

export default function Products() {
  const { user } = useAuth();
  const isSuperAdmin = user && (user.username === 'admin' || ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes((user.role || '').toUpperCase()));

  const [products, setProducts] = useState([]);
  const [racks, setRacks] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState('');
  const [selectedKategoriFilter, setSelectedKategoriFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination tabel produk & rak (reset ke halaman 1 saat data berubah)
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(PAGE_SIZE);
  const [rackPage, setRackPage] = useState(1);
  const [rackPageSize, setRackPageSize] = useState(PAGE_SIZE);

  // State modal produk
  const [productModal, setProductModal] = useState(false);
  const [editingKode, setEditingKode] = useState(null); // null = tambah baru
  const [productForm, setProductForm] = useState(emptyProductForm);

  // State modal ubah harga cepat
  const [priceModal, setPriceModal] = useState(false);
  const [priceProduct, setPriceProduct] = useState(null);
  const [quickHarga, setQuickHarga] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // State modal rak
  const [rackModal, setRackModal] = useState(false);
  const [editingRackId, setEditingRackId] = useState(null);
  const [rackForm, setRackForm] = useState(emptyRackForm);

  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, r, tRes] = await Promise.all([
        api.get('/products', {
          params: {
            search: search.trim() || undefined,
            tenant_id: selectedTenantFilter || undefined,
            kategori: selectedKategoriFilter || undefined,
          },
        }),
        api.get('/racks', {
          params: {
            tenant_id: isSuperAdmin ? 'all' : undefined,
          },
        }),
        api.get('/auth/tenants').catch(() => ({ data: { data: [] } })),
      ]);
      setProducts(p.data.data);
      setRacks(r.data.data);
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

  // Debounce pencarian & filter tenant/kategori
  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [search, selectedTenantFilter, selectedKategoriFilter]);

  const flash = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 4000);
  };

  // --- Produk ---
  const openAddProduct = () => {
    setEditingKode(null);
    const defaultTenant = selectedTenantFilter || (user?.tenant_id ? String(user.tenant_id) : '1');
    setProductForm({
      ...emptyProductForm,
      tenant_id: defaultTenant,
    });
    setProductModal(true);
  };

  const openEditProduct = (product) => {
    setEditingKode(product.kode_produk);
    const rawJenis = product.jenis_izin || '';
    let jIzin = '';
    let customIzin = '';
    if (rawJenis.toUpperCase() === 'AKD') {
      jIzin = 'AKD';
    } else if (rawJenis.toUpperCase() === 'AKL') {
      jIzin = 'AKL';
    } else if (rawJenis) {
      jIzin = 'LAINNYA';
      customIzin = rawJenis;
    }

    setProductForm({
      kode_produk: product.kode_produk,
      nama_produk: product.nama_produk,
      kategori_produk: (product.kategori_produk || 'BARANG_JADI').toUpperCase(),
      satuan: product.satuan || 'PCS',
      harga: product.harga != null ? String(product.harga) : '',
      rack_id: product.rack_id ? String(product.rack_id) : '',
      tenant_id: product.tenant_id ? String(product.tenant_id) : (user?.tenant_id ? String(user.tenant_id) : '1'),
      satuan_besar: product.satuan_besar || 'BOX',
      satuan_menengah: product.satuan_menengah || 'PACK',
      isi_pack_pcs: product.isi_pack_pcs != null ? String(product.isi_pack_pcs) : '1',
      isi_box_pack: product.isi_box_pack != null ? String(product.isi_box_pack) : (product.isi_per_kemasan != null ? String(product.isi_per_kemasan) : '1'),
      isi_box_pcs: product.isi_box_pcs != null ? String(product.isi_box_pcs) : (product.isi_per_kemasan != null ? String(product.isi_per_kemasan) : '1'),
      isi_per_kemasan: product.isi_per_kemasan != null ? String(product.isi_per_kemasan) : '1',
      barcode_kemasan: product.barcode_kemasan || '',
      jenis_izin: jIzin,
      custom_jenis_izin: customIzin,
      nomor_izin: product.nomor_izin || '',
      metode_stok: product.metode_stok || 'FIFO',
    });
    setProductModal(true);
  };

  const submitProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const harga = Number(productForm.harga);
      if (!Number.isFinite(harga) || harga < 0) {
        setError('Harga wajib diisi berupa angka >= 0');
        setSaving(false);
        return;
      }
      const tenantIdToSave = productForm.tenant_id ? Number(productForm.tenant_id) : (user?.tenant_id || 1);

      let finalJenisIzin = null;
      if (productForm.jenis_izin === 'LAINNYA') {
        finalJenisIzin = productForm.custom_jenis_izin ? productForm.custom_jenis_izin.trim().toUpperCase() : 'LAINNYA';
      } else if (productForm.jenis_izin) {
        finalJenisIzin = productForm.jenis_izin.trim().toUpperCase();
      }

      const payload = {
        nama_produk: productForm.nama_produk.trim(),
        kategori_produk: productForm.kategori_produk || 'BARANG_JADI',
        satuan: productForm.satuan.trim(),
        harga,
        rack_id: productForm.rack_id ? Number(productForm.rack_id) : null,
        tenant_id: tenantIdToSave,
        satuan_besar: productForm.satuan_besar ? productForm.satuan_besar.trim().toUpperCase() : 'BOX',
        satuan_menengah: productForm.satuan_menengah ? productForm.satuan_menengah.trim().toUpperCase() : 'PACK',
        isi_pack_pcs: Number(productForm.isi_pack_pcs) > 0 ? Number(productForm.isi_pack_pcs) : 1,
        isi_box_pack: Number(productForm.isi_box_pack) > 0 ? Number(productForm.isi_box_pack) : 1,
        isi_box_pcs: (Number(productForm.isi_box_pack) > 0 ? Number(productForm.isi_box_pack) : 1) * (Number(productForm.isi_pack_pcs) > 0 ? Number(productForm.isi_pack_pcs) : 1),
        isi_per_kemasan: Number(productForm.isi_per_kemasan) > 0 ? Number(productForm.isi_per_kemasan) : 1,
        barcode_kemasan: productForm.barcode_kemasan ? productForm.barcode_kemasan.trim() : null,
        jenis_izin: finalJenisIzin,
        nomor_izin: productForm.nomor_izin ? productForm.nomor_izin.trim() : null,
        metode_stok: productForm.metode_stok || 'FIFO',
      };
      if (editingKode) {
        const { data } = await api.put(`/products/${encodeURIComponent(editingKode)}`, payload);
        flash(data.message);
        toastSuccess(data.message);
      } else {
        const { data } = await api.post('/products', {
          kode_produk: productForm.kode_produk.trim(),
          ...payload,
        });
        flash(data.message);
        toastSuccess(data.message);
      }
      setProductModal(false);
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Produk', msg);
    } finally {
      setSaving(false);
    }
  };

  const openEditPrice = (product) => {
    setPriceProduct(product);
    setQuickHarga(product.harga != null ? String(product.harga) : '0');
    setPriceModal(true);
  };

  const submitQuickPrice = async (e) => {
    e.preventDefault();
    if (!priceProduct) return;
    setSavingPrice(true);
    setError('');
    try {
      const hargaNum = Number(quickHarga);
      if (!Number.isFinite(hargaNum) || hargaNum < 0) {
        setError('Harga wajib diisi berupa angka >= 0');
        setSavingPrice(false);
        return;
      }
      const { data } = await api.put(`/products/${encodeURIComponent(priceProduct.kode_produk)}`, {
        harga: hargaNum,
      });
      const msg = data.message || `Harga produk "${priceProduct.kode_produk}" berhasil diperbarui`;
      flash(msg);
      toastSuccess(msg);
      setPriceModal(false);
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Memperbarui Harga', msg);
    } finally {
      setSavingPrice(false);
    }
  };

  const deleteProduct = async (kode) => {
    const confirmed = await confirmDelete({
      title: `Hapus Produk ${kode}?`,
      text: `Produk "${kode}" beserta seluruh lot stoknya akan dihapus permanen!`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/products/${encodeURIComponent(kode)}`);
      flash(data.message);
      toastSuccess(data.message);
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus Produk', msg);
    }
  };

  // --- Rak ---
  const openAddRack = () => {
    setEditingRackId(null);
    const defaultTenant = selectedTenantFilter || (user?.tenant_id ? String(user.tenant_id) : '1');
    setRackForm({
      ...emptyRackForm,
      tenant_id: defaultTenant,
    });
    setRackModal(true);
  };

  const openEditRack = (rack) => {
    setEditingRackId(rack.id);
    setRackForm({
      kode_rak: rack.kode_rak,
      keterangan: rack.keterangan || '',
      tenant_id: rack.tenant_id ? String(rack.tenant_id) : (user?.tenant_id ? String(user.tenant_id) : '1'),
    });
    setRackModal(true);
  };

  const submitRack = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const tenantIdToSave = rackForm.tenant_id ? Number(rackForm.tenant_id) : (user?.tenant_id || 1);
      const payload = {
        kode_rak: rackForm.kode_rak.trim(),
        keterangan: rackForm.keterangan.trim() || null,
        tenant_id: tenantIdToSave,
      };
      if (editingRackId) {
        const { data } = await api.put(`/racks/${editingRackId}`, payload);
        flash(data.message);
        toastSuccess(data.message);
      } else {
        const { data } = await api.post('/racks', payload);
        flash(data.message);
        toastSuccess(data.message);
      }
      setRackModal(false);
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Rak', msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteRack = async (rack) => {
    const confirmed = await confirmDelete({
      title: `Hapus Rak ${rack.kode_rak}?`,
      text:
        rack.jumlah_produk > 0
          ? `Rak ini dipakai oleh ${rack.jumlah_produk} produk. Lokasi produk akan menjadi kosong.`
          : 'Data rak ini akan dihapus permanen.',
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/racks/${rack.id}`);
      flash(data.message);
      toastSuccess(data.message);
      load();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus Rak', msg);
    }
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

      {/* --- Master Produk --- */}
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Master Produk</h2>
              <p className="text-xs text-slate-500">{products.length} produk terdaftar</p>
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
                  title="Filter produk berdasarkan Perusahaan / PT"
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
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedKategoriFilter}
                onChange={(e) => {
                  setSelectedKategoriFilter(e.target.value);
                  setProductPage(1);
                }}
                className="input h-[38px] py-1 px-2.5 text-xs font-medium w-40 bg-white border-slate-300"
                title="Filter kategori produk"
              >
                <option value="">Semua Kategori</option>
                <option value="MATERIAL">Material</option>
                <option value="BARANG_JADI">Barang Jadi</option>
              </select>
            </div>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode / nama produk..."
                className="input w-56 pl-3"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const headers = [
                  'Kode Produk',
                  'Nama Produk',
                  'Kategori',
                  'Jenis Izin',
                  'Nomor Izin Edar',
                  'Satuan Kecil',
                  'Satuan Besar',
                  'Isi Per Kemasan',
                  'Harga Satuan (Rp)',
                  'Total Stok Fisik',
                  'Kode Rak',
                ];
                const rows = products.map((p) => [
                  p.kode_produk || '',
                  p.nama_produk || '',
                  (p.kategori_produk || 'BARANG_JADI') === 'MATERIAL' ? 'Material' : 'Barang Jadi',
                  p.jenis_izin || '-',
                  p.nomor_izin || '-',
                  p.satuan || '',
                  p.satuan_besar || 'BOX',
                  p.isi_per_kemasan || 1,
                  p.harga || 0,
                  p.total_stok || 0,
                  p.kode_rak || '-',
                ]);
                exportToExcel('Master_Katalog_Produk_Stok', headers, rows);
              }}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Export Master Produk ke Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Excel
            </button>
            <button type="button" onClick={openAddProduct} className="btn-primary">
              <Plus className="h-4 w-4" /> Produk
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
          </div>
        ) : products.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Tidak ada produk ditemukan.
          </p>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(products, productPage, productPageSize);
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Nama Produk</th>
                        <th>Kategori</th>
                        <th>Izin Edar</th>
                        <th>Perusahaan / PT</th>
                        <th>Satuan</th>
                        <th className="text-right">Harga</th>
                        <th>Metode Stok</th>
                        <th>Rak</th>
                        <th className="text-right">Total Stok</th>
                        <th className="text-right">Lot</th>
                        <th>Terdaftar</th>
                        <th>
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((p) => (
                        <tr key={p.kode_produk}>
                          <td className="font-medium text-slate-700">{p.kode_produk}</td>
                          <td className="font-semibold text-slate-900">{p.nama_produk}</td>
                          <td>
                            {(p.kategori_produk || 'BARANG_JADI').toUpperCase() === 'MATERIAL' ? (
                              <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-800 border border-orange-200">
                                Material
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200">
                                Barang Jadi
                              </span>
                            )}
                          </td>
                          <td>
                            {p.nomor_izin ? (
                              <div className="flex flex-col gap-0.5 min-w-[130px]">
                                <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 border border-sky-200 w-max">
                                  <ShieldCheck className="h-3 w-3 text-sky-600 shrink-0" />
                                  <span>{p.jenis_izin || 'AKD/AKL'}</span>
                                </span>
                                <span className="text-[11px] font-mono text-slate-600 font-medium">
                                  {p.nomor_izin}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td>
                            <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
                              {p.nama_perusahaan || '-'}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">{p.satuan}</span>
                              {Number(p.isi_per_kemasan) > 1 && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 w-max">
                                    <Package className="w-3 h-3" />
                                    1 {p.satuan_besar || 'BOX'} = {p.isi_box_pack || 1} {p.satuan_menengah || 'PACK'} = {p.isi_box_pcs || p.isi_per_kemasan || 1} {p.satuan || 'PCS'}
                                  </span>
                                  {p.barcode_kemasan && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Barcode Box: {p.barcode_kemasan}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-right font-medium">
                            <button
                              type="button"
                              onClick={() => openEditPrice(p)}
                              className="group inline-flex items-center gap-1 font-medium text-slate-700 hover:text-emerald-600 focus:outline-none"
                              title="Klik untuk ubah harga"
                            >
                              <span>{formatRupiah(p.harga)}</span>
                              <Pencil className="h-3 w-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          </td>
                          <td>
                            {(p.metode_stok || 'FIFO').toUpperCase() === 'FEFO' ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-200" title="First Expired, First Out (Tanggal Kadaluarsa Terdekat Ditunaikan Dulu)">
                                FEFO (Expired)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 border border-blue-200" title="First In, First Out (Barang Masuk Terlama Dikeluarkan Dulu)">
                                FIFO (Masuk)
                              </span>
                            )}
                          </td>
                          <td>
                            {p.kode_rak ? (
                              <span className="badge bg-slate-100 text-slate-700">{p.kode_rak}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <p className="font-semibold text-slate-800">{formatNumber(p.total_stok)} {p.satuan}</p>
                            {Number(p.isi_per_kemasan) > 1 && (
                              <p className="text-[11px] text-indigo-600 font-medium">
                                ≈ {formatMultiTierBreakdown(p.total_stok, p)}
                              </p>
                            )}
                          </td>
                          <td className="text-right">{formatNumber(p.jumlah_lot)}</td>
                          <td className="text-xs text-slate-500">{formatDate(p.created_at)}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditPrice(p)}
                                className="rounded p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Ubah Harga"
                                aria-label={`Ubah Harga ${p.kode_produk}`}
                              >
                                <Tag className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditProduct(p)}
                                className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                title="Edit Produk"
                                aria-label={`Edit ${p.kode_produk}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteProduct(p.kode_produk)}
                                className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                title="Hapus Produk"
                                aria-label={`Hapus ${p.kode_produk}`}
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
                  onPage={setProductPage}
                  totalItems={products.length}
                  pageSize={productPageSize}
                  onPageSize={(s) => {
                    setProductPageSize(s);
                    setProductPage(1);
                  }}
                  label="produk"
                />
              </>
            );
          })()
        )}
      </div>

      {/* --- Lokasi Rak --- */}
      {(() => {
        const displayedRacks = selectedTenantFilter
          ? racks.filter((r) => String(r.tenant_id) === String(selectedTenantFilter))
          : racks;

        return (
          <div className="card">
            <div className="card-header flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-violet-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Lokasi Rak</h2>
                  <p className="text-xs text-slate-500">
                    {displayedRacks.length} rak terdaftar {selectedTenantFilter ? '(sesuai filter PT)' : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={openAddRack} className="btn-secondary">
                <Plus className="h-4 w-4" /> Tambah Rak
              </button>
            </div>
            {displayedRacks.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Belum ada rak{selectedTenantFilter ? ' untuk PT yang dipilih' : ''}, silakan tambahkan lokasi rak baru.
              </p>
            ) : (
              (() => {
                const { pageItems, totalPages, safePage } = paginate(displayedRacks, rackPage, rackPageSize);
                return (
                  <>
                    <div className="overflow-x-auto">
                      <table className="table-base">
                        <thead>
                          <tr>
                            <th>Kode Rak</th>
                            <th>Perusahaan / PT</th>
                            <th>Keterangan</th>
                            <th className="text-right">Jumlah Produk</th>
                            <th>
                              <span className="sr-only">Aksi</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((r) => (
                            <tr key={r.id}>
                              <td className="font-medium text-slate-700">{r.kode_rak}</td>
                              <td>
                                <span className="inline-flex items-center rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 border border-violet-100">
                                  {r.nama_perusahaan || '-'}
                                </span>
                              </td>
                              <td>{r.keterangan || '-'}</td>
                              <td className="text-right">{formatNumber(r.jumlah_produk)}</td>
                              <td>
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditRack(r)}
                                    className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                    aria-label={`Edit ${r.kode_rak}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteRack(r)}
                                    className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                    aria-label={`Hapus ${r.kode_rak}`}
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
                      onPage={setRackPage}
                      totalItems={displayedRacks.length}
                      pageSize={rackPageSize}
                      onPageSize={(s) => {
                        setRackPageSize(s);
                        setRackPage(1);
                      }}
                      label="rak"
                    />
                  </>
                );
              })()
            )}
          </div>
        );
      })()}

      {/* --- Modal Produk --- */}
      {(() => {
        const activeProductTenantId = productForm.tenant_id || (user?.tenant_id ? String(user.tenant_id) : '1');
        const tenantCompany = tenants.find((t) => String(t.id) === String(activeProductTenantId));
        const activeCompanyName = tenantCompany?.nama_perusahaan || user?.tenant_name || 'PT Utama';
        const availableRacksForProduct = racks.filter(
          (r) => String(r.tenant_id) === String(activeProductTenantId)
        );

        return (
          <Modal
            isOpen={productModal}
            title={editingKode ? `Edit Produk ${editingKode}` : 'Tambah Produk Baru'}
            onClose={() => setProductModal(false)}
            maxWidth="max-w-3xl"
          >
            <form onSubmit={submitProduct} className="space-y-4">
              {/* Pilihan / Informasi PT Penginput */}
              {isSuperAdmin ? (
                <div>
                  <label className="label" htmlFor="prod_tenant_id">
                    Perusahaan / PT Pemilik Produk *
                  </label>
                  <SearchableSelect
                    id="prod_tenant_id"
                    value={String(activeProductTenantId)}
                    onChange={(val) => {
                      const newTenantId = val && val.target ? val.target.value : val;
                      const rackBelongs = racks.some(
                        (r) => String(r.tenant_id) === String(newTenantId) && String(r.id) === String(productForm.rack_id)
                      );
                      setProductForm((prev) => ({
                        ...prev,
                        tenant_id: newTenantId,
                        rack_id: rackBelongs ? prev.rack_id : '',
                      }));
                    }}
                    searchPlaceholder="Pilih atau cari PT..."
                    options={tenants.map((t) => ({
                      value: String(t.id),
                      label: t.nama_perusahaan,
                      sublabel: `Kode: ${t.kode_tenant || '-'} • Status: ${t.status || 'ACTIVE'}`,
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Pilihan rak di bawah akan otomatis menyesuaikan dengan rak milik PT yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-slate-500">Perusahaan / PT Penginput:</span>{' '}
                      <strong className="text-blue-900 font-semibold">{activeCompanyName}</strong>
                    </div>
                  </div>
                  <span className="rounded bg-blue-200/80 px-2 py-0.5 font-semibold text-[11px] text-blue-800">
                    PT Anda
                  </span>
                </div>
              )}

              {/* Kode Produk & Nama Produk dalam 2 Kolom */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="label flex items-center gap-1.5" htmlFor="kode_produk">
                    <span>Kode Produk *</span>
                    <HelpTooltip
                      title="Kode SKU Produk"
                      text="Kode unik identitas produk atau barcode fisik. Tidak boleh sama dengan produk lain."
                      example="PRD-001"
                    />
                  </label>
                  <input
                    id="kode_produk"
                    className="input font-mono font-semibold"
                    disabled={Boolean(editingKode)}
                    value={productForm.kode_produk}
                    onChange={(e) => setProductForm({ ...productForm, kode_produk: e.target.value })}
                    placeholder="Contoh: PRD-001"
                    required
                  />
                  {editingKode && (
                    <p className="mt-1 text-[11px] text-slate-500">Kode tidak dapat diubah.</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5" htmlFor="nama_produk">
                    <span>Nama Produk *</span>
                    <HelpTooltip
                      title="Nama Item Produk"
                      text="Nama lengkap barang beserta varian/merk agar mudah ditemukan saat transaksi."
                      example="Minyak Goreng 2L / Jarum Suntik 3ml"
                    />
                  </label>
                  <input
                    id="nama_produk"
                    className="input font-medium"
                    value={productForm.nama_produk}
                    onChange={(e) => setProductForm({ ...productForm, nama_produk: e.target.value })}
                    placeholder="Contoh: Jarum Suntik 3ml / Tepung Terigu Cakra"
                    required
                  />
                </div>
              </div>

              {/* Kategori Produk */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <label className="label text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Kategori Produk *
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {[
                    {
                      value: 'MATERIAL',
                      title: 'Material / Bahan Baku',
                      desc: 'Bahan mentah, komponen produksi, atau barang pendukung',
                      activeClass: 'border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-500',
                    },
                    {
                      value: 'BARANG_JADI',
                      title: 'Barang Jadi',
                      desc: 'Produk akhir siap jual / didistribusikan ke pelanggan',
                      activeClass: 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500',
                    },
                  ].map((opt) => {
                    const selected = (productForm.kategori_produk || 'BARANG_JADI') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setProductForm({ ...productForm, kategori_produk: opt.value })}
                        className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition ${
                          selected
                            ? opt.activeClass
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-bold">{opt.title}</span>
                          <span
                            className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                              selected ? 'border-current bg-current' : 'border-slate-300'
                            }`}
                          >
                            {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                        </div>
                        <span className="mt-0.5 text-[11px] opacity-80">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Satuan, Harga, Metode Stok, Lokasi Rak */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="label flex items-center gap-1.5" htmlFor="satuan">
                    <span>Satuan Dasar *</span>
                    <HelpTooltip
                      title="Satuan Terkecil"
                      text="Satuan unit fisik terendah yang disimpan dan dihitung di gudang."
                      example="PCS, KG, LTR, BTL"
                    />
                  </label>
                  <input
                    id="satuan"
                    className="input uppercase font-semibold"
                    value={productForm.satuan}
                    onChange={(e) => setProductForm({ ...productForm, satuan: e.target.value.toUpperCase() })}
                    placeholder="PCS / KG"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Unit terendah.</p>
                </div>
                <div>
                  <label className="label flex items-center gap-1.5" htmlFor="harga">
                    <span>Harga Jual (Rp) *</span>
                    <HelpTooltip
                      title="Harga Jual Satuan"
                      text="Harga jual dasar ke pelanggan sebelum potongan diskon atau PPN."
                      example="25000"
                    />
                  </label>
                  <input
                    id="harga"
                    type="number"
                    min="0"
                    step="any"
                    className="input font-semibold text-emerald-700"
                    value={productForm.harga}
                    onChange={(e) => setProductForm({ ...productForm, harga: e.target.value })}
                    placeholder="0"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Per unit dasar.</p>
                </div>
                <div>
                  <label className="label flex items-center gap-1.5" htmlFor="metode_stok">
                    <span>Metode Stok *</span>
                    <HelpTooltip
                      title="Metode Alur Stok"
                      text="FIFO: Barang masuk pertama dikeluarkan pertama. FEFO: Barang dengan expired date terdekat dikeluarkan pertama."
                    />
                  </label>
                  <select
                    id="metode_stok"
                    className="select font-semibold text-slate-700"
                    value={productForm.metode_stok || 'FIFO'}
                    onChange={(e) => setProductForm({ ...productForm, metode_stok: e.target.value })}
                  >
                    <option value="FIFO">FIFO (First In, First Out)</option>
                    <option value="FEFO">FEFO (First Expired, First Out)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {productForm.metode_stok === 'FEFO' ? 'Expired terdekat duluan' : 'Masuk terlama duluan'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0" htmlFor="rack_id">
                      Lokasi Rak
                    </label>
                  </div>
                  <SearchableSelect
                    id="rack_id"
                    value={productForm.rack_id}
                    onChange={(e) => setProductForm({ ...productForm, rack_id: e.target ? e.target.value : e })}
                    placeholder="-- Tanpa rak --"
                    searchPlaceholder={`Cari rak ${activeCompanyName}...`}
                    options={[
                      { value: '', label: '-- Tanpa rak --' },
                      ...availableRacksForProduct.map((r) => ({
                        value: String(r.id),
                        label: r.kode_rak,
                        sublabel: r.keterangan || undefined,
                      })),
                    ]}
                  />
                  {availableRacksForProduct.length === 0 ? (
                    <p className="mt-1 text-[11px] text-amber-600">
                      ⚠️ Belum ada rak ({activeCompanyName}).
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {availableRacksForProduct.length} rak tersedia.
                    </p>
                  )}
                </div>
              </div>

              {/* Seksi Izin Edar Alkes (AKD / AKL / Lainnya) */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-950">
                    Izin Edar Alat Kesehatan / Produk (Kemenkes RI)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <div>
                    <label className="label text-xs font-semibold text-slate-700" htmlFor="jenis_izin">
                      Jenis Izin Edar
                    </label>
                    <select
                      id="jenis_izin"
                      className="select bg-white text-xs font-medium text-slate-800"
                      value={productForm.jenis_izin || ''}
                      onChange={(e) => setProductForm({ ...productForm, jenis_izin: e.target.value })}
                    >
                      <option value="">-- Tanpa Izin Edar / Belum Ada --</option>
                      <option value="AKD">AKD (Alat Kesehatan Dalam Negeri)</option>
                      <option value="AKL">AKL (Alat Kesehatan Luar Negeri / Impor)</option>
                      <option value="LAINNYA">Lainnya (Isi Sendiri)</option>
                    </select>
                  </div>

                  {productForm.jenis_izin === 'LAINNYA' && (
                    <div>
                      <label className="label text-xs font-semibold text-slate-700" htmlFor="custom_jenis_izin">
                        Nama Jenis Izin *
                      </label>
                      <input
                        id="custom_jenis_izin"
                        className="input bg-white text-xs uppercase font-medium"
                        value={productForm.custom_jenis_izin || ''}
                        onChange={(e) => setProductForm({ ...productForm, custom_jenis_izin: e.target.value })}
                        placeholder="Contoh: PKRT / IZIN KHUSUS"
                        required={productForm.jenis_izin === 'LAINNYA'}
                      />
                    </div>
                  )}

                  <div className={productForm.jenis_izin === 'LAINNYA' ? 'sm:col-span-2 md:col-span-1' : 'sm:col-span-1 md:col-span-2'}>
                    <label className="label text-xs font-semibold text-slate-700" htmlFor="nomor_izin">
                      Nomor Izin Edar (AKD / AKL)
                    </label>
                    <input
                      id="nomor_izin"
                      className="input bg-white text-xs font-mono font-medium"
                      value={productForm.nomor_izin || ''}
                      onChange={(e) => setProductForm({ ...productForm, nomor_izin: e.target.value })}
                      placeholder="Contoh: KEMENKES RI AKD 21603910123"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi Konversi Satuan & Kemasan (Multi-Unit Packaging) */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                    Konversi Satuan 3 Parameter (1 Box = X Pack = Y Pcs)
                  </span>
                </div>
                <p className="text-xs text-indigo-700/90 leading-relaxed">
                  Tentukan satuan kemasan kardus/box dan rasio konversinya ke satuan dasar. Saat barcode kemasan discan di Barang Masuk, Qty otomatis terhitung.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <label className="label text-xs font-semibold text-slate-700" htmlFor="satuan_besar">
                      1. Satuan Besar (Luar)
                    </label>
                    <input
                      id="satuan_besar"
                      className="input bg-white text-xs uppercase"
                      value={productForm.satuan_besar}
                      onChange={(e) => setProductForm({ ...productForm, satuan_besar: e.target.value.toUpperCase() })}
                      placeholder="BOX / DUS / KARTON / BAL"
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-semibold text-slate-700" htmlFor="isi_box_pack">
                      Isi {productForm.satuan_menengah || 'PACK'} per {productForm.satuan_besar || 'BOX'} *
                    </label>
                    <input
                      id="isi_box_pack"
                      type="number"
                      min="1"
                      step="any"
                      className="input bg-white text-xs font-bold text-indigo-700"
                      value={productForm.isi_box_pack}
                      onChange={(e) => {
                        const val = e.target.value;
                        const bP = Number(val) || 1;
                        const pP = Number(productForm.isi_pack_pcs) || 1;
                        setProductForm({ 
                          ...productForm, 
                          isi_box_pack: val, 
                          isi_box_pcs: String(bP * pP),
                          isi_per_kemasan: String(bP * pP)
                        });
                      }}
                      placeholder="Contoh: 10"
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-semibold text-slate-700" htmlFor="satuan_menengah">
                      2. Satuan Menengah
                    </label>
                    <input
                      id="satuan_menengah"
                      className="input bg-white text-xs uppercase"
                      value={productForm.satuan_menengah}
                      onChange={(e) => setProductForm({ ...productForm, satuan_menengah: e.target.value.toUpperCase() })}
                      placeholder="PACK / STRIP / RENCENG"
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-semibold text-slate-700" htmlFor="isi_pack_pcs">
                      Isi {productForm.satuan || 'PCS'} per {productForm.satuan_menengah || 'PACK'} *
                    </label>
                    <input
                      id="isi_pack_pcs"
                      type="number"
                      min="1"
                      step="any"
                      className="input bg-white text-xs font-bold text-indigo-700"
                      value={productForm.isi_pack_pcs}
                      onChange={(e) => {
                        const val = e.target.value;
                        const pP = Number(val) || 1;
                        const bP = Number(productForm.isi_box_pack) || 1;
                        setProductForm({ 
                          ...productForm, 
                          isi_pack_pcs: val, 
                          isi_box_pcs: String(bP * pP),
                          isi_per_kemasan: String(bP * pP)
                        });
                      }}
                      placeholder="Contoh: 20"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="label text-xs font-semibold text-slate-700" htmlFor="barcode_kemasan">
                      Barcode Kemasan / Box (Opsional)
                    </label>
                    <input
                      id="barcode_kemasan"
                      className="input bg-white text-xs font-mono"
                      value={productForm.barcode_kemasan}
                      onChange={(e) => setProductForm({ ...productForm, barcode_kemasan: e.target.value })}
                      placeholder="Barcode pada dus luar..."
                    />
                  </div>

                  <div className="flex items-end">
                    {(() => {
                      const bP = Number(productForm.isi_box_pack) > 0 ? Number(productForm.isi_box_pack) : 1;
                      const pP = Number(productForm.isi_pack_pcs) > 0 ? Number(productForm.isi_pack_pcs) : 1;
                      const totalPcs = bP * pP;
                      return (
                        <div className="w-full rounded-lg bg-white border border-indigo-200 p-2.5 text-xs text-indigo-950 flex flex-col justify-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Rumus Satuan Terpasang:</span>
                          <span className="font-bold text-sm text-indigo-700 mt-0.5">
                            1 {productForm.satuan_besar || 'BOX'} = {bP} {productForm.satuan_menengah || 'PACK'} = {totalPcs.toLocaleString('id-ID')} {productForm.satuan || 'PCS'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setProductModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingKode ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* --- Modal Rak --- */}
      {(() => {
        const activeRackTenantId = rackForm.tenant_id || (user?.tenant_id ? String(user.tenant_id) : '1');
        const tenantCompany = tenants.find((t) => String(t.id) === String(activeRackTenantId));
        const activeCompanyName = tenantCompany?.nama_perusahaan || user?.tenant_name || 'PT Utama';

        return (
          <Modal
            isOpen={rackModal}
            title={editingRackId ? 'Edit Rak' : 'Tambah Rak'}
            onClose={() => setRackModal(false)}
          >
            <form onSubmit={submitRack} className="space-y-4">
              {isSuperAdmin ? (
                <div>
                  <label className="label" htmlFor="rack_tenant_id">
                    Perusahaan / PT Pemilik Rak *
                  </label>
                  <SearchableSelect
                    id="rack_tenant_id"
                    value={String(activeRackTenantId)}
                    onChange={(val) => setRackForm({ ...rackForm, tenant_id: val.target ? val.target.value : val })}
                    searchPlaceholder="Pilih PT untuk rak ini..."
                    options={tenants.map((t) => ({
                      value: String(t.id),
                      label: t.nama_perusahaan,
                      sublabel: `Kode: ${t.kode_tenant || '-'}`,
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Rak ini akan terdaftar khusus untuk PT yang dipilih.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/70 px-3.5 py-2.5 text-xs text-violet-900">
                  <Building2 className="h-4 w-4 text-violet-600 shrink-0" />
                  <div>
                    <span className="text-slate-500">Perusahaan / PT Pemilik Rak:</span>{' '}
                    <strong className="text-violet-950 font-semibold">{activeCompanyName}</strong>
                  </div>
                </div>
              )}
              <div>
                <label className="label" htmlFor="kode_rak">
                  Kode Rak *
                </label>
                <input
                  id="kode_rak"
                  className="input"
                  value={rackForm.kode_rak}
                  onChange={(e) => setRackForm({ ...rackForm, kode_rak: e.target.value })}
                  placeholder="Contoh: RACK-A1"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="ket-rak">
                  Keterangan
                </label>
                <textarea
                  id="ket-rak"
                  rows="3"
                  className="input"
                  value={rackForm.keterangan}
                  onChange={(e) => setRackForm({ ...rackForm, keterangan: e.target.value })}
                  placeholder="Lokasi fisik rak (opsional)"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setRackModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingRackId ? 'Simpan Perubahan' : 'Tambah Rak'}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* --- Modal Ubah Harga Cepat --- */}
      <Modal
        isOpen={priceModal}
        title={`Ubah Harga - ${priceProduct?.kode_produk || ''}`}
        onClose={() => setPriceModal(false)}
      >
        <form onSubmit={submitQuickPrice} className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-800">{priceProduct?.nama_produk}</div>
            <div className="mt-1 text-xs text-slate-500">
              Satuan: <span className="font-semibold text-slate-700">{priceProduct?.satuan}</span> • Harga saat ini:{' '}
              <span className="font-semibold text-slate-700">{formatRupiah(priceProduct?.harga)}</span>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="quick_harga">
              Harga Baru (Rp) *
            </label>
            <input
              id="quick_harga"
              type="number"
              min="0"
              step="any"
              className="input text-lg font-semibold"
              value={quickHarga}
              onChange={(e) => setQuickHarga(e.target.value)}
              placeholder="0"
              required
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setPriceModal(false)} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={savingPrice} className="btn-primary">
              {savingPrice && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Harga
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

