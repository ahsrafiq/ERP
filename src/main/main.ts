import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, protocol, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './database/schema';
import {
  authHandlers,
  userHandlers,
  companyHandlers,
  customerHandlers,
  vendorHandlers,
  brandHandlers,
  itemHandlers,
  salesInvoiceHandlers,
  purchaseInvoiceHandlers,
  expenseHandlers,
  paymentHandlers,
  dashboardHandlers,
  searchHandlers,
  fileHandlers,
  salesQuotationHandlers,
  deliveryChallanHandlers
} from './database/handlers';
import { isMasterMode, getConfig, saveConfig } from './config';
import { dbBridge } from './database/bridge';
import { startServer } from './server';
import { apiClient } from './apiClient';

// Register atom protocol as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'atom', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, Vite builds to dist/renderer/index.html
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.reload();
          },
        },
        { type: 'separator' },
        {
          label: 'Backup Database',
          click: async () => {
            if (!isMasterMode()) {
              dialog.showMessageBox({
                type: 'info',
                title: 'Master Only',
                message: 'Database backup is only available on the Master machine.',
              });
              return;
            }

            const { filePath } = await dialog.showSaveDialog({
              title: 'Backup Database',
              defaultPath: path.join(app.getPath('downloads'), `erp_backup_${new Date().toISOString().split('T')[0]}.db`),
              filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            });

            if (filePath) {
              try {
                const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
                fs.copyFileSync(dbPath, filePath);
                dialog.showMessageBox({
                  type: 'info',
                  title: 'Backup Success',
                  message: 'Database backed up successfully.',
                });
              } catch (error: any) {
                dialog.showErrorBox('Backup Failed', error.message);
              }
            }
          },
        },
        {
          label: 'Restore Database',
          click: async () => {
            if (!isMasterMode()) {
              dialog.showMessageBox({
                type: 'info',
                title: 'Master Only',
                message: 'Database restore is only available on the Master machine.',
              });
              return;
            }

            const { response } = await dialog.showMessageBox({
              type: 'warning',
              title: 'Confirm Restore',
              message: 'Restoring will overwrite all current data. Are you sure?',
              buttons: ['Cancel', 'Restore'],
              defaultId: 0,
            });

            if (response === 1) {
              const { filePaths } = await dialog.showOpenDialog({
                title: 'Select Backup File',
                filters: [{ name: 'SQLite Database', extensions: ['db'] }],
                properties: ['openFile'],
              });

              if (filePaths && filePaths.length > 0) {
                try {
                  const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
                  // We don't need to close connection here because our handlers open/close per request
                  fs.copyFileSync(filePaths[0], dbPath);

                  dialog.showMessageBox({
                    type: 'info',
                    title: 'Restore Success',
                    message: 'Database restored successfully. The application will now restart.',
                  }).then(() => {
                    app.relaunch();
                    app.exit();
                  });
                } catch (error: any) {
                  dialog.showErrorBox('Restore Failed', error.message);
                }
              }
            }
          },
        },
        {
          label: 'Connection Settings',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'open-settings');
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'about');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show ERP',
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('ERP Desktop');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

