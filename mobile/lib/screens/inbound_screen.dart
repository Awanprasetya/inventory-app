import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/product_model.dart';
import '../models/warehouse_model.dart';
import '../models/po_model.dart';
import '../models/transaction_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/barcode_scanner_view.dart';
import '../widgets/status_badge.dart';

class InboundScreen extends StatefulWidget {
  const InboundScreen({super.key});

  @override
  State<InboundScreen> createState() => _InboundScreenState();
}

class _InboundScreenState extends State<InboundScreen> {
  final _formKey = GlobalKey<FormState>();

  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  // Master Data
  List<WarehouseModel> _warehouses = [];
  List<ProductModel> _products = [];
  List<PoModel> _purchaseOrders = [];
  List<TransactionModel> _recentInbound = [];

  // Selected State
  int? _selectedWarehouseId;
  ProductModel? _selectedProduct;
  PoModel? _selectedPo;

  // Form Controllers
  final _lotController = TextEditingController();
  final _qtyController = TextEditingController(text: '1');
  final _kemasanCountController = TextEditingController(text: '1');
  final _referensiController = TextEditingController();
  final _keteranganController = TextEditingController();

  DateTime _prodDate = DateTime.now();
  DateTime _expDate = DateTime.now().add(const Duration(days: 365 * 2));
  int _shift = 1;
  String _lotStatus = 'AVAILABLE';

  final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');
  final NumberFormat _numFormat = NumberFormat('#,###', 'id_ID');

  @override
  void initState() {
    super.initState();
    _determineShift();
    _loadInitialData();
  }

  @override
  void dispose() {
    _lotController.dispose();
    _qtyController.dispose();
    _kemasanCountController.dispose();
    _referensiController.dispose();
    _keteranganController.dispose();
    super.dispose();
  }

