import React, { useEffect, useMemo, useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Input, Select, Space, Modal, InputNumber } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  DatabaseOutlined,
  DollarOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import './Layout.css';

// const { Header, Content } = AntLayout; // Moved inside component

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [addFYOpen, setAddFYOpen] = useState(false);
  const [customFyStartYears, setCustomFyStartYears] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem('erp_fy_ranges_custom');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) return parsed.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n));
    } catch { /* ignore */ }
    return [];
  });
  const [fyStartYearDraft, setFyStartYearDraft] = useState<number>(2026);
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    currentCompany, 
    setCurrentCompany, 
    companies, 
    user, 
    fiscalYear, 
    setFiscalYear, 
    logout,
    minimizedModals,
    restoreModal,
    removeMinimizedModal
  } = useApp();

  const defaultFyOptions = useMemo(() => {
    const baseStartYear = 2000 + (Number(fiscalYear) || 0);
    const starts: number[] = [];
    for (let y = baseStartYear - 2; y <= baseStartYear + 2; y++) starts.push(y);
    return starts;
  }, [fiscalYear]);

  const fyOptions = useMemo(() => {
    const starts = Array.from(new Set([
      ...defaultFyOptions,
      ...customFyStartYears,
      2000 + (Number(fiscalYear) || 0),
    ]));

    // Normalize and sort
    starts.sort((a, b) => a - b);

    return starts.map((startYear) => {
      const endYY = String((startYear + 1) % 100).padStart(2, '0');
      return {
        value: startYear % 100,
        label: `${startYear}\u2013${endYY}`,
      };
    });
  }, [customFyStartYears, defaultFyOptions, fiscalYear]);

  // Ensure selected FY is part of options
  const fiscalYearValue = Number(fiscalYear);

  useEffect(() => {
    try {
      localStorage.setItem('erp_fy_ranges_custom', JSON.stringify(customFyStartYears));
    } catch {
      // ignore
    }
  }, [customFyStartYears]);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    ...(user?.role === 'admin' || user?.role_name === 'Administrator' || user?.role_id === 1 ? [
      {
        key: '/users',
        icon: <UserOutlined />,
        label: 'Users & Roles',
      },
      {
        key: '/companies',
        icon: <ShopOutlined />,
        label: 'Companies',
      },
    ] : []),
    {
      key: 'sales',
      icon: <ShoppingCartOutlined />,
      label: 'Sales',
      children: [
        { key: '/sales/customers', label: 'Customers' },
        { key: '/sales/quotations', label: 'Quotations' },
        { key: '/sales/delivery-challans', label: 'Delivery Challans' },
        { key: '/sales/invoices', label: currentCompany?.is_gst_enabled ? 'Invoices' : 'Bills' },
      ],
    },
    {
      key: '/receivables',
      icon: <DollarOutlined />,
      label: 'Receivables',
    },
    {
      key: 'purchase',
      icon: <ShoppingOutlined />,
      label: 'Purchase',
      children: [
        { key: '/purchase/vendors', label: 'Vendors' },
        { key: '/purchase/invoices', label: 'Invoices' },
      ],
    },
    {
      key: 'inventory',
      icon: <DatabaseOutlined />,
      label: 'Inventory',
      children: [
        { key: '/inventory/items', label: 'Items' },
        { key: '/inventory/brands', label: 'Brands' },
        { key: '/inventory/adjustment-notes', label: 'Adjustment Notes' },
      ],
    },
    {
      key: 'expenses',
      icon: <DollarOutlined />,
      label: 'Expenses',
      children: [
        { key: '/expenses', label: 'Expenses' },
        { key: '/expenses/categories', label: 'Expense Categories' },
      ],
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
      children: [
        { key: '/reports', label: 'All Reports' },
        { key: '/reports/sales', label: 'Sales Report' },
        { key: '/reports/purchase', label: 'Purchase Report' },
        { key: '/reports/inventory', label: 'Inventory Report' },
        { key: '/reports/customer-ledger', label: 'Customer Ledger' },
        { key: '/reports/vendor-ledger', label: 'Vendor Ledger' },
        { key: '/reports/tax', label: 'Tax Deduction Report' },
        { key: '/reports/recovery', label: 'Recovery Report' },
        { key: '/reports/expenses', label: 'Expense Report' },
        { key: '/reports/pl', label: 'Profit & Loss' },
        { key: '/reports/balance', label: 'Balance Sheet' },
      ],
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'profile') {
      navigate('/profile');
    } else if (key === 'logout') {
      logout();
    }
  };

  const selectedKeys = [location.pathname];
  const openKeys = menuItems
    .filter(item => item.children)
    // @ts-ignore
    .map(item => item.key)
    .filter(key => location.pathname.startsWith(key));

  const { Header, Content, Sider } = AntLayout;

  return (
    <AntLayout className="app-layout" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        theme="light"
        className="app-sider"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
        }}
      >
        <div className="logo" style={{ justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '0' : '0 16px' }}>
          {!collapsed && <h2 style={{ marginLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden' }}>ERP Desktop</h2>}
          {collapsed && <h2 style={{ fontSize: '18px' }}>ERP</h2>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={handleMenuClick}
          theme="light"
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout style={{ marginLeft: collapsed ? 80 : 250, transition: 'all 0.2s' }}>
        <Header className="app-header">
          <div className="header-left">
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: '18px', cursor: 'pointer', padding: '0 24px' }
            })}
            <div style={{ width: 8 }}></div>
            <Select
              value={currentCompany?.id}
              onChange={(value) => {
                const company = companies.find(c => c.id === value);
                if (company) setCurrentCompany(company);
              }}
              style={{ width: 200, marginLeft: 16 }}
              placeholder="Select Company"
              options={companies.map((c) => ({ label: c.name, value: c.id }))}
            />
            <Input
              addonBefore="FY 20"
              value={String(fiscalYearValue).padStart(2, '0')}
              readOnly
              disabled
              style={{ width: 100, marginLeft: 12 }}
            />
            <Select
              value={fiscalYearValue}
              onChange={(v) => {
                if (v === 'add' as any) {
                  setFyStartYearDraft(2026);
                  setAddFYOpen(true);
                  return;
                }
                const n = Number(v);
                if (!Number.isNaN(n)) setFiscalYear(n);
              }}
              style={{ width: 140, marginLeft: 12 }}
              options={[
                ...fyOptions,
                { value: 'add' as any, label: 'Add FY range...' },
              ]}
            />
          </div>
            <Space size="large">
              <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
                <Avatar style={{ cursor: 'pointer' }} icon={<UserOutlined />} />
              </Dropdown>
            </Space>
        </Header>
        <Content className="app-content">
          {children}
        </Content>
        <Modal
          title="Add Fiscal Year Range"
          open={addFYOpen}
          onCancel={() => setAddFYOpen(false)}
          onOk={() => {
            const startYear = Number(fyStartYearDraft);
            if (!Number.isFinite(startYear) || startYear < 2000 || startYear > 2099) return;
            setCustomFyStartYears((prev) => {
              const normalized = Array.from(new Set([...prev, startYear])).sort((a, b) => a - b);
              return normalized;
            });
            setFiscalYear(startYear % 100);
            setAddFYOpen(false);
          }}
          okText="Add"
          cancelText="Cancel"
        >
          <div style={{ marginBottom: 12 }}>
            Enter the starting year of the range (example: <strong>2026</strong> for <strong>2026–27</strong>)
          </div>
          <InputNumber
            min={2000}
            max={2099}
            value={fyStartYearDraft}
            onChange={(v) => {
              if (v == null) return;
              setFyStartYearDraft(Number(v));
            }}
            style={{ width: '100%' }}
          />
        </Modal>
        {minimizedModals.length > 0 && (
          <div className="minimized-modals-bar">
            {minimizedModals.map((modal) => (
              <div key={modal.id} className="minimized-modal-item">
                <span className="minimized-modal-item-restore" onClick={() => {
                  if (modal.returnPath && modal.returnPath !== location.pathname) {
                    navigate(modal.returnPath);
                    setTimeout(() => restoreModal(modal), 10);
                  } else {
                    restoreModal(modal);
                  }
                }}>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  <span className="modal-title">{modal.title}</span>
                </span>
                <CloseOutlined 
                  className="modal-close-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMinimizedModal(modal.id);
                  }} 
                />
              </div>
            ))}
          </div>
        )}
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
