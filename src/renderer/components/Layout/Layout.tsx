import React, { useEffect, useMemo, useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Select, Space, Typography, Button, message } from 'antd';
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
  FileSearchOutlined,
  CloseOutlined,
  CalendarOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { attachModalEnterToSubmit } from '../../utils/modalEnterSubmit';
import './Layout.css';

// const { Header, Content } = AntLayout; // Moved inside component

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
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
    removeMinimizedModal,
    triggerGlobalRefresh
  } = useApp();

  // Load company logo as base64 whenever logo_path changes
  useEffect(() => {
    if (!currentCompany?.logo_path) {
      setLogoDataUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await (window as any).electronAPI.db.files.readAsDataURL(currentCompany.logo_path);
        if (!cancelled && result?.success && result?.data) {
          setLogoDataUrl(result.data);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentCompany?.logo_path]);

  const defaultFyOptions = useMemo(() => {
    const baseStartYear = 2000 + (Number(fiscalYear) || 0);
    const starts: number[] = [];
    for (let y = baseStartYear - 2; y <= baseStartYear + 2; y++) starts.push(y);
    return starts;
  }, [fiscalYear]);

  const fyOptions = useMemo(() => {
    const starts = Array.from(new Set([
      ...defaultFyOptions,
      2000 + (Number(fiscalYear) || 0),
    ]));

    // Normalize and sort
    starts.sort((a, b) => a - b);

    return starts.map((startYear) => {
      const endYear = startYear + 1;
      const value = endYear % 100;
      return {
        value,
        label: `${startYear}\u2013${String(endYear % 100).padStart(2, '0')}`,
      };
    });
  }, [defaultFyOptions, fiscalYear]);

  // Ensure selected FY is part of options
  const fiscalYearValue = Number(fiscalYear);

  // Ctrl+P on report screens: trigger print from the report page.
  // (Sales documents already handle Ctrl+P to open their print preview modal.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        if (location.pathname.startsWith('/reports')) {
          e.preventDefault();
          window.print();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname]);

  // Modals / drawers: Enter → primary button; Shift+Enter → newline in textareas.
  useEffect(() => attachModalEnterToSubmit(), []);

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
      key: '/inventory/adjustment-notes',
      icon: <FileTextOutlined />,
      label: 'Adjustment Notes',
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
      label: 'Stock',
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
      key: '/reports/custom-builder',
      icon: <FileSearchOutlined />,
      label: 'Custom Report Builder',
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
      children: [
        { key: '/reports', label: 'All Reports' },
        { key: '/reports/sales', label: 'Sales Report' },
        { key: '/reports/sales-by-item', label: 'Sales by Item' },
        { key: '/reports/purchase', label: 'Purchase Report' },
        { key: '/reports/inventory', label: 'Stock Report' },
        { key: '/reports/customer-ledger', label: 'Customer Ledger' },
        { key: '/reports/vendor-ledger', label: 'Vendor Ledger' },
        { key: '/reports/tax', label: 'Tax Deduction Report' },
        { key: '/reports/recovery', label: 'Recovery Report' },
        { key: '/reports/expenses', label: 'Expense Report' },
        { key: '/reports/pl', label: 'Profit & Loss' },
        { key: '/reports/balance', label: 'Balance Sheet' },
        { key: '/reports/customer-outstanding', label: 'Customer Outstanding' },
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
        <div className="logo" style={{ justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '0' : '0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar 
            src={logoDataUrl || undefined} 
            shape={collapsed ? 'circle' : 'square'} 
            size={collapsed ? 32 : 40}
            icon={!logoDataUrl && <h2 style={{ fontSize: '18px', margin: 0 }}>{currentCompany?.name?.[0].toUpperCase() || 'E'}</h2>}
            style={{ flexShrink: 0 }}
          />
          {!collapsed && <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '15px', margin: 0, flex: 1 }}>{currentCompany?.name || 'ERP'}</h2>}
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
            <Space style={{ marginLeft: 24 }}>
              <CalendarOutlined style={{ color: '#1890ff' }} />
              <Typography.Text strong>Fiscal Year:</Typography.Text>
              <Select
                value={fiscalYearValue}
                onChange={(v) => {
                  const n = Number(v);
                  if (!Number.isNaN(n)) setFiscalYear(n);
                }}
                style={{ width: 140 }}
                options={fyOptions}
              />
            </Space>
            <Button 
              type="text" 
              icon={<SyncOutlined />} 
              onClick={() => {
                triggerGlobalRefresh();
                message.success('System data refreshed', 1);
              }}
              style={{ marginLeft: 16 }}
              title="Refresh Data"
            >
              Refresh
            </Button>
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
