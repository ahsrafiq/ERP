import express from 'express';
import cors from 'cors';
import {
    authHandlers,
    userHandlers,
    companyHandlers,
    customerHandlers,
    vendorHandlers,
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
    searchHandlers
} from './database/handlers';
import { getConfig } from './config';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Heartbeat
app.get('/api/heartbeat', (req, res) => res.json({ success: true }));

// Auth
app.post('/api/auth/login', async (req, res) => res.json(await authHandlers.login(req.body.username, req.body.password)));

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
app.post('/api/customers', async (req, res) => res.json(await customerHandlers.create(req.body)));
app.put('/api/customers/:id', async (req, res) => res.json(await customerHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/customers/:id', async (req, res) => res.json(await customerHandlers.delete(Number(req.params.id))));

// Vendors
app.get('/api/vendors', async (req, res) => res.json(await vendorHandlers.getAll(Number(req.query.companyId))));
app.get('/api/vendors/:id', async (req, res) => res.json(await vendorHandlers.getById(Number(req.params.id))));
app.post('/api/vendors', async (req, res) => res.json(await vendorHandlers.create(req.body)));
app.put('/api/vendors/:id', async (req, res) => res.json(await vendorHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/vendors/:id', async (req, res) => res.json(await vendorHandlers.delete(Number(req.params.id))));

// Items
app.get('/api/items', async (req, res) => res.json(await itemHandlers.getAll(Number(req.query.companyId))));
app.get('/api/items/:id', async (req, res) => res.json(await itemHandlers.getById(Number(req.params.id))));
app.post('/api/items', async (req, res) => res.json(await itemHandlers.create(req.body)));
app.put('/api/items/:id', async (req, res) => res.json(await itemHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/items/:id', async (req, res) => res.json(await itemHandlers.delete(Number(req.params.id))));

// Sales Invoices
app.get('/api/sales-invoices', async (req, res) => res.json(await salesInvoiceHandlers.getAll(Number(req.query.companyId))));
app.get('/api/sales-invoices/:id', async (req, res) => res.json(await salesInvoiceHandlers.getById(Number(req.params.id))));
app.post('/api/sales-invoices', async (req, res) => res.json(await salesInvoiceHandlers.create(req.body)));
app.put('/api/sales-invoices/:id', async (req, res) => res.json(await salesInvoiceHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/sales-invoices/:id', async (req, res) => res.json(await salesInvoiceHandlers.delete(Number(req.params.id))));

// Sales Quotations
app.get('/api/sales-quotations', async (req, res) => res.json(await salesQuotationHandlers.getAll(Number(req.query.companyId))));
app.get('/api/sales-quotations/:id', async (req, res) => res.json(await salesQuotationHandlers.getById(Number(req.params.id))));
app.post('/api/sales-quotations', async (req, res) => res.json(await salesQuotationHandlers.create(req.body)));
app.put('/api/sales-quotations/:id', async (req, res) => res.json(await salesQuotationHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/sales-quotations/:id', async (req, res) => res.json(await salesQuotationHandlers.delete(Number(req.params.id))));

// Delivery Challans
app.get('/api/delivery-challans', async (req, res) => res.json(await deliveryChallanHandlers.getAll(Number(req.query.companyId))));
app.get('/api/delivery-challans/:id', async (req, res) => res.json(await deliveryChallanHandlers.getById(Number(req.params.id))));
app.post('/api/delivery-challans', async (req, res) => res.json(await deliveryChallanHandlers.create(req.body)));
app.put('/api/delivery-challans/:id', async (req, res) => res.json(await deliveryChallanHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/delivery-challans/:id', async (req, res) => res.json(await deliveryChallanHandlers.delete(Number(req.params.id))));

// Purchase Invoices
app.get('/api/purchase-invoices', async (req, res) => res.json(await purchaseInvoiceHandlers.getAll(Number(req.query.companyId))));
app.get('/api/purchase-invoices/:id', async (req, res) => res.json(await purchaseInvoiceHandlers.getById(Number(req.params.id))));
app.post('/api/purchase-invoices', async (req, res) => res.json(await purchaseInvoiceHandlers.create(req.body)));
app.put('/api/purchase-invoices/:id', async (req, res) => res.json(await purchaseInvoiceHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/purchase-invoices/:id', async (req, res) => res.json(await purchaseInvoiceHandlers.delete(Number(req.params.id))));

// Chart of Accounts
app.get('/api/chart-of-accounts', async (req, res) => res.json(await chartOfAccountsHandlers.getAll(Number(req.query.companyId))));
app.get('/api/chart-of-accounts/:id', async (req, res) => res.json(await chartOfAccountsHandlers.getById(Number(req.params.id))));
app.post('/api/chart-of-accounts', async (req, res) => res.json(await chartOfAccountsHandlers.create(req.body)));
app.put('/api/chart-of-accounts/:id', async (req, res) => res.json(await chartOfAccountsHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/chart-of-accounts/:id', async (req, res) => res.json(await chartOfAccountsHandlers.delete(Number(req.params.id))));

// Expenses
app.get('/api/expenses', async (req, res) => res.json(await expenseHandlers.getAll(Number(req.query.companyId))));
app.get('/api/expenses/:id', async (req, res) => res.json(await expenseHandlers.getById(Number(req.params.id))));
app.post('/api/expenses', async (req, res) => res.json(await expenseHandlers.create(req.body)));
app.put('/api/expenses/:id', async (req, res) => res.json(await expenseHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/expenses/:id', async (req, res) => res.json(await expenseHandlers.delete(Number(req.params.id))));

// Journal Entries
app.get('/api/journal-entries', async (req, res) => res.json(await journalEntryHandlers.getAll(Number(req.query.companyId))));
app.get('/api/journal-entries/:id', async (req, res) => res.json(await journalEntryHandlers.getById(Number(req.params.id))));
app.post('/api/journal-entries', async (req, res) => res.json(await journalEntryHandlers.create(req.body)));
app.put('/api/journal-entries/:id', async (req, res) => res.json(await journalEntryHandlers.update(Number(req.params.id), req.body)));
app.delete('/api/journal-entries/:id', async (req, res) => res.json(await journalEntryHandlers.delete(Number(req.params.id))));

// Payments
app.get('/api/payments', async (req, res) => res.json(await paymentHandlers.getAll(Number(req.query.companyId))));
app.get('/api/payments/invoice/:type/:id', async (req, res) => res.json(await paymentHandlers.getByInvoice(req.params.type, Number(req.params.id))));
app.post('/api/payments', async (req, res) => res.json(await paymentHandlers.create(req.body)));
app.delete('/api/payments/:id', async (req, res) => res.json(await paymentHandlers.delete(Number(req.params.id))));

// Dashboard
app.get('/api/dashboard/kpis', async (req, res) => res.json(await dashboardHandlers.getKPIs(Number(req.query.companyId))));
app.get('/api/dashboard/sales-vs-purchase', async (req, res) => res.json(await dashboardHandlers.getSalesVsPurchase(Number(req.query.companyId))));
app.get('/api/dashboard/expense-breakdown', async (req, res) => res.json(await dashboardHandlers.getExpenseBreakdown(Number(req.query.companyId))));
app.get('/api/dashboard/monthly-revenue', async (req, res) => res.json(await dashboardHandlers.getMonthlyRevenue(Number(req.query.companyId))));
app.get('/api/dashboard/top-customers', async (req, res) => res.json(await dashboardHandlers.getTopCustomers(Number(req.query.companyId))));

// Global Search
app.get('/api/search/global', async (req, res) => res.json(await searchHandlers.search(Number(req.query.companyId), String(req.query.query))));

export function startServer() {
    const { serverPort } = getConfig();
    app.listen(serverPort, '0.0.0.0', () => {
        console.log(`Master server running on port ${serverPort}`);
    });
}
