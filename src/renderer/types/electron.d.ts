export interface ElectronAPI {
  db: {
    users: {
      getAll: (companyId?: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (user: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, user: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    companies: {
      getAll: () => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (company: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, company: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    customers: {
      getAll: (companyId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (customer: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, customer: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    vendors: {
      getAll: (companyId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (vendor: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, vendor: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    items: {
      getAll: (companyId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (item: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, item: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    salesInvoices: {
      getAll: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (invoice: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, invoice: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    purchaseInvoices: {
      getAll: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (invoice: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, invoice: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    expenses: {
      getAll: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      getById: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      create: (expense: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      update: (id: number, expense: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      delete: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      getCategories: (companyId: number) => Promise<{ success: boolean; data?: any; error?: string }>;
      createCategory: (category: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    dashboard: {
      getKPIs: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      getSalesVsPurchase: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      getExpenseBreakdown: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      getMonthlyRevenue: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      getTopCustomers: (companyId: number, filters?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
    search: {
      global: (companyId: number, query: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    };
  };
  onMenuAction: (callback: (action: string) => void) => () => void;
  onAutoBackupStatus: (callback: (data: { success: boolean; path?: string; error?: string }) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
