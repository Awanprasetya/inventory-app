class ProductModel {
  final int id;
  final String kodeProduk;
  final String namaProduk;
  final String kategoriProduk;
  final String satuan;
  final String satuanMenengah;
  final String satuanBesar;
  final double isiPackPcs;
  final double isiBoxPack;
  final double isiBoxPcs;
  final double isiPerKemasan;
  final double totalStok;
  final int jumlahLot;
  final String kodeRak;
  final String metodeStok;
  final double hargaBeli;
  final double hargaJual;
  final bool isScannedKemasan;

  ProductModel({
    required this.id,
    required this.kodeProduk,
    required this.namaProduk,
    this.kategoriProduk = 'BARANG_JADI',
    required this.satuan,
    this.satuanMenengah = 'PACK',
    this.satuanBesar = 'BOX',
    this.isiPackPcs = 1.0,
    this.isiBoxPack = 1.0,
    this.isiBoxPcs = 1.0,
    this.isiPerKemasan = 1.0,
    this.totalStok = 0.0,
    this.jumlahLot = 0,
    this.kodeRak = '-',
    this.metodeStok = 'FIFO',
    this.hargaBeli = 0.0,
    this.hargaJual = 0.0,
    this.isScannedKemasan = false,
  });

  String get kategoriLabel =>
      kategoriProduk.toUpperCase() == 'MATERIAL' ? 'Material' : 'Barang Jadi';

  List<Map<String, dynamic>> get unitOptions {
    final base = satuan.toUpperCase();
    final mid = satuanMenengah.toUpperCase();
    final big = satuanBesar.toUpperCase();
    final opts = <Map<String, dynamic>>[];

    if (isiBoxPcs > 1 || big != base) {
      opts.add({'unit': big, 'ratio': isiBoxPcs, 'label': '$big (1 $big = ${isiBoxPcs.toStringAsFixed(0)} $base)'});
    }
    if (mid != big && (isiPackPcs > 1 || mid != base)) {
      opts.add({'unit': mid, 'ratio': isiPackPcs, 'label': '$mid (1 $mid = ${isiPackPcs.toStringAsFixed(0)} $base)'});
    }
    if (!opts.any((o) => o['unit'] == base)) {
      opts.add({'unit': base, 'ratio': 1.0, 'label': '$base (Satuan Dasar)'});
    }
    return opts;
  }

  double convertToBase(double qtyInput, String unitName) {
    final u = unitName.toUpperCase();
    if (u == satuanBesar.toUpperCase()) return qtyInput * isiBoxPcs;
    if (u == satuanMenengah.toUpperCase()) return qtyInput * isiPackPcs;
    return qtyInput;
  }

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final packPcs = double.tryParse(json['isi_pack_pcs']?.toString() ?? '1') ?? 1.0;
    final boxPack = double.tryParse(json['isi_box_pack']?.toString() ?? '1') ?? 1.0;
    final rawBoxPcs = double.tryParse(json['isi_box_pcs']?.toString() ?? '0') ?? 0.0;
    final rawKemasan = double.tryParse(json['isi_per_kemasan']?.toString() ?? '1') ?? 1.0;
    final effectiveBoxPcs = rawBoxPcs > 0
        ? rawBoxPcs
        : (rawKemasan > 1 ? rawKemasan : (boxPack * packPcs));

    return ProductModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      kodeProduk: json['kode_produk']?.toString() ?? '',
      namaProduk: json['nama_produk']?.toString() ?? '',
      kategoriProduk: (json['kategori_produk']?.toString() ?? 'BARANG_JADI').toUpperCase(),
      satuan: json['satuan']?.toString() ?? 'pcs',
      satuanMenengah: json['satuan_menengah']?.toString() ?? 'PACK',
      satuanBesar: json['satuan_besar']?.toString() ?? 'BOX',
      isiPackPcs: packPcs > 0 ? packPcs : 1.0,
      isiBoxPack: boxPack > 0 ? boxPack : 1.0,
      isiBoxPcs: effectiveBoxPcs > 0 ? effectiveBoxPcs : 1.0,
      isiPerKemasan: effectiveBoxPcs > 0 ? effectiveBoxPcs : 1.0,
      totalStok: double.tryParse(json['total_stok']?.toString() ?? json['stok']?.toString() ?? '0') ?? 0.0,
      jumlahLot: int.tryParse(json['jumlah_lot']?.toString() ?? '0') ?? 0,
      kodeRak: json['kode_rak']?.toString() ?? '-',
      metodeStok: (json['metode_stok']?.toString() ?? 'FIFO').toUpperCase(),
      hargaBeli: double.tryParse(json['harga_beli']?.toString() ?? '0') ?? 0.0,
      hargaJual: double.tryParse(json['harga_jual']?.toString() ?? json['harga']?.toString() ?? '0') ?? 0.0,
      isScannedKemasan: json['is_scanned_kemasan'] == true,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProductModel && runtimeType == other.runtimeType && kodeProduk == other.kodeProduk;

  @override
  int get hashCode => kodeProduk.hashCode;
}
