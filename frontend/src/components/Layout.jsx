import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Navbar from './Navbar.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import TourGuide from './TourGuide.jsx';
import ModuleTourBanner from './ModuleTourBanner.jsx';
import { TourProvider } from '../context/TourContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const titles = {
  '/': 'Dashboard',
  '/inbound': 'Barang Masuk (Scan Barcode)',
  '/outbound': 'Barang Keluar (Scan Pengiriman)',
  '/products': 'Master Produk & Lokasi Rak',
  '/stock-card': 'Kartu Stok Realtime',
  '/purchase-orders': 'Purchase Order (PO)',
  '/sales-orders': 'Sales Order (SO)',
  '/delivery-orders': 'Delivery Order (DO)',
  '/accounts-payable': 'Utang Usaha (AP)',
  '/accounts-receivable': 'Piutang Usaha (AR)',
  '/cash-bank': 'Kas & Rekening Bank',
  '/general-journal': 'Jurnal Umum (General Journal)',
  '/chart-of-accounts': 'Bagan Akun (COA)',
  '/financial-reports': 'Laporan Keuangan ERP',
  '/fixed-assets': 'Aset Tetap & Depresiasi',
  '/budgeting': 'Penganggaran & Kontrol Biaya',
  '/tax-management': 'Manajemen Perpajakan (PPN & PPh)',
  '/period-closing': 'Tutup Buku Periode',
  '/sales-quotations': 'Penawaran Harga (Sales Quotation)',
  '/returns': 'Retur Penjualan & Pembelian',
  '/stock-adjustment': 'Stok Opname & Penyesuaian Persediaan',
  '/batch-lots': 'Manajemen Batch, Lot & Expired Date',
  '/warehouses': 'Multi-Gudang & Transfer Stok Antar Gudang',
  '/suppliers-customers': 'Supplier & Customer Master',
  '/users': 'Manajemen User & Hak Akses',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (_) {
      return true;
    }
  });

  const location = useLocation();
  const { user } = useAuth();
  const isSuperAdmin = user && (user.username === 'admin' || ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes((user.role || '').toUpperCase()));
  const defaultTitle = isSuperAdmin ? 'SyntesiaERP - Portal Pengembang' : `${user?.tenant_name || 'SyntesiaERP'}`;
  const title = titles[location.pathname] || defaultTitle;

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_open', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  return (
    <TourProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div
          className={`flex min-h-screen flex-col transition-all duration-200 ${
            sidebarOpen ? 'md:pl-64' : 'pl-0'
          } print:pl-0`}
        >
          <Navbar
            title={title}
            sidebarOpen={sidebarOpen}
            onToggle={toggleSidebar}
          />
          <main className="flex-1 p-4 md:p-6 print:p-0">
            <ErrorBoundary>
              <ModuleTourBanner />
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <TourGuide />
      </div>
    </TourProvider>
  );
}
