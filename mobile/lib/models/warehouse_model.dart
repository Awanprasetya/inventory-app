class WarehouseModel {
  final int id;
  final String kodeGudang;
  final String namaGudang;
  final int? tenantId;
  final String? namaPerusahaan;
  final String? kodeTenant;

  WarehouseModel({
    required this.id,
    required this.kodeGudang,
    required this.namaGudang,
    this.tenantId,
    this.namaPerusahaan,
    this.kodeTenant,
  });

  String displayLabel({int? currentTenantId}) {
    final isOther = currentTenantId != null && tenantId != null && tenantId != currentTenantId;
    if (isOther && namaPerusahaan != null && namaPerusahaan!.isNotEmpty) {
      return '$kodeGudang - $namaGudang [$namaPerusahaan]';
    }
    return '$kodeGudang - $namaGudang';
  }

  factory WarehouseModel.fromJson(Map<String, dynamic> json) {
    return WarehouseModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      kodeGudang: json['kode_gudang']?.toString() ?? '',
      namaGudang: json['nama_gudang']?.toString() ?? '',
      tenantId: int.tryParse(json['tenant_id']?.toString() ?? ''),
      namaPerusahaan: json['nama_perusahaan']?.toString(),
      kodeTenant: json['kode_tenant']?.toString(),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is WarehouseModel && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
