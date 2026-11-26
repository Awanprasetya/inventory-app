import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/transaction_model.dart';
import '../models/transfer_model.dart';
import 'inbound_screen.dart';
import 'outbound_screen.dart';
import 'transfer_screen.dart';
import 'stock_card_screen.dart';
import 'opname_screen.dart';
import '../widgets/status_badge.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _pages = [
    const DashboardTab(),
    const InboundScreen(),
    const OutboundScreen(),
    const TransferScreen(),
    const StockCardScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        indicatorColor: const Color(0xFF2563EB).withOpacity(0.15),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard, color: Color(0xFF2563EB)),
            label: 'Beranda',
          ),
          NavigationDestination(
            icon: Icon(Icons.arrow_downward),
            selectedIcon: Icon(Icons.arrow_downward, color: Color(0xFF059669)),
            label: 'Masuk',
          ),
          NavigationDestination(
            icon: Icon(Icons.arrow_upward),
            selectedIcon: Icon(Icons.arrow_upward, color: Color(0xFFD97706)),
            label: 'Keluar',
          ),
          NavigationDestination(
            icon: Icon(Icons.swap_horiz),
            selectedIcon: Icon(Icons.swap_horiz, color: Color(0xFF4F46E5)),
            label: 'Transfer',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_outlined),
            selectedIcon: Icon(Icons.inventory, color: Color(0xFF0D9488)),
            label: 'Kartu Stok',
          ),
        ],
      ),
    );
  }
}

// TAB 1: DASHBOARD
class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  bool _isLoading = true;
  List<TransactionModel> _recentInbound = [];
  List<TransactionModel> _recentOutbound = [];
  int _pendingTransferCount = 0;

  final NumberFormat _numFormat = NumberFormat('#,###', 'id_ID');

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);
    final api = context.read<AuthProvider>().api;
    try {
      final results = await Future.wait([
        api.getTransactions(type: 'MASUK', limit: 5),
        api.getTransactions(type: 'KELUAR', limit: 5),
        api.getWarehouseTransfers().catchError((_) => <WarehouseTransferModel>[]),
      ]);
      if (mounted) {
        final transfers = results[2] as List<WarehouseTransferModel>;
        setState(() {
          _recentInbound = results[0] as List<TransactionModel>;
          _recentOutbound = results[1] as List<TransactionModel>;
          _pendingTransferCount = transfers.where((t) => t.status == 'PENDING').length;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final totalInboundQty = _recentInbound.fold(0.0, (sum, t) => sum + t.totalQty);
    final totalOutboundQty = _recentOutbound.fold(0.0, (sum, t) => sum + t.totalQty);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.warehouse, color: Color(0xFF2563EB)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                user?.tenantName ?? 'Operasional Gudang',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Perbarui',
            onPressed: _loadDashboardData,
          ),
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            tooltip: 'Profil & Pengaturan Server',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboardData,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User Welcome Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 4)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: const Color(0xFF2563EB),
                          child: Text(
                            (user?.namaLengkap.isNotEmpty == true ? user!.namaLengkap[0] : 'U').toUpperCase(),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Halo, ${user?.namaLengkap ?? 'Petugas Gudang'}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                              const SizedBox(height: 2),
                              Text('Role: ${user?.role ?? 'STAFF'} • ${user?.tenantName ?? 'SyntesiaERP'}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.location_on_outlined, color: Color(0xFF38BDF8), size: 15),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              user?.warehouseId != null
                                  ? 'Gudang Tugas: ${user!.kodeGudang ?? ''} - ${user.namaGudang ?? 'Gudang Terbatas'}'
                                  : 'Akses Gudang: Semua Gudang',
                              style: const TextStyle(color: Color(0xFFBAE6FD), fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // Kartu Ringkasan Operasional
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      title: 'Total Masuk Terkini',
                      value: '${_numFormat.format(totalInboundQty)} unit',
                      subtext: '${_recentInbound.length} transaksi',
                      icon: Icons.arrow_downward,
                      color: const Color(0xFF059669),
                      bgColor: const Color(0xFFDCFCE7),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricCard(
                      title: 'Total Keluar Terkini',
                      value: '${_numFormat.format(totalOutboundQty)} unit',
                      subtext: '${_recentOutbound.length} transaksi',
                      icon: Icons.arrow_upward,
                      color: const Color(0xFFD97706),
                      bgColor: const Color(0xFFFEF3C7),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Aksi Cepat Operasional Gudang
              const Text('Menu Operasional Gudang', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _quickActionTile(
                      title: 'Scan Barang Masuk',
                      subtitle: 'Penerimaan PO / QR Lot',
                      icon: Icons.qr_code_scanner,
                      color: const Color(0xFF2563EB),
                      bgColor: const Color(0xFFEFF6FF),
                      borderColor: const Color(0xFF93C5FD),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const InboundScreen())),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickActionTile(
                      title: 'Scan Barang Keluar',
                      subtitle: 'Pengeluaran DO / FEFO',
                      icon: Icons.qr_code_scanner,
                      color: const Color(0xFFD97706),
                      bgColor: const Color(0xFFFFFBEB),
                      borderColor: const Color(0xFFFDE68A),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OutboundScreen())),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _quickActionTile(
                      title: 'Transfer & Approval',
                      subtitle: _pendingTransferCount > 0 ? '$_pendingTransferCount Menunggu Approval' : 'Mutasi Antar Gudang',
                      icon: Icons.swap_horiz,
                      color: const Color(0xFF4F46E5),
                      bgColor: const Color(0xFFEEF2FF),
                      borderColor: const Color(0xFFC7D2FE),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TransferScreen())),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickActionTile(
                      title: 'Kartu Stok & Lot',
                      subtitle: 'Cek Lot & Saldo Mutasi',
                      icon: Icons.inventory_2_outlined,
                      color: const Color(0xFF0D9488),
                      bgColor: const Color(0xFFF0FDFA),
                      borderColor: const Color(0xFF99F6E4),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StockCardScreen())),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _quickActionTile(
                      title: 'Stok Opname (Audit)',
                      subtitle: 'Penyesuaian Fisik & Satuan',
                      icon: Icons.fact_check_outlined,
                      color: const Color(0xFF7C3AED),
                      bgColor: const Color(0xFFF5F3FF),
                      borderColor: const Color(0xFFDDD6FE),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OpnameScreen())),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(child: SizedBox.shrink()),
                ],
              ),

              const SizedBox(height: 24),

              // Aktivitas Terkini
              const Text('Aktivitas Operasional Terakhir', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),

              if (_isLoading)
                const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
              else if (_recentInbound.isEmpty && _recentOutbound.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(10)),
                  child: const Text('Belum ada transaksi operasional.', style: TextStyle(color: Colors.grey)),
                )
              else ...[
                ..._recentInbound.map(
                  (t) => Card(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Colors.grey[200]!)),
                    child: ListTile(
                      leading: const CircleAvatar(backgroundColor: Color(0xFFDCFCE7), child: Icon(Icons.arrow_downward, color: Color(0xFF166534), size: 18)),
                      title: Text(t.kodeTransaksi, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      subtitle: Text('${t.tanggalTransaksi} • ${t.namaGudang} • Ref: ${t.referensi ?? '-'}', style: const TextStyle(fontSize: 11)),
                      trailing: const StatusBadge(status: 'MASUK', small: true),
                    ),
                  ),
                ),
                ..._recentOutbound.map(
                  (t) => Card(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Colors.grey[200]!)),
                    child: ListTile(
                      leading: const CircleAvatar(backgroundColor: Color(0xFFFFEDD5), child: Icon(Icons.arrow_upward, color: Color(0xFF9A3412), size: 18)),
                      title: Text(t.kodeTransaksi, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      subtitle: Text('${t.tanggalTransaksi} • ${t.namaGudang} • Ref: ${t.referensi ?? '-'}', style: const TextStyle(fontSize: 11)),
                      trailing: const StatusBadge(status: 'KELUAR', small: true),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _quickActionTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required Color bgColor,
    required Color borderColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              child: Icon(icon, color: Colors.white, size: 24),
            ),
            const SizedBox(height: 10),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 2),
            Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Colors.black54), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtext,
    required IconData icon,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
              Icon(icon, color: color, size: 20),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(subtext, style: TextStyle(fontSize: 11, color: color.withOpacity(0.8))),
        ],
      ),
    );
  }
}

