class TransferItemModel {
  final int id;
  final int productId;
  final String kodeProduk;
  final String namaProduk;
  final String satuan;
  final String? satuanTransfer;
  final double? qtyInput;
  final double qty;
  final String? catatan;

  TransferItemModel({
    required this.id,
    required this.productId,
    required this.kodeProduk,
    required this.namaProduk,
    required this.satuan,
    this.satuanTransfer,
    this.qtyInput,
    required this.qty,
    this.catatan,
  });

  factory TransferItemModel.fromJson(Map<String, dynamic> json) {
    return TransferItemModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      productId: json['product_id'] is int ? json['product_id'] : int.tryParse(json['product_id']?.toString() ?? '0') ?? 0,
      kodeProduk: json['kode_produk']?.toString() ?? '',
      namaProduk: json['nama_produk']?.toString() ?? '',
      satuan: json['satuan']?.toString() ?? 'pcs',
      satuanTransfer: json['satuan_transfer']?.toString(),
      qtyInput: json['qty_input'] != null ? double.tryParse(json['qty_input'].toString()) : null,
      qty: double.tryParse(json['qty']?.toString() ?? '0') ?? 0.0,
      catatan: json['catatan']?.toString(),
    );
  }
}

class WarehouseTransferModel {
  final int id;
  final String noTransfer;
  final int fromWarehouseId;
  final int toWarehouseId;
  final int? fromTenantId;
  final int? toTenantId;
  final bool isIntercompany;
  final String? fromTenantNama;
  final String? toTenantNama;
  final String fromWarehouseNama;
  final String fromWarehouseKode;
  final String toWarehouseNama;
  final String toWarehouseKode;
  final String? noSo;
  final String? noDo;
  final String? noPo;
  final String tanggal;
  final String status;
  final String? catatan;
  final String? rejectedReason;
  final int? createdBy;
  final String createdByName;
  final String? approvedByName;
  final List<TransferItemModel> items;

  WarehouseTransferModel({
    required this.id,
    required this.noTransfer,
    required this.fromWarehouseId,
    required this.toWarehouseId,
    this.fromTenantId,
    this.toTenantId,
    this.isIntercompany = false,
    this.fromTenantNama,
    this.toTenantNama,
    required this.fromWarehouseNama,
    required this.fromWarehouseKode,
    required this.toWarehouseNama,
    required this.toWarehouseKode,
    this.noSo,
    this.noDo,
    this.noPo,
    required this.tanggal,
    required this.status,
    this.catatan,
    this.rejectedReason,
    this.createdBy,
    required this.createdByName,
    this.approvedByName,
    this.items = const [],
  });

  factory WarehouseTransferModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    final fromTId = int.tryParse(json['from_tenant_id']?.toString() ?? json['tenant_id']?.toString() ?? '');
    final toTId = int.tryParse(json['to_tenant_id']?.toString() ?? '');
    final crossPt = json['is_intercompany'] == true ||
        json['is_intercompany'] == 1 ||
        (fromTId != null && toTId != null && fromTId != toTId);

    return WarehouseTransferModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      noTransfer: json['no_transfer']?.toString() ?? '',
      fromWarehouseId: int.tryParse(json['from_warehouse_id']?.toString() ?? '0') ?? 0,
      toWarehouseId: int.tryParse(json['to_warehouse_id']?.toString() ?? '0') ?? 0,
      fromTenantId: fromTId,
      toTenantId: toTId,
      isIntercompany: crossPt,
      fromTenantNama: json['from_tenant_nama']?.toString(),
      toTenantNama: json['to_tenant_nama']?.toString(),
      fromWarehouseNama: json['from_warehouse_nama']?.toString() ?? '-',
      fromWarehouseKode: json['from_warehouse_kode']?.toString() ?? '',
      toWarehouseNama: json['to_warehouse_nama']?.toString() ?? '-',
      toWarehouseKode: json['to_warehouse_kode']?.toString() ?? '',
      noSo: json['no_so']?.toString(),
      noDo: json['no_do']?.toString(),
      noPo: json['no_po']?.toString(),
      tanggal: json['tanggal']?.toString() ?? '',
      status: (json['status']?.toString() ?? 'COMPLETED').toUpperCase(),
      catatan: json['catatan']?.toString(),
      rejectedReason: json['rejected_reason']?.toString(),
      createdBy: int.tryParse(json['created_by']?.toString() ?? ''),
      createdByName: json['created_by_name']?.toString() ?? 'Admin',
      approvedByName: json['approved_by_name']?.toString(),
      items: rawItems.map((e) => TransferItemModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
