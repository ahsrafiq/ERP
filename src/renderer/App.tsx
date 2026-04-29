import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import AdjustmentNotes from './pages/Inventory/AdjustmentNotes';
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
import StockMovementReport from './pages/Reports/StockMovementReport';
import CustomerOutstandingReport from './pages/Reports/CustomerOutstandingReport';
import CustomReportBuilder from './pages/Reports/CustomReportBuilder';
import SalesByItemReport from './pages/Reports/SalesByItemReport';
import SalesBySalesPersonReport from './pages/Reports/SalesBySalesPerson';
import SalesQuotations from './pages/Sales/SalesQuotations';
import DeliveryChallans from './pages/Sales/DeliveryChallans';
import Receivables from './pages/Receivables/Receivables';
import { ErrorBoundary } from './components/ErrorBoundary';
import './components/ReportPdf/ReportPdf.css';
import { AppProvider } from './context/AppContext';

import Login from './pages/Login/Login';
import Profile from './pages/Users/Profile';
import { useApp } from './context/AppContext';

const KeepAliveRoute = ({ path, element, currentPath }: { path: string; element: React.ReactElement; currentPath: string }) => {
  const [hasVisited, setHasVisited] = React.useState(false);
  const isMatch = currentPath === path || (path === '/dashboard' && currentPath === '/');

  React.useEffect(() => {
    if (isMatch && !hasVisited) {
      setHasVisited(true);
    }
  }, [isMatch, hasVisited]);

  if (!hasVisited && !isMatch) return null;

  return (
    <div style={{ display: isMatch ? 'block' : 'none', height: '100%' }}>
      {element}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user } = useApp();
  const location = useLocation();

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
        <Route path="*" element={null} />
      </Routes>
      <KeepAliveRoute currentPath={location.pathname} path="/dashboard" element={<Dashboard />} />
      <KeepAliveRoute currentPath={location.pathname} path="/profile" element={<Profile />} />
      <KeepAliveRoute currentPath={location.pathname} path="/users" element={<Users />} />
      <KeepAliveRoute currentPath={location.pathname} path="/companies" element={<Companies />} />
      <KeepAliveRoute currentPath={location.pathname} path="/sales/customers" element={<Customers />} />
      <KeepAliveRoute currentPath={location.pathname} path="/sales/quotations" element={<SalesQuotations />} />
      <KeepAliveRoute currentPath={location.pathname} path="/sales/invoices" element={<SalesInvoices />} />
      <KeepAliveRoute currentPath={location.pathname} path="/sales/delivery-challans" element={<DeliveryChallans />} />
      <KeepAliveRoute currentPath={location.pathname} path="/receivables" element={<ErrorBoundary><Receivables /></ErrorBoundary>} />
      <KeepAliveRoute currentPath={location.pathname} path="/purchase/vendors" element={<Vendors />} />
      <KeepAliveRoute currentPath={location.pathname} path="/purchase/invoices" element={<PurchaseInvoices />} />
      <KeepAliveRoute currentPath={location.pathname} path="/inventory/items" element={<Items />} />
      <KeepAliveRoute currentPath={location.pathname} path="/inventory/brands" element={<Brands />} />
      <KeepAliveRoute currentPath={location.pathname} path="/inventory/adjustment-notes" element={<AdjustmentNotes />} />
      <KeepAliveRoute currentPath={location.pathname} path="/expenses" element={<Expenses />} />
      <KeepAliveRoute currentPath={location.pathname} path="/expenses/categories" element={<ExpenseCategories />} />
      <KeepAliveRoute currentPath={location.pathname} path="/hr/employees" element={<Employees />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports" element={<Reports />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/sales" element={<SalesReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/inventory" element={<InventoryReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/customer-outstanding" element={<CustomerOutstandingReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/custom-builder" element={<CustomReportBuilder />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/purchase" element={<PurchaseReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/customer-ledger" element={<CustomerLedgerReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/tax" element={<TaxReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/recovery" element={<RecoveryReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/expenses" element={<ExpenseReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/vendor-ledger" element={<VendorLedgerReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/pl" element={<ProfitLossReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/balance" element={<BalanceSheetReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/stock-movement" element={<StockMovementReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/sales-by-item" element={<SalesByItemReport />} />
      <KeepAliveRoute currentPath={location.pathname} path="/reports/sales-by-salesperson" element={<SalesBySalesPersonReport />} />
    </Layout>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    const focusFirstErrorField = (modalRoot: HTMLElement) => {
      const firstErrorItem = modalRoot.querySelector('.ant-form-item-has-error');
      if (!firstErrorItem) return;
      const focusTarget = firstErrorItem.querySelector(
        'input, textarea, .ant-select-selector, .ant-picker-input input, [tabindex]'
      ) as HTMLElement | null;
      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
        focusTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const modalRoot = target.closest('.ant-modal') as HTMLElement | null;
      if (!modalRoot) return;
      if (target.closest('.ant-select-dropdown') || target.closest('.ant-picker-dropdown')) return;
      if ((target as HTMLElement).isContentEditable) return;

      e.preventDefault();

      const formEl =
        (target.closest('form') as HTMLFormElement | null) ||
        (modalRoot.querySelector('form') as HTMLFormElement | null);

      if (formEl?.requestSubmit) {
        formEl.requestSubmit();
      } else if (formEl) {
        formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      } else {
        const okBtn = modalRoot.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement | null;
        okBtn?.click();
      }

      window.setTimeout(() => focusFirstErrorField(modalRoot), 40);
    };

    const onMaskMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isMask = target.classList.contains('ant-modal-mask');
      const isWrap = target.classList.contains('ant-modal-wrap');
      if (!isMask && !isWrap) return;

      // Top-most visible modal (last in DOM order is usually the active one).
      const wraps = Array.from(document.querySelectorAll('.ant-modal-root .ant-modal-wrap')) as HTMLElement[];
      const activeWrap = wraps.filter((w) => w.style.display !== 'none').pop();
      if (!activeWrap) return;
      if (isWrap && target !== activeWrap) return;

      const modal = activeWrap.querySelector('.ant-modal') as HTMLElement | null;
      if (!modal) return;

      // Only minimize when modal supports it (minus icon provided by page).
      const minimizeIcon = modal.querySelector('.anticon-minus-square') as HTMLElement | null;
      if (!minimizeIcon) return;

      e.preventDefault();
      e.stopPropagation();
      minimizeIcon.click();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMaskMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMaskMouseDown, true);
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 8,
          colorPrimary: '#1890ff',
        },
      }}
      form={{
        scrollToFirstError: { behavior: 'smooth', block: 'center' },
        validateMessages: { required: '${label} is required' },
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
