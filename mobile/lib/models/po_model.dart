class PoItemModel {
  final int id;
  final int productId;
  final String kodeProduk;
  final String namaProduk;
  final String satuan;
  final double qtyPesan;
  final double qtyDiterima;
  final double hargaSatuan;

  PoItemModel({
    required this.id,
    required this.productId,
    required this.kodeProduk,
    required this.namaProduk,
    required this.satuan,
    required this.qtyPesan,
    required this.qtyDiterima,
    required this.hargaSatuan,
  });

  double get sisaQty => (qtyPesan - qtyDiterima).clamp(0, double.infinity);

  factory PoItemModel.fromJson(Map<String, dynamic> json) {
    return PoItemModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      productId: json['product_id'] is int ? json['product_id'] : int.tryParse(json['product_id']?.toString() ?? '0') ?? 0,
      kodeProduk: json['kode_produk']?.toString() ?? '',
      namaProduk: json['nama_produk']?.toString() ?? '',
      satuan: json['satuan']?.toString() ?? 'pcs',
      qtyPesan: double.tryParse(json['qty_pesan']?.toString() ?? json['qty']?.toString() ?? '0') ?? 0.0,
      qtyDiterima: double.tryParse(json['qty_diterima']?.toString() ?? '0') ?? 0.0,
      hargaSatuan: double.tryParse(json['harga_satuan']?.toString() ?? '0') ?? 0.0,
    );
  }
}

class PoModel {
  final int id;
  final String noPo;
  final int? supplierId;
  final String supplierNama;
  final String status;
  final double totalHarga;
  final String tanggalPo;
  final List<PoItemModel> items;

  PoModel({
    required this.id,
    required this.noPo,
    this.supplierId,
    required this.supplierNama,
    required this.status,
    required this.totalHarga,
    required this.tanggalPo,
    this.items = const [],
  });

  factory PoModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return PoModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      noPo: json['no_po']?.toString() ?? '',
      supplierId: int.tryParse(json['supplier_id']?.toString() ?? ''),
      supplierNama: json['nama_supplier']?.toString() ?? json['supplier_nama']?.toString() ?? '-',
      status: json['status']?.toString() ?? 'DRAFT',
      totalHarga: double.tryParse(json['total_harga']?.toString() ?? '0') ?? 0.0,
      tanggalPo: json['tanggal_po']?.toString() ?? '',
      items: rawItems.map((e) => PoItemModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
