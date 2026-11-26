class LotModel {
  final int id;
  final String nomorLot;
  final String kodeProduk;
  final String namaProduk;
  final String satuan;
  final String satuanBesar;
  final double isiPerKemasan;
  final double stokQty;
  final String? expiredDate;
  final String? tanggalProduksi;
  final int shift;
  final String status;
  final int? warehouseId;
  final String? namaGudang;
  final String kodeRak;
  final double hargaBeli;
  final int? daysToExpire;
  final String effectiveStatus;
  final bool isRecommended;
  final Map<String, dynamic>? priorityWarning;

  LotModel({
    required this.id,
    required this.nomorLot,
    required this.kodeProduk,
    required this.namaProduk,
    required this.satuan,
    this.satuanBesar = 'BOX',
    this.isiPerKemasan = 1.0,
    this.stokQty = 0.0,
    this.expiredDate,
    this.tanggalProduksi,
    this.shift = 1,
    this.status = 'AVAILABLE',
    this.warehouseId,
    this.namaGudang,
    this.kodeRak = '-',
    this.hargaBeli = 0.0,
    this.daysToExpire,
    this.effectiveStatus = 'AVAILABLE',
    this.isRecommended = false,
    this.priorityWarning,
  });

  bool get isExpired {
    if (expiredDate == null || expiredDate!.isEmpty) return false;
    try {
      final exp = DateTime.parse(expiredDate!);
      final today = DateTime.now();
      return exp.isBefore(DateTime(today.year, today.month, today.day));
    } catch (_) {
      return false;
    }
  }

  bool get isQuarantine => ['QUARANTINE', 'HOLD', 'EXPIRED'].contains(status.toUpperCase());

  bool get isAvailableForOutbound => !isExpired && !isQuarantine && stokQty > 0;

  factory LotModel.fromJson(Map<String, dynamic> json) {
    final isi = double.tryParse(json['isi_per_kemasan']?.toString() ?? '1') ?? 1.0;
    return LotModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      nomorLot: json['nomor_lot']?.toString() ?? '',
      kodeProduk: json['kode_produk']?.toString() ?? '',
      namaProduk: json['nama_produk']?.toString() ?? '',
      satuan: json['satuan']?.toString() ?? 'pcs',
      satuanBesar: json['satuan_besar']?.toString() ?? 'BOX',
      isiPerKemasan: isi > 0 ? isi : 1.0,
      stokQty: double.tryParse(json['stok_qty']?.toString() ?? '0') ?? 0.0,
      expiredDate: json['expired_date']?.toString(),
      tanggalProduksi: json['tanggal_produksi']?.toString(),
      shift: int.tryParse(json['shift']?.toString() ?? '1') ?? 1,
      status: json['status']?.toString() ?? 'AVAILABLE',
      warehouseId: int.tryParse(json['warehouse_id']?.toString() ?? ''),
      namaGudang: json['nama_gudang']?.toString(),
      kodeRak: json['kode_rak']?.toString() ?? '-',
      hargaBeli: double.tryParse(json['harga_beli']?.toString() ?? '0') ?? 0.0,
      daysToExpire: int.tryParse(json['days_to_expire']?.toString() ?? ''),
      effectiveStatus: json['effective_status']?.toString() ?? json['status']?.toString() ?? 'AVAILABLE',
      isRecommended: json['is_recommended'] == true,
      priorityWarning: json['priority_warning'] is Map<String, dynamic>
          ? json['priority_warning'] as Map<String, dynamic>
          : null,
    );
  }
}
