import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  db: {
    auth: {
      login: (username: string, password?: string) => ipcRenderer.invoke('db:auth:login', username, password),
    },
    users: {
      getAll: (companyId?: number) => ipcRenderer.invoke('db:users:getAll', companyId),
      getById: (id: number) => ipcRenderer.invoke('db:users:getById', id),
      create: (user: any) => ipcRenderer.invoke('db:users:create', user),
      update: (id: number, user: any) => ipcRenderer.invoke('db:users:update', id, user),
      delete: (id: number) => ipcRenderer.invoke('db:users:delete', id),
      resetPassword: (id: number, newPassword?: string) => ipcRenderer.invoke('db:users:resetPassword', id, newPassword),
    },
    companies: {
      getAll: () => ipcRenderer.invoke('db:companies:getAll'),
      getById: (id: number) => ipcRenderer.invoke('db:companies:getById', id),
      create: (company: any) => ipcRenderer.invoke('db:companies:create', company),
      update: (id: number, company: any) => ipcRenderer.invoke('db:companies:update', id, company),
      delete: (id: number) => ipcRenderer.invoke('db:companies:delete', id),
    },
    customers: {
      getAll: (companyId: number) => ipcRenderer.invoke('db:customers:getAll', companyId),
      getById: (id: number) => ipcRenderer.invoke('db:customers:getById', id),
      create: (customer: any) => ipcRenderer.invoke('db:customers:create', customer),
      update: (id: number, customer: any) => ipcRenderer.invoke('db:customers:update', id, customer),
      delete: (id: number) => ipcRenderer.invoke('db:customers:delete', id),
    },
    vendors: {
      getAll: (companyId: number) => ipcRenderer.invoke('db:vendors:getAll', companyId),
      getById: (id: number) => ipcRenderer.invoke('db:vendors:getById', id),
      create: (vendor: any) => ipcRenderer.invoke('db:vendors:create', vendor),
      update: (id: number, vendor: any) => ipcRenderer.invoke('db:vendors:update', id, vendor),
      delete: (id: number) => ipcRenderer.invoke('db:vendors:delete', id),
    },
    brands: {
      getAll: () => ipcRenderer.invoke('db:brands:getAll'),
      getById: (id: number) => ipcRenderer.invoke('db:brands:getById', id),
      create: (brand: any) => ipcRenderer.invoke('db:brands:create', brand),
      update: (id: number, brand: any) => ipcRenderer.invoke('db:brands:update', id, brand),
      delete: (id: number) => ipcRenderer.invoke('db:brands:delete', id),
    },
    items: {
      getAll: (companyId: number) => ipcRenderer.invoke('db:items:getAll', companyId),
      getById: (id: number) => ipcRenderer.invoke('db:items:getById', id),
      create: (item: any) => ipcRenderer.invoke('db:items:create', item),
      update: (id: number, item: any) => ipcRenderer.invoke('db:items:update', id, item),
      delete: (id: number) => ipcRenderer.invoke('db:items:delete', id),
    },
    salesInvoices: {
      getAll: (companyId: number, filters?: any) => ipcRenderer.invoke('db:salesInvoices:getAll', companyId, filters),
      getById: (id: number) => ipcRenderer.invoke('db:salesInvoices:getById', id),
      getNextNumber: (companyId: number, fiscalYear?: number | string) => ipcRenderer.invoke('db:salesInvoices:getNextNumber', companyId, fiscalYear),
      create: (invoice: any) => ipcRenderer.invoke('db:salesInvoices:create', invoice),
      update: (id: number, invoice: any) => ipcRenderer.invoke('db:salesInvoices:update', id, invoice),
      delete: (id: number) => ipcRenderer.invoke('db:salesInvoices:delete', id),
      createFromQuotation: (quotationId: number, createdBy?: number) => ipcRenderer.invoke('db:salesInvoices:createFromQuotation', quotationId, createdBy),
    },
    salesQuotations: {
      getAll: (companyId: number, filters?: any) => ipcRenderer.invoke('db:salesQuotations:getAll', companyId, filters),
      getById: (id: number) => ipcRenderer.invoke('db:salesQuotations:getById', id),
      getNextNumber: (companyId: number, fiscalYear?: number | string) => ipcRenderer.invoke('db:salesQuotations:getNextNumber', companyId, fiscalYear),
      create: (quotation: any) => ipcRenderer.invoke('db:salesQuotations:create', quotation),
      update: (id: number, quotation: any) => ipcRenderer.invoke('db:salesQuotations:update', id, quotation),
      delete: (id: number) => ipcRenderer.invoke('db:salesQuotations:delete', id),
    },
    deliveryChallans: {
      getAll: (companyId: number) => ipcRenderer.invoke('db:deliveryChallans:getAll', companyId),
      getById: (id: number) => ipcRenderer.invoke('db:deliveryChallans:getById', id),
      getNextNumber: (companyId: number, fiscalYear?: number | string) => ipcRenderer.invoke('db:deliveryChallans:getNextNumber', companyId, fiscalYear),
      create: (challan: any) => ipcRenderer.invoke('db:deliveryChallans:create', challan),
      update: (id: number, challan: any) => ipcRenderer.invoke('db:deliveryChallans:update', id, challan),
      delete: (id: number) => ipcRenderer.invoke('db:deliveryChallans:delete', id),
      createFromInvoice: (invoiceId: number, createdBy?: number) => ipcRenderer.invoke('db:deliveryChallans:createFromInvoice', invoiceId, createdBy),
    },
    purchaseInvoices: {
      getAll: (companyId: number, filters?: any) => ipcRenderer.invoke('db:purchaseInvoices:getAll', companyId, filters),
      getById: (id: number) => ipcRenderer.invoke('db:purchaseInvoices:getById', id),
      create: (invoice: any) => ipcRenderer.invoke('db:purchaseInvoices:create', invoice),
      update: (id: number, invoice: any) => ipcRenderer.invoke('db:purchaseInvoices:update', id, invoice),
      delete: (id: number) => ipcRenderer.invoke('db:purchaseInvoices:delete', id),
    },
    expenses: {
      getAll: (companyId: number, filters?: any) => ipcRenderer.invoke('db:expenses:getAll', companyId, filters),
      getById: (id: number) => ipcRenderer.invoke('db:expenses:getById', id),
      create: (expense: any) => ipcRenderer.invoke('db:expenses:create', expense),
      update: (id: number, expense: any) => ipcRenderer.invoke('db:expenses:update', id, expense),
      delete: (id: number) => ipcRenderer.invoke('db:expenses:delete', id),
      getCategories: (companyId: number) => ipcRenderer.invoke('db:expenses:getCategories', companyId),
      createCategory: (category: any) => ipcRenderer.invoke('db:expenses:createCategory', category),
    },
    payments: {
      getAll: (companyId: number, filters?: any) => ipcRenderer.invoke('db:payments:getAll', companyId, filters),
      getByInvoice: (type: string, id: number) => ipcRenderer.invoke('db:payments:getByInvoice', type, id),
      create: (payment: any) => ipcRenderer.invoke('db:payments:create', payment),
      delete: (id: number) => ipcRenderer.invoke('db:payments:delete', id),
    },
    dashboard: {
      getKPIs: (companyId: number, filters?: any) => ipcRenderer.invoke('db:dashboard:getKPIs', companyId, filters),
      getSalesVsPurchase: (companyId: number, filters?: any) => ipcRenderer.invoke('db:dashboard:getSalesVsPurchase', companyId, filters),
      getExpenseBreakdown: (companyId: number, filters?: any) => ipcRenderer.invoke('db:dashboard:getExpenseBreakdown', companyId, filters),
      getMonthlyRevenue: (companyId: number, filters?: any) => ipcRenderer.invoke('db:dashboard:getMonthlyRevenue', companyId, filters),
      getTopCustomers: (companyId: number, filters?: any) => ipcRenderer.invoke('db:dashboard:getTopCustomers', companyId, filters),
    },
    search: {
      global: (companyId: number, query: string) => ipcRenderer.invoke('db:search:global', companyId, query),
    },
    heartbeat: () => ipcRenderer.invoke('db:heartbeat'),
    config: {
      get: () => ipcRenderer.invoke('db:config:get'),
      save: (config: any) => ipcRenderer.invoke('db:config:save', config),
    },
    files: {
      save: (base64Data: string, fileName: string, subDir: string) => ipcRenderer.invoke('file:save', base64Data, fileName, subDir),
      readAsDataURL: (path: string) => ipcRenderer.invoke('file:readAsDataURL', path),
      printToPDF: () => ipcRenderer.invoke('file:printToPDF'),
      print: () => ipcRenderer.invoke('file:print'),
    },
  },
  // Menu actions
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (event, action) => callback(action));
  },
  // Platform info
  platform: process.platform,
});
