import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Input, Select, Space } from 'antd';
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
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import './Layout.css';

// const { Header, Content } = AntLayout; // Moved inside component

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [fiscalYearInput, setFiscalYearInput] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany, setCurrentCompany, companies, user, fiscalYear, setFiscalYear, logout } = useApp();

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
      setCollapsed(true); // Close drawer on navigation
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
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
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
              value={fiscalYearInput !== null ? fiscalYearInput : String(fiscalYear).padStart(2, '0')}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                setFiscalYearInput(v);
                if (v !== '') {
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n >= 0 && n <= 99) setFiscalYear(n);
                }
              }}
              onFocus={() => setFiscalYearInput(String(fiscalYear).padStart(2, '0'))}
              onBlur={() => {
                const v = (fiscalYearInput ?? '').replace(/\D/g, '');
                setFiscalYearInput(null);
                if (v === '') {
                  setFiscalYear(new Date().getFullYear() % 100);
                } else {
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n >= 0 && n <= 99) setFiscalYear(n);
                }
              }}
              placeholder="26"
              style={{ width: 100, marginLeft: 12 }}
              maxLength={2}
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
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
