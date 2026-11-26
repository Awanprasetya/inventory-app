import { useEffect, useRef, useState } from 'react';
import {
  ScanBarcode,
  Truck,
  Loader2,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Building,
  RotateCcw,
  Sparkles,
  FileText,
  Warehouse,
  FileSpreadsheet,
  Package,
} from 'lucide-react';
import api, { getErrorMessage, formatNumber, formatDateTime, formatDate } from '../services/api.js';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { toastSuccess, alertError } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';

export default function Outbound() {
  const { user } = useAuth();
  const isRestrictedAdminGudang =
    ['ADMIN_GUDANG', 'WAREHOUSE'].includes((user?.role || '').toUpperCase()) &&
    Boolean(user?.warehouse_id);
  const assignedWarehouseId = isRestrictedAdminGudang ? String(user.warehouse_id) : null;

  const [scanValue, setScanValue] = useState('');
  const [warehouseId, setWarehouseId] = useState(assignedWarehouseId || '');
  const [cart, setCart] = useState([]); // { nomor_lot, kode_produk, nama_produk, satuan, stok_qty, qty, expired_date, status }
  const [candidateLots, setCandidateLots] = useState([]);
  const [candidateProduct, setCandidateProduct] = useState(null);
  const [referensi, setReferensi] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [deliveryOrderId, setDeliveryOrderId] = useState('');
  const [selectedDoData, setSelectedDoData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Master Data
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [dos, setDos] = useState([]);
  const [recent, setRecent] = useState([]);
  const scanRef = useRef(null);

  const loadData = async () => {
    try {
      const [trxRes, doRes, whRes, prodRes] = await Promise.all([
        api.get('/transactions', { params: { type: 'KELUAR', limit: 10 } }),
        api.get('/delivery-orders'),
        api.get('/warehouses'),
        api.get('/products'),
      ]);
      setRecent(trxRes.data.data || []);
      setDos((doRes.data.data || []).filter((d) => d.status === 'DRAFT' || d.status === 'PENDING'));
      const whList = whRes.data.data || [];
      setWarehouses(whList);
      if (assignedWarehouseId) {
        setWarehouseId(assignedWarehouseId);
      } else if (whList.length > 0 && !warehouseId) {
        setWarehouseId(String(whList[0].id));
      }
      setProducts(prodRes.data.data || []);
    } catch (_) {
      /* ignore */
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Ambil detail DO saat dipilih
  const handleDoChange = async (doId) => {
    const dId = doId ? String(doId) : '';
    setDeliveryOrderId(dId);
    if (!dId) {
      setSelectedDoData(null);
      return;
    }
    try {
      const { data } = await api.get(`/delivery-orders/${dId}`);
      setSelectedDoData(data.data);
      if (data.data?.no_do) {
        setReferensi(data.data.no_do);
      }
    } catch (_) {
      setSelectedDoData(null);
    }
  };

  // Pilih DO item untuk disiapkan
  const handlePickDoItem = async (doItem) => {
    try {
      const { data } = await api.get(`/products/${encodeURIComponent(doItem.kode_produk)}/lots`);
      const prod = products.find((p) => p.kode_produk === doItem.kode_produk);
      setCandidateProduct(prod || { nama_produk: doItem.nama_produk, kode_produk: doItem.kode_produk });
      const activeWhId = assignedWarehouseId || warehouseId;
      const availableLots = (data.data.lots || []).filter(
        (l) => Number(l.stok_qty) > 0 && (!activeWhId || Number(l.warehouse_id) === Number(activeWhId))
      );
      setCandidateLots(availableLots);
      toastSuccess(`Memuat lot untuk item DO: ${doItem.nama_produk}`);
    } catch (err) {
      alertError('Gagal Mengambil Lot', getErrorMessage(err));
    }
  };

  // Pilih produk via Dropdown langsung
  const handleSelectProduct = async (kodeProduk) => {
    if (!kodeProduk) {
      setCandidateLots([]);
      setCandidateProduct(null);
      return;
    }
    try {
      const prod = products.find((p) => p.kode_produk === kodeProduk);
      setCandidateProduct(prod);
      const { data } = await api.get(`/products/${encodeURIComponent(kodeProduk)}/lots`);
      const activeWhId = assignedWarehouseId || warehouseId;
      const lots = (data.data.lots || []).filter(
        (l) => Number(l.stok_qty) > 0 && (!activeWhId || Number(l.warehouse_id) === Number(activeWhId))
      );
      if (lots.length === 0) {
        setError(`Produk "${prod?.nama_produk || kodeProduk}" tidak memiliki lot dengan stok tersedia di gudang yang dipilih.`);
        setCandidateLots([]);
      } else {
        setError('');
        setCandidateLots(lots);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // Tambah Lot ke Keranjang Outbound dengan Proteksi Medis (BPOM / Kemenkes) & Gudang
  const addToCart = (lot) => {
    const activeWhId = assignedWarehouseId || warehouseId;
    if (activeWhId && lot.warehouse_id && Number(lot.warehouse_id) !== Number(activeWhId)) {
      alertError(
        'Gudang Tidak Sesuai',
        `Lot "${lot.nomor_lot}" berada di gudang lain (${lot.nama_gudang || 'Gudang Lain'}). Anda hanya diperbolehkan mengeluarkan stok dari gudang yang dipilih.`
      );
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const isExpired = lot.expired_date && lot.expired_date <= today;
    const isQuarantine = ['QUARANTINE', 'HOLD', 'EXPIRED'].includes(lot.status);

    if (isQuarantine || isExpired) {
      alertError(
        'Proteksi Mutu Medis Ditolak',
        `Lot "${lot.nomor_lot}" berstatus ${lot.status || 'KEDALUWARSA'} (${lot.expired_date || 'Expired'}). Dilarang untuk pengeluaran barang!`
      );
      return;
    }

    setCandidateLots((lots) => lots.filter((l) => l.nomor_lot !== lot.nomor_lot));
    const isi = Number(lot.isi_per_kemasan) || Number(candidateProduct?.isi_per_kemasan) || 1;
    const satuanBesar = lot.satuan_besar || candidateProduct?.satuan_besar || 'BOX';
    const totalStok = Number(lot.stok_qty);

    setCart((prev) => {
      const found = prev.find((c) => c.nomor_lot === lot.nomor_lot);
      if (found) {
        const nextQty = Math.min(found.qty + (isi > 1 ? isi : 1), totalStok);
        const boxCount = (nextQty / isi).toFixed(2).replace(/\.00$/, '');
        toastSuccess(`📦 +1 ${satuanBesar} pada Lot ${lot.nomor_lot} (Total Qty: ${nextQty} ${lot.satuan || 'pcs'} ≈ ${boxCount} ${satuanBesar})`);
        return prev.map((c) =>
          c.nomor_lot === lot.nomor_lot ? { ...c, qty: nextQty } : c
        );
      }

      const initialQty = Math.min(isi > 1 ? isi : 1, totalStok);
      if (isi > 1) {
        toastSuccess(`📦 Lot & Kemasan ${satuanBesar} terdeteksi: 1 ${satuanBesar} = ${isi} ${lot.satuan || 'pcs'} (Qty Outbound Otomatis: ${initialQty} ${lot.satuan || 'pcs'})`);
      } else {
        toastSuccess(`Lot ${lot.nomor_lot} ditambahkan ke keranjang.`);
      }

      return [
        ...prev,
        {
          nomor_lot: lot.nomor_lot,
          kode_produk: lot.kode_produk,
          nama_produk: lot.nama_produk || candidateProduct?.nama_produk || 'Produk',
          satuan: lot.satuan || candidateProduct?.satuan || 'pcs',
          satuan_besar: satuanBesar,
          isi_per_kemasan: isi,
          stok_qty: totalStok,
          expired_date: lot.expired_date,
          status: lot.status || 'AVAILABLE',
          qty: initialQty,
        },
      ];
    });
  };

  // Scan Barcode (mendukung QR JSON Lot, nomor lot biasa, atau kode produk/kemasan)
  const handleScan = async () => {
    let code = scanValue.trim();
    if (!code) return;
    if (code.startsWith('{') && code.endsWith('}')) {
      try {
        const parsed = JSON.parse(code);
        code = String(parsed.nomor_lot || parsed.lot || parsed.kode_produk || code).trim();
      } catch (_) {}
    }
    setScanning(true);
    setError('');
    setSuccess('');
    try {
      // 1. Coba sebagai nomor lot -> langsung masuk keranjang jika lolos uji QC & sesuai gudang
      const activeWhId = assignedWarehouseId || warehouseId;
      const res = await api.get(`/lots/${encodeURIComponent(code)}`, {
        params: { warehouse_id: activeWhId || undefined },
      });
      const lot = res.data.data;
      if (Number(lot.stok_qty) <= 0) {
        setError(`Lot "${lot.nomor_lot}" stoknya telah habis.`);
      } else {
        addToCart(lot);
        if (lot.priority_warning?.has_warning) {
          setError(lot.priority_warning.message);
        }
      }
    } catch (_) {
      try {
        // 2. Coba sebagai kode produk atau barcode kemasan box -> tampilkan pilihan lot terurut FEFO
        const activeWhId = assignedWarehouseId || warehouseId;
        const prodRes = await api.get(`/products/${encodeURIComponent(code)}`);
        const prod = prodRes.data.data;
        const res = await api.get(`/products/${encodeURIComponent(prod.kode_produk)}/lots`);
        const lots = (res.data.data.lots || []).filter(
          (l) => Number(l.stok_qty) > 0 && (!activeWhId || Number(l.warehouse_id) === Number(activeWhId))
        );
        setCandidateProduct(prod);
        if (lots.length === 0) {
          setError(`Produk "${prod.nama_produk}" tidak memiliki lot dengan sisa stok di gudang yang dipilih.`);
          setCandidateLots([]);
        } else {
          setCandidateLots(lots);
        }
      } catch (errProduct) {
        setCandidateLots([]);
        setError(`Barcode "${code}" tidak ditemukan sebagai lot, kemasan box, maupun kode produk.`);
      }
    } finally {
      setScanning(false);
      setScanValue('');
      scanRef.current?.focus();
    }
  };

  const updateQty = (nomorLot, qty) => {
    const value = Number(qty);
    setCart((prev) =>
      prev.map((c) =>
        c.nomor_lot === nomorLot
          ? { ...c, qty: Number.isFinite(value) ? Math.max(0, Math.min(value, c.stok_qty)) : 0 }
          : c
      )
    );
  };

  const removeItem = (nomorLot) => {
    setCart((prev) => prev.filter((c) => c.nomor_lot !== nomorLot));
  };

  // Submit Pengeluaran Barang
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Keranjang pengeluaran masih kosong. Silakan pilih atau scan lot barang.');
      return;
    }
    const invalid = cart.find((c) => !Number.isInteger(c.qty) || c.qty < 1 || c.qty > c.stok_qty);
    if (invalid) {
      setError(`Qty lot "${invalid.nomor_lot}" tidak valid (minimal 1, maksimal stok tersedia: ${invalid.stok_qty}).`);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        warehouse_id: Number(warehouseId || 1),
        items: cart.map((c) => ({ nomor_lot: c.nomor_lot, qty: c.qty })),
        referensi: referensi.trim() || null,
        keterangan: keterangan.trim() || null,
        delivery_order_id: deliveryOrderId ? Number(deliveryOrderId) : null,
      };

      const { data } = await api.post('/transactions/outbound', payload);
      setSuccess(`${data.message} — ${data.data.items.length} lot berhasil dipotong dari stok.`);
      toastSuccess(`Barang Keluar Berhasil: ${data.data.kode_transaksi}`);
      setCart([]);
      setCandidateLots([]);
      setCandidateProduct(null);
      setReferensi('');
      setKeterangan('');
      setDeliveryOrderId('');
      setSelectedDoData(null);
      loadData();
      scanRef.current?.focus();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menyimpan Barang Keluar', msg);
    } finally {
      setSaving(false);
    }
  };

  const totalQty = cart.reduce((sum, c) => sum + (Number(c.qty) || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Kolom Kiri: Form Scanner & Keranjang */}
          <div className="space-y-6 xl:col-span-2">
            {/* Box Identifikasi & Gudang Asal */}
            <div className="card shadow-sm rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-800">
                    Pengeluaran Barang (Outbound & Dispatch)
                  </h2>
                </div>
                <div className="w-full sm:w-72">
                  {isRestrictedAdminGudang ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      <span className="truncate">
                        {warehouses.find((w) => String(w.id) === assignedWarehouseId)
                          ? `${warehouses.find((w) => String(w.id) === assignedWarehouseId).nama_gudang} (${warehouses.find((w) => String(w.id) === assignedWarehouseId).kode_gudang})`
                          : user?.nama_gudang || 'Gudang Tugas Anda'}
                      </span>
                      <span className="ml-2 shrink-0 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        Gudang Anda
                      </span>
                    </div>
                  ) : (
                    <SearchableSelect
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target ? e.target.value : e)}
                      placeholder="Gudang Pengeluaran..."
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.nama_gudang} ({w.kode_gudang})
                        </option>
                      ))}
                    </SearchableSelect>
                  )}
                </div>
              </div>

              {/* Integrasi Delivery Order (DO) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Hubungkan dengan Delivery Order (DO)
                </label>
                <SearchableSelect
                  value={deliveryOrderId}
                  onChange={(e) => handleDoChange(e.target ? e.target.value : e)}
                  placeholder="-- Pengeluaran Bebas / Tanpa DO --"
                >
                  <option value="">-- Pengeluaran Bebas / Tanpa DO --</option>
                  {dos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.no_do} &mdash; {d.nama_customer} ({d.status})
                    </option>
                  ))}
                </SearchableSelect>
              </div>

              {/* Info DO jika dipilih */}
              {selectedDoData && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-700" />
                      DO: {selectedDoData.no_do} &mdash; {selectedDoData.nama_customer}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                      Alamat: {selectedDoData.alamat_pengiriman || '-'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead>
                        <tr className="border-b border-indigo-200 text-slate-600">
                          <th className="py-1 px-2">Item Barang DO</th>
                          <th className="py-1 px-2 text-center">Qty Kirim</th>
                          <th className="py-1 px-2 text-center">Aksi Cepat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-100">
                        {(selectedDoData.details || []).map((it, idx) => (
                          <tr key={idx} className="hover:bg-indigo-100/40">
                            <td className="py-2 px-2 font-medium">
                              {it.nama_produk} ({it.kode_produk})
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-indigo-700">
                              {it.qty_kirim} {it.satuan || 'pcs'}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handlePickDoItem(it)}
                                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-sm transition"
                              >
                                Pilih Lot Item Ini
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Scan Barcode ATAU Pilih Produk */}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pilih / Scan Barang yang Dikeluarkan
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        ref={scanRef}
                        type="text"
                        value={scanValue}
                        onChange={(e) => setScanValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                        placeholder="Scan barcode lot / produk..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleScan}
                      disabled={scanning || !scanValue.trim()}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari'}
                    </button>
                  </div>

                  <div>
                    <SearchableSelect
                      value={candidateProduct?.kode_produk || ''}
                      onChange={(e) => handleSelectProduct(e.target ? e.target.value : e)}
                      placeholder="Atau pilih produk dari katalog..."
                    >
                      <option value="">-- Pilih Produk Manual --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.kode_produk}>
                          {p.kode_produk} &mdash; {p.nama_produk}
                        </option>
                      ))}
                    </SearchableSelect>
                  </div>
                </div>
              </div>

              {/* Rekomendasi Lot (FIFO / FEFO) Produk Terpilih */}
              {candidateLots.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  {(() => {
                    const activeMethod = (candidateLots[0]?.metode_digunakan || candidateProduct?.metode_stok || 'FIFO').toUpperCase();
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                                Lot Tersedia untuk: <span className="text-indigo-700">{candidateProduct?.nama_produk}</span>
                              </p>
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                activeMethod === 'FEFO' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}>
                                {activeMethod === 'FEFO' ? 'Aturan: FEFO (Expired)' : 'Aturan: FIFO (Barang Masuk)'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {activeMethod === 'FEFO'
                                ? 'Diurutkan berdasarkan FEFO (First Expired First Out). Lot dengan tanggal kadaluarsa terdekat direkomendasikan lebih dulu.'
                                : 'Diurutkan berdasarkan FIFO (First In First Out). Lot dengan tanggal produksi/masuk terlama direkomendasikan lebih dulu.'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {candidateLots.map((lot, idx) => {
                            const isExpired = lot.expired_date && lot.expired_date <= todayStr;
                            const isQuarantine = ['QUARANTINE', 'HOLD', 'EXPIRED'].includes(lot.status);
                            const isBestRecommended = (lot.is_recommended || idx === 0) && !isExpired && !isQuarantine;

                            return (
                              <div
                                key={lot.nomor_lot}
                                className={`p-3 rounded-lg border flex flex-col justify-between transition ${
                                  isQuarantine || isExpired
                                    ? 'bg-red-50/50 border-red-200 opacity-60'
                                    : isBestRecommended
                                    ? activeMethod === 'FEFO'
                                      ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                                      : 'bg-blue-50/80 border-blue-300 shadow-xs'
                                    : 'bg-white border-slate-200 hover:border-indigo-300'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-mono text-xs font-bold text-slate-800">{lot.nomor_lot}</span>
                                    {isBestRecommended && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                        activeMethod === 'FEFO' ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
                                      }`}>
                                        <Sparkles className="w-2.5 h-2.5" /> Rekomendasi {activeMethod}
                                      </span>
                                    )}
                                  </div>
                            <p className="text-xs text-slate-600">
                              Stok: <strong>{formatNumber(lot.stok_qty)}</strong>
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Exp: {lot.expired_date ? formatDate(lot.expired_date) : '-'}
                            </p>
                            {isQuarantine && (
                              <span className="text-[10px] font-bold text-red-600 block mt-1">
                                🚫 Status: {lot.status}
                              </span>
                            )}
                            {isExpired && (
                              <span className="text-[10px] font-bold text-red-600 block mt-1">
                                ⚠️ Kedaluwarsa!
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={isQuarantine || isExpired}
                            onClick={() => addToCart(lot)}
                            className="mt-2.5 w-full py-1.5 px-2 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white transition flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isQuarantine || isExpired ? 'Dilarang' : 'Ambil Lot'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

            {/* Keranjang Pengiriman */}
            <div className="card shadow-sm rounded-xl border border-slate-200 overflow-hidden">
              <div className="card-header bg-slate-50/60 p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800">Keranjang Barang Siap Kirim</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                    {cart.length} Lot
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Total Fisik: <strong>{formatNumber(totalQty)} pcs</strong>
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                  <p className="text-sm font-medium text-slate-600">Keranjang Pengiriman Kosong</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Scan barcode atau pilih lot produk di atas untuk memasukkan ke keranjang kirim.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Produk</th>
                        <th className="py-2.5 px-4">No. Lot & Exp</th>
                        <th className="py-2.5 px-4 text-center">Stok Ada</th>
                        <th className="py-2.5 px-4 text-center">Qty Kirim</th>
                        <th className="py-2.5 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cart.map((item) => (
                        <tr key={item.nomor_lot} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800">{item.nama_produk}</span>
                            <span className="text-xs text-slate-400 block">{item.kode_produk}</span>
                            {Number(item.isi_per_kemasan) > 1 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 mt-1 w-max">
                                <Package className="w-3 h-3" />
                                1 {item.satuan_besar || 'BOX'} = {item.isi_per_kemasan} {item.satuan}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold text-slate-700">{item.nomor_lot}</span>
                            <span className="text-xs text-slate-400 block">
                              Exp: {item.expired_date ? formatDate(item.expired_date) : '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-slate-600">
                            <p className="font-semibold">{formatNumber(item.stok_qty)} {item.satuan}</p>
                            {Number(item.isi_per_kemasan) > 1 && (
                              <p className="text-[11px] text-indigo-600 font-medium">
                                ≈ {formatNumber(Number((item.stok_qty / item.isi_per_kemasan).toFixed(2)))} {item.satuan_besar || 'BOX'}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {Number(item.isi_per_kemasan) > 1 ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.stok_qty}
                                    value={item.qty}
                                    onChange={(e) => updateQty(item.nomor_lot, e.target.value)}
                                    className="w-20 px-2 py-1 text-sm border border-slate-300 rounded text-center font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs font-bold text-slate-700">{item.satuan}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="any"
                                    value={(item.qty / item.isi_per_kemasan).toFixed(2).replace(/\.00$/, '')}
                                    onChange={(e) => {
                                      const boxNum = Number(e.target.value) || 0;
                                      const calcQty = Math.round(boxNum * item.isi_per_kemasan * 100) / 100;
                                      updateQty(item.nomor_lot, calcQty);
                                    }}
                                    className="w-14 px-1 py-0.5 text-xs text-center border border-indigo-200 rounded font-bold bg-white text-indigo-800"
                                  />
                                  <span>{item.satuan_besar || 'BOX'}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max={item.stok_qty}
                                  value={item.qty}
                                  onChange={(e) => updateQty(item.nomor_lot, e.target.value)}
                                  className="w-20 px-2 py-1 text-sm border border-slate-300 rounded text-center font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-slate-700">{item.satuan}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.nomor_lot)}
                              className="p-1.5 text-slate-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Kolom Kanan: Ringkasan Pengiriman & Submit */}
          <div className="space-y-6">
            <div className="card shadow-sm rounded-xl border border-slate-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                Dokumen Pengiriman
              </h3>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Referensi (No DO / No SJ)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: DO-2026-001"
                  value={referensi}
                  onChange={(e) => setReferensi(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Keterangan Ekspedisi / Kurir
                </label>
                <textarea
                  rows="3"
                  placeholder="Nama driver, no polisi kendaraan, nama RS penerima..."
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Total Jenis Lot:</span>
                  <span className="font-bold text-slate-800">{cart.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Kuantitas:</span>
                  <span className="font-bold text-indigo-700">{formatNumber(totalQty)} pcs</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span>Jurnal ERP:</span>
                  <span className="font-semibold text-emerald-700">Auto Debit HPP & Kredit Stok</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || cart.length === 0}
                className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                {saving ? 'Memproses Pengeluaran...' : 'Konfirmasi & Kirim Barang'}
              </button>
            </div>

            {/* Riwayat 10 Keluar Terakhir */}
            <div className="card shadow-sm rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  10 Pengeluaran Terakhir
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const headers = ['Kode Transaksi', 'Tanggal', 'Gudang', 'DO', 'Produk / Lot', 'Qty Keluar'];
                    const rows = [];
                    recent.forEach((trx) => {
                      (trx.details || []).forEach((d) => {
                        rows.push([
                          trx.kode_transaksi || '',
                          formatDateTime(trx.tanggal_transaksi),
                          trx.nama_gudang || 'Pusat',
                          trx.no_do || '',
                          d.nama_produk || d.nomor_lot || '',
                          d.qty || 0,
                        ]);
                      });
                    });
                    exportToExcel('Riwayat_Outbound_Pengeluaran', headers, rows);
                  }}
                  className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                  title="Export Riwayat Outbound ke Excel"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  Excel
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {recent.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Belum ada transaksi keluar.</p>
                ) : (
                  recent.map((trx) => (
                    <div key={trx.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-800 font-mono">{trx.kode_transaksi}</span>
                        <span className="text-slate-400">{formatDateTime(trx.tanggal_transaksi)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>Gudang: {trx.nama_gudang || 'Pusat'}</span>
                        {trx.no_do && <span className="font-semibold text-indigo-600">DO: {trx.no_do}</span>}
                      </div>
                      <div className="border-t border-slate-200/60 pt-1">
                        {(trx.details || []).map((d, i) => (
                          <span key={i} className="block text-[11px] text-slate-600">
                            {d.nama_produk || d.nomor_lot}: -{formatNumber(d.qty)} pcs
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
