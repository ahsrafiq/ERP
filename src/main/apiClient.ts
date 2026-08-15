import axios from 'axios';
import { getConfig } from './config';

const getBaseUrl = () => {
    const { serverIp, serverPort } = getConfig();
    return `http://${serverIp}:${serverPort}/api`;
};

async function apiRequest(method: string, endpoint: string, data?: any) {
    try {
        const isGet = method.toLowerCase() === 'get';
        const url = `${getBaseUrl()}${endpoint}`;
        // Log the exact URL being requested to diagnose SSL/Mapping issues
        console.log(`[API Client] Request: ${method.toUpperCase()} ${url}`);

        const config: any = {
            method,
            url,
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
            proxy: false, // Disable proxy to prevent SSL redirection/interception
            timeout: 5000 // 5-second timeout for all requests
        };

        if (isGet) {
            // Add cache-busting timestamp
            const params = { ...(data || {}), _t: Date.now() };
            config.params = params;
        } else {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error: any) {
        console.error(`API Request failed (${endpoint}):`, error.message);
        if (error.response?.data) {
            return {
                ...error.response.data,
                success: false // Ensure success is false even if not in body
            };
        }
        return {
            success: false,
            error: 'Database server unreachable'
        };
    }
}

export const apiClient = {
    authHandlers: {
        login: (username: string, password?: string) => apiRequest('post', '/auth/login', { username, password }),
        verifyAdminPassword: (password: string) => apiRequest('post', '/auth/verify-admin-password', { password }),
    },
    userHandlers: {
        getAll: (companyId?: number) => apiRequest('get', '/users', { companyId }),
        getById: (id: number) => apiRequest('get', `/users/${id}`),
        create: (user: any) => apiRequest('post', '/users', user),
        update: (id: number, user: any) => apiRequest('put', `/users/${id}`, user),
        delete: (id: number) => apiRequest('delete', `/users/${id}`),
        resetPassword: (id: number, newPassword?: string) => apiRequest('post', `/users/${id}/reset-password`, { newPassword }),
    },
    companyHandlers: {
        getAll: () => apiRequest('get', '/companies'),
        getById: (id: number) => apiRequest('get', `/companies/${id}`),
        create: (company: any) => apiRequest('post', '/companies', company),
        update: (id: number, company: any) => apiRequest('put', `/companies/${id}`, company),
        delete: (id: number) => apiRequest('delete', `/companies/${id}`),
    },
    customerHandlers: {
        getAll: (companyId: number) => apiRequest('get', '/customers', { companyId }),
        getById: (id: number) => apiRequest('get', `/customers/${id}`),
        getUnpaidInvoices: (customerId: number, companyId?: number) => apiRequest('get', `/customers/${customerId}/unpaid-invoices`, { companyId }),
        create: (customer: any) => apiRequest('post', '/customers', customer),
        update: (id: number, customer: any) => apiRequest('put', `/customers/${id}`, customer),
        delete: (id: number) => apiRequest('delete', `/customers/${id}`),
        deleteMultiple: (ids: number[]) => apiRequest('post', '/customers/delete-multiple', { ids }),
    },
    vendorHandlers: {
        getAll: (companyId: number) => apiRequest('get', '/vendors', { companyId }),
        getById: (id: number) => apiRequest('get', `/vendors/${id}`),
        create: (vendor: any) => apiRequest('post', '/vendors', vendor),
        update: (id: number, vendor: any) => apiRequest('put', `/vendors/${id}`, vendor),
        delete: (id: number) => apiRequest('delete', `/vendors/${id}`),
        deleteMultiple: (ids: number[]) => apiRequest('post', '/vendors/delete-multiple', { ids }),
    },
    brandHandlers: {
        getAll: () => apiRequest('get', '/brands'),
        getById: (id: number) => apiRequest('get', `/brands/${id}`),
        create: (brand: any) => apiRequest('post', '/brands', brand),
        update: (id: number, brand: any) => apiRequest('put', `/brands/${id}`, brand),
        delete: (id: number) => apiRequest('delete', `/brands/${id}`),
        deleteAll: () => apiRequest('post', '/brands/delete-all'),
    },
    itemHandlers: {
        getAll: (companyId: number) => apiRequest('get', '/items', { companyId }),
        getById: (id: number) => apiRequest('get', `/items/${id}`),
        create: (item: any) => apiRequest('post', '/items', item),
        update: (id: number, item: any) => apiRequest('put', `/items/${id}`, item),
        delete: (id: number) => apiRequest('delete', `/items/${id}`),
        deleteAll: () => apiRequest('post', '/items/delete-all'),
        getNextCode: () => apiRequest('get', '/items/next-code'),
    },
    warehouseHandlers: {
        getAll: (companyId: number) => apiRequest('get', '/warehouses', { companyId }),
        getById: (id: number) => apiRequest('get', `/warehouses/${id}`),
        create: (warehouse: any) => apiRequest('post', '/warehouses', warehouse),
        update: (id: number, warehouse: any) => apiRequest('put', `/warehouses/${id}`, warehouse),
        delete: (id: number) => apiRequest('delete', `/warehouses/${id}`),
    },
    salesInvoiceHandlers: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/sales-invoices', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/sales-invoices/${id}`),
        getNextNumber: (companyId: number, fiscalYear?: number | string, isGstEnabled?: boolean) => apiRequest('get', '/sales-invoices/next-number', { companyId, fiscalYear, isGstEnabled }),
        getNextPoNumber: (companyId: number, fiscalYear?: number | string) => apiRequest('get', '/sales-invoices/next-po-number', { companyId, fiscalYear }),
        create: (invoice: any) => apiRequest('post', '/sales-invoices', invoice),
        update: (id: number, invoice: any) => apiRequest('put', `/sales-invoices/${id}`, invoice),
        delete: (id: number) => apiRequest('delete', `/sales-invoices/${id}`),
        createFromQuotation: (quotationId: number, createdBy?: number, fiscalYear?: number | string, force: boolean = false) => apiRequest('post', '/sales-invoices/create-from-quotation', { quotationId, createdBy, fiscalYear, force }),
        createFromChallan: (challanId: number, createdBy?: number, fiscalYear?: number | string, force: boolean = false) => apiRequest('post', '/sales-invoices/create-from-challan', { challanId, createdBy, fiscalYear, force }),
        getSalesByItem: (companyId: number, filters?: any) => apiRequest('get', '/sales-invoices/reports/by-item', { companyId, ...filters }),
        getPendingWithItems: (companyId: number, filters?: any) => apiRequest('get', '/sales-invoices/pending-with-items', { companyId, ...filters }),
    },
    salesQuotationHandlers: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/sales-quotations', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/sales-quotations/${id}`),
        getNextNumber: (companyId: number, fiscalYear?: number | string) => apiRequest('get', '/sales-quotations/next-number', { companyId, fiscalYear }),
        create: (quotation: any) => apiRequest('post', '/sales-quotations', quotation),
        update: (id: number, quotation: any) => apiRequest('put', `/sales-quotations/${id}`, quotation),
        delete: (id: number) => apiRequest('delete', `/sales-quotations/${id}`),
    },
    deliveryChallanHandlers: {
        getAll: (companyId: number) => apiRequest('get', '/delivery-challans', { companyId }),
        getById: (id: number) => apiRequest('get', `/delivery-challans/${id}`),
        getNextNumber: (companyId: number, fiscalYear?: number | string) => apiRequest('get', '/delivery-challans/next-number', { companyId, fiscalYear }),
        getNextPoNumber: (companyId: number, fiscalYear?: number | string) => apiRequest('get', '/delivery-challans/next-po-number', { companyId, fiscalYear }),
        create: (challan: any) => apiRequest('post', '/delivery-challans', challan),
        update: (id: number, challan: any) => apiRequest('put', `/delivery-challans/${id}`, challan),
        delete: (id: number) => apiRequest('delete', `/delivery-challans/${id}`),
        createFromInvoice: (invoiceId: number, createdBy?: number, fiscalYear?: number | string, force: boolean = false) => apiRequest('post', '/delivery-challans/create-from-invoice', { invoiceId, createdBy, fiscalYear, force }),
        createFromQuotation: (quotationId: number, createdBy?: number, selectedItems?: any[], poNumber?: string, fiscalYear?: number | string, force: boolean = false) => apiRequest('post', '/delivery-challans/create-from-quotation', { quotationId, createdBy, selectedItems, poNumber, fiscalYear, force }),
        getChallansByItem: (companyId: number, filters?: any) => apiRequest('get', '/delivery-challans/reports/by-item', { companyId, ...filters }),
    },
    purchaseInvoiceHandlers: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/purchase-invoices', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/purchase-invoices/${id}`),
        getNextNumber: (companyId: number, fiscalYear?: number) => apiRequest('get', '/purchase-invoices/next-number', { companyId, fiscalYear }),
        create: (invoice: any) => apiRequest('post', '/purchase-invoices', invoice),
        update: (id: number, invoice: any) => apiRequest('put', `/purchase-invoices/${id}`, invoice),
        delete: (id: number) => apiRequest('delete', `/purchase-invoices/${id}`),
    },
    expenseHandlers: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/expenses', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/expenses/${id}`),
        create: (expense: any) => apiRequest('post', '/expenses', expense),
        update: (id: number, expense: any) => apiRequest('put', `/expenses/${id}`, expense),
        delete: (id: number) => apiRequest('delete', `/expenses/${id}`),
        getCategories: (companyId: number) => apiRequest('get', '/expenses/categories', { companyId }),
        createCategory: (category: any) => apiRequest('post', '/expenses/categories', category),
    },
    paymentHandlers: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/payments', { companyId, ...filters }),
        getByInvoice: (type: string, id: number) => apiRequest('get', `/payments/invoice/${type}/${id}`),
        create: (payment: any) => apiRequest('post', '/payments', payment),
        update: (id: number, payment: any) => apiRequest('put', `/payments/${id}`, payment),
        delete: (id: number) => apiRequest('delete', `/payments/${id}`),
    },
    dashboardHandlers: {
        getKPIs: (companyId: number, filters?: any) => apiRequest('get', '/dashboard/kpis', { companyId, ...filters }),
        getHistory: (companyId: number, filters?: any) => apiRequest('get', '/dashboard/history', { companyId, ...filters }),
        getSalesVsPurchase: (companyId: number, filters?: any) => apiRequest('get', '/dashboard/sales-vs-purchase', { companyId, ...filters }),
        getExpenseBreakdown: (companyId: number, filters?: any) => apiRequest('get', '/dashboard/expense-breakdown', { companyId, ...filters }),
        getMonthlyRevenue: (companyId: number, filters?: any) => apiRequest('get', '/dashboard/monthly-revenue', { companyId, ...filters }),
        getTopCustomers: (companyId: number, filters?: any) => apiRequest('get', '/dashboard/top-customers', { companyId, ...filters }),
    },
    adjustmentNoteHandlers: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/adjustment-notes', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/adjustment-notes/${id}`),
        getNextNumber: (companyId: number, fiscalYear?: number | string) => apiRequest('get', '/adjustment-notes/next-number', { companyId, fiscalYear }),
        create: (note: any) => apiRequest('post', '/adjustment-notes', note),
        update: (id: number, note: any) => apiRequest('put', `/adjustment-notes/${id}`, note),
        delete: (id: number) => apiRequest('delete', `/adjustment-notes/${id}`),
    },
    searchHandlers: {
        search: (companyId: number, query: string) => apiRequest('get', '/search/global', { companyId, query }),
    },
    chartOfAccountsHandlers: {
        getAll: (companyId: number) => apiRequest('get', '/chart-of-accounts', { companyId }),
        getById: (id: number) => apiRequest('get', `/chart-of-accounts/${id}`),
        create: (account: any) => apiRequest('post', '/chart-of-accounts', account),
        update: (id: number, account: any) => apiRequest('put', `/chart-of-accounts/${id}`, account),
        delete: (id: number) => apiRequest('delete', `/chart-of-accounts/${id}`),
    },
    journalEntryHandlers: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/journal-entries', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/journal-entries/${id}`),
        create: (entry: any) => apiRequest('post', '/journal-entries', entry),
        update: (id: number, entry: any) => apiRequest('put', `/journal-entries/${id}`, entry),
        delete: (id: number) => apiRequest('delete', `/journal-entries/${id}`),
    },
    customReportHandlers: {
        getAll: (companyId: number) => apiRequest('get', '/custom-reports', { companyId }),
        create: (report: any) => apiRequest('post', '/custom-reports', report),
        delete: (id: number) => apiRequest('delete', `/custom-reports/${id}`),
    },
    reportHandlers: {
        getCustomerHistory: (companyId: number, filters?: any) => apiRequest('get', '/reports/customer-history', { companyId, ...filters }),
    },
    fileHandlers: {
        readAsDataURL: (atomPath: string) => apiRequest('post', '/files/read', { atomPath }),
        saveFile: (base64Data: string, fileName: string, subDir: string) => apiRequest('post', '/files/save', { base64Data, fileName, subDir }),
    },
    settingsHandlers: {
        getAll: () => apiRequest('get', '/settings'),
        get: (key: string) => apiRequest('get', `/settings/${key}`),
        set: (key: string, value: string) => apiRequest('post', `/settings/${key}`, { value }),
    },
    heartbeat: async () => {
        // Retry heartbeat 3 times with a 1-second delay for the initial warm-up phase
        for (let i = 0; i < 3; i++) {
            const result = await apiRequest('get', '/heartbeat');
            if (result.success) return result;
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return { success: false, error: 'Master node is unreachable' };
    },
};