  void _determineShift() {
    final hour = DateTime.now().hour;
    if (hour >= 7 && hour < 15) {
      _shift = 1;
    } else if (hour >= 15 && hour < 23) {
      _shift = 2;
    } else {
      _shift = 3;
    }
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
        api.getPurchaseOrders(),
        api.getTransactions(type: 'MASUK', limit: 10),
      ]);

      if (mounted) {
        final user = context.read<AuthProvider>().currentUser;
        setState(() {
          _warehouses = results[0] as List<WarehouseModel>;
          _products = results[1] as List<ProductModel>;
          _purchaseOrders = results[2] as List<PoModel>;
          _recentInbound = results[3] as List<TransactionModel>;

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

  void _generateLotNumber(String kodeProduk) {
    final now = DateTime.now();
    final dStr = DateFormat('yyyyMMdd').format(now);
    final rand = (Random().nextInt(9000) + 1000).toString();
    _lotController.text = 'LOT-$dStr-$rand';
  }

  // Handle Barcode Scanned from Camera or Manual (mendukung QR JSON Lot & Barcode biasa)
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
            Text('Mencari barcode: $cleanCode...'),
          ],
        ),
        duration: const Duration(seconds: 1),
      ),
    );

    // 1. Cek apakah barcode adalah nomor LOT
    final user = context.read<AuthProvider>().currentUser;
    final lot = await api.getLotByNumber(cleanCode, warehouseId: _selectedWarehouseId);
    if (!mounted) return;
    if (lot != null) {
      if (user != null &&
          user.isRestrictedWarehouseAdmin &&
          lot.warehouseId != null &&
          lot.warehouseId != _selectedWarehouseId) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.redAccent,
            content: Text('Lot berada di gudang lain. Anda hanya dapat input di gudang tugas Anda.'),
          ),
        );
        return;
      }
      ProductModel? prod = _products.cast<ProductModel?>().firstWhere(
        (p) => p?.kodeProduk == lot.kodeProduk,
        orElse: () => null,
      );
      prod ??= await api.getProductByCode(lot.kodeProduk);

      if (mounted) {
        if (prod != null && !_products.any((p) => p.kodeProduk == prod!.kodeProduk)) {
          _products.add(prod);
        }
        setState(() {
          _selectedProduct = prod;
          _lotController.text = lot.nomorLot;
          if (lot.tanggalProduksi != null) {
            try {
              _prodDate = DateTime.parse(lot.tanggalProduksi!);
            } catch (_) {}
          }
          if (lot.expiredDate != null) {
            try {
              _expDate = DateTime.parse(lot.expiredDate!);
            } catch (_) {}
          }
          _shift = lot.shift;
          _lotStatus = lot.status;

          final isi = prod?.isiPerKemasan ?? lot.isiPerKemasan;
          if (_selectedProduct?.kodeProduk == prod?.kodeProduk && _lotController.text == lot.nomorLot) {
            final currentKemasan = double.tryParse(_kemasanCountController.text) ?? 1.0;
            final nextKemasan = currentKemasan + 1.0;
            _kemasanCountController.text = nextKemasan.toStringAsFixed(0);
            _qtyController.text = (nextKemasan * isi).toStringAsFixed(0);
          } else {
            _kemasanCountController.text = '1';
            _qtyController.text = isi.toStringAsFixed(0);
          }
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF059669),
            content: Text('Lot Terdaftar: ${lot.nomorLot} (${lot.namaProduk})'),
          ),
        );
      }
      return;
    }

    // 2. Cek sebagai kode produk atau kemasan
    final prod = await api.getProductByCode(cleanCode);
    if (prod != null) {
      if (!_products.any((p) => p.kodeProduk == prod.kodeProduk)) {
        _products.add(prod);
      }
      if (mounted) {
        setState(() {
          _selectedProduct = prod;
          _generateLotNumber(prod.kodeProduk);

          final isi = prod.isiPerKemasan > 0 ? prod.isiPerKemasan : 1.0;
          _kemasanCountController.text = '1';
          _qtyController.text = isi.toStringAsFixed(0);
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF2563EB),
            content: Text(
              prod.isiPerKemasan > 1
                  ? 'Kemasan ${prod.satuanBesar} terdeteksi: 1 ${prod.satuanBesar} = ${prod.isiPerKemasan.toStringAsFixed(0)} ${prod.satuan}'
                  : 'Produk Terdeteksi: ${prod.namaProduk}',
            ),
          ),
        );
      }
      return;
    }

    // Jika tidak ditemukan
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text('Barcode "$cleanCode" tidak ditemukan di katalog produk atau lot.'),
        ),
      );
    }
  }

  void _onProductChanged(ProductModel? prod) {
    if (prod == null) return;
    setState(() {
      _selectedProduct = prod;
      _generateLotNumber(prod.kodeProduk);
      final isi = prod.isiPerKemasan > 0 ? prod.isiPerKemasan : 1.0;
      _kemasanCountController.text = '1';
      _qtyController.text = isi.toStringAsFixed(0);
    });
  }

  void _onKemasanChanged(String value) {
    final count = double.tryParse(value) ?? 1.0;
    final isi = _selectedProduct?.isiPerKemasan ?? 1.0;
    final total = count * isi;
    _qtyController.text = total.toStringAsFixed(0);
  }

  void _onQtyChanged(String value) {
    final qty = double.tryParse(value) ?? 1.0;
    final isi = _selectedProduct?.isiPerKemasan ?? 1.0;
    if (isi > 0) {
      final kemasan = (qty / isi).toStringAsFixed(2).replaceAll(RegExp(r'\.00$'), '');
      _kemasanCountController.text = kemasan;
    }
  }

  // Pilih dari PO
  void _showPoPicker() {
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
                  Icon(Icons.receipt_long, color: Color(0xFF2563EB)),
                  SizedBox(width: 8),
                  Text('Pilih Purchase Order (PO)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _purchaseOrders.isEmpty
                    ? const Center(child: Text('Tidak ada PO aktif yang siap diterima.'))
                    : ListView.separated(
                        controller: scrollController,
                        itemCount: _purchaseOrders.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, index) {
                          final po = _purchaseOrders[index];
                          return ListTile(
                            title: Text(po.noPo, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text('Supplier: ${po.supplierNama} • Tgl: ${po.tanggalPo}'),
                            trailing: StatusBadge(status: po.status, small: true),
                            onTap: () async {
                              Navigator.pop(ctx);
                              final api = context.read<AuthProvider>().api;
                              final poDetail = await api.getPurchaseOrderDetail(po.id);
                              if (poDetail != null && mounted) {
                                setState(() {
                                  _selectedPo = poDetail;
                                  _referensiController.text = poDetail.noPo;
                                });
                                _showPoItemPicker(poDetail);
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

  void _showPoItemPicker(PoModel po) {
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
                Text('Pilih Barang dari ${po.noPo}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: po.items.length,
                itemBuilder: (_, i) {
                  final item = po.items[i];
                  final sisa = item.sisaQty;
                  return Card(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    child: ListTile(
                      title: Text(item.namaProduk, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        'Pesan: ${item.qtyPesan} ${item.satuan} • Diterima: ${item.qtyDiterima} • Sisa: $sisa ${item.satuan}',
                      ),
                      trailing: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          final prod = _products.cast<ProductModel?>().firstWhere(
                                (p) => p?.kodeProduk == item.kodeProduk,
                                orElse: () => null,
                              );
                          final targetProd = prod ??
                              ProductModel(
                                id: item.productId,
                                kodeProduk: item.kodeProduk,
                                namaProduk: item.namaProduk,
                                satuan: item.satuan,
                              );
                          if (!_products.any((p) => p.kodeProduk == targetProd.kodeProduk)) {
                            _products.add(targetProd);
                          }
                          setState(() {
                            _selectedProduct = targetProd;
                            _generateLotNumber(item.kodeProduk);
                            final targetQty = sisa > 0 ? sisa : 1.0;
                            _qtyController.text = targetQty.toStringAsFixed(0);
                            final isi = prod?.isiPerKemasan ?? 1.0;
                            _kemasanCountController.text = (targetQty / isi).toStringAsFixed(2).replaceAll(RegExp(r'\.00$'), '');
                          });
                        },
                        child: const Text('Pilih'),
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

  Future<void> _submitInbound() async {
    if (_selectedProduct == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pilih atau scan produk terlebih dahulu!'), backgroundColor: Colors.redAccent),
      );
      return;
    }

    if (_lotController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nomor lot wajib diisi!'), backgroundColor: Colors.redAccent),
      );
      return;
    }

    final qtyVal = int.tryParse(_qtyController.text.trim()) ?? 0;
    if (qtyVal <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Qty barang masuk harus bilangan bulat lebih dari 0!'), backgroundColor: Colors.redAccent),
      );
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    final payload = {
      'warehouse_id': _selectedWarehouseId ?? 1,
      'kode_produk': _selectedProduct!.kodeProduk,
      'nomor_lot': _lotController.text.trim(),
      'tanggal_produksi': _dateFormat.format(_prodDate),
      'expired_date': _dateFormat.format(_expDate),
      'shift': _shift,
      'status': _lotStatus,
      'qty': qtyVal,
      'referensi': _referensiController.text.trim().isEmpty ? null : _referensiController.text.trim(),
      'keterangan': _keteranganController.text.trim().isEmpty ? null : _keteranganController.text.trim(),
      'purchase_order_id': _selectedPo?.id,
    };

    final api = context.read<AuthProvider>().api;
    try {
      final res = await api.createInbound(payload);
      final kodeTrx = res['data']?['kode_transaksi'] ?? 'IN-SUCCESS';

      if (mounted) {
        setState(() {
          _isSaving = false;
          // Reset Form
          _selectedProduct = null;
          _selectedPo = null;
          _lotController.clear();
          _qtyController.text = '1';
          _kemasanCountController.text = '1';
          _referensiController.clear();
          _keteranganController.clear();
        });

        // Tampilkan dialog sukses
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.check_circle, color: Color(0xFF059669), size: 48),
            title: const Text('Barang Masuk Tersimpan', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold)),
            content: Text(
              'Transaksi penerimaan barang masuk telah sukses dibukukan di sistem ERP.\n\nKode Transaksi: $kodeTrx',
              textAlign: TextAlign.center,
            ),
            actions: [
              Center(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _loadInitialData();
                  },
                  child: const Text('OK / Scan Barang Lain'),
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
          title: 'Scan Masuk (Inbound)',
          subtitle: 'Arahkan kamera ke Barcode Produk, Dus Kemasan, atau Nomor Lot',
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Barang Masuk (Inbound)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Muat Ulang',
            onPressed: _loadInitialData,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF2563EB),
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
                color: const Color(0xFFEFF6FF),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFBFDBFE)),
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
                              color: const Color(0xFF2563EB),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.camera_alt, color: Colors.white, size: 24),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Scan Cepat Kamera', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                SizedBox(height: 2),
                                Text(
                                  'Pindai barcode produk / dus kemasan / lot barang masuk',
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
                                foregroundColor: const Color(0xFF2563EB),
                                side: const BorderSide(color: Color(0xFF2563EB)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                              onPressed: _openCameraScanner,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton.icon(
                              icon: const Icon(Icons.receipt_long, size: 18),
                              label: const Text('Pilih dari PO'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF1E293B),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                              onPressed: _showPoPicker,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Form Penerimaan
              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Warehouse & PO Link Info
                    if (_selectedPo != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF10B981)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Terhubung ke PO: ${_selectedPo!.noPo}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF065F46))),
                            InkWell(
                              onTap: () => setState(() => _selectedPo = null),
                              child: const Icon(Icons.close, size: 18, color: Color(0xFF065F46)),
                            ),
                          ],
                        ),
                      ),

                    // Gudang Tujuan
                    Builder(
                      builder: (context) {
                        final isRestricted = context.watch<AuthProvider>().currentUser?.isRestrictedWarehouseAdmin ?? false;
                        return DropdownButtonFormField<int>(
                          value: _warehouses.any((w) => w.id == _selectedWarehouseId)
                              ? _selectedWarehouseId
                              : (_warehouses.isNotEmpty ? _warehouses.first.id : null),
                          decoration: InputDecoration(
                            labelText: 'Gudang Penyimpanan *',
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

                    const SizedBox(height: 12),

                    // Pilih Produk
                    DropdownButtonFormField<String>(
                      value: _selectedProduct != null && _products.any((p) => p.kodeProduk == _selectedProduct!.kodeProduk)
                          ? _selectedProduct!.kodeProduk
                          : null,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Produk *',
                        prefixIcon: Icon(Icons.inventory_2_outlined),
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      hint: const Text('Pilih atau Scan Barcode Produk'),
                      items: _products
                          .map(
                            (p) => DropdownMenuItem<String>(
                              value: p.kodeProduk,
                              child: Text('${p.namaProduk} (${p.kodeProduk})', overflow: TextOverflow.ellipsis),
                            ),
                          )
                          .toList(),
                      onChanged: (kode) {
                        if (kode != null) {
                          final p = _products.firstWhere((item) => item.kodeProduk == kode);
                          _onProductChanged(p);
                        }
                      },
                    ),

                    // Info box produk terpilih
                    if (_selectedProduct != null)
                      Container(
                        margin: const EdgeInsets.only(top: 8, bottom: 8),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey[300]!),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Satuan Dasar: ${_selectedProduct!.satuan}', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                                Text('Lokasi Rak: ${_selectedProduct!.kodeRak}', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('Kemasan: ${_selectedProduct!.satuanBesar}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                Text('1 ${_selectedProduct!.satuanBesar} = ${_selectedProduct!.isiPerKemasan.toStringAsFixed(0)} ${_selectedProduct!.satuan}', style: const TextStyle(fontSize: 11, color: Colors.blueAccent)),
                              ],
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 12),

                    // Nomor Lot
                    TextFormField(
                      controller: _lotController,
                      decoration: InputDecoration(
                        labelText: 'Nomor Lot *',
                        prefixIcon: const Icon(Icons.tag),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.autorenew, color: Color(0xFF2563EB)),
                          tooltip: 'Generate Nomor Lot Baru',
                          onPressed: () {
                            if (_selectedProduct != null) {
                              _generateLotNumber(_selectedProduct!.kodeProduk);
                            }
                          },
                        ),
                        border: const OutlineInputBorder(),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Kemasan Calculator & Quantity
                    Row(
                      children: [
                        // Jumlah Kemasan (Box / Pack)
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            controller: _kemasanCountController,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              labelText: _selectedProduct?.satuanBesar ?? 'BOX / DUS',
                              border: const OutlineInputBorder(),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            onChanged: _onKemasanChanged,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text('=', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(width: 8),
                        // Qty Total (Pcs)
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            controller: _qtyController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Total Qty (${_selectedProduct?.satuan ?? 'pcs'}) *',
                              border: const OutlineInputBorder(),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            onChanged: _onQtyChanged,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Tanggal Produksi & Expired Date
                    Row(
                      children: [
                        // Tgl Produksi
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: _prodDate,
                                firstDate: DateTime(2020),
                                lastDate: DateTime(2035),
                              );
                              if (picked != null) setState(() => _prodDate = picked);
                            },
                            child: InputDecorator(
                              decoration: const InputDecoration(
                                labelText: 'Tgl Produksi *',
                                prefixIcon: Icon(Icons.calendar_today, size: 18),
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                              ),
                              child: Text(_dateFormat.format(_prodDate), style: const TextStyle(fontSize: 13)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Tgl Expired
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: _expDate,
                                firstDate: DateTime(2020),
                                lastDate: DateTime(2035),
                              );
                              if (picked != null) setState(() => _expDate = picked);
                            },
                            child: InputDecorator(
                              decoration: const InputDecoration(
                                labelText: 'Tgl Expired *',
                                prefixIcon: Icon(Icons.event_busy, size: 18),
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                              ),
                              child: Text(_dateFormat.format(_expDate), style: const TextStyle(fontSize: 13)),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Shift & Status Lot
                    Row(
                      children: [
                        // Shift
                        Expanded(
                          child: DropdownButtonFormField<int>(
                            value: _shift,
                            decoration: const InputDecoration(
                              labelText: 'Shift Kerja *',
                              prefixIcon: Icon(Icons.schedule, size: 18),
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                            ),
                            items: const [
                              DropdownMenuItem(value: 1, child: Text('Shift 1 (Pagi)')),
                              DropdownMenuItem(value: 2, child: Text('Shift 2 (Siang)')),
                              DropdownMenuItem(value: 3, child: Text('Shift 3 (Malam)')),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _shift = val);
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Status Lot
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _lotStatus,
                            decoration: const InputDecoration(
                              labelText: 'Status Lot *',
                              prefixIcon: Icon(Icons.verified_outlined, size: 18),
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                            ),
                            items: const [
                              DropdownMenuItem(value: 'AVAILABLE', child: Text('AVAILABLE')),
                              DropdownMenuItem(value: 'QUARANTINE', child: Text('QUARANTINE')),
                              DropdownMenuItem(value: 'HOLD', child: Text('HOLD')),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _lotStatus = val);
                            },
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Referensi (No Surat Jalan / PO)
                    TextFormField(
                      controller: _referensiController,
                      decoration: const InputDecoration(
                        labelText: 'Referensi (No. Surat Jalan / No. PO)',
                        prefixIcon: Icon(Icons.description_outlined),
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Keterangan
                    TextFormField(
                      controller: _keteranganController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Catatan / Keterangan',
                        prefixIcon: Icon(Icons.notes),
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Tombol Submit
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: _isSaving ? null : _submitInbound,
                        child: _isSaving
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                                  SizedBox(width: 10),
                                  Text('Menyimpan Transaksi...', style: TextStyle(fontWeight: FontWeight.bold)),
                                ],
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.save_outlined, size: 20),
                                  SizedBox(width: 8),
                                  Text('Simpan Barang Masuk', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Riwayat 10 Transaksi Terakhir Masuk
              const Row(
                children: [
                  Icon(Icons.history, color: Colors.grey, size: 20),
                  SizedBox(width: 8),
                  Text('Riwayat Penerimaan Terakhir', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 12),

              if (_recentInbound.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(8)),
                  child: const Text('Belum ada transaksi barang masuk.', style: TextStyle(color: Colors.grey)),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _recentInbound.length,
                  itemBuilder: (_, idx) {
                    final trx = _recentInbound[idx];
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(color: Colors.grey[200]!),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFFDCFCE7),
                          child: const Icon(Icons.arrow_downward, color: Color(0xFF166534), size: 20),
                        ),
                        title: Text(trx.kodeTransaksi, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text(
                          '${trx.tanggalTransaksi} • ${trx.namaGudang}\nRef: ${trx.referensi ?? '-'} • Total: ${_numFormat.format(trx.totalQty)} item',
                          style: const TextStyle(fontSize: 12),
                        ),
                        isThreeLine: true,
                        trailing: const StatusBadge(status: 'MASUK', small: true),
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
