import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/lot_model.dart';
import '../models/product_model.dart';
import '../models/warehouse_model.dart';
import '../providers/auth_provider.dart';
import '../widgets/status_badge.dart';

class StockCardScreen extends StatefulWidget {
  const StockCardScreen({super.key});

  @override
  State<StockCardScreen> createState() => _StockCardScreenState();
}

class _StockCardScreenState extends State<StockCardScreen> with SingleTickerProviderStateMixin {
  bool _isLoadingProducts = true;
  bool _isLoadingDetail = false;
  String? _errorMessage;

  List<WarehouseModel> _warehouses = [];
  List<ProductModel> _products = [];
  int? _selectedWarehouseId; // null = Semua Gudang
  String _searchQuery = '';
  String _selectedKategori = 'ALL';

  // Detail State
  ProductModel? _activeProduct;
  List<LotModel> _lots = [];
  List<dynamic> _mutations = [];
  Map<String, dynamic> _ringkasan = {};

  late final TabController _tabController;
  final NumberFormat _numFormat = NumberFormat('#,###', 'id_ID');

  static const _positiveTypes = ['MASUK', 'ADJUSTMENT_MASUK', 'TRANSFER_MASUK', 'RETUR_JUAL'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadInitial();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _isLoadingProducts = true;
      _errorMessage = null;
    });
    final api = context.read<AuthProvider>().api;
    try {
      final results = await Future.wait([
        api.getWarehouses(),
        api.getProducts(warehouseId: _selectedWarehouseId),
      ]);
      if (mounted) {
        setState(() {
          _warehouses = results[0] as List<WarehouseModel>;
          _products = results[1] as List<ProductModel>;
          _isLoadingProducts = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoadingProducts = false;
        });
      }
    }
  }

  Future<void> _reloadProductsForWarehouse() async {
    setState(() => _isLoadingProducts = true);
    try {
      final prods = await context.read<AuthProvider>().api.getProducts(warehouseId: _selectedWarehouseId);
      if (mounted) {
        setState(() {
          _products = prods;
          _isLoadingProducts = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingProducts = false);
    }
  }

  Future<void> _openProductDetail(ProductModel prod) async {
    setState(() {
      _activeProduct = prod;
      _isLoadingDetail = true;
      _errorMessage = null;
      _tabController.index = 0; // Default ke Tab Lot Produk
    });

    final api = context.read<AuthProvider>().api;
    try {
      final results = await Future.wait([
        api.getLotsByProductCode(prod.kodeProduk),
        api.getStockCard(prod.kodeProduk, warehouseId: _selectedWarehouseId),
      ]);

      final allLots = results[0] as List<LotModel>;
      final cardData = results[1] as Map<String, dynamic>;

      if (mounted) {
        setState(() {
          _lots = _selectedWarehouseId == null
              ? allLots
              : allLots.where((l) => l.warehouseId == _selectedWarehouseId).toList();
          _mutations = cardData['rows'] as List<dynamic>? ?? [];
          _ringkasan = cardData['ringkasan'] as Map<String, dynamic>? ?? {};
          _isLoadingDetail = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoadingDetail = false;
        });
      }
    }
  }

  List<ProductModel> get _filteredProducts {
    final q = _searchQuery.trim().toLowerCase();
    return _products.where((p) {
      final matchCat = _selectedKategori == 'ALL' || p.kategoriProduk.toUpperCase() == _selectedKategori;
      final matchSearch = q.isEmpty ||
          p.kodeProduk.toLowerCase().contains(q) ||
          p.namaProduk.toLowerCase().contains(q) ||
          p.kodeRak.toLowerCase().contains(q);
      return matchCat && matchSearch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: _activeProduct != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _activeProduct = null),
              )
            : null,
        title: Text(
          _activeProduct != null ? _activeProduct!.namaProduk : 'Kartu Stok & Lot',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              if (_activeProduct != null) {
                _openProductDetail(_activeProduct!);
              } else {
                _loadInitial();
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Gudang Global (Selalu ada di Daftar Produk & Detail Produk)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Column(
              children: [
                DropdownButtonFormField<int?>(
                  value: _selectedWarehouseId != null && _warehouses.any((w) => w.id == _selectedWarehouseId)
                      ? _selectedWarehouseId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Filter Gudang Tertentu',
                    prefixIcon: Icon(Icons.warehouse_outlined, size: 20),
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  items: [
                    const DropdownMenuItem<int?>(value: null, child: Text('-- Semua Gudang Penyimpanan --')),
                    ..._warehouses.map((w) => DropdownMenuItem<int?>(
                          value: w.id,
                          child: Text('${w.namaGudang} (${w.kodeGudang})'),
                        )),
                  ],
                  onChanged: (val) {
                    setState(() => _selectedWarehouseId = val);
                    _reloadProductsForWarehouse();
                    if (_activeProduct != null) {
                      _openProductDetail(_activeProduct!);
                    }
                  },
                ),
                if (_activeProduct == null) ...[
                  const SizedBox(height: 8),
                  TextField(
                    decoration: const InputDecoration(
                      hintText: 'Cari kode, nama produk, atau rak...',
                      prefixIcon: Icon(Icons.search, size: 20),
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onChanged: (v) => setState(() => _searchQuery = v),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      for (final opt in const [
                        {'val': 'ALL', 'label': 'Semua'},
                        {'val': 'MATERIAL', 'label': 'Material'},
                        {'val': 'BARANG_JADI', 'label': 'Barang Jadi'},
                      ])
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(opt['label']!, style: const TextStyle(fontSize: 12)),
                            selected: _selectedKategori == opt['val'],
                            onSelected: (_) => setState(() => _selectedKategori = opt['val']!),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 13)),
            ),

          Expanded(
            child: _activeProduct == null ? _buildProductListView() : _buildProductDetailView(),
          ),
        ],
      ),
    );
  }

  // VIEW 1: DAFTAR SELURUH PRODUK
  Widget _buildProductListView() {
    if (_isLoadingProducts) {
      return const Center(child: CircularProgressIndicator());
    }
    final list = _filteredProducts;
    if (list.isEmpty) {
      return const Center(child: Text('Produk tidak ditemukan.', style: TextStyle(color: Colors.grey)));
    }

    return RefreshIndicator(
      onRefresh: _reloadProductsForWarehouse,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        itemBuilder: (_, idx) {
          final p = list[idx];
          return Card(
            margin: const EdgeInsets.symmetric(vertical: 5),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              onTap: () => _openProductDetail(p),
              title: Row(
                children: [
                  Expanded(
                    child: Text(p.namaProduk, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                  Container(
                    margin: const EdgeInsets.only(right: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: p.kategoriProduk == 'MATERIAL' ? const Color(0xFFFFEDD5) : const Color(0xFFE0E7FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      p.kategoriLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: p.kategoriProduk == 'MATERIAL' ? const Color(0xFF9A3412) : const Color(0xFF3730A3),
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: p.metodeStok == 'FEFO' ? const Color(0xFFFEF3C7) : const Color(0xFFDBEAFE),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      p.metodeStok,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: p.metodeStok == 'FEFO' ? const Color(0xFF92400E) : const Color(0xFF1E40AF),
                      ),
                    ),
                  ),
                ],
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${p.kodeProduk} • Rak: ${p.kodeRak} • ${p.jumlahLot} Lot', style: const TextStyle(fontSize: 12)),
                    Text(
                      '${_numFormat.format(p.totalStok)} ${p.satuan}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: p.totalStok > 0 ? const Color(0xFF059669) : Colors.red,
                      ),
                    ),
                  ],
                ),
              ),
              trailing: const Icon(Icons.chevron_right, color: Colors.grey),
            ),
          );
        },
      ),
    );
  }

  // VIEW 2: DETAIL PRODUK (RINGKASAN + TAB LOT & TAB MUTASI SALDO BERJALAN)
  Widget _buildProductDetailView() {
    if (_isLoadingDetail) {
      return const Center(child: CircularProgressIndicator());
    }

    final totalMasuk = double.tryParse(_ringkasan['total_masuk']?.toString() ?? '0') ?? 0.0;
    final totalKeluar = double.tryParse(_ringkasan['total_keluar']?.toString() ?? '0') ?? 0.0;
    final saldo = double.tryParse(_ringkasan['saldo']?.toString() ?? '0') ?? 0.0;
    final unit = _activeProduct?.satuan ?? 'pcs';

    return Column(
      children: [
        // Ringkasan 3 Metrik
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Row(
            children: [
              _miniMetric('Masuk', '+${_numFormat.format(totalMasuk)} $unit', const Color(0xFF059669), const Color(0xFFDCFCE7)),
              const SizedBox(width: 8),
              _miniMetric('Keluar', '-${_numFormat.format(totalKeluar)} $unit', const Color(0xFFD97706), const Color(0xFFFEF3C7)),
              const SizedBox(width: 8),
              _miniMetric('Saldo Akhir', '${_numFormat.format(saldo)} $unit', const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
            ],
          ),
        ),

        // Tabs
        Container(
          color: Colors.white,
          child: TabBar(
            controller: _tabController,
            labelColor: const Color(0xFF2563EB),
            unselectedLabelColor: Colors.grey,
            indicatorColor: const Color(0xFF2563EB),
            tabs: [
              Tab(text: 'Batch / Lot (${_lots.length})'),
              Tab(text: 'Mutasi Saldo (${_mutations.length})'),
            ],
          ),
        ),

        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildLotsTab(unit),
              _buildMutationsTab(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _miniMetric(String label, String val, Color fg, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 10, color: fg, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(val, style: TextStyle(fontSize: 12, color: fg, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }

  Widget _buildLotsTab(String unit) {
    if (_lots.isEmpty) {
      return const Center(child: Text('Belum ada batch/lot untuk produk ini.', style: TextStyle(color: Colors.grey)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: _lots.length,
      itemBuilder: (_, i) {
        final lot = _lots[i];
        return Card(
          margin: const EdgeInsets.symmetric(vertical: 4),
          child: ListTile(
            title: Row(
              children: [
                Expanded(child: Text(lot.nomorLot, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
                StatusBadge(status: lot.effectiveStatus, small: true),
              ],
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${lot.namaGudang ?? 'Gudang Utama'} • Prod: ${lot.tanggalProduksi ?? '-'} • ED: ${lot.expiredDate ?? '-'}\nStok Lot: ${_numFormat.format(lot.stokQty)} $unit • Shift ${lot.shift}',
                style: const TextStyle(fontSize: 12),
              ),
            ),
            isThreeLine: true,
          ),
        );
      },
    );
  }

  Widget _buildMutationsTab() {
    if (_mutations.isEmpty) {
      return const Center(child: Text('Belum ada catatan mutasi saldo.', style: TextStyle(color: Colors.grey)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(14),
      itemCount: _mutations.length,
      itemBuilder: (_, i) {
        final row = _mutations[i] as Map<String, dynamic>;
        final tipe = row['tipe']?.toString() ?? '';
        final isPos = _positiveTypes.contains(tipe);
        final qty = double.tryParse(row['qty_perubahan']?.toString() ?? '0') ?? 0.0;
        final sisa = double.tryParse(row['qty_sisa']?.toString() ?? '0') ?? 0.0;

        return Card(
          margin: const EdgeInsets.symmetric(vertical: 4),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: isPos ? const Color(0xFFDCFCE7) : const Color(0xFFFFEDD5),
              child: Icon(isPos ? Icons.add : Icons.remove, color: isPos ? const Color(0xFF166534) : const Color(0xFF9A3412), size: 18),
            ),
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Text(tipe, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                Text(
                  '${isPos ? '+' : '-'}${_numFormat.format(qty)}',
                  style: TextStyle(fontWeight: FontWeight.bold, color: isPos ? const Color(0xFF059669) : const Color(0xFFD97706)),
                ),
              ],
            ),
            subtitle: Text(
              'Lot: ${row['nomor_lot'] ?? '-'} • ${row['nama_gudang'] ?? '-'}\nSisa Saldo: ${_numFormat.format(sisa)} • Ref: ${row['referensi'] ?? '-'}',
              style: const TextStyle(fontSize: 11),
            ),
            isThreeLine: true,
          ),
        );
      },
    );
  }
}
