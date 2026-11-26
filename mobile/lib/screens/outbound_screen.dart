import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/product_model.dart';
import '../models/lot_model.dart';
import '../models/warehouse_model.dart';
import '../models/do_model.dart';
import '../models/transaction_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/barcode_scanner_view.dart';
import '../widgets/status_badge.dart';

class OutboundCartItem {
  final LotModel lot;
  final ProductModel? product;
  double qty;

  OutboundCartItem({
    required this.lot,
    this.product,
    required this.qty,
  });

  double get maxStock => lot.stokQty;
}

class OutboundScreen extends StatefulWidget {
  const OutboundScreen({super.key});

  @override
  State<OutboundScreen> createState() => _OutboundScreenState();
}

class _OutboundScreenState extends State<OutboundScreen> {
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  // Master Data
  List<WarehouseModel> _warehouses = [];
  List<ProductModel> _products = [];
  List<DoModel> _deliveryOrders = [];
  List<TransactionModel> _recentOutbound = [];

  // Outbound Cart
  final List<OutboundCartItem> _cart = [];

  // Selected State
  int? _selectedWarehouseId;
  DoModel? _selectedDo;

  final _referensiController = TextEditingController();
  final _keteranganController = TextEditingController();

  final NumberFormat _numFormat = NumberFormat('#,###', 'id_ID');

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _referensiController.dispose();
    _keteranganController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final api = context.read<AuthProvider>().api;
    try {
      final results = await Future.wait([
        api.getWarehouses(),
        api.getProducts(),
        api.getDeliveryOrders(),
        api.getTransactions(type: 'KELUAR', limit: 10),
      ]);

      if (mounted) {
        final user = context.read<AuthProvider>().currentUser;
        setState(() {
          _warehouses = results[0] as List<WarehouseModel>;
          _products = results[1] as List<ProductModel>;
          _deliveryOrders = results[2] as List<DoModel>;
          _recentOutbound = results[3] as List<TransactionModel>;

          if (user != null && user.isRestrictedWarehouseAdmin) {
            _selectedWarehouseId = user.warehouseId;
          } else if (_warehouses.isNotEmpty) {
            if (_selectedWarehouseId == null || !_warehouses.any((w) => w.id == _selectedWarehouseId)) {
              _selectedWarehouseId = _warehouses.first.id;
            }
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Gagal memuat data: ${e.toString().replaceAll('Exception: ', '')}';
          _isLoading = false;
        });
      }
    }
  }

