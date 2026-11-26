import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/product_model.dart';
import '../models/transfer_model.dart';
import '../models/warehouse_model.dart';
import '../providers/auth_provider.dart';

class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key});

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  String _statusFilter = 'ALL'; // ALL, PENDING, COMPLETED, REJECTED
  int? _processingId;

  List<WarehouseTransferModel> _transfers = [];
  List<WarehouseModel> _warehouses = [];
  List<WarehouseModel> _allWarehouses = [];
  List<ProductModel> _products = [];

  final NumberFormat _numFormat = NumberFormat('#,###', 'id_ID');

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

    final api = context.read<AuthProvider>().api;
    try {
      final results = await Future.wait([
        api.getWarehouseTransfers(),
        api.getWarehouses(),
        api.getWarehouses(includeOtherTenants: true),
        api.getProducts(),
      ]);
      if (mounted) {
        setState(() {
          _transfers = results[0] as List<WarehouseTransferModel>;
          _warehouses = results[1] as List<WarehouseModel>;
          final allWh = results[2] as List<WarehouseModel>;
          _allWarehouses = allWh.isNotEmpty ? allWh : _warehouses;
          _products = results[3] as List<ProductModel>;
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

  List<WarehouseTransferModel> get _filteredTransfers {
    if (_statusFilter == 'ALL') return _transfers;
    if (_statusFilter == 'COMPLETED') {
      return _transfers.where((t) => t.status == 'COMPLETED' || t.status == 'APPROVED').toList();
    }
    return _transfers.where((t) => t.status == _statusFilter).toList();
  }

  int get _pendingCount => _transfers.where((t) => t.status == 'PENDING').length;

  Future<void> _approveTransfer(WarehouseTransferModel trf) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.check_circle_outline, color: Color(0xFF059669), size: 42),
        title: Text('Setujui ${trf.noTransfer}?', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Text(
          'Stok fisik akan langsung dipotong dari "${trf.fromWarehouseNama}" dan ditambahkan ke "${trf.toWarehouseNama}".',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF059669), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ya, Setujui'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    setState(() => _processingId = trf.id);
    try {
      final res = await context.read<AuthProvider>().api.approveWarehouseTransfer(trf.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFF059669), content: Text(res['message']?.toString() ?? 'Transfer disetujui!')),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.redAccent, content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _processingId = null);
    }
  }

  Future<void> _rejectTransfer(WarehouseTransferModel trf) async {
    final reasonCtrl = TextEditingController();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.cancel_outlined, color: Color(0xFFE11D48), size: 42),
        title: Text('Tolak ${trf.noTransfer}?', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(
            labelText: 'Alasan Penolakan (Opsional)',
            hintText: 'cth: Stok dibutuhkan di gudang pusat',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE11D48), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ya, Tolak'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    setState(() => _processingId = trf.id);
    try {
      final res = await context.read<AuthProvider>().api.rejectWarehouseTransfer(trf.id, reason: reasonCtrl.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFFE11D48), content: Text(res['message']?.toString() ?? 'Transfer ditolak.')),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.redAccent, content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _processingId = null);
    }
  }

  void _openCreateTransferSheet() {
    final destPool = _allWarehouses.isNotEmpty ? _allWarehouses : _warehouses;
    if (_warehouses.isEmpty || destPool.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(backgroundColor: Colors.orange, content: Text('Minimal butuh 2 gudang untuk melakukan transfer stok.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _CreateTransferSheet(
        warehouses: _warehouses,
        allWarehouses: destPool,
        products: _products,
        onSubmitted: () => _loadData(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final roleUpper = (user?.role ?? '').toUpperCase();
    final isSuperAdmin = ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].contains(roleUpper) || user?.username == 'admin';
    final isAdminOrSuper = ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN', 'ADMINISTRATOR', 'ADMIN'].contains(roleUpper);
    final isWarehouseRole = isAdminOrSuper || ['ADMIN_GUDANG', 'WAREHOUSE'].contains(roleUpper);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transfer Gudang & Approval', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
      floatingActionButton: isWarehouseRole
          ? FloatingActionButton.extended(
              backgroundColor: const Color(0xFF4F46E5),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.swap_horiz),
              label: const Text('Ajukan Transfer', style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: _openCreateTransferSheet,
            )
          : null,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: Column(
                children: [
                  // Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      children: [
                        _buildFilterChip('ALL', 'Semua (${_transfers.length})'),
                        const SizedBox(width: 8),
                        _buildFilterChip('PENDING', 'Menunggu Approval ($_pendingCount)', highlight: _pendingCount > 0),
                        const SizedBox(width: 8),
                        _buildFilterChip('COMPLETED', 'Selesai'),
                        const SizedBox(width: 8),
                        _buildFilterChip('REJECTED', 'Ditolak'),
                      ],
                    ),
                  ),

                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                    ),

                  Expanded(
                    child: _filteredTransfers.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.swap_horiz, size: 52, color: Colors.grey[350]),
                                const SizedBox(height: 8),
                                const Text('Belum ada data transfer gudang', style: TextStyle(color: Colors.grey)),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.only(left: 16, right: 16, bottom: 90),
                            itemCount: _filteredTransfers.length,
                            itemBuilder: (_, idx) {
                              final trf = _filteredTransfers[idx];
                              final isPending = trf.status == 'PENDING';
                              final isRejected = trf.status == 'REJECTED';
                              final isBusy = _processingId == trf.id;

                              final isOwnRequest = trf.createdBy != null && user?.id != null && trf.createdBy == user!.id;
                              final isDestTenant = !trf.isIntercompany ||
                                  (user?.tenantId != null && trf.toTenantId == user!.tenantId);
                              final isDestWarehouse = user?.warehouseId == null || trf.toWarehouseId == user!.warehouseId;
                              final canApproveRow = isSuperAdmin ||
                                  (isDestTenant && (isAdminOrSuper || (isWarehouseRole && !isOwnRequest && isDestWarehouse)));

                              return Card(
                                margin: const EdgeInsets.symmetric(vertical: 6),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Header Row
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Text(trf.noTransfer, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                                  if (trf.isIntercompany) ...[
                                                    const SizedBox(width: 6),
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                      decoration: BoxDecoration(
                                                        color: const Color(0xFFE0E7FF),
                                                        borderRadius: BorderRadius.circular(6),
                                                      ),
                                                      child: const Text('Lintas PT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF3730A3))),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                              Text(trf.tanggal, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                            ],
                                          ),
                                          _buildTransferStatusBadge(trf.status),
                                        ],
                                      ),
                                      const Divider(height: 18),

                                      // Rute Gudang
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text('DARI GUDANG', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                                                Text(trf.fromWarehouseNama, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                                if (trf.isIntercompany && trf.fromTenantNama != null)
                                                  Text(trf.fromTenantNama!, style: const TextStyle(fontSize: 10, color: Colors.indigo)),
                                              ],
                                            ),
                                          ),
                                          const Padding(
                                            padding: EdgeInsets.symmetric(horizontal: 8),
                                            child: Icon(Icons.arrow_forward, size: 18, color: Color(0xFF4F46E5)),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.end,
                                              children: [
                                                const Text('KE GUDANG', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                                                Text(trf.toWarehouseNama, textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                                if (trf.isIntercompany && trf.toTenantNama != null)
                                                  Text(trf.toTenantNama!, textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, color: Colors.indigo)),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),

                                      // Items List
                                      Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF8FAFC),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0xFFE2E8F0)),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: trf.items.map((it) {
                                            final hasCustomUnit = it.satuanTransfer != null &&
                                                it.qtyInput != null &&
                                                it.satuanTransfer!.toUpperCase() != it.satuan.toUpperCase();
                                            return Padding(
                                              padding: const EdgeInsets.symmetric(vertical: 2),
                                              child: Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  Expanded(
                                                    child: Text(it.namaProduk, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                                  ),
                                                  Text(
                                                    hasCustomUnit
                                                        ? '${_numFormat.format(it.qtyInput)} ${it.satuanTransfer} (${_numFormat.format(it.qty)} ${it.satuan})'
                                                        : '${_numFormat.format(it.qty)} ${it.satuan}',
                                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5)),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }).toList(),
                                        ),
                                      ),

                                      if (trf.isIntercompany && (trf.noSo != null || trf.noDo != null || trf.noPo != null)) ...[
                                        const SizedBox(height: 6),
                                        Wrap(
                                          spacing: 6,
                                          runSpacing: 4,
                                          children: [
                                            if (trf.noSo != null)
                                              Text('SO: ${trf.noSo}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8))),
                                            if (trf.noDo != null)
                                              Text('DO: ${trf.noDo}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0F766E))),
                                            if (trf.noPo != null)
                                              Text('PO: ${trf.noPo}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                                          ],
                                        ),
                                      ],
                                      if (trf.catatan != null && trf.catatan!.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text('Catatan: ${trf.catatan}', style: const TextStyle(fontSize: 11, color: Colors.black54)),
                                      ],
                                      if (isRejected && trf.rejectedReason != null) ...[
                                        const SizedBox(height: 4),
                                        Text('Alasan Tolak: ${trf.rejectedReason}', style: const TextStyle(fontSize: 11, color: Colors.red, fontWeight: FontWeight.w600)),
                                      ],
                                      const SizedBox(height: 8),

                                      // Footer Pengaju + Approver + Action Buttons
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text('Pengaju: ${trf.createdByName}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                                if (trf.approvedByName != null)
                                                  Text(
                                                    '${isRejected ? 'Ditolak' : 'Disetujui'}: ${trf.approvedByName}',
                                                    style: const TextStyle(fontSize: 11, color: Colors.black54, fontWeight: FontWeight.w500),
                                                  ),
                                              ],
                                            ),
                                          ),
                                          if (isPending && isWarehouseRole)
                                            canApproveRow
                                                ? Row(
                                                    children: [
                                                      OutlinedButton(
                                                        style: OutlinedButton.styleFrom(
                                                          foregroundColor: const Color(0xFFE11D48),
                                                          side: const BorderSide(color: Color(0xFFFDA4AF)),
                                                          padding: const EdgeInsets.symmetric(horizontal: 12),
                                                        ),
                                                        onPressed: isBusy ? null : () => _rejectTransfer(trf),
                                                        child: const Text('Tolak', style: TextStyle(fontSize: 12)),
                                                      ),
                                                      const SizedBox(width: 8),
                                                      ElevatedButton(
                                                        style: ElevatedButton.styleFrom(
                                                          backgroundColor: const Color(0xFF059669),
                                                          foregroundColor: Colors.white,
                                                          padding: const EdgeInsets.symmetric(horizontal: 14),
                                                        ),
                                                        onPressed: isBusy ? null : () => _approveTransfer(trf),
                                                        child: isBusy
                                                            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                                            : const Text('Setujui', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                                      ),
                                                    ],
                                                  )
                                                : Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                    decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(6)),
                                                    child: Text(
                                                      !isDestTenant
                                                          ? 'Menunggu ${trf.toTenantNama ?? 'PT Tujuan'}'
                                                          : (isOwnRequest ? 'Menunggu Gudang Tujuan' : 'Khusus PIC ${trf.toWarehouseKode}'),
                                                      style: const TextStyle(fontSize: 11, color: Colors.black54),
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

  Widget _buildFilterChip(String id, String label, {bool highlight = false}) {
    final active = _statusFilter == id;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: active ? Colors.white : (highlight ? const Color(0xFFB45309) : Colors.black87),
        ),
      ),
      selected: active,
      selectedColor: const Color(0xFF4F46E5),
      backgroundColor: highlight ? const Color(0xFFFEF3C7) : Colors.white,
      onSelected: (_) => setState(() => _statusFilter = id),
    );
  }

  Widget _buildTransferStatusBadge(String status) {
    if (status == 'PENDING') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFCD34D))),
        child: const Text('MENUNGGU APPROVAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF92400E))),
      );
    }
    if (status == 'REJECTED') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFCA5A5))),
        child: const Text('DITOLAK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF991B1B))),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF86EFAC))),
      child: const Text('DISETUJUI & SELESAI', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF166534))),
    );
  }
}

