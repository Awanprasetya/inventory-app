import {
  LayoutDashboard,
  ShoppingCart,
  FileCheck2,
  FileText,
  Truck,
  Undo2,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  Barcode,
  ArrowRightLeft,
  ClipboardList,
  Landmark,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  BookOpen,
  TrendingUp,
  Building2,
  PieChart,
  Percent,
  Lock,
  Package,
  UserCheck,
  Users,
} from 'lucide-react';

export const normalizeRole = (role, tenantId = null, username = null) => {
  const r = (role || '').toUpperCase().replace(/\s+/g, '_');
  if (['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes(r)) {
    return 'PENGEMBANG';
  }
  if (['ADMINISTRATOR', 'ADMIN'].includes(r)) return 'ADMINISTRATOR';
  if (['ADMIN_KEUANGAN', 'ADMIN_AKUNTANSI', 'FINANCE'].includes(r)) return 'ADMIN_KEUANGAN';
  if (['ADMIN_GUDANG', 'WAREHOUSE'].includes(r)) return 'ADMIN_GUDANG';
  if (['ADMIN_OPERASIONAL', 'ADMIN_OPERATIONAL', 'OPERATIONAL'].includes(r)) return 'ADMIN_OPERASIONAL';
  return 'ADMINISTRATOR';
};

export const ALL_ROLES = [
  { id: 'ADMINISTRATOR', label: 'Administrator' },
  { id: 'ADMIN_GUDANG', label: 'Admin Gudang' },
  { id: 'ADMIN_KEUANGAN', label: 'Admin Keuangan' },
  { id: 'ADMIN_OPERASIONAL', label: 'Admin Operasional' },
];

export const defaultRolePermissions = {
  ADMINISTRATOR: [
    '/', '/workflows', '/sales-quotations', '/purchase-orders', '/sales-orders', '/delivery-orders', '/returns',
    '/inbound', '/outbound', '/stock-adjustment', '/batch-lots', '/warehouses', '/stock-card',
    '/accounts-payable', '/accounts-receivable', '/cash-bank', '/general-journal', '/chart-of-accounts',
    '/financial-reports', '/fixed-assets', '/budgeting', '/tax-management', '/period-closing',
    '/suppliers-customers', '/products', '/users'
  ],
  ADMIN_GUDANG: [
    '/', '/workflows', '/delivery-orders', '/inbound', '/outbound', '/stock-adjustment', '/batch-lots', '/warehouses', '/stock-card',
    '/suppliers-customers', '/products'
  ],
  ADMIN_KEUANGAN: [
    '/', '/workflows', '/sales-quotations', '/purchase-orders', '/sales-orders', '/returns',
    '/accounts-payable', '/accounts-receivable', '/cash-bank', '/general-journal', '/chart-of-accounts',
    '/financial-reports', '/fixed-assets', '/budgeting', '/tax-management', '/period-closing',
    '/suppliers-customers', '/products'
  ],
  ADMIN_OPERASIONAL: [
    '/', '/workflows', '/sales-quotations', '/purchase-orders', '/sales-orders', '/delivery-orders', '/returns',
    '/inbound', '/outbound', '/stock-card', '/suppliers-customers', '/products'
  ],
};

export const menuGroups = [
  {
    title: 'UTAMA',
    icon: LayoutDashboard,
    isSingle: true,
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'PANDUAN & SOP',
    icon: BookOpen,
    isSingle: true,
    items: [{ to: '/workflows', label: 'Panduan & SOP Alur', icon: BookOpen }],
  },
  {
    title: 'PESANAN & PENGIRIMAN',
    icon: ShoppingCart,
    items: [
      { to: '/sales-quotations', label: 'Penawaran Harga (SQ)', icon: FileCheck2 },
      { to: '/purchase-orders', label: 'Purchase Order (PO)', icon: FileText },
      { to: '/sales-orders', label: 'Sales Order (SO)', icon: ShoppingCart },
      { to: '/delivery-orders', label: 'Delivery Order (DO)', icon: Truck },
      { to: '/returns', label: 'Retur Jual & Beli', icon: Undo2 },
    ],
  },
  {
    title: 'OPERASIONAL GUDANG',
    icon: Warehouse,
    items: [
      { to: '/inbound', label: 'Barang Masuk', icon: ArrowDownToLine },
      { to: '/outbound', label: 'Barang Keluar', icon: ArrowUpFromLine },
      { to: '/stock-adjustment', label: 'Stok Opname (Audit)', icon: ClipboardCheck },
      { to: '/batch-lots', label: 'Batch & Expired Date', icon: Barcode },
      { to: '/warehouses', label: 'Gudang & Transfer Stok', icon: ArrowRightLeft },
      { to: '/stock-card', label: 'Kartu Stok', icon: ClipboardList },
    ],
  },
  {
    title: 'AKUNTANSI & KEUANGAN',
    icon: Landmark,
    items: [
      { to: '/accounts-payable', label: 'Utang Usaha (AP)', icon: CreditCard },
      { to: '/accounts-receivable', label: 'Piutang Usaha (AR)', icon: Wallet },
      { to: '/cash-bank', label: 'Kas & Rekening Bank', icon: Landmark },
      { to: '/general-journal', label: 'Jurnal Umum', icon: FileSpreadsheet },
      { to: '/chart-of-accounts', label: 'Bagan Akun (COA)', icon: BookOpen },
      { to: '/financial-reports', label: 'Laporan Keuangan ERP', icon: TrendingUp },
      { to: '/fixed-assets', label: 'Aset Tetap & Depresiasi', icon: Building2 },
      { to: '/budgeting', label: 'Anggaran (Budgeting)', icon: PieChart },
      { to: '/tax-management', label: 'Perpajakan (PPN & PPh)', icon: Percent },
      { to: '/period-closing', label: 'Tutup Buku Periode', icon: Lock },
    ],
  },
  {
    title: 'MASTER DATA',
    icon: Package,
    items: [
      { to: '/suppliers-customers', label: 'Supplier & Customer', icon: UserCheck },
      { to: '/products', label: 'Produk & Lokasi Rak', icon: Package },
    ],
  },
  {
    title: 'PENGATURAN & SAAS',
    icon: Users,
    items: [
      { to: '/super-admin/tenants', label: 'Kelola Klien & Lisensi SaaS', icon: Building2, superAdminOnly: true },
      { to: '/users', label: 'Manajemen User & Hak Akses', icon: Users, adminOnly: true },
    ],
  },
];

