import axios from 'axios';
import { getConfig } from './config';

const getBaseUrl = () => {
    const { serverIp, serverPort } = getConfig();
    return `http://${serverIp}:${serverPort}/api`;
};

async function apiRequest(method: string, endpoint: string, data?: any) {
    try {
        const config = {
            method,
            url: `${getBaseUrl()}${endpoint}`,
            data: method === 'get' ? undefined : data,
            params: method === 'get' ? data : undefined,
        };
        const response = await axios(config);
        return response.data;
    } catch (error: any) {
        console.error(`API Request failed (${endpoint}):`, error.message);
        return {
            success: false,
            error: error.response?.data?.error || 'Database server unreachable'
        };
    }
}

export const apiClient = {
    auth: {
        login: (username: string, password?: string) => apiRequest('post', '/auth/login', { username, password }),
    },
    users: {
        getAll: (companyId?: number) => apiRequest('get', '/users', { companyId }),
        getById: (id: number) => apiRequest('get', `/users/${id}`),
        create: (user: any) => apiRequest('post', '/users', user),
        update: (id: number, user: any) => apiRequest('put', `/users/${id}`, user),
        delete: (id: number) => apiRequest('delete', `/users/${id}`),
        resetPassword: (id: number, newPassword?: string) => apiRequest('post', `/users/${id}/reset-password`, { newPassword }),
    },
    companies: {
        getAll: () => apiRequest('get', '/companies'),
        getById: (id: number) => apiRequest('get', `/companies/${id}`),
        create: (company: any) => apiRequest('post', '/companies', company),
        update: (id: number, company: any) => apiRequest('put', `/companies/${id}`, company),
        delete: (id: number) => apiRequest('delete', `/companies/${id}`),
    },
    customers: {
        getAll: (companyId: number) => apiRequest('get', '/customers', { companyId }),
        getById: (id: number) => apiRequest('get', `/customers/${id}`),
        create: (customer: any) => apiRequest('post', '/customers', customer),
        update: (id: number, customer: any) => apiRequest('put', `/customers/${id}`, customer),
        delete: (id: number) => apiRequest('delete', `/customers/${id}`),
    },
    vendors: {
        getAll: (companyId: number) => apiRequest('get', '/vendors', { companyId }),
        getById: (id: number) => apiRequest('get', `/vendors/${id}`),
        create: (vendor: any) => apiRequest('post', '/vendors', vendor),
        update: (id: number, vendor: any) => apiRequest('put', `/vendors/${id}`, vendor),
        delete: (id: number) => apiRequest('delete', `/vendors/${id}`),
    },
    items: {
        getAll: (companyId: number) => apiRequest('get', '/items', { companyId }),
        getById: (id: number) => apiRequest('get', `/items/${id}`),
        create: (item: any) => apiRequest('post', '/items', item),
        update: (id: number, item: any) => apiRequest('put', `/items/${id}`, item),
        delete: (id: number) => apiRequest('delete', `/items/${id}`),
    },
    warehouses: {
        getAll: (companyId: number) => apiRequest('get', '/warehouses', { companyId }),
        getById: (id: number) => apiRequest('get', `/warehouses/${id}`),
        create: (warehouse: any) => apiRequest('post', '/warehouses', warehouse),
        update: (id: number, warehouse: any) => apiRequest('put', `/warehouses/${id}`, warehouse),
        delete: (id: number) => apiRequest('delete', `/warehouses/${id}`),
    },
    salesInvoices: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/sales-invoices', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/sales-invoices/${id}`),
        create: (invoice: any) => apiRequest('post', '/sales-invoices', invoice),
        update: (id: number, invoice: any) => apiRequest('put', `/sales-invoices/${id}`, invoice),
        delete: (id: number) => apiRequest('delete', `/sales-invoices/${id}`),
    },
    salesQuotations: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/sales-quotations', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/sales-quotations/${id}`),
        create: (quotation: any) => apiRequest('post', '/sales-quotations', quotation),
        update: (id: number, quotation: any) => apiRequest('put', `/sales-quotations/${id}`, quotation),
        delete: (id: number) => apiRequest('delete', `/sales-quotations/${id}`),
    },
    deliveryChallans: {
        getAll: (companyId: number) => apiRequest('get', '/delivery-challans', { companyId }),
        getById: (id: number) => apiRequest('get', `/delivery-challans/${id}`),
        create: (challan: any) => apiRequest('post', '/delivery-challans', challan),
        update: (id: number, challan: any) => apiRequest('put', `/delivery-challans/${id}`, challan),
        delete: (id: number) => apiRequest('delete', `/delivery-challans/${id}`),
    },
    purchaseInvoices: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/purchase-invoices', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/purchase-invoices/${id}`),
        create: (invoice: any) => apiRequest('post', '/purchase-invoices', invoice),
        update: (id: number, invoice: any) => apiRequest('put', `/purchase-invoices/${id}`, invoice),
        delete: (id: number) => apiRequest('delete', `/purchase-invoices/${id}`),
    },
    chartOfAccounts: {
        getAll: (companyId: number) => apiRequest('get', '/chart-of-accounts', { companyId }),
        getById: (id: number) => apiRequest('get', `/chart-of-accounts/${id}`),
        create: (account: any) => apiRequest('post', '/chart-of-accounts', account),
        update: (id: number, account: any) => apiRequest('put', `/chart-of-accounts/${id}`, account),
        delete: (id: number) => apiRequest('delete', `/chart-of-accounts/${id}`),
    },
    expenses: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/expenses', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/expenses/${id}`),
        create: (expense: any) => apiRequest('post', '/expenses', expense),
        update: (id: number, expense: any) => apiRequest('put', `/expenses/${id}`, expense),
        delete: (id: number) => apiRequest('delete', `/expenses/${id}`),
    },
    journalEntries: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/journal-entries', { companyId, ...filters }),
        getById: (id: number) => apiRequest('get', `/journal-entries/${id}`),
        create: (entry: any) => apiRequest('post', '/journal-entries', entry),
        update: (id: number, entry: any) => apiRequest('put', `/journal-entries/${id}`, entry),
        delete: (id: number) => apiRequest('delete', `/journal-entries/${id}`),
    },
    payments: {
        getAll: (companyId: number, filters?: any) => apiRequest('get', '/payments', { companyId, ...filters }),
        getByInvoice: (type: string, id: number) => apiRequest('get', `/payments/invoice/${type}/${id}`),
        create: (payment: any) => apiRequest('post', '/payments', payment),
        delete: (id: number) => apiRequest('delete', `/payments/${id}`),
    },
    dashboard: {
        getKPIs: (companyId: number) => apiRequest('get', '/dashboard/kpis', { companyId }),
        getSalesVsPurchase: (companyId: number) => apiRequest('get', '/dashboard/sales-vs-purchase', { companyId }),
        getExpenseBreakdown: (companyId: number) => apiRequest('get', '/dashboard/expense-breakdown', { companyId }),
        getMonthlyRevenue: (companyId: number) => apiRequest('get', '/dashboard/monthly-revenue', { companyId }),
        getTopCustomers: (companyId: number) => apiRequest('get', '/dashboard/top-customers', { companyId }),
    },
    reportTemplates: {
        getAllByUser: (companyId: number, userId: number, moduleKey?: string) =>
            apiRequest('get', '/report-templates', { companyId, userId, ...(moduleKey ? { moduleKey } : {}) }),
        getById: (id: number) => apiRequest('get', `/report-templates/${id}`),
        create: (template: any) => apiRequest('post', '/report-templates', template),
        deleteById: (id: number) => apiRequest('delete', `/report-templates/${id}`),
    },
    search: {
        global: (companyId: number, query: string) => apiRequest('get', '/search/global', { companyId, query }),
    },
    heartbeat: () => apiRequest('get', '/heartbeat'),
};