// Bottom Sheet Form Pengajuan Transfer (dengan Satuan Multi-Tingkat)
class _CreateTransferSheet extends StatefulWidget {
  final List<WarehouseModel> warehouses;
  final List<WarehouseModel> allWarehouses;
  final List<ProductModel> products;
  final VoidCallback onSubmitted;

  const _CreateTransferSheet({
    required this.warehouses,
    required this.allWarehouses,
    required this.products,
    required this.onSubmitted,
  });

  @override
  State<_CreateTransferSheet> createState() => _CreateTransferSheetState();
}

class _CreateTransferSheetState extends State<_CreateTransferSheet> {
  int? _fromWarehouseId;
  int? _toWarehouseId;
  final _catatanCtrl = TextEditingController();
  bool _isSaving = false;
  List<ProductModel> _sourceProducts = [];

  // Item baris sementara
  final List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().currentUser;
    if (user != null && user.isRestrictedWarehouseAdmin) {
      _fromWarehouseId = user.warehouseId;
    } else if (widget.warehouses.isNotEmpty) {
      _fromWarehouseId = widget.warehouses.first.id;
    }

    final other = widget.allWarehouses.where((w) => w.id != _fromWarehouseId).toList();
    if (other.isNotEmpty) {
      _toWarehouseId = other.first.id;
    }

