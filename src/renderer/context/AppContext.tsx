import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, Modal, Form, Input, Radio, message, Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

interface Company {
  id: number;
  name: string;
  logo_path?: string;
  letterhead_path?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  tax_number?: string;
  is_gst_enabled: number;
  gst_registration_number?: string;
  currency: string;
  fiscal_year_start?: string;
  is_active: number;
}

interface User {
  id: number;
  username: string;
  role: 'admin';
  name: string;
  role_id?: number;
  company_ids?: number[];
  role_name?: string;
}

interface AppContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  user: User | null;
  fiscalYear: number;
  setFiscalYear: (year: number) => void;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const FISCAL_YEAR_KEY = 'erp_fiscal_year';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [fiscalYear, setFiscalYearState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(FISCAL_YEAR_KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (n >= 0 && n <= 99) return n;
      }
    } catch (_) { }
    return new Date().getFullYear() % 100;
  });
  const setFiscalYear = (year: number) => {
    setFiscalYearState(year);
    localStorage.setItem(FISCAL_YEAR_KEY, String(year));
  };
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('online');
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [appConfig, setAppConfig] = useState<any>(null);

  useEffect(() => {
    // Load config on mount
    loadConfig();

    // Heartbeat check every 10 seconds
    const interval = setInterval(async () => {
      checkHeartbeat();
    }, 10000);

    // List for menu action to open settings
    const removeListener = (window as any).electronAPI.onMenuAction((action: string) => {
      if (action === 'open-settings') {
        setIsSettingsModalVisible(true);
      }
    });

    return () => {
      clearInterval(interval);
      if (removeListener) removeListener();
    };
  }, []);

  const loadConfig = async () => {
    try {
      const config = await (window as any).electronAPI.db.config.get();
      setAppConfig(config);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const checkHeartbeat = async () => {
    try {
      const result = await (window as any).electronAPI.db.heartbeat();
      setServerStatus(result.success ? 'online' : 'offline');
    } catch (error) {
      setServerStatus('offline');
    }
  };

  const saveSettings = async (values: any) => {
    try {
      await (window as any).electronAPI.db.config.save(values);
      message.success('Settings saved. Please restart the application for changes to take full effect.');
      setIsSettingsModalVisible(false);
      setAppConfig(values);
      checkHeartbeat();
    } catch (error) {
      message.error('Failed to save settings');
    }
  };

  useEffect(() => {
    if (serverStatus === 'online') {
      loadCompanies();
    }
  }, [serverStatus]);

  const loadCompanies = async () => {
    try {
      const result = await (window as any).electronAPI.db.companies.getAll();
      if (result.success && result.data) {
        setCompanies(result.data);
        if (result.data.length > 0 && !currentCompany) {
          setCurrentCompany(result.data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      const result = await (window as any).electronAPI.db.auth.login(username, password);
      if (result.success && result.data) {
        const userData = result.data;
        setUser(userData);

        // Filter companies based on user's assigned companies
        if (userData.role === 'admin' || userData.role_id === 1) {
          loadCompanies(); // Reloads all
        } else {
          // Filter companies
          const allowedIds = userData.company_ids || [];
          if (allowedIds.length > 0) {
            const allowedCompanies = companies.filter(c => allowedIds.includes(c.id));
            setCompanies(allowedCompanies);
            if (allowedCompanies.length > 0) {
              setCurrentCompany(allowedCompanies[0]);
            } else {
              setCurrentCompany(null);
            }
          } else {
            setCompanies([]);
            setCurrentCompany(null);
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AppContext.Provider value={{ currentCompany, setCurrentCompany, companies, setCompanies, user, fiscalYear, setFiscalYear, login, logout }}>
      {serverStatus === 'offline' && (
        <Alert
          message="Database connection lost"
          description={
            <div>
              <p>The Master software is not running or unreachable. Please ensure the Master machine is on and the ERP software is running.</p>
              <Button
                type="primary"
                size="small"
                onClick={() => setIsSettingsModalVisible(true)}
                icon={<SettingOutlined />}
                style={{ marginTop: 8 }}
              >
                Configure Connection
              </Button>
            </div>
          }
          type="error"
          showIcon
          banner
          style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, height: 'auto' }}
        />
      )}

      <Modal
        title="Connection Settings"
        open={isSettingsModalVisible}
        onCancel={() => setIsSettingsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          initialValues={appConfig}
          onFinish={saveSettings}
          layout="vertical"
        >
          <Form.Item
            name="mode"
            label="Application Mode"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value="MASTER">Master (Server)</Radio>
              <Radio value="CLIENT">Client</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.mode !== currentValues.mode}
          >
            {({ getFieldValue }) =>
              getFieldValue('mode') === 'CLIENT' ? (
                <Form.Item
                  name="serverIp"
                  label="Master IP Address"
                  rules={[{ required: true, message: 'Please enter the Master IP' }]}
                >
                  <Input placeholder="e.g. 192.168.1.10" />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="serverPort"
            label="Port"
            rules={[{ required: true }]}
          >
            <Input type="number" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Save & Apply
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
