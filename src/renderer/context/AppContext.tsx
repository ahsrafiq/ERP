import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  minimizedModals: any[];
  minimizeModal: (modal: any) => void;
  restoreModal: (modal: { id: string; onRestore?: () => void }) => void;
  removeMinimizedModal: (id: string) => void;
  globalRefreshKey: number;
  triggerGlobalRefresh: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

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
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1; // 1-12
    // If July or later, the suffix is for the next calendar year
    const suffix = currMonth >= 7 ? (currYear + 1) : currYear;
    return suffix % 100;
  });
  const setFiscalYear = (year: number) => {
    setFiscalYearState(year);
    localStorage.setItem(FISCAL_YEAR_KEY, String(year));
  };
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('online');
  const [globalRefreshKey, setGlobalRefreshKey] = useState<number>(0);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [appConfig, setAppConfig] = useState<any>(null);
  const consecutiveFailures = useRef(0);

  useEffect(() => {
    // Load config on first mount only
    loadConfig();

    // Trigger immediate check to avoid initial 5-second "Offline" gap
    checkHeartbeat();
    
    // Heartbeat check every 5 seconds
    const interval = setInterval(async () => {
      checkHeartbeat();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh data every 30 seconds if in CLIENT mode and a user is logged in
  useEffect(() => {
    if (appConfig?.mode === 'CLIENT' && user) {
      const refreshInterval = setInterval(() => {
        triggerGlobalRefresh();
      }, 30000);
      return () => clearInterval(refreshInterval);
    }
  }, [appConfig?.mode, user?.id]);

  useEffect(() => {
    // Listen for menu action to open settings.
    // Access control for backupPath itself is handled inside the form/UI.
    const removeListener = (window as any).electronAPI.onMenuAction((action: string) => {
      if (action === 'open-settings') {
        setIsSettingsModalVisible(true);
      }
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, [user]);

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
      if (result.success) {
        setServerStatus('online');
        consecutiveFailures.current = 0;
        if (user) syncUser(user.id);
      } else {
        throw new Error('Heartbeat failed');
      }
    } catch (error) {
      consecutiveFailures.current += 1;
      
      // Only set status to offline and logout after 5 consecutive failures (~25 seconds)
      // This allows for Master server warm-up and transient network jitter.
      if (consecutiveFailures.current >= 5) {
        setServerStatus('offline');
        
        // Auto-logout if in client mode and user is logged in
        if (appConfig?.mode === 'CLIENT' && user) {
          logout();
          message.error('Connection to Master lost. You have been logged out.', 5);
        }
      } else {
        console.warn(`[Heartbeat] Transient failure count: ${consecutiveFailures.current}`);
      }
    }
  };

  const syncUser = async (userId: number) => {
    try {
      const result = await (window as any).electronAPI.db.users.getById(userId);
      // In bridge mode, results are wrapped in { success, data }
      if (!result?.success || !result?.data) return;
      
      const updatedUser = result.data;
      
      if (updatedUser.is_active === 0) {
        logout();
        message.warning('Your account has been deactivated or removed by an administrator.');
        return;
      }

      // Deep compare to avoid unnecessary re-renders
      if (JSON.stringify(updatedUser) !== JSON.stringify(user)) {
        console.log('[SyncUser] User profile changed, updating state...', updatedUser.company_ids);
        setUser(updatedUser);
      }
    } catch (error) {
      // Ignore background sync errors to avoid flickering
    }
  };

  const triggerGlobalRefresh = () => {
    setGlobalRefreshKey(prev => prev + 1);
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
    // Listen for changes in user's company assignments to auto-refresh list
  }, [serverStatus, user?.id, JSON.stringify(user?.company_ids), globalRefreshKey]);

  // Clear minimized modals when company changes to avoid conflicts
  useEffect(() => {
    setMinimizedModals([]);
  }, [currentCompany?.id]);

  const loadCompanies = async () => {
    try {
      const result = await (window as any).electronAPI.db.companies.getAll();
      if (result.success && result.data) {
        const allFetched = result.data as Company[];
        console.log('[LoadCompanies] Fetched', allFetched.length, 'companies from server');
        
        // Filter based on user access
        let allowedCompanies = allFetched;
        if (user && user.role !== 'admin' && user.role_id !== 1) {
          const allowedIds = user.company_ids || [];
          allowedCompanies = allFetched.filter(c => allowedIds.includes(c.id));
        }

        setCompanies(allowedCompanies);

        // Update currentCompany if invalid or missing
        if (allowedCompanies.length > 0) {
          if (!currentCompany || !allowedCompanies.find(c => c.id === currentCompany.id)) {
            setCurrentCompany(allowedCompanies[0]);
          } else {
            // Refresh details of the current company
            const updated = allowedCompanies.find(c => c.id === currentCompany.id);
            if (updated) setCurrentCompany(updated);
          }
        } else {
          setCurrentCompany(null);
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const login = async (username: string, password?: string): Promise<boolean> => {
    const result = await (window as any).electronAPI.db.auth.login(username, password);
    if (result.success && result.data) {
      setUser(result.data);
      // loadCompanies is now triggered by the useEffect on [user?.id]
      return true;
    }
    if (result.error) {
      throw new Error(result.error);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setMinimizedModals([]);
    pendingRestoresRef.current = [];
  };

  const [minimizedModals, setMinimizedModals] = useState<any[]>([]);
  const pendingRestoresRef = useRef<(() => void)[]>([]);

  const minimizeModal = (modal: any) => {
    const returnPath = window.location.hash.replace('#', '');
    setMinimizedModals(prev => [...prev.filter(m => m.id !== modal.id), { ...modal, returnPath }]);
  };

  const restoreModal = (modal: { id: string; onRestore?: () => void; returnPath?: string }) => {
    if (modal?.onRestore) {
      pendingRestoresRef.current = [...pendingRestoresRef.current, modal.onRestore];
    }
    setMinimizedModals(prev => prev.filter(m => m.id !== modal.id));
  };

  useEffect(() => {
    if (pendingRestoresRef.current.length === 0) return;
    const fns = [...pendingRestoresRef.current];
    pendingRestoresRef.current = [];
    // Use a microtask/setTimeout to ensure state updates happen after the current render cycle if needed,
    // but don't clear it in cleanup so we don't drop fns if minimizedModals updates again immediately.
    setTimeout(() => {
      fns.forEach(fn => fn());
    }, 0);
  }, [minimizedModals]);

  const removeMinimizedModal = (id: string) => {
    setMinimizedModals(prev => prev.filter(m => m.id !== id));
  };

  return (
    <AppContext.Provider value={{
      currentCompany, setCurrentCompany, companies, setCompanies, user, fiscalYear, setFiscalYear, login, logout,
      minimizedModals, minimizeModal, restoreModal, removeMinimizedModal, globalRefreshKey, triggerGlobalRefresh
    }}>
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
          style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000, height: 'auto' }}
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

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.mode !== currentValues.mode}
          >
            {({ getFieldValue }) =>
              getFieldValue('mode') === 'MASTER' && (user?.role === 'admin' || user?.role_id === 1 || user?.username === 'admin') ? (
                <Form.Item
                  name="backupPath"
                  label="Database backup folder (Drive sync path)"
                  tooltip="This folder should be inside your Drive/OneDrive/etc. Only admin can change it."
                >
                  <Input placeholder="e.g. D:\MyDrive\ERP_Backups" />
                </Form.Item>
              ) : null
            }
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