  // Handle Scan Barcode (mendukung QR JSON Lot & Barcode biasa)
  Future<void> _handleBarcodeScanned(String code) async {
    final cleanCode = ApiService.parseScannedCode(code);
    if (cleanCode.isEmpty) return;

    final api = context.read<AuthProvider>().api;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
            const SizedBox(width: 10),
            Text('Mengecek barcode: $cleanCode...'),
          ],
        ),
        duration: const Duration(seconds: 1),
      ),
    );

    // 1. Cek apakah barcode adalah Nomor LOT langsung
    final lot = await api.getLotByNumber(cleanCode, warehouseId: _selectedWarehouseId);
    if (lot != null) {
      final hasPriorityWarning = lot.isAvailableForOutbound &&
          lot.priorityWarning != null &&
          lot.priorityWarning!['has_warning'] == true;
      if (hasPriorityWarning && mounted) {
        await _showPriorityWarningDialog(lot, api);
      } else {
        _addLotToCart(lot);
      }
      return;
    }

    // 2. Cek sebagai Kode Produk atau Barcode Dus Kemasan
    final prod = await api.getProductByCode(cleanCode);
    if (prod != null) {
      final lots = await api.getLotsByProductCode(prod.kodeProduk);
      final availableLots = lots
          .where((l) => l.stokQty > 0 && (_selectedWarehouseId == null || l.warehouseId == _selectedWarehouseId))
          .toList();

      if (mounted) {
        if (availableLots.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.amber[800],
              content: Text('Produk "${prod.namaProduk}" tidak memiliki lot dengan sisa stok.'),
            ),
          );
        } else {
          _showCandidateLotsDialog(prod, availableLots);
        }
      }
      return;
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text('Barcode "$cleanCode" tidak dikenali sebagai lot atau produk.'),
        ),
      );
    }
  }

  // Peringatan Prioritas Lot (FIFO / FEFO) saat scan lot yang lebih baru / ED lebih jauh
  Future<void> _showPriorityWarningDialog(LotModel scannedLot, dynamic api) async {
    final warn = scannedLot.priorityWarning ?? {};
    final metode = warn['metode_stok']?.toString() ?? 'FIFO';
    final rec = warn['recommended_lot'] is Map ? Map<String, dynamic>.from(warn['recommended_lot']) : null;
    final recNomor = rec?['nomor_lot']?.toString();
    final message = warn['message']?.toString() ??
        'Ada lot lain yang lebih lama atau lebih dekat masa kedaluwarsanya.';

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 46),
        title: Text(
          'Peringatan Prioritas $metode',
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Anda memindai lot ${scannedLot.nomorLot}.',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFF59E0B)),
              ),
              child: Text(
                message,
                style: const TextStyle(fontSize: 12, color: Color(0xFF92400E)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _addLotToCart(scannedLot);
            },
            child: Text('Tetap Pakai ${scannedLot.nomorLot}'),
          ),
          if (recNomor != null && recNomor.isNotEmpty)
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                Navigator.pop(ctx);
                final recLot = await api.getLotByNumber(recNomor, warehouseId: _selectedWarehouseId);
                if (recLot != null && mounted) {
                  _addLotToCart(recLot);
                }
              },
              child: Text('Pakai $recNomor'),
            ),
        ],
      ),
    );
  }

  // Proteksi Medis & QC (BPOM / Kemenkes) + Pembatasan Gudang
  void _addLotToCart(LotModel lot) {
    if (_selectedWarehouseId != null && lot.warehouseId != null && lot.warehouseId != _selectedWarehouseId) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text('Lot "${lot.nomorLot}" tersimpan di gudang lain, bukan gudang pengeluaran yang dipilih.'),
        ),
      );
      return;
    }
    if (lot.stokQty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text('Stok lot "${lot.nomorLot}" telah habis.'),
        ),
      );
      return;
    }

    if (lot.isQuarantine || lot.isExpired) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          icon: const Icon(Icons.shield, color: Colors.redAccent, size: 48),
          title: const Text('Proteksi Mutu Medis Ditolak', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
          content: Text(
            'Lot "${lot.nomorLot}" berstatus ${lot.status} (${lot.isExpired ? 'TELAH KEDALUWARSA: ${lot.expiredDate}' : 'KARANTINA'}).\n\nDilarang keras untuk pengeluaran barang operasional!',
            textAlign: TextAlign.center,
          ),
          actions: [
            Center(
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Tutup'),
              ),
            ),
          ],
        ),
      );
      return;
    }

    ProductModel? prod = _products.cast<ProductModel?>().firstWhere(
      (p) => p?.kodeProduk == lot.kodeProduk,
      orElse: () => null,
    );

    setState(() {
      final existingIndex = _cart.indexWhere((c) => c.lot.nomorLot == lot.nomorLot);
      final isi = prod?.isiPerKemasan ?? lot.isiPerKemasan;
      final step = isi > 1 ? isi : 1.0;

      if (existingIndex >= 0) {
        final current = _cart[existingIndex];
        final nextQty = (current.qty + step).clamp(1.0, current.maxStock);
        current.qty = nextQty;

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF2563EB),
            content: Text('📦 +${step.toStringAsFixed(0)} pada Lot ${lot.nomorLot} (Total: ${nextQty.toStringAsFixed(0)} ${lot.satuan})'),
          ),
        );
      } else {
        final initialQty = step.clamp(1.0, lot.stokQty);
        _cart.add(OutboundCartItem(lot: lot, product: prod, qty: initialQty));

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF059669),
            content: Text('Lot ${lot.nomorLot} ditambahkan ke keranjang keluar.'),
          ),
        );
      }
    });
  }

  void _showCandidateLotsDialog(ProductModel prod, List<LotModel> lots) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.85,
        minChildSize: 0.35,
        expand: false,
        builder: (_, scrollController) => Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.sort, color: Color(0xFF2563EB)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Rekomendasi ${prod.metodeStok} - ${prod.namaProduk}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: prod.kategoriProduk == 'MATERIAL' ? const Color(0xFFFFEDD5) : const Color(0xFFE0E7FF),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                prod.kategoriLabel,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: prod.kategoriProduk == 'MATERIAL' ? const Color(0xFF9A3412) : const Color(0xFF3730A3),
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          prod.metodeStok == 'FEFO'
                              ? 'First Expired First Out (Prioritaskan lot paling awal expired)'
                              : 'First In First Out (Prioritaskan lot masuk/produksi terlama)',
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  controller: scrollController,
                  itemCount: lots.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final lot = lots[i];
                    final isSafe = lot.isAvailableForOutbound;
                    final isTopRec = isSafe && (lot.isRecommended || i == 0);
                    final expSoon = !lot.isExpired && lot.daysToExpire != null && lot.daysToExpire! <= 90;
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      title: Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        children: [
                          Text(lot.nomorLot, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          StatusBadge(status: lot.status, small: true),
                          if (isTopRec)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: prod.metodeStok == 'FEFO' ? const Color(0xFFFEF3C7) : const Color(0xFFDBEAFE),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'Rekomendasi #1 ${prod.metodeStok}',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: prod.metodeStok == 'FEFO' ? const Color(0xFF92400E) : const Color(0xFF1E40AF),
                                ),
                              ),
                            ),
                        ],
                      ),
                      subtitle: Text(
                        'Sisa Stok: ${_numFormat.format(lot.stokQty)} ${lot.satuan} • Exp: ${lot.expiredDate ?? '-'}${expSoon ? ' (${lot.daysToExpire} hr lagi!)' : ''}',
                        style: TextStyle(
                          color: lot.isExpired ? Colors.red : (expSoon ? const Color(0xFFB45309) : Colors.black87),
                          fontWeight: (lot.isExpired || expSoon) ? FontWeight.bold : FontWeight.normal,
                          fontSize: 12,
                        ),
                      ),
                      trailing: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isSafe ? const Color(0xFF2563EB) : Colors.grey,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        ),
                        onPressed: isSafe
                            ? () {
                                Navigator.pop(ctx);
                                _addLotToCart(lot);
                              }
                            : null,
                        child: Text(isSafe ? '+ Pilih Lot' : 'Dilarang'),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Pilih dari DO
  void _showDoPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollController) => Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 12),
              const Row(
                children: [
                  Icon(Icons.local_shipping, color: Color(0xFFD97706)),
                  SizedBox(width: 8),
                  Text('Pilih Delivery Order (DO)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _deliveryOrders.isEmpty
                    ? const Center(child: Text('Tidak ada DO yang menunggu pengiriman.'))
                    : ListView.separated(
                        controller: scrollController,
                        itemCount: _deliveryOrders.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, index) {
                          final d = _deliveryOrders[index];
                          return ListTile(
                            title: Text(d.noDo, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text('Customer: ${d.customerNama} • Tgl: ${d.tanggalDo}'),
                            trailing: StatusBadge(status: d.status, small: true),
                            onTap: () async {
                              Navigator.pop(ctx);
                              final api = context.read<AuthProvider>().api;
                              final doDetail = await api.getDeliveryOrderDetail(d.id);
                              if (doDetail != null && mounted) {
                                setState(() {
                                  _selectedDo = doDetail;
                                  _referensiController.text = doDetail.noDo;
                                });
                                _showDoItemPicker(doDetail);
                              }
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDoItemPicker(DoModel d) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Barang Pesanan DO: ${d.noDo}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: d.items.length,
                itemBuilder: (_, i) {
                  final item = d.items[i];
                  return Card(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    child: ListTile(
                      title: Text(item.namaProduk, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('Order: ${item.qtyOrder} ${item.satuan} • Dikirim: ${item.qtyDikirim}'),
                      trailing: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                        ),
                        onPressed: () async {
                          Navigator.pop(ctx);
                          final api = context.read<AuthProvider>().api;
                          final prod = _products.cast<ProductModel?>().firstWhere(
                                (p) => p?.kodeProduk == item.kodeProduk,
                                orElse: () => null,
                              );
                          final lots = await api.getLotsByProductCode(item.kodeProduk);
                          final available = lots
                              .where((l) => l.stokQty > 0 && (_selectedWarehouseId == null || l.warehouseId == _selectedWarehouseId))
                              .toList();
                          if (mounted) {
                            if (available.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: Colors.redAccent,
                                  content: Text('Tidak ada sisa stok lot untuk "${item.namaProduk}".'),
                                ),
                              );
                            } else {
                              _showCandidateLotsDialog(prod ?? ProductModel(id: item.productId, kodeProduk: item.kodeProduk, namaProduk: item.namaProduk, satuan: item.satuan), available);
                            }
                          }
                        },
                        child: const Text('Cari Lot'),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _updateCartQty(int index, double newQty) {
    setState(() {
      final item = _cart[index];
      item.qty = newQty.clamp(1.0, item.maxStock);
    });
  }

  void _removeCartItem(int index) {
    setState(() {
      _cart.removeAt(index);
    });
  }

  Future<void> _submitOutbound() async {
    if (_cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Keranjang pengeluaran masih kosong. Scan atau pilih lot barang!'), backgroundColor: Colors.redAccent),
      );
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    final payload = {
      'warehouse_id': _selectedWarehouseId ?? 1,
      'items': _cart.map((c) => {'nomor_lot': c.lot.nomorLot, 'qty': c.qty.toInt()}).toList(),
      'referensi': _referensiController.text.trim().isEmpty ? null : _referensiController.text.trim(),
      'keterangan': _keteranganController.text.trim().isEmpty ? null : _keteranganController.text.trim(),
      'delivery_order_id': _selectedDo?.id,
    };

    final api = context.read<AuthProvider>().api;
    try {
      final res = await api.createOutbound(payload);
      final kodeTrx = res['data']?['kode_transaksi'] ?? 'OUT-SUCCESS';

      if (mounted) {
        setState(() {
          _isSaving = false;
          _cart.clear();
          _selectedDo = null;
          _referensiController.clear();
          _keteranganController.clear();
        });

        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.check_circle, color: Color(0xFFD97706), size: 48),
            title: const Text('Barang Keluar Berhasil', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold)),
            content: Text(
              'Transaksi pengeluaran barang berhasil disimpan dan stok gudang telah terpotong.\n\nKode Transaksi: $kodeTrx',
              textAlign: TextAlign.center,
            ),
            actions: [
              Center(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _loadInitialData();
                  },
                  child: const Text('Selesai / Scan Lainnya'),
                ),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaving = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  void _openCameraScanner() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BarcodeScannerView(
          title: 'Scan Keluar (Outbound)',
          subtitle: 'Arahkan kamera ke Barcode Lot atau Kode Produk yang akan dikeluarkan',
          onScanned: (code) => _handleBarcodeScanned(code),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final totalCartQty = _cart.fold(0.0, (sum, c) => sum + c.qty);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Barang Keluar (Outbound)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Muat Ulang',
            onPressed: _loadInitialData,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD97706),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.qr_code_scanner, size: 24),
        label: const Text('Scan Kamera', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _openCameraScanner,
      ),
      body: RefreshIndicator(
        onRefresh: _loadInitialData,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 90),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Banner Error & Success
              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFEF4444)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Color(0xFFDC2626)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_errorMessage!, style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13)),
                      ),
                    ],
                  ),
                ),

              // Card Quick Scanner Barcode
              Card(
                elevation: 0,
                color: const Color(0xFFFFFBEB),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFFDE68A)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD97706),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.camera_alt, color: Colors.white, size: 24),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Scan Barcode Pengeluaran', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                SizedBox(height: 2),
                                Text(
                                  'Pindai nomor lot fisik atau kode barang yang siap dikirim',
                                  style: TextStyle(color: Colors.black54, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.qr_code_scanner),
                              label: const Text('Buka Kamera'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFFD97706),
                                side: const BorderSide(color: Color(0xFFD97706)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                              onPressed: _openCameraScanner,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton.icon(
                              icon: const Icon(Icons.local_shipping, size: 18),
                              label: const Text('Pilih dari DO'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF1E293B),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                              onPressed: _showDoPicker,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Delivery Order Link Info
              if (_selectedDo != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFF59E0B)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Terhubung ke DO: ${_selectedDo!.noDo}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFFB45309))),
                      InkWell(
                        onTap: () => setState(() => _selectedDo = null),
                        child: const Icon(Icons.close, size: 18, color: Color(0xFFB45309)),
                      ),
                    ],
                  ),
                ),

              // Gudang Asal Pengeluaran
              Builder(
                builder: (context) {
                  final isRestricted = context.watch<AuthProvider>().currentUser?.isRestrictedWarehouseAdmin ?? false;
                  return DropdownButtonFormField<int>(
                    value: _warehouses.any((w) => w.id == _selectedWarehouseId)
                        ? _selectedWarehouseId
                        : (_warehouses.isNotEmpty ? _warehouses.first.id : null),
                    decoration: InputDecoration(
                      labelText: 'Gudang Pengeluaran *',
                      helperText: isRestricted ? 'Terkunci sesuai gudang penugasan Anda' : null,
                      prefixIcon: const Icon(Icons.warehouse_outlined),
                      border: const OutlineInputBorder(),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    items: _warehouses
                        .map((w) => DropdownMenuItem<int>(
                              value: w.id,
                              child: Text('${w.namaGudang} (${w.kodeGudang})'),
                            ))
                        .toList(),
                    onChanged: isRestricted ? null : (val) => setState(() => _selectedWarehouseId = val),
                  );
                },
              ),

              const SizedBox(height: 16),

              // KERANJANG PENGELUARAN BARANG
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.shopping_cart_outlined, size: 20, color: Color(0xFFD97706)),
                      const SizedBox(width: 8),
                      const Text('Daftar Barang Keluar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(10)),
                        child: Text('${_cart.length} item', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF92400E))),
                      ),
                    ],
                  ),
                  if (_cart.isNotEmpty)
                    TextButton(
                      onPressed: () => setState(() => _cart.clear()),
                      child: const Text('Kosongkan', style: TextStyle(color: Colors.red, fontSize: 12)),
                    ),
                ],
              ),

              const SizedBox(height: 8),

              if (_cart.isEmpty)
                Container(
                  padding: const EdgeInsets.all(28),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.grey[50],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey[300]!, style: BorderStyle.solid),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.qr_code_scanner, size: 40, color: Colors.grey[400]),
                      const SizedBox(height: 8),
                      const Text(
                        'Keranjang masih kosong\nTekan tombol "Scan Kamera" untuk mulai memindai barcode lot barang keluar.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                    ],
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _cart.length,
                  itemBuilder: (_, index) {
                    final item = _cart[index];
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(color: Colors.grey[300]!),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    item.lot.namaProduk,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                  onPressed: () => _removeCartItem(index),
                                ),
                              ],
                            ),
                            Text(
                              'Lot: ${item.lot.nomorLot} • Sisa Stok: ${_numFormat.format(item.maxStock)} ${item.lot.satuan}',
                              style: const TextStyle(fontSize: 12, color: Colors.black54),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                StatusBadge(status: item.lot.status, small: true),
                                // Qty Stepper
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.remove_circle_outline, color: Colors.grey),
                                      onPressed: () => _updateCartQty(index, item.qty - 1),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: Colors.grey[100],
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: Colors.grey[300]!),
                                      ),
                                      child: Text(
                                        '${item.qty.toStringAsFixed(0)} ${item.lot.satuan}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.add_circle_outline, color: Color(0xFFD97706)),
                                      onPressed: () => _updateCartQty(index, item.qty + 1),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),

              const SizedBox(height: 16),

              // Referensi & Keterangan Form
              TextFormField(
                controller: _referensiController,
                decoration: const InputDecoration(
                  labelText: 'Referensi (No. DO / No. Resi / Surat Jalan)',
                  prefixIcon: Icon(Icons.description_outlined),
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),

              const SizedBox(height: 12),

              TextFormField(
                controller: _keteranganController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Catatan Pengeluaran',
                  prefixIcon: Icon(Icons.notes),
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),

              const SizedBox(height: 20),

              // Tombol Submit Outbound
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: (_isSaving || _cart.isEmpty) ? null : _submitOutbound,
                  child: _isSaving
                      ? const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                            SizedBox(width: 10),
                            Text('Memproses Pengeluaran...', style: TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.send_outlined, size: 20),
                            const SizedBox(width: 8),
                            Text('Keluarkan ${_cart.length} Lot (${totalCartQty.toStringAsFixed(0)} item)', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 28),

              // Riwayat Transaksi Keluar
              const Row(
                children: [
                  Icon(Icons.history, color: Colors.grey, size: 20),
                  SizedBox(width: 8),
                  Text('Riwayat Pengeluaran Terakhir', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 12),

              if (_recentOutbound.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(8)),
                  child: const Text('Belum ada transaksi barang keluar.', style: TextStyle(color: Colors.grey)),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _recentOutbound.length,
                  itemBuilder: (_, idx) {
                    final trx = _recentOutbound[idx];
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(color: Colors.grey[200]!),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFFFFEDD5),
                          child: const Icon(Icons.arrow_upward, color: Color(0xFF9A3412), size: 20),
                        ),
                        title: Text(trx.kodeTransaksi, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text(
                          '${trx.tanggalTransaksi} • ${trx.namaGudang}\nRef: ${trx.referensi ?? '-'} • Total: ${_numFormat.format(trx.totalQty)} item',
                          style: const TextStyle(fontSize: 12),
                        ),
                        isThreeLine: true,
                        trailing: const StatusBadge(status: 'KELUAR', small: true),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