// PROFIL & PENGATURAN
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profil & Pengaturan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Profil Box
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: const Color(0xFF2563EB),
                    child: Text(
                      (user?.namaLengkap.isNotEmpty == true ? user!.namaLengkap[0] : 'U').toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user?.namaLengkap ?? '-', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('@${user?.username ?? '-'} • ${user?.role ?? '-'}', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text('Tenant: ${user?.tenantName ?? 'SyntesiaERP'}', style: const TextStyle(fontSize: 12, color: Color(0xFF2563EB), fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(
                          user?.warehouseId != null
                              ? 'Gudang Tugas: ${user!.kodeGudang ?? ''} - ${user.namaGudang ?? 'Gudang #${user.warehouseId}'}'
                              : 'Gudang Tugas: Semua Gudang',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF059669), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),
          const Text('Koneksi & Sistem', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey, fontSize: 13)),
          const SizedBox(height: 8),

          ListTile(
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            leading: const Icon(Icons.dns, color: Color(0xFF2563EB)),
            title: const Text('Alamat Server API'),
            subtitle: Text(auth.api.baseUrl),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              final urlController = TextEditingController(text: auth.api.baseUrl);
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Ubah URL Server API'),
                  content: TextField(
                    controller: urlController,
                    decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'http://...:5000/api'),
                  ),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
                    ElevatedButton(
                      onPressed: () {
                        auth.updateBaseUrl(urlController.text.trim());
                        Navigator.pop(ctx);
                      },
                      child: const Text('Simpan'),
                    ),
                  ],
                ),
              );
            },
          ),

          const SizedBox(height: 12),

          ListTile(
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            leading: const Icon(Icons.qr_code_scanner, color: Color(0xFF059669)),
            title: const Text('Scanner Barcode & QR Code'),
            subtitle: const Text('Mendukung Barcode 1D & QR Code Lot dari Batch'),
          ),

          const SizedBox(height: 24),

          // Tombol Logout
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFEE2E2),
              foregroundColor: const Color(0xFFDC2626),
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.logout),
            label: const Text('Keluar dari Aplikasi (Logout)', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () {
              Navigator.of(context).popUntil((route) => route.isFirst);
              auth.logout();
            },
          ),
        ],
      ),
    );
  }
}
