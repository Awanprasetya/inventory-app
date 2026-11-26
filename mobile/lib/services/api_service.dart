import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../models/warehouse_model.dart';
import '../models/product_model.dart';
import '../models/lot_model.dart';
import '../models/po_model.dart';
import '../models/do_model.dart';
import '../models/transaction_model.dart';
import '../models/transfer_model.dart';

class ApiService {
  static const String keyBaseUrl = 'inventory_base_url';
  static const String keyToken = 'inventory_token';
  static const String keyUserData = 'inventory_user_data';

  /// Ekstrak kode barcode / nomor lot jika QR Code berisi JSON dari Batch & Expired Date
  static String parseScannedCode(String raw) {
    final trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        final decoded = jsonDecode(trimmed);
        if (decoded is Map<String, dynamic>) {
          final lot = decoded['nomor_lot']?.toString() ?? decoded['lot']?.toString();
          if (lot != null && lot.trim().isNotEmpty) return lot.trim();
          final kode = decoded['kode_produk']?.toString();
          if (kode != null && kode.trim().isNotEmpty) return kode.trim();
        }
      } catch (_) {}
    }
    return trimmed;
  }

  static String getDefaultBaseUrl() {
    if (kIsWeb) return 'http://localhost:5000/api';
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:5000/api';
    } catch (_) {}
    return 'http://localhost:5000/api';
  }

  String _baseUrl = getDefaultBaseUrl();
  String? _token;

  String get baseUrl => _baseUrl;
  String? get token => _token;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString(keyBaseUrl) ?? getDefaultBaseUrl();
    _token = prefs.getString(keyToken);
  }

  Future<void> setBaseUrl(String url) async {
    String cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1);
    }
    if (!cleanUrl.endsWith('/api')) {
      cleanUrl = '$cleanUrl/api';
    }
    _baseUrl = cleanUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyBaseUrl, _baseUrl);
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString(keyToken, token);
    } else {
      await prefs.remove(keyToken);
    }
  }

  Map<String, String> _headers() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  // Uji koneksi ke server backend
  Future<bool> testConnection(String? urlToCheck) async {
    final target = (urlToCheck != null && urlToCheck.isNotEmpty) ? urlToCheck : _baseUrl;
    try {
      final uri = Uri.parse('$target/auth/login');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({}),
      ).timeout(const Duration(seconds: 5));
      // Backend mengembalikan status 400 (Bad Request - missing username/password), artinya server online & reachable!
      return res.statusCode == 400 || res.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // --- AUTH ---
  Future<UserModel> login(String username, String password) async {
    final uri = Uri.parse('$_baseUrl/auth/login');
    final res = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username.trim(), 'password': password}),
    );

    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      final token = data['token'] ?? data['data']?['token'];
      if (token == null) {
        throw Exception('Token tidak ditemukan pada respons server');
      }
      await setToken(token);
      final user = UserModel.fromJson(data, token);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyUserData, jsonEncode(user.toJson()));
      return user;
    } else {
      final msg = data['message'] ?? 'Login gagal, periksa username dan password';
      throw Exception(msg);
    }
  }

  Future<void> logout() async {
    await setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(keyUserData);
  }

  Future<UserModel?> getMe() async {
    if (_token == null || _token!.isEmpty) return null;
    try {
      final uri = Uri.parse('$_baseUrl/auth/me');
      final res = await http.get(uri, headers: _headers()).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['success'] == true) {
          final user = UserModel.fromJson(data, _token!);
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(keyUserData, jsonEncode(user.toJson()));
          return user;
        }
      } else if (res.statusCode == 401) {
        await logout();
      }
    } catch (_) {}
    return null;
  }

  // --- MASTER GUDANG ---
  Future<List<WarehouseModel>> getWarehouses({bool includeOtherTenants = false}) async {
    final baseUri = Uri.parse('$_baseUrl/warehouses');
    final uri = includeOtherTenants
        ? baseUri.replace(queryParameters: {'include_other_tenants': '1'})
        : baseUri;
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      final list = (data['data'] as List<dynamic>? ?? []);
      return list.map((e) => WarehouseModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  // --- MASTER PRODUK & LOT ---
  Future<List<ProductModel>> getProducts({int? warehouseId}) async {
    final baseUri = Uri.parse('$_baseUrl/products');
    final uri = warehouseId != null
        ? baseUri.replace(queryParameters: {'warehouse_id': warehouseId.toString()})
        : baseUri;
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      final list = (data['data'] as List<dynamic>? ?? []);
      return list.map((e) => ProductModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  // Ambil detail produk berdasarkan kode atau barcode kemasan
  Future<ProductModel?> getProductByCode(String code) async {
    final uri = Uri.parse('$_baseUrl/products/${Uri.encodeComponent(code.trim())}');
    final res = await http.get(uri, headers: _headers());
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['data'] != null) {
        return ProductModel.fromJson(data['data']);
      }
    }
    return null;
  }

  // Ambil detail lot produk berdasarkan nomor lot
  Future<LotModel?> getLotByNumber(String nomorLot, {int? warehouseId}) async {
    final baseUri = Uri.parse('$_baseUrl/lots/${Uri.encodeComponent(nomorLot.trim())}');
    final uri = warehouseId != null
        ? baseUri.replace(queryParameters: {'warehouse_id': warehouseId.toString()})
        : baseUri;
    final res = await http.get(uri, headers: _headers());
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['data'] != null) {
        return LotModel.fromJson(data['data']);
      }
    }
    return null;
  }

  // Ambil daftar lot untuk produk tertentu (biasanya terurut FEFO)
  Future<List<LotModel>> getLotsByProductCode(String productCode) async {
    final uri = Uri.parse('$_baseUrl/products/${Uri.encodeComponent(productCode.trim())}/lots');
    final res = await http.get(uri, headers: _headers());
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['data'] != null) {
        final rawLots = data['data']['lots'] as List<dynamic>? ?? [];
        return rawLots.map((e) => LotModel.fromJson(e as Map<String, dynamic>)).toList();
      }
    }
    return [];
  }

  // --- PURCHASE ORDER (PO) UNTUK BARANG MASUK ---
  Future<List<PoModel>> getPurchaseOrders() async {
    final uri = Uri.parse('$_baseUrl/purchase-orders');
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      final list = (data['data'] as List<dynamic>? ?? []);
      return list
          .map((e) => PoModel.fromJson(e as Map<String, dynamic>))
          .where((po) => po.status != 'CANCELLED' && po.status != 'COMPLETED')
          .toList();
    }
    return [];
  }

  Future<PoModel?> getPurchaseOrderDetail(int id) async {
    final uri = Uri.parse('$_baseUrl/purchase-orders/$id');
    final res = await http.get(uri, headers: _headers());
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['data'] != null) {
        return PoModel.fromJson(data['data']);
      }
    }
    return null;
  }

  // --- DELIVERY ORDER (DO) UNTUK BARANG KELUAR ---
  Future<List<DoModel>> getDeliveryOrders() async {
    final uri = Uri.parse('$_baseUrl/delivery-orders');
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      final list = (data['data'] as List<dynamic>? ?? []);
      return list
          .map((e) => DoModel.fromJson(e as Map<String, dynamic>))
          .where((d) => d.status == 'DRAFT' || d.status == 'PENDING')
          .toList();
    }
    return [];
  }

  Future<DoModel?> getDeliveryOrderDetail(int id) async {
    final uri = Uri.parse('$_baseUrl/delivery-orders/$id');
    final res = await http.get(uri, headers: _headers());
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data['success'] == true && data['data'] != null) {
        return DoModel.fromJson(data['data']);
      }
    }
    return null;
  }

  // --- TRANSAKSI (INBOUND & OUTBOUND) ---
  Future<List<TransactionModel>> getTransactions({String? type, int limit = 20}) async {
    final queryParams = <String, String>{'limit': limit.toString()};
    if (type != null) queryParams['type'] = type;
    final uri = Uri.parse('$_baseUrl/transactions').replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      final list = (data['data'] as List<dynamic>? ?? []);
      return list.map((e) => TransactionModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  // Submit Barang Masuk
  Future<Map<String, dynamic>> createInbound(Map<String, dynamic> payload) async {
    final uri = Uri.parse('$_baseUrl/transactions/inbound');
    final res = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Gagal memproses transaksi barang masuk');
  }

  // Submit Barang Keluar
  Future<Map<String, dynamic>> createOutbound(Map<String, dynamic> payload) async {
    final uri = Uri.parse('$_baseUrl/transactions/outbound');
    final res = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Gagal memproses transaksi barang keluar');
  }

  // --- TRANSFER ANTAR GUDANG & APPROVAL ---
  Future<List<WarehouseTransferModel>> getWarehouseTransfers() async {
    final uri = Uri.parse('$_baseUrl/warehouses/transfers');
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      final list = (data['data'] as List<dynamic>? ?? []);
      return list.map((e) => WarehouseTransferModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> createWarehouseTransfer(Map<String, dynamic> payload) async {
    final uri = Uri.parse('$_baseUrl/warehouses/transfers');
    final res = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Gagal mengajukan transfer stok');
  }

  Future<Map<String, dynamic>> approveWarehouseTransfer(int id) async {
    final uri = Uri.parse('$_baseUrl/warehouses/transfers/$id/approve');
    final res = await http.put(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Gagal menyetujui transfer stok');
  }

  Future<Map<String, dynamic>> rejectWarehouseTransfer(int id, {String? reason}) async {
    final uri = Uri.parse('$_baseUrl/warehouses/transfers/$id/reject');
    final res = await http.put(
      uri,
      headers: _headers(),
      body: jsonEncode({'reason': reason}),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Gagal menolak transfer stok');
  }

  // --- KARTU STOK (MUTASI SALDO BERJALAN) ---
  Future<Map<String, dynamic>> getStockCard(
    String kodeProduk, {
    int? warehouseId,
    String? from,
    String? to,
  }) async {
    final params = <String, String>{};
    if (warehouseId != null) params['warehouse_id'] = warehouseId.toString();
    if (from != null && from.isNotEmpty) params['from'] = from;
    if (to != null && to.isNotEmpty) params['to'] = to;
    final uri = Uri.parse('$_baseUrl/stock-card/${Uri.encodeComponent(kodeProduk)}')
        .replace(queryParameters: params.isEmpty ? null : params);
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return (data['data'] as Map<String, dynamic>? ?? {});
    }
    throw Exception(data['message'] ?? 'Gagal memuat kartu stok');
  }

  // --- STOK OPNAME & PENYESUAIAN FISIK ---
  Future<List<dynamic>> getStockAdjustments() async {
    final uri = Uri.parse('$_baseUrl/stock-adjustments');
    final res = await http.get(uri, headers: _headers());
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return (data['data'] as List<dynamic>? ?? []);
    }
    return [];
  }

  Future<Map<String, dynamic>> createStockAdjustment(Map<String, dynamic> payload) async {
    final uri = Uri.parse('$_baseUrl/stock-adjustments');
    final res = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode(payload),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Gagal menyimpan stok opname');
  }
}
