class DoItemModel {
  final int id;
  final int productId;
  final String kodeProduk;
  final String namaProduk;
  final String satuan;
  final double qtyOrder;
  final double qtyDikirim;

  DoItemModel({
    required this.id,
    required this.productId,
    required this.kodeProduk,
    required this.namaProduk,
    required this.satuan,
    required this.qtyOrder,
    required this.qtyDikirim,
  });

  double get sisaQty => (qtyOrder - qtyDikirim).clamp(0, double.infinity);

  factory DoItemModel.fromJson(Map<String, dynamic> json) {
    return DoItemModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      productId: json['product_id'] is int ? json['product_id'] : int.tryParse(json['product_id']?.toString() ?? '0') ?? 0,
      kodeProduk: json['kode_produk']?.toString() ?? '',
      namaProduk: json['nama_produk']?.toString() ?? '',
      satuan: json['satuan']?.toString() ?? 'pcs',
      qtyOrder: double.tryParse(json['qty_order']?.toString() ?? json['qty']?.toString() ?? '0') ?? 0.0,
      qtyDikirim: double.tryParse(json['qty_dikirim']?.toString() ?? '0') ?? 0.0,
    );
  }
}

class DoModel {
  final int id;
  final String noDo;
  final int? customerId;
  final String customerNama;
  final String status;
  final String tanggalDo;
  final List<DoItemModel> items;

  DoModel({
    required this.id,
    required this.noDo,
    this.customerId,
    required this.customerNama,
    required this.status,
    required this.tanggalDo,
    this.items = const [],
  });

  factory DoModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return DoModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      noDo: json['no_do']?.toString() ?? '',
      customerId: int.tryParse(json['customer_id']?.toString() ?? ''),
      customerNama: json['nama_customer']?.toString() ?? json['customer_nama']?.toString() ?? '-',
      status: json['status']?.toString() ?? 'DRAFT',
      tanggalDo: json['tanggal_do']?.toString() ?? '',
      items: rawItems.map((e) => DoItemModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
