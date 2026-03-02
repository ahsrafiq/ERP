import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Users from './pages/Users/Users';
import Companies from './pages/Companies/Companies';
import Customers from './pages/Sales/Customers';
import SalesInvoices from './pages/Sales/SalesInvoices';
import Vendors from './pages/Purchase/Vendors';
import PurchaseInvoices from './pages/Purchase/PurchaseInvoices';
import Items from './pages/Inventory/Items';
import Brands from './pages/Inventory/Brands';
import Expenses from './pages/Expenses/Expenses';
import ExpenseCategories from './pages/Expenses/ExpenseCategories';
import Employees from './pages/HR/Employees';
import Reports from './pages/Reports/Reports';
import SalesReport from './pages/Reports/SalesReport';
import InventoryReport from './pages/Reports/InventoryReport';
import PurchaseReport from './pages/Reports/PurchaseReport';
import CustomerLedgerReport from './pages/Reports/CustomerLedgerReport';
import TaxReport from './pages/Reports/TaxReport';
import RecoveryReport from './pages/Reports/RecoveryReport';
import ExpenseReport from './pages/Reports/ExpenseReport';
import VendorLedgerReport from './pages/Reports/VendorLedgerReport';
import ProfitLossReport from './pages/Reports/ProfitLossReport';
import BalanceSheetReport from './pages/Reports/BalanceSheetReport';
import SalesQuotations from './pages/Sales/SalesQuotations';
import DeliveryChallans from './pages/Sales/DeliveryChallans';
import { AppProvider } from './context/AppContext';

import Login from './pages/Login/Login';
import Profile from './pages/Users/Profile';
import { useApp } from './context/AppContext';

const AppContent: React.FC = () => {
  const { user } = useApp();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<Users />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/sales/customers" element={<Customers />} />
        <Route path="/sales/quotations" element={<SalesQuotations />} />
        <Route path="/sales/invoices" element={<SalesInvoices />} />
        <Route path="/sales/delivery-challans" element={<DeliveryChallans />} />
        <Route path="/purchase/vendors" element={<Vendors />} />
        <Route path="/purchase/invoices" element={<PurchaseInvoices />} />
        <Route path="/inventory/items" element={<Items />} />
        <Route path="/inventory/brands" element={<Brands />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/categories" element={<ExpenseCategories />} />
        <Route path="/hr/employees" element={<Employees />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/sales" element={<SalesReport />} />
        <Route path="/reports/inventory" element={<InventoryReport />} />
        <Route path="/reports/purchase" element={<PurchaseReport />} />
        <Route path="/reports/customer-ledger" element={<CustomerLedgerReport />} />
        <Route path="/reports/tax" element={<TaxReport />} />
        <Route path="/reports/recovery" element={<RecoveryReport />} />
        <Route path="/reports/expenses" element={<ExpenseReport />} />
        <Route path="/reports/vendor-ledger" element={<VendorLedgerReport />} />
        <Route path="/reports/pl" element={<ProfitLossReport />} />
        <Route path="/reports/balance" element={<BalanceSheetReport />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 8,
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AppProvider>
        <Router>
          <AppContent />
        </Router>
      </AppProvider>
    </ConfigProvider>
  );
};

export default App;
