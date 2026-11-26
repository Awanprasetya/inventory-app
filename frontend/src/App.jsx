import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inbound from './pages/Inbound.jsx';
import Outbound from './pages/Outbound.jsx';
import Products from './pages/Products.jsx';
import StockCard from './pages/StockCard.jsx';
import Users from './pages/Users.jsx';
import SuppliersCustomers from './pages/SuppliersCustomers.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import SalesOrders from './pages/SalesOrders.jsx';
import DeliveryOrders from './pages/DeliveryOrders.jsx';
import AccountsPayable from './pages/AccountsPayable.jsx';
import AccountsReceivable from './pages/AccountsReceivable.jsx';
import CashBank from './pages/CashBank.jsx';
import GeneralJournal from './pages/GeneralJournal.jsx';
import ChartOfAccounts from './pages/ChartOfAccounts.jsx';
import FinancialReports from './pages/FinancialReports.jsx';
import FixedAssets from './pages/FixedAssets.jsx';
import PeriodClosing from './pages/PeriodClosing.jsx';
import Budgeting from './pages/Budgeting.jsx';
import TaxManagement from './pages/TaxManagement.jsx';
import StockAdjustment from './pages/StockAdjustment.jsx';
import BatchLots from './pages/BatchLots.jsx';
import Warehouses from './pages/Warehouses.jsx';
import SalesQuotations from './pages/SalesQuotations.jsx';
import Returns from './pages/Returns.jsx';
import SuperAdminTenants from './pages/SuperAdminTenants.jsx';
import WorkflowsGuide from './pages/WorkflowsGuide.jsx';

export default function App() {
  return (
    <Routes>
      {/* Halaman publik */}
      <Route path="/login" element={<Login />} />

      {/* Semua halaman di dalam ini wajib login */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<RoleRoute><Dashboard /></RoleRoute>} />
        <Route path="/workflows" element={<RoleRoute><WorkflowsGuide /></RoleRoute>} />
        <Route path="/inbound" element={<RoleRoute><Inbound /></RoleRoute>} />
        <Route path="/outbound" element={<RoleRoute><Outbound /></RoleRoute>} />
        <Route path="/purchase-orders" element={<RoleRoute><PurchaseOrders /></RoleRoute>} />
        <Route path="/sales-orders" element={<RoleRoute><SalesOrders /></RoleRoute>} />
        <Route path="/delivery-orders" element={<RoleRoute><DeliveryOrders /></RoleRoute>} />
        <Route path="/accounts-payable" element={<RoleRoute><AccountsPayable /></RoleRoute>} />
        <Route path="/accounts-receivable" element={<RoleRoute><AccountsReceivable /></RoleRoute>} />
        <Route path="/cash-bank" element={<RoleRoute><CashBank /></RoleRoute>} />
        <Route path="/general-journal" element={<RoleRoute><GeneralJournal /></RoleRoute>} />
        <Route path="/chart-of-accounts" element={<RoleRoute><ChartOfAccounts /></RoleRoute>} />
        <Route path="/financial-reports" element={<RoleRoute><FinancialReports /></RoleRoute>} />
        <Route path="/fixed-assets" element={<RoleRoute><FixedAssets /></RoleRoute>} />
        <Route path="/period-closing" element={<RoleRoute><PeriodClosing /></RoleRoute>} />
        <Route path="/budgeting" element={<RoleRoute><Budgeting /></RoleRoute>} />
        <Route path="/tax-management" element={<RoleRoute><TaxManagement /></RoleRoute>} />
        <Route path="/sales-quotations" element={<RoleRoute><SalesQuotations /></RoleRoute>} />
        <Route path="/returns" element={<RoleRoute><Returns /></RoleRoute>} />
        <Route path="/stock-adjustment" element={<RoleRoute><StockAdjustment /></RoleRoute>} />
        <Route path="/batch-lots" element={<RoleRoute><BatchLots /></RoleRoute>} />
        <Route path="/warehouses" element={<RoleRoute><Warehouses /></RoleRoute>} />
        <Route path="/suppliers-customers" element={<RoleRoute><SuppliersCustomers /></RoleRoute>} />
        <Route path="/products" element={<RoleRoute><Products /></RoleRoute>} />
        <Route path="/stock-card" element={<RoleRoute><StockCard /></RoleRoute>} />
        {/* RBAC & SaaS Management: khusus PENGEMBANG & ADMINISTRATOR */}
        <Route
          path="/super-admin/tenants"
          element={
            <RoleRoute allow={['PENGEMBANG', 'ADMINISTRATOR']} superAdminOnly>
              <SuperAdminTenants />
            </RoleRoute>
          }
        />
        <Route
          path="/users"
          element={
            <RoleRoute allow={['PENGEMBANG', 'ADMINISTRATOR']}>
              <Users />
            </RoleRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

