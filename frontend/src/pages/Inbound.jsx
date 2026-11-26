import { useEffect, useRef, useState } from 'react';
import {
  ScanBarcode,
  PackagePlus,
  Loader2,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Building,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  FileText,
  Warehouse,
  Barcode,
  Clock,
  Package,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getErrorMessage, formatNumber, formatDateTime, formatDate, formatRupiah } from '../services/api.js';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

const getCurrentShift = () => {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return '1'; // Shift 1 (Pagi 07:00 - 15:00)
  if (hour >= 15 && hour < 23) return '2'; // Shift 2 (Siang 15:00 - 23:00)
  return '3'; // Shift 3 (Malam 23:00 - 07:00)
};

const getInitialDates = () => {
  const today = new Date();
  const exp = new Date();
  exp.setFullYear(today.getFullYear() + 2);
  return {
    prod: today.toISOString().split('T')[0],
    exp: exp.toISOString().split('T')[0],
  };
};

const initialDates = getInitialDates();

const emptyForm = {
  warehouse_id: '',
  nomor_lot: '',
  tanggal_produksi: initialDates.prod,
  expired_date: initialDates.exp,
  shift: getCurrentShift(),
  status: 'AVAILABLE',
  qty: '',
  referensi: '',
  keterangan: '',
  purchase_order_id: '',
};