// Initialize database
app.whenReady().then(() => {
  // Register atom protocol handler for local file access
  protocol.handle('atom', (request) => {
    try {
      const url = new URL(request.url.replace('atom://', 'http://local.host/'));
      // On Windows, url.pathname might start with a leading slash which path.join treats as absolute
      // We need to ensure we use a relative path for joining
      const relativePath = decodeURIComponent(url.pathname).replace(/^\//, '');
      const filePath = path.join(app.getPath('userData'), 'uploads', relativePath);

      console.log(`[Protocol handler] Request: ${request.url} -> Path: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.warn(`[Protocol handler] File not found: ${filePath}`);
      }

      const { pathToFileURL } = require('url');
      const { net } = require('electron');
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      console.error('Protocol error:', error);
      const { net } = require('electron');
      return net.fetch('data:text/plain,Error');
    }
  });

  ipcMain.handle('file:print', (event) => {
    console.log('[Print Handler] Starting print dialog...');
    try {
      event.sender.print({ silent: false, printBackground: true });
      console.log('[Print Handler] Print dialog opened successfully');
      return { success: true };
    } catch (error) {
      console.error('[Print Handler] Failed to open print dialog:', error);
      return { success: false, error: String(error) };
    }
  });

  try {
    if (isMasterMode()) {
      initializeDatabase();
      console.log('Database initialized successfully at:', path.join(app.getPath('userData'), 'database', 'erp.db'));
      startServer();
    } else {
      console.log('Running in CLIENT mode. Connecting to Master server.');
    }
  } catch (error) {
    console.error('Database/Server initialization error:', error);
  }

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('file:printToPDF', async (event) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save as PDF',
    defaultPath: path.join(app.getPath('documents'), 'ERP_Document.pdf'),
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });

  if (filePath) {
    try {
      const data = await event.sender.printToPDF({
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: 'A4',
      });
      fs.writeFileSync(filePath, data);
      return { success: true, filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Save cancelled' };
});

// Step 1: Show save dialog and return chosen path (no capturing yet)
ipcMain.handle('file:getSavePath', async (_event, defaultName: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save as PDF',
    defaultPath: path.join(app.getPath('documents'), defaultName || 'ERP_Document.pdf'),
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false, error: 'Save cancelled' };
  return { success: true, filePath };
});

// Step 2: Capture PDF from current page and write to the already-chosen path.
// heightMM is optional: when provided the PDF page height is cropped to exactly
// the content height (no blank trailing page); falls back to A4 (297 mm).
ipcMain.handle('file:captureAndSave', async (event, filePath: string, heightMM?: number) => {
  try {
    const pageSize = heightMM && heightMM > 50
      ? { width: 210000, height: Math.round(heightMM * 1000) }  // microns
      : 'A4' as const;
    const data = await event.sender.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize,
    });
    fs.writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Render a complete HTML string in an isolated hidden window and save as PDF.
// This sidesteps all @media-print / CSS-isolation issues with the main window.
ipcMain.handle('file:printHtmlToPDF', async (_event, html: string, filePath: string, heightMM: number) => {
  const tmpPath = path.join(app.getPath('temp'), `erp-print-${Date.now()}.html`);
  let win: BrowserWindow | null = null;
  try {
    fs.writeFileSync(tmpPath, html, 'utf8');
    win = new BrowserWindow({
      show: false,
      width: 794,
      height: Math.ceil((heightMM || 297) * 3.78) + 50,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    await win.loadFile(tmpPath);
    // Give images and fonts an extra tick to decode after load
    await new Promise(r => setTimeout(r, 300));
    const pageSize: any = heightMM > 50
      ? { width: 210000, height: Math.round(heightMM * 1000) }
      : 'A4';
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize,
    });
    fs.writeFileSync(filePath, pdfData);
    return { success: true, filePath };
  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    win?.destroy();
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
});

// IPC Handlers
ipcMain.handle('file:save', async (event, base64Data: string, fileName: string, subDir: string) => {
  return fileHandlers.saveFile(base64Data, fileName, subDir);
});

ipcMain.handle('file:readAsDataURL', async (event, path: string) => {
  return fileHandlers.readAsDataURL(path);
});

ipcMain.handle('db:users:getAll', async (event, companyId?: number) => {
  return dbBridge.users.getAll(companyId);
});

ipcMain.handle('db:users:getById', async (event, id: number) => {
  return dbBridge.users.getById(id);
});

ipcMain.handle('db:users:create', async (event, user: any) => {
  return dbBridge.users.create(user);
});

ipcMain.handle('db:users:update', async (event, id: number, user: any) => {
  return dbBridge.users.update(id, user);
});

ipcMain.handle('db:users:delete', async (event, id: number) => {
  return dbBridge.users.delete(id);
});

ipcMain.handle('db:users:resetPassword', async (event, id: number, newPassword?: string) => {
  return dbBridge.users.resetPassword(id, newPassword);
});

ipcMain.handle('db:companies:getAll', async () => {
  return dbBridge.companies.getAll();
});

ipcMain.handle('db:companies:getById', async (event, id: number) => {
  return dbBridge.companies.getById(id);
});

ipcMain.handle('db:companies:create', async (event, company: any) => {
  return dbBridge.companies.create(company);
});

ipcMain.handle('db:companies:update', async (event, id: number, company: any) => {
  return dbBridge.companies.update(id, company);
});

ipcMain.handle('db:companies:delete', async (event, id: number) => {
  return dbBridge.companies.delete(id);
});

ipcMain.handle('db:customers:getAll', async (event, companyId: number) => {
  return dbBridge.customers.getAll(companyId);
});

ipcMain.handle('db:customers:getById', async (event, id: number) => {
  return dbBridge.customers.getById(id);
});

ipcMain.handle('db:customers:create', async (event, customer: any) => {
  return dbBridge.customers.create(customer);
});

ipcMain.handle('db:customers:update', async (event, id: number, customer: any) => {
  return dbBridge.customers.update(id, customer);
});

ipcMain.handle('db:customers:delete', async (event, id: number) => {
  return dbBridge.customers.delete(id);
});

ipcMain.handle('db:vendors:getAll', async (event, companyId: number) => {
  return dbBridge.vendors.getAll(companyId);
});

ipcMain.handle('db:vendors:getById', async (event, id: number) => {
  return dbBridge.vendors.getById(id);
});

ipcMain.handle('db:vendors:create', async (event, vendor: any) => {
  return dbBridge.vendors.create(vendor);
});

ipcMain.handle('db:vendors:update', async (event, id: number, vendor: any) => {
  return dbBridge.vendors.update(id, vendor);
});

ipcMain.handle('db:vendors:delete', async (event, id: number) => {
  return dbBridge.vendors.delete(id);
});

ipcMain.handle('db:brands:getAll', async () => {
  return dbBridge.brands.getAll();
});
ipcMain.handle('db:brands:getById', async (event, id: number) => {
  return dbBridge.brands.getById(id);
});
ipcMain.handle('db:brands:create', async (event, brand: any) => {
  return dbBridge.brands.create(brand);
});
ipcMain.handle('db:brands:update', async (event, id: number, brand: any) => {
  return dbBridge.brands.update(id, brand);
});
ipcMain.handle('db:brands:delete', async (event, id: number) => {
  return dbBridge.brands.delete(id);
});

// Danger: delete ALL brands
ipcMain.handle('db:brands:deleteAll', async () => {
  return dbBridge.brands.deleteAll();
});

ipcMain.handle('db:items:getAll', async (event, companyId: number) => {
  return dbBridge.items.getAll(companyId);
});

ipcMain.handle('db:items:getById', async (event, id: number) => {
  return dbBridge.items.getById(id);
});

ipcMain.handle('db:items:create', async (event, item: any) => {
  return dbBridge.items.create(item);
});

ipcMain.handle('db:items:update', async (event, id: number, item: any) => {
  return dbBridge.items.update(id, item);
});

ipcMain.handle('db:items:delete', async (event, id: number) => {
  return dbBridge.items.delete(id);
});

// Danger: delete ALL items
ipcMain.handle('db:items:deleteAll', async () => {
  return dbBridge.items.deleteAll();
});

ipcMain.handle('db:salesInvoices:getAll', async (event, companyId: number, filters?: any) => {
  return dbBridge.salesInvoices.getAll(companyId, filters);
});

ipcMain.handle('db:salesInvoices:getById', async (event, id: number) => {
  return dbBridge.salesInvoices.getById(id);
});

ipcMain.handle('db:salesInvoices:getNextNumber', async (event, companyId: number, fiscalYear?: number | string, isGstEnabled?: boolean) => {
  return dbBridge.salesInvoices.getNextNumber(companyId, fiscalYear, isGstEnabled);
});

ipcMain.handle('db:salesInvoices:getNextPoNumber', async (event, companyId: number, fiscalYear?: number | string) => {
  return dbBridge.salesInvoices.getNextPoNumber(companyId, fiscalYear);
});

ipcMain.handle('db:salesInvoices:create', async (event, invoice: any) => {
  return dbBridge.salesInvoices.create(invoice);
});

ipcMain.handle('db:salesInvoices:update', async (event, id: number, invoice: any) => {
  return dbBridge.salesInvoices.update(id, invoice);
});

ipcMain.handle('db:salesInvoices:delete', async (event, id: number) => {
  return dbBridge.salesInvoices.delete(id);
});

ipcMain.handle('db:salesInvoices:createFromQuotation', async (event, quotationId: number, createdBy?: number) => {
  return dbBridge.salesInvoices.createFromQuotation(quotationId, createdBy);
});

ipcMain.handle('db:salesInvoices:createFromChallan', async (event, challanId: number, createdBy?: number) => {
  return dbBridge.salesInvoices.createFromChallan(challanId, createdBy);
});

ipcMain.handle('db:salesQuotations:getAll', async (event, companyId: number, filters?: any) => {
  return dbBridge.salesQuotations.getAll(companyId, filters);
});

ipcMain.handle('db:salesQuotations:getById', async (event, id: number) => {
  return dbBridge.salesQuotations.getById(id);
});

ipcMain.handle('db:salesQuotations:getNextNumber', async (event, companyId: number, fiscalYear?: number | string) => {
  return dbBridge.salesQuotations.getNextNumber(companyId, fiscalYear);
});

ipcMain.handle('db:salesQuotations:create', async (event, quotation: any) => {
  return dbBridge.salesQuotations.create(quotation);
});

ipcMain.handle('db:salesQuotations:update', async (event, id: number, quotation: any) => {
  return dbBridge.salesQuotations.update(id, quotation);
});

ipcMain.handle('db:salesQuotations:delete', async (event, id: number) => {
  return dbBridge.salesQuotations.delete(id);
});

ipcMain.handle('db:deliveryChallans:getAll', async (event, companyId: number) => {
  return dbBridge.deliveryChallans.getAll(companyId);
});

ipcMain.handle('db:deliveryChallans:getById', async (event, id: number) => {
  return dbBridge.deliveryChallans.getById(id);
});

ipcMain.handle('db:deliveryChallans:getNextNumber', async (event, companyId: number, fiscalYear?: number | string) => {
  return dbBridge.deliveryChallans.getNextNumber(companyId, fiscalYear);
});

ipcMain.handle('db:deliveryChallans:getNextPoNumber', async (event, companyId: number, fiscalYear?: number | string) => {
  return dbBridge.deliveryChallans.getNextPoNumber(companyId, fiscalYear);
});

ipcMain.handle('db:deliveryChallans:create', async (event, challan: any) => {
  return dbBridge.deliveryChallans.create(challan);
});

ipcMain.handle('db:deliveryChallans:update', async (event, id: number, challan: any) => {
  return dbBridge.deliveryChallans.update(id, challan);
});

ipcMain.handle('db:deliveryChallans:delete', async (event, id: number) => {
  return dbBridge.deliveryChallans.delete(id);
});

ipcMain.handle('db:deliveryChallans:createFromInvoice', async (event, invoiceId: number, createdBy?: number) => {
  return dbBridge.deliveryChallans.createFromInvoice(invoiceId, createdBy);
});

ipcMain.handle('db:deliveryChallans:createFromQuotation', async (event, quotationId: number, createdBy?: number) => {
  return dbBridge.deliveryChallans.createFromQuotation(quotationId, createdBy);
});

ipcMain.handle('db:purchaseInvoices:getAll', async (event, companyId: number, filters?: any) => {
  return dbBridge.purchaseInvoices.getAll(companyId, filters);
});

ipcMain.handle('db:purchaseInvoices:getById', async (event, id: number) => {
  return dbBridge.purchaseInvoices.getById(id);
});

ipcMain.handle('db:purchaseInvoices:create', async (event, invoice: any) => {
  return dbBridge.purchaseInvoices.create(invoice);
});

ipcMain.handle('db:purchaseInvoices:update', async (event, id: number, invoice: any) => {
  return dbBridge.purchaseInvoices.update(id, invoice);
});

ipcMain.handle('db:purchaseInvoices:delete', async (event, id: number) => {
  return dbBridge.purchaseInvoices.delete(id);
});

ipcMain.handle('db:expenses:getAll', async (event, companyId: number, filters?: any) => {
  return dbBridge.expenses.getAll(companyId, filters);
});

ipcMain.handle('db:expenses:getById', async (event, id: number) => {
  return dbBridge.expenses.getById(id);
});

ipcMain.handle('db:expenses:create', async (event, expense: any) => {
  return dbBridge.expenses.create(expense);
});

ipcMain.handle('db:expenses:update', async (event, id: number, expense: any) => {
  return dbBridge.expenses.update(id, expense);
});

ipcMain.handle('db:expenses:delete', async (event, id: number) => {
  return dbBridge.expenses.delete(id);
});

ipcMain.handle('db:expenses:getCategories', async (event, companyId: number) => {
  return dbBridge.expenses.getCategories(companyId);
});

ipcMain.handle('db:expenses:createCategory', async (event, category: any) => {
  return dbBridge.expenses.createCategory(category);
});

ipcMain.handle('db:payments:getAll', async (event, companyId: number, filters?: any) => {
  return dbBridge.payments.getAll(companyId, filters);
});

ipcMain.handle('db:payments:getByInvoice', async (event, type: string, id: number) => {
  return dbBridge.payments.getByInvoice(type, id);
});

ipcMain.handle('db:payments:create', async (event, payment: any) => {
  return dbBridge.payments.create(payment);
});

ipcMain.handle('db:payments:delete', async (event, id: number) => {
  return dbBridge.payments.delete(id);
});

ipcMain.handle('db:dashboard:getKPIs', async (event, companyId: number, filters?: any) => {
  return dbBridge.dashboard.getKPIs(companyId, filters);
});

ipcMain.handle('db:dashboard:getSalesVsPurchase', async (event, companyId: number, filters?: any) => {
  return dbBridge.dashboard.getSalesVsPurchase(companyId, filters);
});

ipcMain.handle('db:dashboard:getExpenseBreakdown', async (event, companyId: number, filters?: any) => {
  return dbBridge.dashboard.getExpenseBreakdown(companyId, filters);
});

ipcMain.handle('db:dashboard:getMonthlyRevenue', async (event, companyId: number, filters?: any) => {
  return dbBridge.dashboard.getMonthlyRevenue(companyId, filters);
});

ipcMain.handle('db:dashboard:getTopCustomers', async (event, companyId: number, filters?: any) => {
  return dbBridge.dashboard.getTopCustomers(companyId, filters);
});

// Auth handler
ipcMain.handle('db:auth:login', async (event, username: string, password?: string) => {
  return dbBridge.auth.login(username, password);
});

// Global search handler
ipcMain.handle('db:search:global', async (event, companyId: number, query: string) => {
  return dbBridge.search.global(companyId, query);
});

// Heartbeat handler
ipcMain.handle('db:heartbeat', async () => {
  if (isMasterMode()) return { success: true };
  return apiClient.heartbeat();
});

// Config handlers
ipcMain.handle('db:config:get', async () => {
  return getConfig();
});

ipcMain.handle('db:config:save', async (event, config: any) => {
  saveConfig(config);
  return { success: true };
});
