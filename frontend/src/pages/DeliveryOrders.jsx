import { useEffect, useState } from 'react';
import {
  Truck,
  Plus,
  Eye,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  XCircle,
  ScanBarcode,
  Barcode,
  Package,
  Sparkles,
  Layers,
  Clock,
  Building,
  Printer,
  Sliders,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import api, { getErrorMessage, formatDate, formatNumber } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import Pagination, { paginate } from '../components/Pagination.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { confirmDelete, toastSuccess, alertError, Toast } from '../utils/alert.js';
import { exportToExcel } from '../utils/exportHelper.js';
import {
  getProductUnits,
  getUnitDropdownOptions,
  convertToPcs,
  getConversionPreviewText,
  formatMultiTierBreakdown,
} from '../utils/unitHelper.js';
import ReportCustomizerModal, {
  loadSavedReportConfig,
} from '../components/ReportCustomizerModal.jsx';
import PrintableReportHeader from '../components/PrintableReportHeader.jsx';
import PrintableReportSignatures from '../components/PrintableReportSignatures.jsx';
import PrintableInvoiceModal from '../components/PrintableInvoiceModal.jsx';

const PAGE_SIZE = 10;

const statusBadges = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SHIPPED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
};

export default function DeliveryOrders() {
  const [dos, setDos] = useState([]);
  const [sos, setSos] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Kustomisasi Laporan State
  const [reportCustomizerOpen, setReportCustomizerOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState(() => loadSavedReportConfig('DO'));

  // Detail Modal
  const [detailModal, setDetailModal] = useState(false);
  const [activeDo, setActiveDo] = useState(null);

  // Cetak Dokumen Detail DO Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Add Modal state
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shippingId, setShippingId] = useState(null);
  const [availableLots, setAvailableLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [selectedSoData, setSelectedSoData] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [scannedProductRec, setScannedProductRec] = useState(null); // { product, metode, lots, isKemasan }
  const [lotWarning, setLotWarning] = useState(null); // { scannedLot, warning, targetNomorLot }

  const handlePrintRow = async (doItem) => {
    setSelectedInvoiceData(doItem);
    setInvoiceModalOpen(true);
    setLoadingInvoice(true);
    try {
      const { data } = await api.get(`/delivery-orders/${doItem.id}`);
      setSelectedInvoiceData(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingInvoice(false);
    }
  };

  const [form, setForm] = useState({
    no_do: '',
    so_id: '',
    customer_id: '',
    tanggal_do: new Date().toISOString().split('T')[0],
    status: 'DRAFT',
    items: [{ nomor_lot: '', kemasan_count: '1', qty_kirim: 1, lot_info: null }],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [doRes, soRes, custRes, prodRes] = await Promise.all([
        api.get('/delivery-orders', {
          params: { status: statusFilter || undefined, search: search.trim() || undefined },
        }),
        api.get('/sales-orders'),
        api.get('/customers'),
        api.get('/products'),
      ]);
      setDos(doRes.data.data || []);
      setSos(soRes.data.data || []);
      setCustomers(custRes.data.data || []);
      setProducts(prodRes.data.data || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 300);
    return () => clearTimeout(timer);
  }, [statusFilter, search]);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const fetchAvailableLots = async () => {
    setLoadingLots(true);
    try {
      const res = await api.get('/lots');
      if (res.data.success) {
        setAvailableLots(res.data.data || []);
      }
    } catch (_) {
      /* ignore */
    } finally {
      setLoadingLots(false);
    }
  };

  const resolveIsiPerKemasan = (lotInfo) => {
    if (!lotInfo) return 1;
    const isiLot = Number(lotInfo.isi_per_kemasan);
    if (isiLot > 0) return isiLot;
    const prod = products.find((p) => p.kode_produk === lotInfo.kode_produk);
    const isiProd = Number(prod?.isi_per_kemasan);
    if (isiProd > 0) return isiProd;
    return 1;
  };

  const resolveSatuanBesar = (lotInfo) => {
    if (lotInfo?.satuan_besar) return lotInfo.satuan_besar;
    const prod = products.find((p) => p.kode_produk === lotInfo?.kode_produk);
    return prod?.satuan_besar || 'BOX';
  };

  const handleOpenAddModal = () => {
    fetchAvailableLots();
    setSelectedSoData(null);
    setScanInput('');
    setScannedProductRec(null);
    setLotWarning(null);
    setForm({
      no_do: '',
      so_id: '',
      customer_id: '',
      tanggal_do: new Date().toISOString().split('T')[0],
      status: 'DRAFT',
      items: [{ nomor_lot: '', kemasan_count: '1', qty_kirim: 1, lot_info: null }],
    });
    setAddModal(true);
  };

  const openDetail = async (id) => {
    try {
      const { data } = await api.get(`/delivery-orders/${id}`);
      setActiveDo(data.data);
      setDetailModal(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const changeStatus = async (id, newStatus) => {
    if (newStatus === 'SHIPPED' || newStatus === 'DELIVERED') {
      const isConfirmed = await confirmDelete({
        title: `Ubah Status ke ${newStatus}?`,
        text: `Tindakan ini akan memotong stok fisik lot di gudang, mencatat barang keluar, dan membukukan jurnal HPP (Beban Pokok Pendapatan).`,
        confirmButtonText: `Ya, Ubah ke ${newStatus}`,
        confirmButtonColor: '#2563eb',
      });
      if (!isConfirmed) return;
    }

    try {
      const { data } = await api.put(`/delivery-orders/${id}/status`, { status: newStatus });
      flash(data.message);
      toastSuccess(data.message);
      if (activeDo && activeDo.id === id) {
        setActiveDo(data.data);
      }
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Mengubah Status', msg);
    }
  };

  const handleShipDo = async (doItem) => {
    const isConfirmed = await confirmDelete({
      title: `Kirim DO ${doItem.no_do}?`,
      text: `Tindakan ini akan memotong stok fisik lot di gudang, mencatat pengeluaran barang, dan membukukan jurnal HPP (Beban Pokok Pendapatan).`,
      confirmButtonText: 'Ya, Kirim & Potong Stok',
      confirmButtonColor: '#2563eb',
    });
    if (!isConfirmed) return;

    setShippingId(doItem.id);
    try {
      const { data } = await api.post(`/delivery-orders/${doItem.id}/ship`);
      flash(data.message);
      toastSuccess(data.message);
      if (activeDo && activeDo.id === doItem.id) {
        setActiveDo(data.data);
      }
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Mengirim DO', msg);
    } finally {
      setShippingId(null);
    }
  };

  const deleteDo = async (d) => {
    const confirmed = await confirmDelete({
      title: `Hapus Delivery Order?`,
      text: `DO "${d.no_do}" beserta mutasi barang keluar dan kartu stok akan dibatalkan/dihapus permanen, dan stok lot akan dikembalikan ke gudang!`,
    });
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/delivery-orders/${d.id}`);
      flash(data.message);
      toastSuccess(data.message);
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Menghapus DO', msg);
    }
  };

  // When SO selected, auto fill customer and fetch SO detail
  const handleSoSelect = async (soIdVal) => {
    const selectedSo = sos.find((s) => s.id === Number(soIdVal));
    setForm((f) => ({
      ...f,
      so_id: soIdVal,
      customer_id: selectedSo && selectedSo.customer_id ? String(selectedSo.customer_id) : f.customer_id,
    }));

    if (!soIdVal) {
      setSelectedSoData(null);
      return;
    }

    try {
      const { data } = await api.get(`/sales-orders/${soIdVal}`);
      setSelectedSoData(data.data);
      toastSuccess(`Data Sales Order ${data.data.no_so} berhasil dimuat`);
    } catch (_) {
      setSelectedSoData(null);
    }
  };

  // Auto-fill lot rows from Sales Order items
  const autoFillLotsFromSo = () => {
    if (!selectedSoData || !selectedSoData.details || selectedSoData.details.length === 0) {
      alertError('Informasi', 'Tidak ada item detail pada Sales Order ini.');
      return;
    }

    const newItems = [];
    for (const soItem of selectedSoData.details) {
      const neededQty = Math.max(0, Number(soItem.qty_pesanan) - Number(soItem.qty_terkirim || 0));
      if (neededQty <= 0) continue;

      // Find available lots for this product code
      const matchingLots = availableLots.filter(
        (l) => l.kode_produk === soItem.kode_produk && Number(l.stok_qty) > 0 && l.status !== 'QUARANTINE'
      );

      if (matchingLots.length > 0) {
        // Pick top recommended lot
        const topLot = matchingLots[0];
        const isi = resolveIsiPerKemasan(topLot);
        const sendQty = Math.min(neededQty, Number(topLot.stok_qty));
        const kemasan = isi > 1 ? (sendQty / isi).toFixed(2).replace(/\.00$/, '') : String(sendQty);

        newItems.push({
          nomor_lot: topLot.nomor_lot,
          kemasan_count: kemasan,
          qty_kirim: sendQty,
          lot_info: topLot,
        });
      } else {
        // Fallback row if no lot available in stock yet
        newItems.push({
          nomor_lot: '',
          kemasan_count: '1',
          qty_kirim: neededQty,
          lot_info: null,
          so_product_name: soItem.nama_produk,
        });
      }
    }

    if (newItems.length > 0) {
      setForm((f) => ({ ...f, items: newItems }));
      toastSuccess(`Otomatisi Lot dari SO: ${newItems.length} baris barang disiapkan.`);
    } else {
      alertError('Informasi', 'Seluruh item pada Sales Order ini sudah terkirim sepenuhnya.');
    }
  };

  // Ekstrak kode bersih jika input scanner berupa JSON QR Code Lot
  const parseScannedInput = (raw) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return { cleanCode: '', fallbackKodeProduk: '' };
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          cleanCode: String(parsed.nomor_lot || parsed.lot || parsed.kode_produk || trimmed).trim(),
          fallbackKodeProduk: String(parsed.kode_produk || '').trim(),
        };
      } catch (_) {
        // bukan JSON valid
      }
    }
    return { cleanCode: trimmed, fallbackKodeProduk: '' };
  };

  // Hitung peringatan prioritas lot secara lokal (fallback jika dari cache)
  const computeLocalPriorityWarning = (lot) => {
    if (!lot || !lot.kode_produk) return { has_warning: false };
    const today = new Date().toISOString().split('T')[0];
    const metode = (lot.metode_stok || 'FIFO').toUpperCase();
    const candidates = availableLots.filter((l) => {
      if (l.nomor_lot === lot.nomor_lot) return false;
      if (l.kode_produk !== lot.kode_produk) return false;
      if (lot.warehouse_id && l.warehouse_id && Number(l.warehouse_id) !== Number(lot.warehouse_id)) return false;
      if (Number(l.stok_qty || 0) <= 0) return false;
      const st = (l.effective_status || l.status || 'AVAILABLE').toUpperCase();
      if (['QUARANTINE', 'HOLD', 'EXPIRED'].includes(st)) return false;
      if (l.expired_date && l.expired_date < today) return false;
      return true;
    });

    const olderLots = candidates
      .filter((c) => c.tanggal_produksi && lot.tanggal_produksi && c.tanggal_produksi < lot.tanggal_produksi)
      .sort((a, b) => (a.tanggal_produksi < b.tanggal_produksi ? -1 : 1));
    const earlierExpiryLots = candidates
      .filter((c) => c.expired_date && (!lot.expired_date || c.expired_date < lot.expired_date))
      .sort((a, b) => (a.expired_date < b.expired_date ? -1 : 1));

    const olderLot = olderLots[0] || null;
    const earlierExpiryLot = earlierExpiryLots[0] || null;
    const recommendedLot = metode === 'FEFO' ? (earlierExpiryLot || olderLot) : (olderLot || earlierExpiryLot);
    if (!recommendedLot) return { has_warning: false };

    const reasons = [];
    if (earlierExpiryLot) {
      const expDays = earlierExpiryLot.days_to_expire;
      const expNote =
        expDays !== null && expDays !== undefined && Number(expDays) <= 90
          ? `sebentar lagi expired (${expDays} hari lagi, ED ${earlierExpiryLot.expired_date})`
          : `expired lebih dekat (ED ${earlierExpiryLot.expired_date})`;
      reasons.push(`Lot ${earlierExpiryLot.nomor_lot} ${expNote} dengan stok ${earlierExpiryLot.stok_qty}`);
    }
    if (olderLot) {
      reasons.push(`Lot ${olderLot.nomor_lot} masuk/diproduksi lebih lama (${olderLot.tanggal_produksi}) dengan stok ${olderLot.stok_qty}`);
    }
    return {
      has_warning: true,
      metode_stok: metode,
      has_older_lot: Boolean(olderLot),
      has_earlier_expiry_lot: Boolean(earlierExpiryLot),
      older_lot: olderLot,
      earlier_expiry_lot: earlierExpiryLot,
      recommended_lot: recommendedLot,
      reasons,
      message: `Rekomendasi ${metode}: Sebaiknya gunakan lot ${recommendedLot.nomor_lot} terlebih dahulu. ${reasons.join('; ')}.`,
    };
  };

  // Fetch & tampilkan rekomendasi FEFO/FIFO untuk satu produk
  const showProductRecommendations = async (kodeOrBarcode, isFromBlockedLot = false) => {
    try {
      const res = await api.get('/lots/recommend', {
        params: { kode_produk: kodeOrBarcode },
      });
      if (res.data?.success && res.data?.data?.success) {
        const recData = res.data.data;
        setScannedProductRec({
          product: recData,
          metode: (recData.metode_digunakan || 'FIFO').toUpperCase(),
          lots: recData.recommended_lots || [],
        });
        if (!isFromBlockedLot) {
          toastSuccess(
            `Rekomendasi ${recData.metode_digunakan || 'FIFO'} untuk ${recData.nama_produk}: ${(recData.recommended_lots || []).length} lot tersedia`
          );
        }
        return true;
      }
    } catch (_) {
      // Fallback ke /products/:kode + /products/:kode/lots jika diperlukan
      try {
        const prodRes = await api.get(`/products/${encodeURIComponent(kodeOrBarcode)}`);
        const prod = prodRes.data?.data;
        if (prod) {
          const lotsRes = await api.get(`/products/${encodeURIComponent(prod.kode_produk)}/lots`);
          const lots = (lotsRes.data?.data?.lots || []).filter((l) => Number(l.stok_qty || 0) > 0);
          setScannedProductRec({
            product: prod,
            metode: (prod.metode_stok || 'FIFO').toUpperCase(),
            lots,
          });
          if (!isFromBlockedLot) {
            toastSuccess(
              `Rekomendasi ${prod.metode_stok || 'FIFO'} untuk ${prod.nama_produk}: ${lots.length} lot tersedia`
            );
          }
          return true;
        }
      } catch (_) {
        // ignore
      }
    }
    return false;
  };

  // Tambahkan/inkremen lot terpilih ke daftar item DO
  const addLotToDoForm = (lot, { fromScan = false, priorityWarning = null } = {}) => {
    const today = new Date().toISOString().split('T')[0];
    const isExpired = lot.is_expired || (lot.expired_date && lot.expired_date < today);
    const effStatus = (lot.effective_status || lot.status || 'AVAILABLE').toUpperCase();
    const isQuarantine = ['QUARANTINE', 'HOLD', 'EXPIRED'].includes(effStatus);

    if (isQuarantine || isExpired) {
      alertError(
        'Lot Tidak Dapat Dikirim',
        `Lot "${lot.nomor_lot}" berstatus ${effStatus} (${lot.expired_date || 'Expired'}). Pilih lot rekomendasi lain yang masih valid.`
      );
      if (lot.kode_produk) showProductRecommendations(lot.kode_produk, true);
      return false;
    }

    if (Number(lot.stok_qty || 0) <= 0) {
      alertError('Stok Lot Kosong', `Stok fisik untuk lot "${lot.nomor_lot}" sudah habis (0).`);
      if (lot.kode_produk) showProductRecommendations(lot.kode_produk, true);
      return false;
    }

    const u = getProductUnits(lot);
    const chosenUnit = u.hasBigUnit && u.isiBoxPcs > 1 ? u.bigUnit : u.baseUnit;
    const rasio = convertToPcs(1, chosenUnit, lot);
    const resolvedWarning = priorityWarning || lot.priority_warning || computeLocalPriorityWarning(lot);
    const existingIndex = form.items.findIndex((i) => i.nomor_lot === lot.nomor_lot);

    if (existingIndex >= 0) {
      const currentOrder = Number(form.items[existingIndex].qty_order ?? form.items[existingIndex].kemasan_count) || 1;
      const nextOrder = currentOrder + 1;
      const itemUnit = form.items[existingIndex].satuan_order || chosenUnit;
      const itemRasio = convertToPcs(1, itemUnit, lot);
      const nextQty = Math.round(nextOrder * itemRasio * 100) / 100;

      setForm((f) => ({
        ...f,
        items: f.items.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                qty_order: nextOrder,
                kemasan_count: String(nextOrder),
                satuan_order: itemUnit,
                rasio_pcs: itemRasio,
                qty_kirim: nextQty,
                lot_info: lot,
                priority_warning: resolvedWarning?.has_warning ? resolvedWarning : null,
              }
            : item
        ),
      }));
      toastSuccess(`+1 ${itemUnit} pada Lot ${lot.nomor_lot} (${nextOrder} ${itemUnit} = ${nextQty} ${u.baseUnit})`);
    } else {
      setForm((f) => ({
        ...f,
        items: [
          ...f.items.filter((i) => i.nomor_lot !== ''),
          {
            nomor_lot: lot.nomor_lot,
            satuan_order: chosenUnit,
            qty_order: 1,
            kemasan_count: '1',
            rasio_pcs: rasio,
            qty_kirim: rasio,
            lot_info: lot,
            priority_warning: resolvedWarning?.has_warning ? resolvedWarning : null,
          },
        ],
      }));
      toastSuccess(`Lot ${lot.nomor_lot} ditambahkan (1 ${chosenUnit} = ${rasio} ${u.baseUnit})`);
    }

    if (resolvedWarning?.has_warning) {
      setLotWarning({
        scannedLot: lot,
        warning: resolvedWarning,
        targetNomorLot: lot.nomor_lot,
      });
      if (fromScan) {
        Toast.fire({
          icon: 'warning',
          title: `Perhatian ${resolvedWarning.metode_stok}: Ada lot ${resolvedWarning.recommended_lot?.nomor_lot || 'lain'} yang lebih prioritas!`,
        });
      }
    } else if (fromScan) {
      setLotWarning(null);
    }
    return true;
  };

  // Tukar baris lot yang kena peringatan dengan lot rekomendasi FEFO/FIFO
  const handleSwitchToRecommendedLot = async (fromNomorLot, recNomorLot) => {
    if (!recNomorLot) return;
    let recLot = availableLots.find((l) => l.nomor_lot === recNomorLot) || null;
    try {
      const res = await api.get(`/lots/${encodeURIComponent(recNomorLot)}`);
      if (res.data?.data) recLot = res.data.data;
    } catch (_) {
      // pakai cache jika gagal
    }
    if (!recLot) return;

    const u = getProductUnits(recLot);
    const chosenUnit = u.hasBigUnit && u.isiBoxPcs > 1 ? u.bigUnit : u.baseUnit;
    const rasio = convertToPcs(1, chosenUnit, recLot);
    const newWarn = recLot.priority_warning || computeLocalPriorityWarning(recLot);

    setForm((f) => ({
      ...f,
      items: f.items.map((item) =>
        item.nomor_lot === fromNomorLot
          ? {
              ...item,
              nomor_lot: recLot.nomor_lot,
              lot_info: recLot,
              satuan_order: chosenUnit,
              qty_order: 1,
              kemasan_count: '1',
              rasio_pcs: rasio,
              qty_kirim: rasio,
              priority_warning: newWarn?.has_warning ? newWarn : null,
            }
          : item
      ),
    }));
    setLotWarning(null);
    toastSuccess(`Diganti ke lot rekomendasi: ${recLot.nomor_lot}`);
  };

  // Scan Barcode Lot ATAU Kode Produk / Barcode Kemasan
  const handleScanLotBarcode = async () => {
    const { cleanCode, fallbackKodeProduk } = parseScannedInput(scanInput);
    if (!cleanCode) return;

    setScanningBarcode(true);
    try {
      // 1. Coba sebagai Nomor Lot terlebih dahulu (ambil dari API agar dapat priority_warning terbaru)
      let lot = null;
      try {
        const res = await api.get(`/lots/${encodeURIComponent(cleanCode)}`);
        lot = res.data?.data || null;
      } catch (_) {
        lot = availableLots.find((l) => l.nomor_lot.toUpperCase() === cleanCode.toUpperCase()) || null;
      }

      if (lot) {
        setScannedProductRec(null);
        addLotToDoForm(lot, { fromScan: true, priorityWarning: lot.priority_warning });
        setScanInput('');
        return;
      }

      // 2. Coba sebagai Kode Produk atau Barcode Kemasan -> tampilkan rekomendasi FEFO/FIFO
      const lookupCode = fallbackKodeProduk || cleanCode;
      const foundProductRec = await showProductRecommendations(lookupCode, false);
      if (foundProductRec) {
        setLotWarning(null);
        setScanInput('');
        return;
      }

      alertError(
        'Barcode Tidak Ditemukan',
        `Barcode "${cleanCode}" tidak ditemukan sebagai nomor lot, kode produk, maupun barcode kemasan.`
      );
    } finally {
      setScanningBarcode(false);
    }
  };

  // --- Add Form Item Handlers ---
  const addItemRow = () => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { nomor_lot: '', kemasan_count: '1', qty_kirim: 1, lot_info: null }],
    }));
  };

  const removeItemRow = (idx) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  };

  const handleItemLotChange = async (idx, nomorLotVal) => {
    let lotInfo = null;

    if (nomorLotVal) {
      try {
        const res = await api.get(`/lots/${encodeURIComponent(nomorLotVal)}`);
        lotInfo = res.data.data;
      } catch (_) {
        lotInfo = availableLots.find((l) => l.nomor_lot === nomorLotVal) || null;
      }
    }

    const u = getProductUnits(lotInfo);
    const chosenUnit = u.hasBigUnit && u.isiBoxPcs > 1 ? u.bigUnit : u.baseUnit;
    const rasio = convertToPcs(1, chosenUnit, lotInfo);
    const resolvedWarning = lotInfo
      ? (lotInfo.priority_warning || computeLocalPriorityWarning(lotInfo))
      : null;

    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === idx
          ? {
              ...item,
              nomor_lot: nomorLotVal,
              lot_info: lotInfo,
              satuan_order: chosenUnit,
              qty_order: 1,
              kemasan_count: '1',
              qty_kirim: rasio,
              rasio_pcs: rasio,
              priority_warning: resolvedWarning?.has_warning ? resolvedWarning : null,
            }
          : item
      ),
    }));

    if (resolvedWarning?.has_warning && lotInfo) {
      setLotWarning({
        scannedLot: lotInfo,
        warning: resolvedWarning,
        targetNomorLot: lotInfo.nomor_lot,
      });
    }
  };

  const handleItemOrderChange = (idx, field, val) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        const lotInfo = updated.lot_info;
        const u = getProductUnits(lotInfo);
        const chosenUnit = field === 'satuan_order' ? val : (updated.satuan_order || u.bigUnit);
        const rasio = convertToPcs(1, chosenUnit, lotInfo);
        const qOrder = Number(field === 'qty_order' ? val : updated.qty_order) || 0;
        const calcQtyPcs = Math.round(qOrder * rasio * 100) / 100;

        return {
          ...updated,
          satuan_order: chosenUnit,
          qty_order: field === 'qty_order' ? val : updated.qty_order,
          qty_kirim: calcQtyPcs,
          kemasan_count: String(qOrder),
          rasio_pcs: rasio,
        };
      }),
    }));
  };

  const handleItemKemasanChange = (idx, kemasanVal) => {
    handleItemOrderChange(idx, 'qty_order', kemasanVal);
  };

  const handleItemQtyChange = (idx, qtyVal) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => {
        if (i !== idx) return item;
        const lotInfo = item.lot_info;
        const qNum = Number(qtyVal) || 0;
        const u = getProductUnits(lotInfo);
        const chosenUnit = item.satuan_order || u.bigUnit;
        const rasio = convertToPcs(1, chosenUnit, lotInfo);
        const calcOrder = rasio > 1 ? (qNum / rasio).toFixed(2).replace(/\.00$/, '') : String(qNum);
        return {
          ...item,
          qty_kirim: qtyVal,
          qty_order: calcOrder,
          kemasan_count: calcOrder,
          rasio_pcs: rasio,
        };
      }),
    }));
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      setError('Minimal 1 lot pengiriman dalam DO');
      return;
    }
    const emptyLot = form.items.find((i) => !i.nomor_lot.trim());
    if (emptyLot) {
      alertError('Validasi Input', 'Semua baris barang wajib memiliki Nomor Lot.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/delivery-orders', {
        ...form,
        so_id: form.so_id ? Number(form.so_id) : null,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        items: form.items.map((i) => ({
          nomor_lot: i.nomor_lot.trim(),
          qty_kirim: Number(i.qty_kirim),
          qty_order: Number(i.qty_order !== undefined ? i.qty_order : i.kemasan_count) || 1,
          satuan_order: i.satuan_order || resolveSatuanBesar(i.lot_info),
          rasio_pcs: i.rasio_pcs || 1,
        })),
      });
      flash(data.message);
      toastSuccess(data.message);
      setAddModal(false);
      setForm({
        no_do: '',
        so_id: '',
        customer_id: '',
        tanggal_do: new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        items: [{ nomor_lot: '', kemasan_count: '1', qty_kirim: 1, lot_info: null }],
      });
      loadData();
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      alertError('Gagal Membuat DO', msg);
    } finally {
      setSaving(false);
    }
  };

  // Calculate overall totals in modal
  const totalQtyPcs = form.items.reduce((sum, item) => sum + Number(item.qty_kirim || 0), 0);
  const totalKemasanBox = form.items.reduce((sum, item) => sum + Number(item.kemasan_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Kop Resmi Khusus Cetak / Print Mode */}
      <div className="hidden print:block">
        <PrintableReportHeader
          companyName={reportConfig.companyName}
          companyAddress={reportConfig.companyAddress}
          companyContact={reportConfig.companyContact}
          companyLogo={reportConfig.companyLogo}
          showCompanyHeader={reportConfig.showCompanyHeader}
          title="LAPORAN REKAPITULASI DELIVERY ORDERS (SURAT JALAN / PENGIRIMAN)"
          subtitle={`Status: ${statusFilter || 'Semua Status'} | Per Tanggal: ${formatDate(new Date())}`}
          docNo="REP-DO"
        />
      </div>

      {/* Notifikasi */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 print:hidden">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* --- Tabel DO --- */}
      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Delivery Orders (DO / Surat Jalan)</h2>
              <p className="text-xs text-slate-500">{dos.length} dokumen DO</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchableSelect
              className="w-36"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="Semua Status"
              searchPlaceholder="Cari status..."
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'DRAFT', label: 'DRAFT' },
                { value: 'SHIPPED', label: 'SHIPPED' },
                { value: 'DELIVERED', label: 'DELIVERED' },
              ]}
            />
            <input
              className="input w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No DO / SO / Customer..."
            />
            <button
              type="button"
              onClick={() => setReportCustomizerOpen(true)}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Kustomisasi Kop Perusahaan & Format Cetak"
            >
              <Sliders className="h-3.5 w-3.5 text-blue-600" />
              Kustomisasi
            </button>
            <button
              type="button"
              onClick={() => {
                const headers = ['No. DO', 'Ref SO', 'Customer', 'Tanggal DO', 'Status'];
                const rows = dos.map((d) => [
                  d.no_do || '',
                  d.no_so || '',
                  d.nama_customer || '',
                  formatDate(d.tanggal_do),
                  d.status || '',
                ]);
                exportToExcel('Rekap_Delivery_Orders_DO', headers, rows);
              }}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Export Delivery Orders ke Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
              title="Cetak Laporan Delivery Orders ke PDF"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" />
              Cetak / Export PDF
            </button>
            <button type="button" onClick={handleOpenAddModal} className="btn-primary">
              <Plus className="h-4 w-4" /> Buat DO Baru
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data Delivery Orders...
          </div>
        ) : dos.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Belum ada Delivery Order.</p>
        ) : (
          (() => {
            const { pageItems, totalPages, safePage } = paginate(dos, page, pageSize);
            return (
              <>
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="table-base print:w-full">
                    <thead>
                      <tr>
                        {reportConfig.columns?.no_do !== false && <th>No DO</th>}
                        {reportConfig.columns?.no_so !== false && <th>Ref SO</th>}
                        {reportConfig.columns?.customer !== false && <th>Customer</th>}
                        {reportConfig.columns?.tanggal_do !== false && <th>Tanggal DO</th>}
                        {reportConfig.columns?.status_do !== false && <th>Status</th>}
                        <th className="print:hidden">
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dos.map((d, index) => {
                        const isCurrentPage = index >= (safePage - 1) * pageSize && index < safePage * pageSize;
                        return (
                          <tr key={d.id} className={`hover:bg-slate-50 ${isCurrentPage ? '' : 'hidden print:table-row'}`}>
                            {reportConfig.columns?.no_do !== false && (
                              <td className="font-medium text-slate-700">{d.no_do}</td>
                            )}
                            {reportConfig.columns?.no_so !== false && (
                              <td className="text-xs text-slate-600">{d.no_so || '-'}</td>
                            )}
                            {reportConfig.columns?.customer !== false && (
                              <td>{d.nama_customer || '-'}</td>
                            )}
                            {reportConfig.columns?.tanggal_do !== false && (
                              <td className="text-xs text-slate-500">{formatDate(d.tanggal_do)}</td>
                            )}
                            {reportConfig.columns?.status_do !== false && (
                              <td>
                                <div>
                                  <span className={`badge ${statusBadges[d.status] || 'bg-slate-100'}`}>
                                    {d.status}
                                  </span>
                                  {d.kode_transaksi_out ? (
                                    <div className="mt-0.5 text-[10px] font-medium text-emerald-600">
                                      Stok Terpotong ({d.kode_transaksi_out})
                                    </div>
                                  ) : d.status === 'DRAFT' ? (
                                    <div className="mt-0.5 text-[10px] text-amber-600 font-medium">
                                      Stok Belum Dipotong
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            )}
                            <td className="print:hidden">
                              <div className="flex justify-end gap-1">
                                {d.status === 'DRAFT' && (
                                  <button
                                    type="button"
                                    onClick={() => handleShipDo(d)}
                                    disabled={shippingId === d.id}
                                    className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition"
                                    title="Kirim DO & Potong Stok Fisik Gudang"
                                    aria-label={`Kirim ${d.no_do}`}
                                  >
                                    {shippingId === d.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Truck className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handlePrintRow(d)}
                                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition"
                                  title="Cetak Surat Jalan (DO)"
                                  aria-label={`Cetak ${d.no_do}`}
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDetail(d.id)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                                  title="Lihat Detail DO"
                                  aria-label={`Detail ${d.no_do}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteDo(d)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                                  title="Hapus DO"
                                  aria-label={`Hapus ${d.no_do}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="print:hidden">
                  <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    onPage={setPage}
                    totalItems={dos.length}
                    pageSize={pageSize}
                    onPageSize={(sz) => {
                      setPageSize(sz);
                      setPage(1);
                    }}
                    label="dokumen DO"
                  />
                </div>

                {/* Blok Tanda Tangan Cetak PDF */}
                <div className="hidden print:block avoid-break mt-6">
                  <PrintableReportSignatures
                    city={reportConfig.signatureCity}
                    date={reportConfig.signatureDate}
                    signer1={reportConfig.signer1}
                    signer2={reportConfig.signer2}
                    signer3={reportConfig.signer3}
                    companyStamp={reportConfig.companyStamp}
                    showStamp={reportConfig.showStamp}
                    stampPosition={reportConfig.stampPosition}
                    showSignatures={reportConfig.showSignatures}
                    footerNote={reportConfig.footerNote}
                  />
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* Modal Kustomisasi Laporan */}
      <ReportCustomizerModal
        isOpen={reportCustomizerOpen}
        onClose={() => setReportCustomizerOpen(false)}
        config={reportConfig}
        onChangeConfig={setReportConfig}
        menuKey="DO"
        activeReportTitle="Laporan Delivery Orders (DO / Surat Jalan)"
      />

      {/* --- Modal Detail DO --- */}
      {activeDo && (
        <Modal
          isOpen={detailModal}
          title={`Detail DO: ${activeDo.no_do}`}
          onClose={() => setDetailModal(false)}
        >
          <div className="space-y-4">
            {/* Status Pemotongan Stok & Jurnal HPP Banner */}
            {activeDo.kode_transaksi_out || activeDo.status === 'SHIPPED' || activeDo.status === 'DELIVERED' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-900">
                      Stok Fisik Gudang Telah Dipotong & Jurnal HPP Tercatat
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Pengeluaran fisik lot telah dibukukan dengan nomor referensi transaksi{' '}
                      <span className="font-mono font-bold">{activeDo.kode_transaksi_out || 'OUT'}</span>. Beban Pokok Pendapatan (HPP) telah terjurnal otomatis.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  Stok Terpotong
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-900">
                      Dokumen DRAFT (Stok Fisik Belum Dipotong)
                    </h4>
                    <p className="text-[11px] text-amber-700">
                      Barang belum dikeluarkan dari gudang. Klik tombol "Kirim DO Sekarang" untuk memotong stok fisik lot dan membukukan jurnal HPP.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleShipDo(activeDo)}
                  disabled={shippingId === activeDo.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {shippingId === activeDo.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Truck className="h-3.5 w-3.5" />
                  )}
                  Kirim DO Sekarang (Potong Stok)
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
              <div>
                <span className="text-slate-500">Ref SO:</span>{' '}
                <strong className="text-slate-700">{activeDo.no_so || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Customer:</span>{' '}
                <strong className="text-slate-700">{activeDo.nama_customer || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Tanggal DO:</span>{' '}
                <strong className="text-slate-700">{formatDate(activeDo.tanggal_do)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Status Saat Ini:</span>{' '}
                <span className={`badge ${statusBadges[activeDo.status]}`}>
                  {activeDo.status}
                </span>
              </div>
            </div>

            {/* Ubah Status */}
            <div className="flex items-center gap-2 border-t border-b border-slate-100 py-3">
              <span className="text-xs font-medium text-slate-600">Ubah Status DO:</span>
              {['DRAFT', 'SHIPPED', 'DELIVERED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => changeStatus(activeDo.id, st)}
                  disabled={
                    activeDo.status === st ||
                    (st === 'DRAFT' && (activeDo.status === 'SHIPPED' || activeDo.status === 'DELIVERED'))
                  }
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    activeDo.status === st
                      ? 'bg-slate-800 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-semibold uppercase text-slate-500">Detail Lot Pengiriman</h3>
            <div className="overflow-x-auto">
              <table className="table-base text-xs">
                <thead>
                  <tr>
                    <th>Nomor Lot</th>
                    <th>Kode Produk</th>
                    <th>Nama Produk</th>
                    <th className="text-right">Qty Kirim</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDo.details?.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium text-slate-700">{d.nomor_lot}</td>
                      <td>{d.kode_produk || '-'}</td>
                      <td>{d.nama_produk || '-'}</td>
                      <td className="text-right font-semibold text-blue-600">
                        <p>{formatNumber(d.qty_kirim)} {d.satuan || ''}</p>
                        {(Number(d.isi_box_pcs) > 1 || Number(d.isi_per_kemasan) > 1) && (
                          <p className="text-[11px] text-indigo-600 font-medium">
                            ≈ {formatMultiTierBreakdown(d.qty_kirim, d)}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintRow(activeDo)}
                  className="btn-secondary !text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold"
                  title="Cetak Dokumen Surat Jalan (DO) Resmi"
                >
                  <Printer className="h-4 w-4" /> Cetak Surat Jalan (DO)
                </button>
                {activeDo.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleShipDo(activeDo)}
                    disabled={shippingId === activeDo.id}
                    className="btn-secondary !text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold"
                    title="Kirim DO & Potong Stok Fisik Gudang"
                  >
                    {shippingId === activeDo.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Truck className="h-4 w-4" />
                    )}
                    Kirim DO (Potong Stok)
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setDetailModal(false)} className="btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- Modal Buat DO Baru --- */}
      <Modal
        isOpen={addModal}
        title="Buat Delivery Order Baru (Pengiriman Barang / Surat Jalan)"
        onClose={() => setAddModal(false)}
        maxWidth="max-w-6xl"
      >
        <form onSubmit={submitAdd} className="space-y-5">
          {/* Form Header Info */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1" htmlFor="no_do">
                Nomor DO
              </label>
              <input
                id="no_do"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                value={form.no_do}
                onChange={(e) => setForm({ ...form, no_do: e.target.value })}
                placeholder="Auto jika dikosongkan"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1" htmlFor="so_id">
                Ref Sales Order (SO)
              </label>
              <SearchableSelect
                id="so_id"
                value={form.so_id}
                onChange={(e) => handleSoSelect(e.target.value)}
                placeholder="-- Tanpa SO / Independen --"
                searchPlaceholder="Cari No SO / Customer..."
                options={[
                  { value: '', label: '-- Tanpa SO / Independen --' },
                  ...sos.map((s) => ({
                    value: s.id,
                    label: `${s.no_so} (${s.nama_customer || 'Tanpa Customer'})`,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1" htmlFor="customer_id_do">
                Customer Receiver
              </label>
              <SearchableSelect
                id="customer_id_do"
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                placeholder="-- Pilih Customer --"
                searchPlaceholder="Cari kode atau nama customer..."
                options={[
                  { value: '', label: '-- Pilih Customer --' },
                  ...customers.map((c) => ({
                    value: c.id,
                    label: `${c.kode_customer} — ${c.nama_customer}`,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1" htmlFor="tanggal_do">
                Tanggal DO <span className="text-red-500">*</span>
              </label>
              <input
                id="tanggal_do"
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                value={form.tanggal_do}
                onChange={(e) => setForm({ ...form, tanggal_do: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Section Ref SO (If SO is selected) */}
          {selectedSoData && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-bold text-blue-900">
                    Item Pesanan dari SO #{selectedSoData.no_so}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={autoFillLotsFromSo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Otomatis Ambil Lot FEFO / FIFO untuk SO Ini
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white rounded-lg border border-blue-100 overflow-hidden shadow-xs">
                  <thead className="bg-blue-100/50 font-semibold text-blue-900">
                    <tr>
                      <th className="px-3.5 py-2">Produk</th>
                      <th className="px-3.5 py-2 text-right">Qty Pesan SO</th>
                      <th className="px-3.5 py-2 text-right">Telah Dikirim</th>
                      <th className="px-3.5 py-2 text-right">Sisa Kirim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 text-slate-700">
                    {selectedSoData.details?.map((item) => {
                      const remaining = Math.max(0, Number(item.qty_pesanan) - Number(item.qty_terkirim || 0));
                      return (
                        <tr key={item.id}>
                          <td className="px-3.5 py-2 font-medium">
                            {item.kode_produk} — {item.nama_produk}
                          </td>
                          <td className="px-3.5 py-2 text-right font-semibold">
                            {formatNumber(item.qty_pesanan)} {item.satuan}
                          </td>
                          <td className="px-3.5 py-2 text-right text-emerald-600 font-semibold">
                            {formatNumber(item.qty_terkirim || 0)} {item.satuan}
                          </td>
                          <td className="px-3.5 py-2 text-right text-blue-700 font-bold">
                            {formatNumber(remaining)} {item.satuan}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section Quick Scan Barcode Lot / Kode Produk */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-teal-800 min-w-[220px]">
                <ScanBarcode className="h-5 w-5 text-teal-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Scan Barcode Lot / Kode Produk</p>
                  <p className="text-[11px] text-teal-700">
                    Scan lot untuk tambah otomatis, atau scan kode produk untuk lihat rekomendasi FEFO / FIFO
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleScanLotBarcode();
                    }
                  }}
                  placeholder="Scan / ketik nomor lot atau kode produk (contoh: PRD-001) lalu Enter..."
                  className="w-full rounded-lg border border-teal-300 bg-white px-3.5 py-2 text-xs font-mono font-medium focus:border-teal-600 focus:outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleScanLotBarcode}
                  disabled={scanningBarcode || !scanInput.trim()}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 shrink-0 shadow-xs flex items-center gap-1.5"
                >
                  {scanningBarcode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanBarcode className="h-3.5 w-3.5" />}
                  Scan / Cek
                </button>
              </div>
            </div>

            {/* Peringatan Rekomendasi Prioritas Lot (Jika scan lot lebih baru / ED lebih jauh) */}
            {lotWarning && lotWarning.warning?.has_warning && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-900">
                        Peringatan Prioritas Lot ({lotWarning.warning.metode_stok}) — Ada Lot Lebih Lama / Segera Expired!
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Anda memindai lot <strong className="font-mono">{lotWarning.scannedLot.nomor_lot}</strong>
                        {lotWarning.scannedLot.expired_date ? ` (ED: ${formatDate(lotWarning.scannedLot.expired_date)})` : ''},
                        namun masih tersedia lot yang lebih diprioritaskan:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900 font-medium">
                        {lotWarning.warning.earlier_expiry_lot && (
                          <li>
                            <span className="font-semibold text-red-700">
                              {lotWarning.warning.earlier_expiry_lot.is_expiring_soon ? 'Sebentar lagi expired: ' : 'Expired lebih dekat: '}
                            </span>
                            Lot <strong className="font-mono">{lotWarning.warning.earlier_expiry_lot.nomor_lot}</strong> — ED{' '}
                            <strong>{formatDate(lotWarning.warning.earlier_expiry_lot.expired_date)}</strong>
                            {lotWarning.warning.earlier_expiry_lot.days_to_expire !== null &&
                              ` (${lotWarning.warning.earlier_expiry_lot.days_to_expire} hari lagi)`}{' '}
                            • Stok: {formatNumber(lotWarning.warning.earlier_expiry_lot.stok_qty)}{' '}
                            {lotWarning.scannedLot.satuan || 'PCS'}
                          </li>
                        )}
                        {lotWarning.warning.older_lot && (
                          <li>
                            <span className="font-semibold text-amber-900">Masuk / Produksi lebih lama: </span>
                            Lot <strong className="font-mono">{lotWarning.warning.older_lot.nomor_lot}</strong> — Tgl{' '}
                            <strong>{formatDate(lotWarning.warning.older_lot.tanggal_produksi)}</strong> • Stok:{' '}
                            {formatNumber(lotWarning.warning.older_lot.stok_qty)} {lotWarning.scannedLot.satuan || 'PCS'}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLotWarning(null)}
                    className="rounded p-1 text-amber-700 hover:bg-amber-200/60"
                    title="Tutup peringatan"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-amber-200/80">
                  <button
                    type="button"
                    onClick={() => setLotWarning(null)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Tetap Pakai {lotWarning.scannedLot.nomor_lot}
                  </button>
                  {lotWarning.warning.recommended_lot && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSwitchToRecommendedLot(
                          lotWarning.targetNomorLot,
                          lotWarning.warning.recommended_lot.nomor_lot
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 shadow-xs"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Ganti ke Lot Rekomendasi ({lotWarning.warning.recommended_lot.nomor_lot})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Rekomendasi Lot FEFO / FIFO Ketika Scan Kode Produk */}
            {scannedProductRec && (
              <div className="rounded-xl border border-indigo-200 bg-white p-3.5 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
                        Rekomendasi Lot Produk: <span className="text-indigo-700">{scannedProductRec.product.nama_produk}</span>
                      </span>
                      <span className="font-mono text-[11px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-semibold">
                        {scannedProductRec.product.kode_produk}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          scannedProductRec.metode === 'FEFO'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {scannedProductRec.metode === 'FEFO' ? 'Aturan FEFO (Expired Terdekat)' : 'Aturan FIFO (Masuk Terlama)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {scannedProductRec.metode === 'FEFO'
                        ? 'Diurutkan otomatis berdasarkan Expired Date terdekat. Pilih lot teratas yang masih valid.'
                        : 'Diurutkan otomatis berdasarkan tanggal masuk/produksi terlama.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScannedProductRec(null)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Tutup panel rekomendasi"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {scannedProductRec.lots.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Belum ada lot dengan sisa stok tersedia untuk produk ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {scannedProductRec.lots.map((lot, idx) => {
                      const effStatus = (lot.effective_status || lot.status || 'AVAILABLE').toUpperCase();
                      const isBlocked = lot.is_expired || ['QUARANTINE', 'HOLD', 'EXPIRED'].includes(effStatus);
                      const isTopRec = !isBlocked && (lot.is_recommended || idx === 0);
                      const enrichedLot = {
                        ...lot,
                        nama_produk: lot.nama_produk || scannedProductRec.product.nama_produk,
                        satuan: lot.satuan || scannedProductRec.product.satuan,
                        satuan_besar: lot.satuan_besar || scannedProductRec.product.satuan_besar,
                        satuan_menengah: lot.satuan_menengah || scannedProductRec.product.satuan_menengah,
                        isi_pack_pcs: lot.isi_pack_pcs || scannedProductRec.product.isi_pack_pcs,
                        isi_box_pack: lot.isi_box_pack || scannedProductRec.product.isi_box_pack,
                        isi_box_pcs: lot.isi_box_pcs || scannedProductRec.product.isi_box_pcs,
                        isi_per_kemasan: lot.isi_per_kemasan || scannedProductRec.product.isi_per_kemasan,
                        metode_stok: scannedProductRec.metode,
                      };

                      return (
                        <div
                          key={lot.nomor_lot}
                          className={`rounded-lg border p-2.5 flex flex-col justify-between text-xs ${
                            isBlocked
                              ? 'bg-red-50/50 border-red-200 opacity-65'
                              : isTopRec
                              ? scannedProductRec.metode === 'FEFO'
                                ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                                : 'bg-blue-50/70 border-blue-300 shadow-xs'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-bold text-slate-800">{lot.nomor_lot}</span>
                              {isTopRec && (
                                <span
                                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    scannedProductRec.metode === 'FEFO'
                                      ? 'bg-amber-200 text-amber-900'
                                      : 'bg-blue-200 text-blue-900'
                                  }`}
                                >
                                  <Sparkles className="w-2.5 h-2.5" /> Rekomendasi #{idx + 1}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              Gudang: <strong>{lot.nama_gudang || 'Utama'}</strong>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              Stok: <strong>{formatNumber(lot.stok_qty)} {enrichedLot.satuan || 'PCS'}</strong>
                              {' • '}Tgl Prod: {lot.tanggal_produksi ? formatDate(lot.tanggal_produksi) : '-'}
                            </div>
                            <div className="text-[11px]">
                              ED:{' '}
                              <strong className={lot.is_expiring_soon ? 'text-amber-700' : lot.is_expired ? 'text-red-600' : 'text-slate-700'}>
                                {lot.expired_date ? formatDate(lot.expired_date) : '-'}
                              </strong>
                              {lot.is_expiring_soon && !lot.is_expired && (
                                <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800">
                                  Segera Expired ({lot.days_to_expire} hr)
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isBlocked}
                            onClick={() => addLotToDoForm(enrichedLot, { fromScan: false })}
                            className="mt-2.5 w-full rounded-lg bg-teal-600 py-1.5 px-2 text-[11px] font-bold text-white hover:bg-teal-700 disabled:bg-slate-300 flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isBlocked ? `Dilarang (${effStatus})` : 'Ambil Lot Ini'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-teal-600" />
                Detail Lot & Kuantitas Barang yang Dikirim
              </h3>
              <button type="button" onClick={addItemRow} className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900">
                <PlusCircle className="h-4 w-4" /> Tambah Baris Lot
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 w-[32%]">Pilih / Scan Nomor Lot *</th>
                    <th className="px-3 py-2.5 w-[28%]">Informasi Produk & Stok</th>
                    <th className="px-2.5 py-2.5 w-24 text-center">Qty *</th>
                    <th className="px-2.5 py-2.5 w-36">Satuan *</th>
                    <th className="px-3 py-2.5 w-32 text-right">Total Fisik (PCS) *</th>
                    <th className="px-2 py-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {form.items.map((item, idx) => {
                    const lotInfo = item.lot_info;
                    const isi = resolveIsiPerKemasan(lotInfo);
                    const satuanBesar = resolveSatuanBesar(lotInfo);
                    const availStock = Number(lotInfo?.stok_qty || 0);
                    const isOverStock = lotInfo && Number(item.qty_kirim) > availStock;
                    const isFefo = lotInfo?.metode_stok === 'FEFO';
                    const unitOptions = getUnitDropdownOptions(lotInfo);
                    const qVal = item.qty_order !== undefined ? item.qty_order : item.kemasan_count;
                    const prev = getConversionPreviewText(qVal, item.satuan_order, lotInfo);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Row Number */}
                        <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-[11px] align-top pt-3.5">
                          {idx + 1}
                        </td>

                        {/* 2. Nomor Lot */}
                        <td className="px-3 py-2.5 align-top">
                          <SearchableSelect
                            size="sm"
                            value={item.nomor_lot}
                            onChange={(e) => handleItemLotChange(idx, e.target.value)}
                            placeholder="-- Pilih / Scan Lot --"
                            searchPlaceholder="Cari nomor lot atau produk..."
                            options={[
                              { value: '', label: '-- Pilih / Scan Lot --' },
                              ...availableLots.map((l) => ({
                                value: l.nomor_lot,
                                label: `${l.nomor_lot} — ${l.nama_produk}`,
                                sublabel: `Stok: ${l.stok_qty} ${l.satuan} | Exp: ${l.expired_date ? formatDate(l.expired_date) : '-'}`,
                              })),
                            ]}
                          />
                          {!availableLots.find((l) => l.nomor_lot === item.nomor_lot) && item.nomor_lot && (
                            <input
                              type="text"
                              className="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                              value={item.nomor_lot}
                              onChange={(e) => handleItemLotChange(idx, e.target.value)}
                              placeholder="Ketik manual jika belum terdaftar..."
                            />
                          )}
                          {item.priority_warning?.has_warning && (
                            <div className="mt-1.5 flex items-center justify-between gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
                              <span className="font-semibold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                Prioritas {item.priority_warning.metode_stok}: {item.priority_warning.recommended_lot?.nomor_lot}
                              </span>
                              {item.priority_warning.recommended_lot && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSwitchToRecommendedLot(
                                      item.nomor_lot,
                                      item.priority_warning.recommended_lot.nomor_lot
                                    )
                                  }
                                  className="shrink-0 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-amber-700"
                                >
                                  Pakai
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 3. Informasi Produk & Stok */}
                        <td className="px-3 py-2.5 align-top">
                          {lotInfo ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-800">{lotInfo.nama_produk}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                Kode: {lotInfo.kode_produk} | Gudang: {lotInfo.nama_gudang || 'Utama'}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
                                <span className="font-medium text-slate-600">
                                  Stok: <strong className="text-slate-900">{formatNumber(availStock)} {lotInfo.satuan || 'PCS'}</strong>
                                </span>
                                {isi > 1 && (
                                  <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium text-[10px]">
                                    1 {satuanBesar} = {isi} {lotInfo.satuan || 'PCS'}
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                    isFefo ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {lotInfo.metode_stok || 'FIFO'}
                                </span>
                              </div>
                              {isOverStock && (
                                <p className="text-[11px] font-bold text-red-600 flex items-center gap-1 pt-0.5">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Qty kirim melebihi stok lot!
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic py-1">
                              {item.so_product_name ? `Item SO: ${item.so_product_name}` : 'Pilih lot untuk menampilkan rincian produk & konversi'}
                            </div>
                          )}
                        </td>

                        {/* 4. Qty Order / Kirim */}
                        <td className="px-2.5 py-2.5 align-top">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            className="input w-full text-xs px-2 py-1.5 text-center font-bold text-indigo-700"
                            value={item.qty_order !== undefined ? item.qty_order : item.kemasan_count}
                            onChange={(e) => handleItemOrderChange(idx, 'qty_order', e.target.value)}
                            placeholder="1"
                            required
                          />
                        </td>

                        {/* 5. Satuan Order (SearchableSelect!) */}
                        <td className="px-2.5 py-2.5 align-top">
                          <SearchableSelect
                            size="sm"
                            className="w-full text-xs font-semibold text-slate-700"
                            value={item.satuan_order || (lotInfo?.satuan_besar || 'BOX')}
                            onChange={(e) => handleItemOrderChange(idx, 'satuan_order', e.target.value)}
                            placeholder="Satuan"
                            searchPlaceholder="Cari satuan..."
                            options={unitOptions.map((opt) => ({
                              value: opt.value,
                              label: opt.shortLabel,
                              sublabel: opt.label.includes('(')
                                ? opt.label.slice(opt.label.indexOf('(') + 1, -1)
                                : (opt.ratio > 1 ? `1 ${opt.shortLabel} = ${opt.ratio} ${lotInfo?.satuan || 'PCS'}` : 'Satuan Dasar'),
                            }))}
                          />
                          {prev && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded px-1.5 py-0.5 whitespace-nowrap">
                                {prev}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 6. Total Qty Fisik (PCS) */}
                        <td className="px-3 py-2.5 align-top">
                          <input
                            type="number"
                            min="1"
                            className="input w-full text-xs px-2 py-1.5 text-right font-bold text-teal-700"
                            value={item.qty_kirim}
                            onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                            placeholder="Qty PCS"
                            required
                          />
                          <span className="block text-[10px] text-slate-400 mt-1 text-right font-semibold">
                            {lotInfo?.satuan || 'PCS'}
                          </span>
                        </td>

                        {/* 7. Hapus Baris */}
                        <td className="px-2 py-2.5 align-top text-center pt-2.5">
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                              title="Hapus baris lot"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div className="flex items-center justify-between rounded-xl bg-slate-800 text-white p-3 px-4 text-xs font-semibold">
              <span className="text-slate-300">Total Pengiriman DO ({form.items.length} Lot)</span>
              <div className="flex items-center gap-4">
                <span>Total Kemasan: <strong className="text-amber-400 text-sm">{formatNumber(totalKemasanBox)} Kemasan / BOX</strong></span>
                <span>Total Fisik: <strong className="text-emerald-400 text-sm">{formatNumber(totalQtyPcs)} PCS</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              onClick={() => setForm((f) => ({ ...f, status: 'DRAFT' }))}
              className="btn-secondary font-semibold"
            >
              Simpan Sebagai Draft
            </button>
            <button
              type="submit"
              disabled={saving}
              onClick={() => setForm((f) => ({ ...f, status: 'SHIPPED' }))}
              className="btn-primary flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Simpan & Kirim Sekarang (Potong Stok)
            </button>
          </div>
        </form>
      </Modal>
      {/* Modal Cetak Dokumen Surat Jalan Pengiriman (DO) */}
      <PrintableInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        type="DO"
        data={selectedInvoiceData}
        loading={loadingInvoice}
      />
    </div>
  );
}