    _addRow();
    _loadSourceStock();
  }

  Future<void> _loadSourceStock() async {
    if (_fromWarehouseId == null) return;
    try {
      final prods = await context.read<AuthProvider>().api.getProducts(warehouseId: _fromWarehouseId);
      if (mounted) setState(() => _sourceProducts = prods);
    } catch (_) {}
  }

  void _addRow() {
    final prod = widget.products.isNotEmpty ? widget.products.first : null;
    if (prod == null) return;
    final defaultUnit = prod.unitOptions.first['unit'] as String;
    setState(() {
      _items.add({
        'product': prod,
        'satuan': defaultUnit,
        'qtyInput': 1.0,
      });
    });
  }

  Future<void> _submit() async {
    if (_fromWarehouseId == null || _toWarehouseId == null || _fromWarehouseId == _toWarehouseId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(backgroundColor: Colors.redAccent, content: Text('Pilih gudang asal dan tujuan yang berbeda!')),
      );
      return;
    }
    if (_items.isEmpty) return;

    setState(() => _isSaving = true);
    try {
      final payload = {
        'from_warehouse_id': _fromWarehouseId,
        'to_warehouse_id': _toWarehouseId,
        'tanggal': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'catatan': _catatanCtrl.text.trim(),
        'items': _items.map((it) {
          final prod = it['product'] as ProductModel;
          final satuan = it['satuan'] as String;
          final qIn = it['qtyInput'] as double;
          final qBase = prod.convertToBase(qIn, satuan).round();
          return {
            'product_id': prod.id,
            'satuan_transfer': satuan,
            'qty_input': qIn,
            'qty': qBase,
          };
        }).toList(),
      };

      final res = await context.read<AuthProvider>().api.createWarehouseTransfer(payload);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: const Color(0xFF4F46E5), content: Text(res['message']?.toString() ?? 'Transfer diajukan!')),
        );
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
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
                const Text('Ajukan Transfer Stok Antar Gudang', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
              ],
            ),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
              child: const Text(
                'Pengajuan transfer berstatus Menunggu Approval. Stok gudang baru berpindah setelah disetujui Admin Gudang Tujuan / Administrator.',
                style: TextStyle(fontSize: 11, color: Color(0xFF92400E)),
              ),
            ),
            const SizedBox(height: 12),

            DropdownButtonFormField<int>(
              value: widget.warehouses.any((w) => w.id == _fromWarehouseId) ? _fromWarehouseId : null,
              decoration: InputDecoration(
                labelText: 'Gudang Asal *',
                helperText: isRestricted ? 'Terkunci sesuai gudang penugasan Anda' : null,
                border: const OutlineInputBorder(),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              items: widget.warehouses.map((w) => DropdownMenuItem(value: w.id, child: Text('${w.kodeGudang} - ${w.namaGudang}'))).toList(),
              onChanged: isRestricted
                  ? null
                  : (val) {
                      setState(() => _fromWarehouseId = val);
                      _loadSourceStock();
                    },
            ),
            const SizedBox(height: 12),

            DropdownButtonFormField<int>(
              value: widget.allWarehouses.any((w) => w.id == _toWarehouseId && w.id != _fromWarehouseId) ? _toWarehouseId : null,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Gudang Tujuan (Satu PT / Lintas PT) *',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              items: widget.allWarehouses
                  .where((w) => w.id != _fromWarehouseId)
                  .map((w) => DropdownMenuItem(
                        value: w.id,
                        child: Text(
                          w.displayLabel(currentTenantId: user?.tenantId),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ))
                  .toList(),
              onChanged: (val) => setState(() => _toWarehouseId = val),
            ),
            Builder(
              builder: (context) {
                final fromObj = widget.warehouses.cast<WarehouseModel?>().firstWhere((w) => w?.id == _fromWarehouseId, orElse: () => null);
                final toObj = widget.allWarehouses.cast<WarehouseModel?>().firstWhere((w) => w?.id == _toWarehouseId, orElse: () => null);
                final isCross = fromObj != null && toObj != null && fromObj.tenantId != toObj.tenantId;
                if (!isCross) return const SizedBox.shrink();
                return Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFC7D2FE)),
                  ),
                  child: Text(
                    'Transfer Lintas PT (${toObj.namaPerusahaan ?? 'PT Tujuan'}): Saat disetujui otomatis menerbitkan SO + DO + Piutang (PT Asal) & PO + Utang + Jurnal (PT Tujuan).',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF3730A3)),
                  ),
                );
              },
            ),
            const SizedBox(height: 14),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Barang yang Dipindahkan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                TextButton.icon(icon: const Icon(Icons.add, size: 16), label: const Text('Tambah'), onPressed: _addRow),
              ],
            ),

            ..._items.asMap().entries.map((entry) {
              final idx = entry.key;
              final item = entry.value;
              final prod = item['product'] as ProductModel;
              final satuan = item['satuan'] as String;
              final qIn = item['qtyInput'] as double;
              final unitOpts = prod.unitOptions;
              final convertedBase = prod.convertToBase(qIn, satuan);

              final srcProd = _sourceProducts.cast<ProductModel?>().firstWhere(
                    (s) => s?.id == prod.id,
                    orElse: () => null,
                  );

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
                            child: DropdownButtonFormField<String>(
                              value: widget.products.any((p) => p.kodeProduk == prod.kodeProduk) ? prod.kodeProduk : null,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Produk',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              items: widget.products
                                  .map((p) => DropdownMenuItem(value: p.kodeProduk, child: Text('${p.kodeProduk} - ${p.namaProduk}', overflow: TextOverflow.ellipsis)))
                                  .toList(),
                              onChanged: (kode) {
                                final matched = widget.products.firstWhere((p) => p.kodeProduk == kode);
                                setState(() {
                                  _items[idx]['product'] = matched;
                                  _items[idx]['satuan'] = matched.unitOptions.first['unit'];
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
                      if (srcProd != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Stok Gudang Asal: ${srcProd.totalStok.toStringAsFixed(0)} ${prod.satuan}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: srcProd.totalStok >= convertedBase ? const Color(0xFF2563EB) : Colors.red,
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            flex: 2,
                            child: TextFormField(
                              initialValue: qIn.toStringAsFixed(0),
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(
                                labelText: 'Qty *',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              onChanged: (val) => setState(() => _items[idx]['qtyInput'] = double.tryParse(val) ?? 1.0),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 3,
                            child: DropdownButtonFormField<String>(
                              value: unitOpts.any((o) => o['unit'] == satuan) ? satuan : unitOpts.first['unit'] as String,
                              decoration: const InputDecoration(
                                labelText: 'Satuan *',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              items: unitOpts
                                  .map((o) => DropdownMenuItem<String>(value: o['unit'] as String, child: Text(o['unit'] as String)))
                                  .toList(),
                              onChanged: (val) {
                                if (val != null) setState(() => _items[idx]['satuan'] = val);
                              },
                            ),
                          ),
                        ],
                      ),
                      if (satuan.toUpperCase() != prod.satuan.toUpperCase())
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Konversi: = ${convertedBase.toStringAsFixed(0)} ${prod.satuan}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 10),
            TextField(
              controller: _catatanCtrl,
              decoration: const InputDecoration(labelText: 'Catatan Pengiriman', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4F46E5), foregroundColor: Colors.white),
                onPressed: _isSaving ? null : _submit,
                child: _isSaving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Ajukan Transfer Stok (Butuh Approval)', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
