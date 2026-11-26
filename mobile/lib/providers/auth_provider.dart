import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  UserModel? _currentUser;
  bool _isLoading = true;
  String? _errorMessage;

  ApiService get api => _api;
  UserModel? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null && _currentUser!.token.isNotEmpty;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    init();
  }

  Future<void> init() async {
    _isLoading = true;
    notifyListeners();

    await _api.init();
    final prefs = await SharedPreferences.getInstance();
    final userRaw = prefs.getString(ApiService.keyUserData);

    if (userRaw != null) {
      try {
        final Map<String, dynamic> json = jsonDecode(userRaw);
        final token = json['token']?.toString() ?? _api.token ?? '';
        if (token.isNotEmpty) {
          _currentUser = UserModel.fromJson(json, token);
          await _api.setToken(token);
          // Sinkronkan profil terbaru (role & warehouse_id) dari server
          final refreshed = await _api.getMe();
          if (refreshed != null) {
            _currentUser = refreshed;
          } else if (_api.token == null) {
            _currentUser = null;
          }
        }
      } catch (_) {
        await _api.setToken(null);
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _currentUser = await _api.login(username, password);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await _api.logout();
    _currentUser = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> updateBaseUrl(String newUrl) async {
    await _api.setBaseUrl(newUrl);
    notifyListeners();
  }
}
