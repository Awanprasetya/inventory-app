import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/product_model.dart';
import '../models/warehouse_model.dart';
import '../providers/auth_provider.dart';

class OpnameScreen extends StatefulWidget {
  const OpnameScreen({super.key});

  @override
  State<OpnameScreen> createState() => _OpnameScreenState();
}

class _OpnameScreenState extends State<OpnameScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  String _searchQuery = '';
  int? _selectedWarehouseId;
  String _selectedMonth = ''; // '' = Semua Bulan, atau 'YYYY-MM'

  List<dynamic> _adjustments = [];
  List<WarehouseModel> _warehouses = [];
  List<ProductModel> _products = [];

  final NumberFormat _numFormat = NumberFormat('#,###', 'id_ID');
  final NumberFormat _currFormat = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = context.read<AuthProvider>();
    final api = auth.api;
    final user = auth.currentUser;

    try {
      final results = await Future.wait([
        api.getStockAdjustments(),
        api.getWarehouses(),
        api.getProducts(),
      ]);
      if (mounted) {
        setState(() {
          _adjustments = results[0];
          _warehouses = results[1] as List<WarehouseModel>;
          _products = results[2] as List<ProductModel>;
          if (user != null && user.isRestrictedWarehouseAdmin) {
            _selectedWarehouseId = user.warehouseId;
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  List<String> get _availableMonths {
    final months = <String>{};
    for (final a in _adjustments) {
      final tgl = a['tanggal']?.toString() ?? '';
      if (tgl.length >= 7) {
        months.add(tgl.substring(0, 7));
      }
    }
    final list = months.toList()..sort((a, b) => b.compareTo(a));
    return list;
  }

  List<dynamic> get _filteredAdjustments {
    final q = _searchQuery.trim().toLowerCase();
    return _adjustments.where((a) {
      final noAdj = (a['no_adjustment']?.toString() ?? '').toLowerCase();
      final catatan = (a['catatan']?.toString() ?? '').toLowerCase();
      final whId = int.tryParse(a['warehouse_id']?.toString() ?? '');
      final tgl = a['tanggal']?.toString() ?? '';

      final matchSearch = q.isEmpty || noAdj.contains(q) || catatan.contains(q);
      final matchWh = _selectedWarehouseId == null || whId == _selectedWarehouseId;
      final matchMonth = _selectedMonth.isEmpty || (tgl.length >= 7 && tgl.substring(0, 7) == _selectedMonth);
      return matchSearch && matchWh && matchMonth;
    }).toList();
  }

  void _openCreateOpnameSheet() {
    if (_warehouses.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(backgroundColor: Colors.orange, content: Text('Data gudang belum tersedia.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _CreateOpnameSheet(
        warehouses: _warehouses,
        allProducts: _products,
        initialWarehouseId: _selectedWarehouseId,
        onSubmitted: _loadData,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final isRestricted = user?.isRestrictedWarehouseAdmin ?? false;
    final filtered = _filteredAdjustments;
    final monthOptions = _availableMonths;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stok Opname (Audit)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF4F46E5),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.fact_check_outlined),
        label: const Text('Mulai Opname', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _openCreateOpnameSheet,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: Column(
                children: [
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        TextField(
                          decoration: const InputDecoration(
                            hintText: 'Cari nomor opname atau catatan...',
                            prefixIcon: Icon(Icons.search, size: 20),
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          onChanged: (v) => setState(() => _searchQuery = v),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: DropdownButtonFormField<int?>(
                                value: (_selectedWarehouseId != null && _warehouses.any((w) => w.id == _selectedWarehouseId))
                                    ? _selectedWarehouseId
                                    : null,
                                isExpanded: true,
                                decoration: InputDecoration(
                                  labelText: isRestricted ? 'Gudang Tugas (Terkunci)' : 'Filter Gudang',
                                  border: const OutlineInputBorder(),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                                items: [
                                  if (!isRestricted)
                                    const DropdownMenuItem<int?>(value: null, child: Text('Semua Gudang')),
                                  ..._warehouses
                                      .where((w) => !isRestricted || w.id == user?.warehouseId)
                                      .map((w) => DropdownMenuItem<int?>(
                                            value: w.id,
                                            child: Text('${w.kodeGudang} - ${w.namaGudang}', overflow: TextOverflow.ellipsis),
                                          )),
                                ],
                                onChanged: isRestricted
                                    ? null
                                    : (val) => setState(() => _selectedWarehouseId = val),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              flex: 2,
                              child: DropdownButtonFormField<String>(
                                value: monthOptions.contains(_selectedMonth) ? _selectedMonth : '',
                                isExpanded: true,
                                decoration: const InputDecoration(
                                  labelText: 'Filter Bulan',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                                items: [
                                  const DropdownMenuItem(value: '', child: Text('Semua Bulan')),
                                  ...monthOptions.map((m) => DropdownMenuItem(value: m, child: Text(m))),
                                ],
                                onChanged: (val) => setState(() => _selectedMonth = val ?? ''),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                    ),
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.fact_check_outlined, size: 52, color: Colors.grey[350]),
                                const SizedBox(height: 8),
                                const Text('Belum ada riwayat stok opname', style: TextStyle(color: Colors.grey)),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.only(left: 14, right: 14, top: 8, bottom: 90),
                            itemCount: filtered.length,
                            itemBuilder: (_, idx) {
                              final adj = filtered[idx] as Map<String, dynamic>;
                              final items = (adj['items'] as List<dynamic>? ?? []);
                              final selisihNominal = double.tryParse(adj['total_selisih_nominal']?.toString() ?? '0') ?? 0.0;
                              final isPlus = selisihNominal >= 0;

                              return Card(
                                margin: const EdgeInsets.symmetric(vertical: 5),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                adj['no_adjustment']?.toString() ?? '-',
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                              ),
                                              Text(
                                                '${adj['tanggal'] ?? '-'} • ${adj['nama_gudang'] ?? '-'}',
                                                style: const TextStyle(fontSize: 11, color: Colors.grey),
                                              ),
                                            ],
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFEEF2FF),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              adj['tipe_adjustment']?.toString() ?? 'OPNAME_FISIK',
                                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF4338CA)),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const Divider(height: 16),
                                      ...items.map((it) {
                                        final satuan = (it['satuan']?.toString() ?? 'PCS').toUpperCase();
                                        final fisik = double.tryParse(it['stok_fisik']?.toString() ?? '0') ?? 0;
                                        final sistem = double.tryParse(it['stok_sistem']?.toString() ?? '0') ?? 0;
                                        final diff = double.tryParse(it['selisih_qty']?.toString() ?? '0') ?? 0;
                                        return Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 2),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  '${it['nama_produk']}: Fisik ${_numFormat.format(fisik)} $satuan (Sistem ${_numFormat.format(sistem)} $satuan)',
                                                  style: const TextStyle(fontSize: 12),
                                                ),
                                              ),
                                              Text(
                                                '${diff > 0 ? '+' : ''}${_numFormat.format(diff)} $satuan',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                  color: diff >= 0 ? const Color(0xFF059669) : Colors.red,
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      }),
                                      const SizedBox(height: 8),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            'Petugas: ${adj['created_by_name'] ?? 'Admin'}',
                                            style: const TextStyle(fontSize: 11, color: Colors.black54),
                                          ),
                                          Text(
                                            'Selisih: ${_currFormat.format(selisihNominal)}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: isPlus ? const Color(0xFF059669) : Colors.red,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
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
}

class _CreateOpnameSheet extends StatefulWidget {
  final List<WarehouseModel> warehouses;
  final List<ProductModel> allProducts;
  final int? initialWarehouseId;
  final VoidCallback onSubmitted;

  const _CreateOpnameSheet({
    required this.warehouses,
    required this.allProducts,
    this.initialWarehouseId,
    required this.onSubmitted,
  });

  @override
  State<_CreateOpnameSheet> createState() => _CreateOpnameSheetState();
}

class _CreateOpnameSheetState extends State<_CreateOpnameSheet> {
  int? _warehouseId;
  String _tipeAdjustment = 'OPNAME_FISIK';
  final _catatanCtrl = TextEditingController();
  bool _loadingStock = false;
  bool _saving = false;

  List<ProductModel> _warehouseProducts = [];
  final List<Map<String, dynamic>> _items = [];

  static const _types = [
    {'value': 'OPNAME_FISIK', 'label': 'Opname Fisik Berkala'},
    {'value': 'RUSAK_KEDALUWARSA', 'label': 'Kerusakan / Kedaluwarsa'},
    {'value': 'SELISIH_HILANG', 'label': 'Selisih Hilang / Susut'},
    {'value': 'KOREKSI_TAMBAH', 'label': 'Koreksi Kelebihan Fisik'},
  ];

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().currentUser;
    if (user != null && user.isRestrictedWarehouseAdmin) {
      _warehouseId = user.warehouseId;
    } else {
      _warehouseId = widget.initialWarehouseId ?? (widget.warehouses.isNotEmpty ? widget.warehouses.first.id : null);
    }
    _loadWarehouseProducts(initRow: true);
  }

  List<ProductModel> get _activeWarehouseProducts =>
      _warehouseProducts.where((p) => p.jumlahLot > 0 || p.totalStok > 0).toList();

  Future<void> _loadWarehouseProducts({bool initRow = false}) async {
    if (_warehouseId == null) return;
    setState(() => _loadingStock = true);
    try {
      final prods = await context.read<AuthProvider>().api.getProducts(warehouseId: _warehouseId);
      if (!mounted) return;
      setState(() {
        _warehouseProducts = prods;
        if (initRow && _items.isEmpty) {
          final first = _activeWarehouseProducts.isNotEmpty
              ? _activeWarehouseProducts.first
              : (prods.isNotEmpty ? prods.first : null);
          if (first != null) {
            _items.add({
              'product': first,
              'stokSistem': first.totalStok,
              'stokFisik': first.totalStok,
            });
          }
        } else {
          for (final it in _items) {
            final p = it['product'] as ProductModel;
            final matched = prods.cast<ProductModel?>().firstWhere((x) => x?.id == p.id, orElse: () => null);
            final newSys = matched?.totalStok ?? 0.0;
            it['product'] = matched ?? p;
            it['stokSistem'] = newSys;
            it['stokFisik'] = newSys;
          }
        }
        _loadingStock = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingStock = false);
    }
  }

  void _populateAllWarehouseItems() {
    final active = _activeWarehouseProducts;
    if (active.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.orange,
          content: Text('Belum ada barang tercatat di gudang ini. Gunakan "+ Tambah" untuk input manual.'),
        ),
      );
      return;
    }
    setState(() {
      _items.clear();
      for (final p in active) {
        _items.add({
          'product': p,
          'stokSistem': p.totalStok,
          'stokFisik': p.totalStok,
        });
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF059669),
        content: Text('Berhasil menarik ${active.length} barang sesuai gudang terpilih.'),
      ),
    );
  }

  void _addRow() {
    final source = _warehouseProducts.isNotEmpty ? _warehouseProducts : widget.allProducts;
    final first = _activeWarehouseProducts.isNotEmpty
        ? _activeWarehouseProducts.first
        : (source.isNotEmpty ? source.first : null);
    if (first == null) return;
    setState(() {
      _items.add({
        'product': first,
        'stokSistem': first.totalStok,
        'stokFisik': first.totalStok,
      });
    });
  }

  Future<void> _submit() async {
    if (_warehouseId == null || _items.isEmpty) return;
    setState(() => _saving = true);
    try {
      final payload = {
        'warehouse_id': _warehouseId,
        'tanggal': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'tipe_adjustment': _tipeAdjustment,
        'catatan': _catatanCtrl.text.trim(),
        'items': _items.map((it) {
          final p = it['product'] as ProductModel;
          return {
            'product_id': p.id,
            'stok_fisik': it['stokFisik'] ?? 0,
            'harga_satuan': p.hargaJual,
            'catatan': '',
          };
        }).toList(),
      };
      final res = await context.read<AuthProvider>().api.createStockAdjustment(payload);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFF059669), content: Text(res['message']?.toString() ?? 'Opname tersimpan!')),
        );
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.redAccent, content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final isRestricted = user?.isRestrictedWarehouseAdmin ?? false;
    final source = _warehouseProducts.isNotEmpty ? _warehouseProducts : widget.allProducts;
    final activeCount = _activeWarehouseProducts.length;

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Formulir Stok Opname Fisik', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
              ],
            ),
            const SizedBox(height: 8),

            DropdownButtonFormField<int>(
              value: widget.warehouses.any((w) => w.id == _warehouseId) ? _warehouseId : null,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Lokasi Gudang *',
                helperText: isRestricted ? 'Terkunci sesuai gudang penugasan Anda' : null,
                border: const OutlineInputBorder(),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              items: widget.warehouses
                  .where((w) => !isRestricted || w.id == user?.warehouseId)
                  .map((w) => DropdownMenuItem(value: w.id, child: Text('${w.kodeGudang} - ${w.namaGudang}')))
                  .toList(),
              onChanged: isRestricted
                  ? null
                  : (val) {
                      setState(() => _warehouseId = val);
                      _loadWarehouseProducts();
                    },
            ),
            const SizedBox(height: 10),

            DropdownButtonFormField<String>(
              value: _tipeAdjustment,
              decoration: const InputDecoration(
                labelText: 'Tipe Penyesuaian *',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              items: _types.map((t) => DropdownMenuItem(value: t['value']!, child: Text(t['label']!))).toList(),
              onChanged: (v) {
                if (v != null) setState(() => _tipeAdjustment = v);
              },
            ),
            const SizedBox(height: 12),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                OutlinedButton.icon(
                  onPressed: _loadingStock ? null : _populateAllWarehouseItems,
                  icon: const Icon(Icons.auto_awesome, size: 15, color: Color(0xFFB45309)),
                  label: Text('Tarik Barang ($activeCount)', style: const TextStyle(fontSize: 12, color: Color(0xFF92400E))),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFFBEB),
                    side: const BorderSide(color: Color(0xFFFCD34D)),
                  ),
                ),
                TextButton.icon(
                  onPressed: _addRow,
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Tambah'),
                ),
              ],
            ),
            if (_loadingStock) const LinearProgressIndicator(minHeight: 2),
            const SizedBox(height: 6),

            ..._items.asMap().entries.map((entry) {
              final idx = entry.key;
              final it = entry.value;
              final p = it['product'] as ProductModel;
              final sys = (it['stokSistem'] as num?)?.toDouble() ?? 0.0;
              final phy = (it['stokFisik'] as num?)?.toDouble() ?? 0.0;
              final diff = phy - sys;
              final satuan = p.satuan.toUpperCase();

              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<int>(
                              value: source.any((s) => s.id == p.id) ? p.id : null,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Produk',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              items: source
                                  .map((s) => DropdownMenuItem(
                                        value: s.id,
                                        child: Text('${s.kodeProduk} - ${s.namaProduk} (${s.totalStok.toStringAsFixed(0)} ${s.satuan.toUpperCase()})',
                                            overflow: TextOverflow.ellipsis),
                                      ))
                                  .toList(),
                              onChanged: (pid) {
                                final m = source.firstWhere((s) => s.id == pid);
                                setState(() {
                                  _items[idx]['product'] = m;
                                  _items[idx]['stokSistem'] = m.totalStok;
                                  _items[idx]['stokFisik'] = m.totalStok;
                                });
                              },
                            ),
                          ),
                          if (_items.length > 1)
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.red),
                              onPressed: () => setState(() => _items.removeAt(idx)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: InputDecorator(
                              decoration: const InputDecoration(
                                labelText: 'Stok Sistem',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              child: Text(
                                '${sys.toStringAsFixed(0)} $satuan',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextFormField(
                              key: ValueKey('phy_${idx}_${p.id}_$sys'),
                              initialValue: phy.toStringAsFixed(0),
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: InputDecoration(
                                labelText: 'Fisik Real *',
                                suffixText: satuan,
                                border: const OutlineInputBorder(),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              onChanged: (v) => setState(() => _items[idx]['stokFisik'] = double.tryParse(v) ?? 0.0),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Selisih: ${diff > 0 ? '+' : ''}${diff.toStringAsFixed(0)} $satuan',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: diff >= 0 ? const Color(0xFF059669) : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 8),
            TextField(
              controller: _catatanCtrl,
              decoration: const InputDecoration(labelText: 'Catatan / Berita Acara', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4F46E5), foregroundColor: Colors.white),
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Simpan & Posting Penyesuaian', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
