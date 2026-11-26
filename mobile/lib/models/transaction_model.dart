class TransactionDetailModel {
  final String nomorLot;
  final double qty;
  final String kodeProduk;
  final String namaProduk;
  final String satuan;
  final String? expiredDate;

  TransactionDetailModel({
    required this.nomorLot,
    required this.qty,
    required this.kodeProduk,
    required this.namaProduk,
    required this.satuan,
    this.expiredDate,
  });

  factory TransactionDetailModel.fromJson(Map<String, dynamic> json) {
    return TransactionDetailModel(
      nomorLot: json['nomor_lot']?.toString() ?? '',
      qty: double.tryParse(json['qty']?.toString() ?? '0') ?? 0.0,
      kodeProduk: json['kode_produk']?.toString() ?? '',
      namaProduk: json['nama_produk']?.toString() ?? '',
      satuan: json['satuan']?.toString() ?? 'pcs',
      expiredDate: json['expired_date']?.toString(),
    );
  }
}

class TransactionModel {
  final int id;
  final String kodeTransaksi;
  final String tipeTransaksi;
  final String? referensi;
  final String tanggalTransaksi;
  final String? keterangan;
  final String userNama;
  final String namaGudang;
  final String? noPo;
  final String? noDo;
  final List<TransactionDetailModel> details;

  TransactionModel({
    required this.id,
    required this.kodeTransaksi,
    required this.tipeTransaksi,
    this.referensi,
    required this.tanggalTransaksi,
    this.keterangan,
    required this.userNama,
    required this.namaGudang,
    this.noPo,
    this.noDo,
    this.details = const [],
  });

  double get totalQty => details.fold(0.0, (sum, d) => sum + d.qty);

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    final rawDetails = json['details'] as List<dynamic>? ?? [];
    return TransactionModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      kodeTransaksi: json['kode_transaksi']?.toString() ?? '',
      tipeTransaksi: json['tipe_transaksi']?.toString() ?? 'MASUK',
      referensi: json['referensi']?.toString(),
      tanggalTransaksi: json['tanggal_transaksi']?.toString() ?? json['created_at']?.toString() ?? '',
      keterangan: json['keterangan']?.toString(),
      userNama: json['user_nama']?.toString() ?? json['user_username']?.toString() ?? '-',
      namaGudang: json['nama_gudang']?.toString() ?? 'Gudang Utama',
      noPo: json['no_po']?.toString(),
      noDo: json['no_do']?.toString(),
      details: rawDetails.map((e) => TransactionDetailModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
