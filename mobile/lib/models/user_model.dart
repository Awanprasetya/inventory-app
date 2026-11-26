class UserModel {
  final int id;
  final String username;
  final String namaLengkap;
  final String role;
  final int tenantId;
  final String tenantName;
  final int? warehouseId;
  final String? namaGudang;
  final String? kodeGudang;
  final String token;

  UserModel({
    required this.id,
    required this.username,
    required this.namaLengkap,
    required this.role,
    required this.tenantId,
    required this.tenantName,
    this.warehouseId,
    this.namaGudang,
    this.kodeGudang,
    required this.token,
  });

  bool get isRestrictedWarehouseAdmin =>
      ['ADMIN_GUDANG', 'WAREHOUSE'].contains(role.toUpperCase()) && warehouseId != null;

  factory UserModel.fromJson(Map<String, dynamic> json, String token) {
    final user = json['user'] is Map<String, dynamic>
        ? json['user'] as Map<String, dynamic>
        : (json['data'] is Map<String, dynamic> && (json['data'] as Map<String, dynamic>)['user'] != null
            ? (json['data'] as Map<String, dynamic>)['user'] as Map<String, dynamic>
            : json);

    return UserModel(
      id: user['id'] is int ? user['id'] : int.tryParse(user['id']?.toString() ?? '0') ?? 0,
      username: user['username']?.toString() ?? '',
      namaLengkap: user['nama_lengkap']?.toString() ?? user['username']?.toString() ?? '',
      role: user['role']?.toString() ?? 'STAFF',
      tenantId: user['tenant_id'] is int ? user['tenant_id'] : int.tryParse(user['tenant_id']?.toString() ?? '1') ?? 1,
      tenantName: user['tenant_name']?.toString() ?? 'SyntesiaERP',
      warehouseId: user['warehouse_id'] is int ? user['warehouse_id'] : int.tryParse(user['warehouse_id']?.toString() ?? ''),
      namaGudang: user['nama_gudang']?.toString(),
      kodeGudang: user['kode_gudang']?.toString(),
      token: token,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'nama_lengkap': namaLengkap,
      'role': role,
      'tenant_id': tenantId,
      'tenant_name': tenantName,
      'warehouse_id': warehouseId,
      'nama_gudang': namaGudang,
      'kode_gudang': kodeGudang,
      'token': token,
    };
  }
}