export default function Inbound() {
  const { user } = useAuth();
  const isRestrictedAdminGudang =
    ['ADMIN_GUDANG', 'WAREHOUSE'].includes((user?.role || '').toUpperCase()) &&
    Boolean(user?.warehouse_id);
  const assignedWarehouseId = isRestrictedAdminGudang ? String(user.warehouse_id) : null;

  const [scanValue, setScanValue] = useState('');
  const [product, setProduct] = useState(null);
  const [existingLot, setExistingLot] = useState(null);
  const [kemasanCount, setKemasanCount] = useState('1');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Master Data
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [pos, setPos] = useState([]);
  const [selectedPoData, setSelectedPoData] = useState(null);
  const [recent, setRecent] = useState([]);
  const lotInputRef = useRef(null);

  const loadData = async () => {
    try {
      const [trxRes, poRes, whRes, prodRes] = await Promise.all([
        api.get('/transactions', { params: { type: 'MASUK', limit: 10 } }),
        api.get('/purchase-orders'),
        api.get('/warehouses'),
        api.get('/products'),
      ]);
      setRecent(trxRes.data.data || []);
      setPos((poRes.data.data || []).filter((p) => p.status !== 'CANCELLED'));
      const whs = whRes.data.data || [];
      setWarehouses(whs);
      if (assignedWarehouseId) {
        setForm((f) => ({ ...f, warehouse_id: assignedWarehouseId }));
      } else if (whs.length > 0 && !form.warehouse_id) {
        setForm((f) => ({ ...f, warehouse_id: String(whs[0].id) }));
      }
      setProducts(prodRes.data.data || []);
    } catch (_) {
      /* ignore */
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Ambil detail PO saat dipilih
  const handlePoChange = async (poId) => {
    const pId = poId ? String(poId) : '';
    setForm((f) => ({
      ...f,
      purchase_order_id: pId,
      shift: getCurrentShift(),
    }));
    if (!pId) {
      setSelectedPoData(null);
      return;
    }
    try {
      const { data } = await api.get(`/purchase-orders/${pId}`);
      setSelectedPoData(data.data);
      if (data.data?.no_po) {
        setForm((f) => ({ ...f, referensi: data.data.no_po }));
      }
    } catch (_) {
      setSelectedPoData(null);
    }
  };

  // Pilih barang dari tabel PO
  const selectItemFromPo = (poItem) => {
    const prod = products.find((p) => p.kode_produk === poItem.kode_produk);
    const targetProd = prod || {
      id: poItem.product_id,
      kode_produk: poItem.kode_produk,
      nama_produk: poItem.nama_produk,
      satuan: poItem.satuan || 'pcs',
      satuan_besar: 'BOX',
      isi_per_kemasan: 1,
      total_stok: 0,
      kode_rak: '-',
      harga_beli: poItem.harga_satuan || 0,
    };

    setProduct(targetProd);
    setExistingLot(null);
    const remainingQty = Math.max(0, Number(poItem.qty_pesan) - Number(poItem.qty_diterima || 0));
    generateLotNumber(targetProd.kode_produk);
    const isi = Number(targetProd.isi_per_kemasan) || 1;
    const finalQty = remainingQty > 0 ? remainingQty : isi;
    const initialKemasan = isi > 1 ? (finalQty / isi).toFixed(2).replace(/\.00$/, '') : '1';
    setKemasanCount(initialKemasan);
    setForm((f) => ({
      ...f,
      qty: finalQty,
      referensi: selectedPoData?.no_po || f.referensi,
    }));
    toastSuccess(`Barang PO dipilih: ${targetProd.nama_produk}`);
  };

  // Pemilihan produk via Dropdown langsung
  const handleProductSelect = (kodeProduk) => {
    if (!kodeProduk) {
      setProduct(null);
      setExistingLot(null);
      setKemasanCount('1');
      return;
    }
    const found = products.find((p) => p.kode_produk === kodeProduk);
    if (found) {
      setProduct(found);
      setExistingLot(null);
      generateLotNumber(found.kode_produk);
      const isi = Number(found.isi_per_kemasan) || 1;
      setKemasanCount('1');
      setForm((f) => ({ ...f, qty: isi > 1 ? isi : (f.qty || 1) }));
    }
  };

  // Scan Barcode (bisa scan barcode produk, barcode kemasan/box, atau lot)
  // Scan Barcode (bisa scan barcode produk, barcode kemasan/box, atau lot)
  const handleScan = async () => {
    const code = scanValue.trim();
    if (!code) return;
    setScanning(true);
    setError('');
    setSuccess('');

    const isLikelyLot = /^LOT/i.test(code);

    if (isLikelyLot) {
      try {
        const res = await api.get(`/lots/${encodeURIComponent(code)}`, {
          params: { warehouse_id: assignedWarehouseId || form.warehouse_id || undefined },
        });
        const lot = res.data.data;
        if (assignedWarehouseId && lot.warehouse_id && String(lot.warehouse_id) !== assignedWarehouseId) {
          setError(`Lot "${lot.nomor_lot}" terdaftar di gudang lain. Anda hanya boleh menginput barang masuk di gudang tugas Anda.`);
          setScanning(false);
          setScanValue('');
          return;
        }
        const isi = Number(lot.isi_per_kemasan) || 1;
        const prodData = {
          id: lot.product_id,
          kode_produk: lot.kode_produk,
          nama_produk: lot.nama_produk,
          satuan: lot.satuan,
          satuan_besar: lot.satuan_besar || 'BOX',
          isi_per_kemasan: isi,
          total_stok: lot.stok_qty,
          kode_rak: lot.kode_rak,
          harga_beli: lot.harga_beli || 0,
        };

        if (product && product.kode_produk === lot.kode_produk && form.nomor_lot === lot.nomor_lot) {
          const currentKemasan = Number(kemasanCount) || 1;
          const nextKemasan = currentKemasan + 1;
          const nextQty = Math.round(nextKemasan * isi * 100) / 100;
          setKemasanCount(String(nextKemasan));
          setForm((f) => ({ ...f, qty: nextQty }));
          toastSuccess(`📦 +1 ${lot.satuan_besar || 'BOX'} pada Lot ${lot.nomor_lot} (${nextKemasan} ${lot.satuan_besar || 'BOX'} = ${nextQty} ${lot.satuan})`);
        } else {
          setProduct(prodData);
          setExistingLot(lot);
          setKemasanCount('1');
          setForm((f) => ({
            ...f,
            nomor_lot: lot.nomor_lot,
            warehouse_id: lot.warehouse_id ? String(lot.warehouse_id) : f.warehouse_id,
            tanggal_produksi: lot.tanggal_produksi || f.tanggal_produksi,
            expired_date: lot.expired_date || f.expired_date,
            shift: String(lot.shift || 1),
            status: lot.status || 'AVAILABLE',
            qty: isi,
          }));
          toastSuccess(`Lot terdaftar: ${lot.nomor_lot}`);
        }
        setScanning(false);
        setScanValue('');
        return;
      } catch (_) {
        /* Lanjut coba produk */
      }
    }

    try {
      // Coba sebagai kode produk atau barcode kemasan
      const res = await api.get(`/products/${encodeURIComponent(code)}`);
      const prod = res.data.data;
      const isi = Number(prod.isi_per_kemasan) || 1;

      if (product && product.kode_produk === prod.kode_produk) {
        const currentKemasan = Number(kemasanCount) || 1;
        const nextKemasan = currentKemasan + 1;
        const nextQty = Math.round(nextKemasan * isi * 100) / 100;
        setKemasanCount(String(nextKemasan));
        setForm((f) => ({ ...f, qty: nextQty }));
        toastSuccess(`📦 +1 ${prod.satuan_besar || 'BOX'} (${nextKemasan} ${prod.satuan_besar || 'BOX'} = ${nextQty} ${prod.satuan})`);
      } else {
        setProduct(prod);
        setExistingLot(null);
        generateLotNumber(prod.kode_produk);
        setKemasanCount('1');
        const defaultQty = isi > 1 ? isi : 1;
        setForm((f) => ({ ...f, qty: defaultQty }));
        if (prod.is_scanned_kemasan || isi > 1) {
          toastSuccess(`📦 Kemasan ${prod.satuan_besar || 'BOX'} terdeteksi: 1 ${prod.satuan_besar || 'BOX'} = ${isi} ${prod.satuan} (Qty Otomatis: ${isi} ${prod.satuan})`);
        } else {
          toastSuccess(`Produk terdeteksi: ${prod.nama_produk}`);
        }
      }
    } catch (_) {
      try {
        const res = await api.get(`/lots/${encodeURIComponent(code)}`, {
          params: { warehouse_id: assignedWarehouseId || form.warehouse_id || undefined },
        });
        const lot = res.data.data;
        if (assignedWarehouseId && lot.warehouse_id && String(lot.warehouse_id) !== assignedWarehouseId) {
          setError(`Lot "${lot.nomor_lot}" terdaftar di gudang lain. Anda hanya boleh menginput barang masuk di gudang tugas Anda.`);
          setScanning(false);
          setScanValue('');
          return;
        }
        const isi = Number(lot.isi_per_kemasan) || 1;
        const prodData = {
          id: lot.product_id,
          kode_produk: lot.kode_produk,
          nama_produk: lot.nama_produk,
          satuan: lot.satuan,
          satuan_besar: lot.satuan_besar || 'BOX',
          isi_per_kemasan: isi,
          total_stok: lot.stok_qty,
          kode_rak: lot.kode_rak,
          harga_beli: lot.harga_beli || 0,
        };

        if (product && product.kode_produk === lot.kode_produk && form.nomor_lot === lot.nomor_lot) {
          const currentKemasan = Number(kemasanCount) || 1;
          const nextKemasan = currentKemasan + 1;
          const nextQty = Math.round(nextKemasan * isi * 100) / 100;
          setKemasanCount(String(nextKemasan));
          setForm((f) => ({ ...f, qty: nextQty }));
          toastSuccess(`📦 +1 ${lot.satuan_besar || 'BOX'} pada Lot ${lot.nomor_lot} (${nextKemasan} ${lot.satuan_besar || 'BOX'} = ${nextQty} ${lot.satuan})`);
        } else {
          setProduct(prodData);
          setExistingLot(lot);
          setKemasanCount('1');
          setForm((f) => ({
            ...f,
            nomor_lot: lot.nomor_lot,
            warehouse_id: lot.warehouse_id ? String(lot.warehouse_id) : f.warehouse_id,
            tanggal_produksi: lot.tanggal_produksi || f.tanggal_produksi,
            expired_date: lot.expired_date || f.expired_date,
            shift: String(lot.shift || 1),
            status: lot.status || 'AVAILABLE',
            qty: isi,
          }));
          if (isi > 1) {
            toastSuccess(`📦 Lot & Kemasan ${lot.satuan_besar || 'BOX'} terdeteksi: 1 ${lot.satuan_besar || 'BOX'} = ${isi} ${lot.satuan} (Qty Otomatis: ${isi} ${lot.satuan})`);
          } else {
            toastSuccess(`Lot terdaftar: ${lot.nomor_lot}`);
          }
        }
      } catch (errLot) {
        setProduct(null);
        setExistingLot(null);
        setError(`Barcode "${code}" tidak ditemukan sebagai produk, kemasan box, maupun lot.`);
      }
    } finally {
      setScanning(false);
      setScanValue('');
    }
  };

  // Generate Nomor Lot Otomatis
  const generateLotNumber = (kd = '') => {
    const prefix = kd ? kd.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) : 'LOT';
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const generated = `${prefix}-${dateStr}-${rand}`;
    setForm((f) => ({ ...f, nomor_lot: generated }));
  };

  // Cek apakah nomor lot sudah ada di sistem
  const checkLot = async () => {
    const nomor = form.nomor_lot.trim();
    if (!nomor || !product) {
      setExistingLot(null);
      return;
    }
    try {
      const { data } = await api.get(`/lots/${encodeURIComponent(nomor)}`, {
        params: { warehouse_id: assignedWarehouseId || form.warehouse_id || undefined },
      });
      const lot = data.data;
      if (lot.kode_produk !== product.kode_produk) {
        setError(`Lot "${nomor}" telah terdaftar untuk produk lain (${lot.kode_produk} - ${lot.nama_produk}). Gunakan nomor lot unik.`);
        setExistingLot(null);
      } else if (assignedWarehouseId && lot.warehouse_id && String(lot.warehouse_id) !== assignedWarehouseId) {
        setError(`Lot "${nomor}" berada di gudang lain. Anda hanya boleh memproses lot di gudang tugas Anda.`);
        setExistingLot(null);
      } else {
        setError('');
        setExistingLot(lot);
        if (!assignedWarehouseId && lot.warehouse_id) {
          setForm((f) => ({ ...f, warehouse_id: String(lot.warehouse_id) }));
        }
      }
    } catch (_) {
      setExistingLot(null); // lot baru
    }
  };

  // Submit Penerimaan Barang
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product) {
      setError('Silakan scan barcode produk atau pilih produk dari dropdown terlebih dahulu.');
      return;
    }
    if (!form.warehouse_id) {
      setError('Silakan pilih gudang tujuan penerimaan barang.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        kode_produk: product.kode_produk,
        nomor_lot: form.nomor_lot.trim(),
        warehouse_id: Number(form.warehouse_id),
        qty: Number(form.qty),
        referensi: form.referensi.trim() || null,
        keterangan: form.keterangan.trim() || null,
        purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : null,
      };

      if (!existingLot) {
        payload.tanggal_produksi = form.tanggal_produksi;
        payload.expired_date = form.expired_date;
        payload.shift = Number(form.shift);
        payload.status = form.status;
      }

      const { data } = await api.post('/transactions/inbound', payload);
      const whName = warehouses.find((w) => String(w.id) === String(form.warehouse_id))?.nama_gudang || 'Gudang';
      setSuccess(
        `${data.message} — stok lot ${data.data.nomor_lot} di ${whName} menjadi ${formatNumber(data.data.stok_baru)}`
      );
      toastSuccess(`Barang Masuk Berhasil: ${data.data.nomor_lot} (${payload.qty} ${product.satuan || 'pcs'})`);

      // Reset form item tapi pertahankan gudang & PO jika ada
      setForm((f) => ({
        ...emptyForm,
        warehouse_id: f.warehouse_id,
        purchase_order_id: f.purchase_order_id,
        referensi: f.referensi,
      }));
      setProduct(null);
      setExistingLot(null);
      setKemasanCount('1');
      loadData();
      if (form.purchase_order_id) {
        handlePoChange(form.purchase_order_id);
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Barang Masuk', msg);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setScanValue('');
    setProduct(null);
    setExistingLot(null);
    setSelectedPoData(null);
    setKemasanCount('1');
    setForm({
      ...emptyForm,
      warehouse_id: assignedWarehouseId || (warehouses[0] ? String(warehouses[0].id) : ''),
    });
    setError('');
    setSuccess('');
  };

  const hasPo = Boolean(form.purchase_order_id);

  return (
    <div className="space-y-6">
      {/* Banner Notifikasi */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid Utama */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Kolom Kiri: Form Penerimaan Barang */}
        <form onSubmit={handleSubmit} className="card xl:col-span-2 shadow-sm rounded-xl border border-slate-200">
          <div className="card-header bg-slate-50/60 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-indigo-600" />
                Penerimaan Barang Masuk (Inbound Logistics)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan barcode atau pilih produk, catat nomor lot, tanggal kedaluwarsa, dan gudang penyimpanan.
              </p>
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Form
            </button>
          </div>

          <div className="space-y-5 p-5">
            {/* Bagian 1: Pilih Gudang & Hubungkan ke PO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Gudang Tujuan Masuk <span className="text-red-500">*</span>
                </label>
                {isRestrictedAdminGudang ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                    <span>
                      {warehouses.find((w) => String(w.id) === assignedWarehouseId)
                        ? `${warehouses.find((w) => String(w.id) === assignedWarehouseId).nama_gudang} (${warehouses.find((w) => String(w.id) === assignedWarehouseId).kode_gudang})`
                        : user?.nama_gudang || 'Gudang Tugas Anda'}
                    </span>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      Gudang Anda
                    </span>
                  </div>
                ) : (
                  <SearchableSelect
                    value={form.warehouse_id}
                    onChange={(e) => setForm({ ...form, warehouse_id: e.target ? e.target.value : e })}
                    placeholder="Pilih Gudang Penerimaan..."
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nama_gudang} ({w.kode_gudang})
                      </option>
                    ))}
                  </SearchableSelect>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Referensi Purchase Order (PO)
                </label>
                <SearchableSelect
                  value={form.purchase_order_id}
                  onChange={(e) => handlePoChange(e.target ? e.target.value : e)}
                  placeholder="-- Penerimaan Tanpa PO (Manual) --"
                >
                  <option value="">-- Penerimaan Tanpa PO (Manual) --</option>
                  {pos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.no_po} &mdash; {p.nama_supplier} ({p.status})
                    </option>
                  ))}
                </SearchableSelect>
              </div>
            </div>

            {/* Banner PO Terpilih dengan Tombol Quick Pick */}
            {selectedPoData && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-bold text-indigo-900">
                      Rincian Dokumen PO: {selectedPoData.no_po} ({selectedPoData.nama_supplier})
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    Status: {selectedPoData.status}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead>
                      <tr className="border-b border-indigo-200 font-semibold text-slate-600">
                        <th className="py-1.5 px-2">Produk</th>
                        <th className="py-1.5 px-2 text-center">Dipesan</th>
                        <th className="py-1.5 px-2 text-center">Telah Masuk</th>
                        <th className="py-1.5 px-2 text-center">Sisa</th>
                        <th className="py-1.5 px-2 text-center">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100">
                      {(selectedPoData.details || selectedPoData.items || []).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-4 text-center text-slate-400 text-xs">
                            Tidak ada rincian barang dalam dokumen PO ini.
                          </td>
                        </tr>
                      ) : (
                        (selectedPoData.details || selectedPoData.items || []).map((it, idx) => {
                          const sisa = Math.max(0, Number(it.qty_pesan) - Number(it.qty_diterima || 0));
                          return (
                            <tr key={idx} className="hover:bg-indigo-100/40">
                              <td className="py-2 px-2">
                                <span className="font-semibold text-slate-800">{it.nama_produk}</span>
                                <span className="text-[11px] text-slate-500 block">{it.kode_produk}</span>
                              </td>
                              <td className="py-2 px-2 text-center font-medium">{it.qty_pesan}</td>
                              <td className="py-2 px-2 text-center font-medium text-emerald-700">{it.qty_diterima || 0}</td>
                              <td className="py-2 px-2 text-center font-bold text-indigo-700">{sisa}</td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => selectItemFromPo(it)}
                                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-sm transition"
                                >
                                  Terima Item Ini
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bagian 2: Scan Barcode ATAU Pilih Produk dari Dropdown */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Identifikasi Barang (Scan Barcode atau Pilih Produk) <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Barcode Scanner */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                      placeholder="Scan barcode produk / lot..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={scanning || !scanValue.trim()}
                    className="px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan'}
                  </button>
                </div>

                {/* 2. Dropdown Selector */}
                <div>
                  <SearchableSelect
                    value={product?.kode_produk || ''}
                    onChange={(e) => handleProductSelect(e.target ? e.target.value : e)}
                    placeholder="Atau cari nama / kode produk..."
                  >
                    <option value="">-- Pilih Produk Manual --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.kode_produk}>
                        {p.kode_produk} &mdash; {p.nama_produk} ({p.satuan || 'pcs'})
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              </div>
            </div>

            {/* Info Produk Aktif */}
            {product && (
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-blue-200 bg-blue-50/70">
                <div>
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Produk Terpilih:</span>
                  <p className="text-base font-bold text-blue-900">{product.nama_produk}</p>
                  <p className="text-xs text-blue-700 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>Kode: <strong>{product.kode_produk}</strong></span>
                    <span>&bull;</span>
                    <span>Satuan: <strong>{product.satuan || 'pcs'}</strong></span>
                    <span>&bull;</span>
                    <span>Lokasi Rak: <strong>{product.kode_rak || '-'}</strong></span>
                    {Number(product.isi_per_kemasan) > 1 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded text-[11px] ml-1">
                        <Package className="w-3 h-3 text-indigo-600" />
                        1 {product.satuan_besar || 'BOX'} = {formatNumber(product.isi_per_kemasan)} {product.satuan}
                        {product.barcode_kemasan && ` (Barcode Box: ${product.barcode_kemasan})`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-blue-600 block">Total Stok Sistem:</span>
                    <span className="text-lg font-extrabold text-blue-900">{formatNumber(product.total_stok || 0)} {product.satuan || 'pcs'}</span>
                  </div>
                  {existingLot ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Lot Terdaftar (Stok: {existingLot.stok_qty})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      <Sparkles className="w-3.5 h-3.5" />
                      Batch / Lot Baru
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Bagian 3: Detail Batch, Lot, Expired Date & Jumlah */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Parameter Batch, Fisik & Mutu Barang
                </span>
                {hasPo && (
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Shift Otomatis: <strong>Shift {form.shift}</strong> (Mengikuti Jam Sistem)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Nomor Lot */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Nomor Lot / Batch <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => generateLotNumber(product?.kode_produk)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto No. Lot
                    </button>
                  </div>
                  <input
                    ref={lotInputRef}
                    type="text"
                    required
                    placeholder="Misal: LOT-MED-2026-001"
                    value={form.nomor_lot}
                    onChange={(e) => setForm({ ...form, nomor_lot: e.target.value })}
                    onBlur={checkLot}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* 2. Tanggal Produksi */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tanggal Produksi {!existingLot && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="date"
                    required={!existingLot}
                    disabled={Boolean(existingLot)}
                    value={form.tanggal_produksi}
                    onChange={(e) => setForm({ ...form, tanggal_produksi: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                </div>

                {/* 3. Tanggal Kedaluwarsa (Expired Date) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tanggal Kedaluwarsa (Exp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required={!existingLot}
                    disabled={Boolean(existingLot)}
                    value={form.expired_date}
                    onChange={(e) => setForm({ ...form, expired_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                </div>

                {/* 4. Qty Masuk */}
                <div className={product && Number(product.isi_per_kemasan) > 1 ? 'sm:col-span-2 lg:col-span-2' : ''}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Kuantitas (Qty) Masuk <span className="text-red-500">*</span>
                    </label>
                    {product && Number(product.isi_per_kemasan) > 1 && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        <Package className="w-3 h-3 text-emerald-600" />
                        1 {product.satuan_besar || 'BOX'} = {formatNumber(product.isi_per_kemasan)} {product.satuan || 'PCS'}
                      </span>
                    )}
                  </div>

                  {product && Number(product.isi_per_kemasan) > 1 ? (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-indigo-900 mb-1">
                            Jumlah Kemasan ({product.satuan_besar || 'BOX'})
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              placeholder="1"
                              value={kemasanCount}
                              onChange={(e) => {
                                const kVal = e.target.value;
                                setKemasanCount(kVal);
                                const num = parseFloat(kVal);
                                if (!isNaN(num) && num > 0) {
                                  const calculatedQty = Math.round(num * Number(product.isi_per_kemasan) * 100) / 100;
                                  setForm((f) => ({ ...f, qty: calculatedQty }));
                                }
                              }}
                              className="w-full px-3 py-2 pr-14 text-sm font-bold text-indigo-900 border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 pointer-events-none">
                              {product.satuan_besar || 'BOX'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 mb-1">
                            Total Qty Masuk ({product.satuan || 'PCS'}) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              required
                              placeholder="0"
                              value={form.qty}
                              onChange={(e) => {
                                const qVal = e.target.value;
                                setForm((f) => ({ ...f, qty: qVal }));
                                const num = parseFloat(qVal);
                                if (!isNaN(num) && num > 0) {
                                  const kVal = (num / Number(product.isi_per_kemasan)).toFixed(2).replace(/\.00$/, '');
                                  setKemasanCount(kVal);
                                }
                              }}
                              className="w-full px-3 py-2 pr-14 text-sm font-extrabold text-emerald-700 border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 pointer-events-none">
                              {product.satuan || 'PCS'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-indigo-900 bg-white/90 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-2xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Package className="w-3.5 h-3.5 text-indigo-600" />
                          Kalkulasi: <strong>{kemasanCount || 0} {product.satuan_besar || 'BOX'} &times; {product.isi_per_kemasan} {product.satuan}</strong>
                        </span>
                        <span className="font-extrabold text-emerald-700">
                          = {formatNumber(form.qty || 0)} {product.satuan || 'PCS'} masuk ke stok
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        placeholder="0"
                        value={form.qty}
                        onChange={(e) => setForm({ ...form, qty: e.target.value })}
                        className="w-full px-3 py-2 pr-14 text-sm border border-slate-300 rounded-lg font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {product?.satuan && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          {product.satuan}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Shift Penerimaan (Hanya tampil jika Manual / Tanpa PO) */}
                {!hasPo && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Shift Penerimaan
                    </label>
                    <SearchableSelect
                      value={form.shift}
                      disabled={Boolean(existingLot)}
                      onChange={(e) => setForm({ ...form, shift: e.target ? e.target.value : e })}
                    >
                      <option value="1">Shift 1 (Pagi 07:00 - 15:00)</option>
                      <option value="2">Shift 2 (Siang 15:00 - 23:00)</option>
                      <option value="3">Shift 3 (Malam 23:00 - 07:00)</option>
                    </SearchableSelect>
                  </div>
                )}

                {/* 6. Status Mutu / Karantina */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Status Mutu / Karantina
                  </label>
                  <SearchableSelect
                    value={form.status}
                    disabled={Boolean(existingLot)}
                    onChange={(e) => setForm({ ...form, status: e.target ? e.target.value : e })}
                  >
                    <option value="AVAILABLE">Lolos QC (AVAILABLE - Siap Kirim)</option>
                    <option value="QUARANTINE">Karantina QC (QUARANTINE - Uji Lab)</option>
                  </SearchableSelect>
                </div>

                {/* 7. No. Surat Jalan Supplier (Saat ada PO diletakkan di baris 2 agar grid pas 3 kolom) */}
                {hasPo && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      No. Surat Jalan Supplier / No Referensi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: SJ-SUP-2026-99"
                      value={form.referensi}
                      onChange={(e) => setForm({ ...form, referensi: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Catatan & Referensi Dokumen Tambahan */}
              {hasPo ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Catatan Tambahan (Kondisi Kemasan, Suhu Chiller, dll)
                  </label>
                  <input
                    type="text"
                    placeholder="Kondisi kemasan baik, segel utuh, suhu chiller normal..."
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      No. Surat Jalan Supplier / No Referensi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: SJ-SUP-2026-99"
                      value={form.referensi}
                      onChange={(e) => setForm({ ...form, referensi: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Catatan Tambahan (Kondisi Kemasan, Suhu, dll)
                    </label>
                    <input
                      type="text"
                      placeholder="Kondisi kemasan baik, segel utuh, suhu chiller normal..."
                      value={form.keterangan}
                      onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Simpan */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-md transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
                {saving ? 'Menyimpan Transaksi...' : 'Konfirmasi & Simpan Barang Masuk'}
              </button>
            </div>
          </div>
        </form>

        {/* Kolom Kanan: Riwayat 10 Masuk Terakhir */}
        <div className="card shadow-sm rounded-xl border border-slate-200 flex flex-col h-full">
          <div className="card-header bg-slate-50/60 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Barcode className="w-4 h-4 text-slate-600" />
                Riwayat Penerimaan Terakhir
              </h2>
              <p className="text-xs text-slate-500">10 transaksi barang masuk terkini di sistem ERP.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const headers = ['Kode Transaksi', 'Tanggal', 'Gudang', 'PO', 'No Ref / SJ', 'Produk & Lot', 'Qty Masuk'];
                const rows = [];
                recent.forEach((trx) => {
                  (trx.details || []).forEach((d) => {
                    rows.push([
                      trx.kode_transaksi || '',
                      formatDateTime(trx.tanggal_transaksi),
                      trx.nama_gudang || 'Pusat',
                      trx.no_po || '',
                      trx.referensi || '',
                      `${d.nama_produk || d.kode_produk} (Lot: ${d.nomor_lot})`,
                      `${d.qty} ${d.satuan || ''}`,
                    ]);
                  });
                });
                exportToExcel('Riwayat_Inbound_Penerimaan', headers, rows);
              }}
              className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-xs"
              title="Export Riwayat Inbound ke Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Excel
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[38rem]">
            {recent.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Belum ada transaksi barang masuk hari ini.
              </div>
            ) : (
              recent.map((trx) => (
                <div key={trx.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 font-mono">{trx.kode_transaksi}</span>
                    <span className="text-slate-400">{formatDateTime(trx.tanggal_transaksi)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                      Gudang: {trx.nama_gudang || 'Pusat'}
                    </span>
                    {trx.no_po && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                        PO: {trx.no_po}
                      </span>
                    )}
                    {trx.referensi && (
                      <span className="text-slate-500">Ref: {trx.referensi}</span>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-1.5 space-y-1">
                    {(trx.details || []).map((d, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-700">
                        <span>
                          <strong>{d.nama_produk || d.kode_produk}</strong> ({d.nomor_lot})
                        </span>
                        <span className="font-bold text-indigo-700">
                          +{formatNumber(d.qty)} {d.satuan || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
