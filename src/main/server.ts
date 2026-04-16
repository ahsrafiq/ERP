import express from 'express';
import cors from 'cors';
import os from 'os';
import {
    authHandlers,
    userHandlers,
    companyHandlers,
    customerHandlers,
    vendorHandlers,
    brandHandlers,
    itemHandlers,
    salesInvoiceHandlers,
    salesQuotationHandlers,
    deliveryChallanHandlers,
    purchaseInvoiceHandlers,
    chartOfAccountsHandlers,
    expenseHandlers,
    journalEntryHandlers,
    paymentHandlers,
    dashboardHandlers,
    searchHandlers,
    adjustmentNoteHandlers,
    customReportHandlers,
    warehouseHandlers
} from './database/handlers';
import { getConfig } from './config';
import { getDatabase } from './database/schema';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Disable caching for all API responses
app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// Helper to handle standard response statuses
const sendResponse = (res: express.Response, result: any) => {
    if (result.success) {
        return res.json(result);
    }
    if (result.code === 'CONFLICT') {
        return res.status(409).json(result);
    }
    return res.status(500).json(result);
};

// Heartbeat - Simplified to just check server availability
app.get('/api/heartbeat', (req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// Auth
app.post('/api/auth/login', async (req, res) => res.json(await authHandlers.login(req.body.username, req.body.password)));
app.post('/api/auth/verify-admin-password', async (req, res) => res.json(await authHandlers.verifyAdminPassword(req.body.password)));

// Users
app.get('/api/users', async (req, res) => res.json(await userHandlers.getAll(req.query.companyId ? Number(req.query.companyId) : undefined)));
app.get('/api/users/:id', async (req, res) => res.json(await userHandlers.getById(Number(req.params.id))));
app.post('/api/users', async (req, res) => res.json(await userHandlers.create(req.body)));
app.put('/api/users/:id', async (req, res) => res.json(await userHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/users/:id', async (req, res) => res.json(await userHandlers.delete(Number(req.params.id))));
app.post('/api/users/:id/reset-password', async (req, res) => res.json(await userHandlers.resetPassword(Number(req.params.id), req.body.newPassword)));

// Companies
app.get('/api/companies', async (req, res) => res.json(await companyHandlers.getAll()));
app.get('/api/companies/:id', async (req, res) => res.json(await companyHandlers.getById(Number(req.params.id))));
app.post('/api/companies', async (req, res) => res.json(await companyHandlers.create(req.body)));
app.put('/api/companies/:id', async (req, res) => res.json(await companyHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/companies/:id', async (req, res) => res.json(await companyHandlers.delete(Number(req.params.id))));

// Customers
app.get('/api/customers', async (req, res) => res.json(await customerHandlers.getAll(Number(req.query.companyId))));
app.get('/api/customers/:id', async (req, res) => res.json(await customerHandlers.getById(Number(req.params.id))));
app.get('/api/customers/:customerId/unpaid-invoices', async (req, res) => res.json(await customerHandlers.getUnpaidInvoices(Number(req.params.customerId), req.query.companyId ? Number(req.query.companyId) : undefined)));
app.post('/api/customers', async (req, res) => sendResponse(res, await customerHandlers.create(req.body)));
app.put('/api/customers/:id', async (req, res) => sendResponse(res, await customerHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/customers/:id', async (req, res) => sendResponse(res, await customerHandlers.delete(Number(req.params.id))));
app.post('/api/customers/delete-multiple', async (req, res) => sendResponse(res, await customerHandlers.deleteMultiple(req.body.ids)));

// Vendors
app.get('/api/vendors', async (req, res) => res.json(await vendorHandlers.getAll(Number(req.query.companyId))));
app.get('/api/vendors/:id', async (req, res) => res.json(await vendorHandlers.getById(Number(req.params.id))));
app.post('/api/vendors', async (req, res) => res.json(await vendorHandlers.create(req.body)));
app.put('/api/vendors/:id', async (req, res) => res.json(await vendorHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/vendors/:id', async (req, res) => res.json(await vendorHandlers.delete(Number(req.params.id))));
app.post('/api/vendors/delete-multiple', async (req, res) => res.json(await vendorHandlers.deleteMultiple(req.body.ids)));

// Brands
app.get('/api/brands', async (req, res) => res.json(await brandHandlers.getAll()));
app.get('/api/brands/:id', async (req, res) => res.json(await brandHandlers.getById(Number(req.params.id))));
app.post('/api/brands', async (req, res) => res.json(await brandHandlers.create(req.body)));
app.put('/api/brands/:id', async (req, res) => res.json(await brandHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/brands/:id', async (req, res) => res.json(await brandHandlers.delete(Number(req.params.id))));
app.post('/api/brands/delete-all', async (req, res) => res.json(await brandHandlers.deleteAll()));

// Items
app.get('/api/items', async (req, res) => res.json(await itemHandlers.getAll(Number(req.query.companyId))));
app.get('/api/items/next-code', async (req, res) => res.json(await itemHandlers.getNextCode()));
app.get('/api/items/:id', async (req, res) => res.json(await itemHandlers.getById(Number(req.params.id))));
app.post('/api/items', async (req, res) => sendResponse(res, await itemHandlers.create(req.body)));
app.put('/api/items/:id', async (req, res) => sendResponse(res, await itemHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/items/:id', async (req, res) => sendResponse(res, await itemHandlers.delete(Number(req.params.id))));
app.post('/api/items/delete-all', async (req, res) => res.json(await itemHandlers.deleteAll()));

// Warehouses
app.get('/api/warehouses', async (req, res) => res.json(await warehouseHandlers.getAll(Number(req.query.companyId))));
app.get('/api/warehouses/:id', async (req, res) => res.json(await warehouseHandlers.getById(Number(req.params.id))));
app.post('/api/warehouses', async (req, res) => res.json(await warehouseHandlers.create(req.body)));
app.put('/api/warehouses/:id', async (req, res) => res.json(await warehouseHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/warehouses/:id', async (req, res) => res.json(await warehouseHandlers.delete(Number(req.params.id))));

// Sales Invoices
app.get('/api/sales-invoices', async (req, res) => res.json(await salesInvoiceHandlers.getAll(Number(req.query.companyId), req.query)));
app.get('/api/sales-invoices/next-number', async (req, res) => res.json(await salesInvoiceHandlers.getNextNumber(Number(req.query.companyId), req.query.fiscalYear as string, req.query.isGstEnabled === 'true')));
app.get('/api/sales-invoices/next-po-number', async (req, res) => res.json(await salesInvoiceHandlers.getNextPoNumber(Number(req.query.companyId), req.query.fiscalYear as string)));
app.get('/api/sales-invoices/reports/by-item', async (req, res) => res.json(await salesInvoiceHandlers.getSalesByItem(Number(req.query.companyId), req.query)));
app.get('/api/sales-invoices/pending-with-items', async (req, res) => res.json(await salesInvoiceHandlers.getPendingWithItems(Number(req.query.companyId), req.query)));
app.get('/api/sales-invoices/:id', async (req, res) => res.json(await salesInvoiceHandlers.getById(Number(req.params.id))));
app.post('/api/sales-invoices', async (req, res) => sendResponse(res, await salesInvoiceHandlers.create(req.body)));
app.put('/api/sales-invoices/:id', async (req, res) => sendResponse(res, await salesInvoiceHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/sales-invoices/:id', async (req, res) => sendResponse(res, await salesInvoiceHandlers.delete(Number(req.params.id))));
app.post('/api/sales-invoices/create-from-quotation', async (req, res) => sendResponse(res, await salesInvoiceHandlers.createFromQuotation(req.body.quotationId, req.body.createdBy)));
app.post('/api/sales-invoices/create-from-challan', async (req, res) => sendResponse(res, await salesInvoiceHandlers.createFromChallan(req.body.challanId, req.body.createdBy)));

// Sales Quotations
app.get('/api/sales-quotations', async (req, res) => res.json(await salesQuotationHandlers.getAll(Number(req.query.companyId), req.query)));
app.get('/api/sales-quotations/next-number', async (req, res) => res.json(await salesQuotationHandlers.getNextNumber(Number(req.query.companyId), req.query.fiscalYear as string)));
app.get('/api/sales-quotations/:id', async (req, res) => res.json(await salesQuotationHandlers.getById(Number(req.params.id))));
app.post('/api/sales-quotations', async (req, res) => sendResponse(res, await salesQuotationHandlers.create(req.body)));
app.put('/api/sales-quotations/:id', async (req, res) => sendResponse(res, await salesQuotationHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/sales-quotations/:id', async (req, res) => sendResponse(res, await salesQuotationHandlers.delete(Number(req.params.id))));

// Delivery Challans
app.get('/api/delivery-challans', async (req, res) => res.json(await deliveryChallanHandlers.getAll(Number(req.query.companyId))));
app.get('/api/delivery-challans/next-number', async (req, res) => res.json(await deliveryChallanHandlers.getNextNumber(Number(req.query.companyId), req.query.fiscalYear as string)));
app.get('/api/delivery-challans/next-po-number', async (req, res) => res.json(await deliveryChallanHandlers.getNextPoNumber(Number(req.query.companyId), req.query.fiscalYear as string)));
app.get('/api/delivery-challans/:id', async (req, res) => res.json(await deliveryChallanHandlers.getById(Number(req.params.id))));
app.post('/api/delivery-challans', async (req, res) => sendResponse(res, await deliveryChallanHandlers.create(req.body)));
app.put('/api/delivery-challans/:id', async (req, res) => sendResponse(res, await deliveryChallanHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/delivery-challans/:id', async (req, res) => sendResponse(res, await deliveryChallanHandlers.delete(Number(req.params.id))));
app.post('/api/delivery-challans/create-from-invoice', async (req, res) => sendResponse(res, await deliveryChallanHandlers.createFromInvoice(req.body.invoiceId, req.body.createdBy)));
app.post('/api/delivery-challans/create-from-quotation', async (req, res) => sendResponse(res, await deliveryChallanHandlers.createFromQuotation(req.body.quotationId, req.body.createdBy, req.body.selectedItems, req.body.poNumber)));

// Purchase Invoices
app.get('/api/purchase-invoices', async (req, res) => res.json(await purchaseInvoiceHandlers.getAll(Number(req.query.companyId), req.query)));
app.get('/api/purchase-invoices/next-number', async (req, res) => res.json(await purchaseInvoiceHandlers.getNextNumber(Number(req.query.companyId), Number(req.query.fiscalYear))));
app.get('/api/purchase-invoices/:id', async (req, res) => res.json(await purchaseInvoiceHandlers.getById(Number(req.params.id))));
app.post('/api/purchase-invoices', async (req, res) => sendResponse(res, await purchaseInvoiceHandlers.create(req.body)));
app.put('/api/purchase-invoices/:id', async (req, res) => sendResponse(res, await purchaseInvoiceHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/purchase-invoices/:id', async (req, res) => sendResponse(res, await purchaseInvoiceHandlers.delete(Number(req.params.id))));

// Expenses
app.get('/api/expenses', async (req, res) => res.json(await expenseHandlers.getAll(Number(req.query.companyId), req.query)));
app.get('/api/expenses/categories', async (req, res) => res.json(await expenseHandlers.getCategories(Number(req.query.companyId))));
app.post('/api/expenses/categories', async (req, res) => res.json(await expenseHandlers.createCategory(req.body)));
app.get('/api/expenses/:id', async (req, res) => res.json(await expenseHandlers.getById(Number(req.params.id))));
app.post('/api/expenses', async (req, res) => res.json(await expenseHandlers.create(req.body)));
app.put('/api/expenses/:id', async (req, res) => res.json(await expenseHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/expenses/:id', async (req, res) => res.json(await expenseHandlers.delete(Number(req.params.id))));

// Chart of Accounts
app.get('/api/chart-of-accounts', async (req, res) => res.json(await chartOfAccountsHandlers.getAll(Number(req.query.companyId))));
app.get('/api/chart-of-accounts/:id', async (req, res) => res.json(await chartOfAccountsHandlers.getById(Number(req.params.id))));
app.post('/api/chart-of-accounts', async (req, res) => res.json(await chartOfAccountsHandlers.create(req.body)));
app.put('/api/chart-of-accounts/:id', async (req, res) => res.json(await chartOfAccountsHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/chart-of-accounts/:id', async (req, res) => res.json(await chartOfAccountsHandlers.delete(Number(req.params.id))));

// Journal Entries
app.get('/api/journal-entries', async (req, res) => res.json(await journalEntryHandlers.getAll(Number(req.query.companyId), req.query)));
app.get('/api/journal-entries/:id', async (req, res) => res.json(await journalEntryHandlers.getById(Number(req.params.id))));
app.post('/api/journal-entries', async (req, res) => res.json(await journalEntryHandlers.create(req.body)));
app.put('/api/journal-entries/:id', async (req, res) => res.json(await journalEntryHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/journal-entries/:id', async (req, res) => res.json(await journalEntryHandlers.delete(Number(req.params.id))));

// Adjustment Notes
app.get('/api/adjustment-notes', async (req, res) => res.json(await adjustmentNoteHandlers.getAll(Number(req.query.companyId), req.query)));
app.get('/api/adjustment-notes/next-number', async (req, res) => res.json(await adjustmentNoteHandlers.getNextNumber(Number(req.query.companyId), req.query.fiscalYear as string)));
app.get('/api/adjustment-notes/:id', async (req, res) => res.json(await adjustmentNoteHandlers.getById(Number(req.params.id))));
app.post('/api/adjustment-notes', async (req, res) => res.json(await adjustmentNoteHandlers.create(req.body)));
app.put('/api/adjustment-notes/:id', async (req, res) => res.json(await adjustmentNoteHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/adjustment-notes/:id', async (req, res) => res.json(await adjustmentNoteHandlers.delete(Number(req.params.id))));

// Custom Reports
app.get('/api/custom-reports', async (req, res) => res.json(await customReportHandlers.getAll(Number(req.query.companyId))));
app.post('/api/custom-reports', async (req, res) => res.json(await customReportHandlers.create(req.body)));
app.delete('/api/custom-reports/:id', async (req, res) => res.json(await customReportHandlers.delete(Number(req.params.id))));

// Payments
app.get('/api/payments', async (req, res) => res.json(await paymentHandlers.getAll(Number(req.query.companyId), req.query)));
app.get('/api/payments/invoice/:type/:id', async (req, res) => res.json(await paymentHandlers.getByInvoice(req.params.type, Number(req.params.id))));
app.post('/api/payments', async (req, res) => res.json(await paymentHandlers.create(req.body)));
app.put('/api/payments/:id', async (req, res) => res.json(await paymentHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/payments/:id', async (req, res) => res.json(await paymentHandlers.delete(Number(req.params.id))));

// Dashboard
app.get('/api/dashboard/kpis', async (req, res) => res.json(await dashboardHandlers.getKPIs(Number(req.query.companyId), req.query)));
app.get('/api/dashboard/history', async (req, res) => res.json(await dashboardHandlers.getHistory(Number(req.query.companyId), req.query)));
app.get('/api/dashboard/sales-vs-purchase', async (req, res) => res.json(await dashboardHandlers.getSalesVsPurchase(Number(req.query.companyId), req.query)));
app.get('/api/dashboard/expense-breakdown', async (req, res) => res.json(await dashboardHandlers.getExpenseBreakdown(Number(req.query.companyId), req.query)));
app.get('/api/dashboard/monthly-revenue', async (req, res) => res.json(await dashboardHandlers.getMonthlyRevenue(Number(req.query.companyId), req.query)));
app.get('/api/dashboard/top-customers', async (req, res) => res.json(await dashboardHandlers.getTopCustomers(Number(req.query.companyId), req.query)));

// Global Search
app.get('/api/search/global', async (req, res) => res.json(await searchHandlers.search(Number(req.query.companyId), String(req.query.query))));

let serverInstance: any = null;

export function startServer() {
    if (serverInstance) {
        console.log('[Server] Master server is already running.');
        return;
    }
    const { serverPort } = getConfig();
    try {
        serverInstance = app.listen(serverPort, '0.0.0.0', () => {
            console.log(`[Server] Master server listening at port ${serverPort}`);
            
            // Log local IPs to help user with client configuration
            const interfaces = os.networkInterfaces();
            console.log('[Server] Available on network interfaces:');
            Object.keys(interfaces).forEach((ifaceName) => {
                interfaces[ifaceName]?.forEach((iface) => {
                    if (iface.family === 'IPv4') {
                        console.log(`  - ${ifaceName}: ${iface.address}`);
                    }
                });
            });
        });

        serverInstance.on('error', (err: any) => {
            console.error('[Server] Failed to start Master server:', err.message);
            serverInstance = null;
        });
    } catch (err: any) {
        console.error('[Server] Critical error starting Express:', err.message);
    }
}

export function stopServer() {
    if (serverInstance) {
        console.log('Stopping Master server...');
        serverInstance.close();
        serverInstance = null;
    }
}
