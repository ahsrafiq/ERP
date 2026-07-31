import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, protocol, dialog, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { initializeDatabase, closeDatabase } from './database/schema';
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
  deliveryChallanHandlers,
  customReportHandlers
} from './database/handlers';
import { isMasterMode, getConfig, saveConfig } from './config';
import { dbBridge } from './database/bridge';
import { startServer, stopServer } from './server';
import { apiClient } from './apiClient';

// Register atom protocol as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'atom', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
]);

// --- Isolated Client Testing Mode ---
// This allows running two separate instances of the app on a single laptop for testing.
// The second instance uses a different data folder so it can have its own config (Client mode).
if (process.argv.includes('--is-client')) {
  const currentPath = app.getPath('userData');
  app.setPath('userData', path.join(path.dirname(currentPath), 'erp-client-test'));
  console.log('Running in CLIENT mode. Connecting to Master server.');
}

// Bypass SSL errors in development to prevent handshake failures on local network/testing
if (process.env.NODE_ENV === 'development') {
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('allow-insecure-localhost');
}

// Allow forcing Master mode via command line if it gets stuck in Client mode
if (process.argv.includes('--is-master')) {
  const { getConfig, saveConfig } = require('./config');
  const config = getConfig();
  if (config.mode !== 'MASTER') {
    config.mode = 'MASTER';
    saveConfig(config);
  }
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const logsDir = isDev
  ? path.join(process.cwd(), 'logs')
  : path.join(path.dirname(app.getPath('exe')), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const mainLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf((info: any) => `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`)
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: '30d',
    }),
    new winston.transports.Console()
  ],
});

// --- Automatic database backup (Master mode only) ---
let backupInterval: NodeJS.Timeout | null = null;
let lastBackupDate = '';
let lastBackupSlots: { [date: string]: { '12': boolean; '18': boolean } } = {};

function performAutomaticDatabaseBackup(now: Date) {
  const config = getConfig();
  const backupRoot = (config as any).backupPath as string | undefined;
  if (!backupRoot || !backupRoot.trim()) {
    // No backup path configured; skip silently
    return;
  }

  try {
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const folderName = `Database_Backup_${datePart}_${timePart}`;
    const targetDir = path.join(backupRoot, folderName);

    const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');

    fs.mkdirSync(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, 'erp.db');
    fs.copyFileSync(dbPath, targetPath);

    // Also backup the uploads folder (logos, letterheads, etc.)
    const uploadsPath = path.join(app.getPath('userData'), 'uploads');
    if (fs.existsSync(uploadsPath)) {
      const targetUploadsPath = path.join(targetDir, 'uploads');
      fs.cpSync(uploadsPath, targetUploadsPath, { recursive: true });
    }

    console.log('[AutoBackup] Full data backup created at:', targetDir);

    // Native OS Notification
    if (Notification.isSupported()) {
      new Notification({
        title: 'ERP Auto-Backup Successful',
        body: `Database backup has been completed successfully at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.\nSaved to: ${targetDir}`,
      }).show();
    }

    // In-app Notification to active window
    mainWindow?.webContents.send('auto-backup-status', { success: true, path: targetDir });
  } catch (err: any) {
    console.error('[AutoBackup] Failed to back up data:', err);

    // Native OS Notification on Failure
    if (Notification.isSupported()) {
      new Notification({
        title: 'ERP Auto-Backup Failed',
        body: `Failed to create automatic backup: ${err?.message || err}`,
      }).show();
    }

    // In-app Notification to active window on Failure
    mainWindow?.webContents.send('auto-backup-status', { success: false, error: err?.message || String(err) });
  }
}

function scheduleAutomaticDatabaseBackups() {
  if (!isMasterMode()) return;
  if (backupInterval) return;

  backupInterval = setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const today = now.toISOString().slice(0, 10);

    if (lastBackupDate !== today) {
      lastBackupDate = today;
      lastBackupSlots[today] = { '12': false, '18': false };
    }

    const slots = lastBackupSlots[today];
    // Run exactly at 12:00 and 18:00 local time (once per day per slot)
    if (minutes === 0 && (hours === 12 || hours === 18)) {
      const key = hours === 12 ? '12' : '18';
      if (!slots[key]) {
        slots[key] = true;
        performAutomaticDatabaseBackup(now);
      }
    }
  }, 60 * 1000); // check every minute
}

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
    mainWindow.loadURL('http://127.0.0.1:5174');
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
          label: 'Backup All Data (DB + Files)',
          click: async () => {
            if (!isMasterMode()) {
              dialog.showMessageBox({
                type: 'info',
                title: 'Master Only',
                message: 'Database backup is only available on the Master machine.',
              });
              return;
            }

            const now = new Date();
            const datePart = now.toISOString().slice(0, 10);
            const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '-');
            const defaultFolderName = `ERP_Full_Backup_${datePart}_${timePart}`;

            const { filePath } = await dialog.showSaveDialog({
              title: 'Create Backup Folder',
              defaultPath: path.join(app.getPath('downloads'), defaultFolderName),
              buttonLabel: 'Create Backup Here',
            });

            if (filePath) {
              try {
                const targetDir = filePath;
                fs.mkdirSync(targetDir, { recursive: true });

                // Backup DB
                const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
                fs.copyFileSync(dbPath, path.join(targetDir, 'erp.db'));

                // Backup Uploads
                const uploadsPath = path.join(app.getPath('userData'), 'uploads');
                if (fs.existsSync(uploadsPath)) {
                  fs.cpSync(uploadsPath, path.join(targetDir, 'uploads'), { recursive: true });
                }

                dialog.showMessageBox({
                  type: 'info',
                  title: 'Backup Success',
                  message: `Full backup created successfully in:\n${targetDir}`,
                });
              } catch (error: any) {
                dialog.showErrorBox('Backup Failed', error.message);
              }
            }
          },
        },
        {
          label: 'Backup Database Only (.db file)',
          click: async () => {
            if (!isMasterMode()) {
              dialog.showMessageBox({ type: 'info', title: 'Master Only', message: 'Database backup is only available on the Master machine.' });
              return;
            }

            const { filePath } = await dialog.showSaveDialog({
              title: 'Backup Database',
              defaultPath: path.join(app.getPath('downloads'), `erp_db_backup_${new Date().toISOString().split('T')[0]}.db`),
              filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            });

            if (filePath) {
              try {
                const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
                fs.copyFileSync(dbPath, filePath);
                dialog.showMessageBox({ type: 'info', title: 'Backup Success', message: 'Database file backed up successfully.' });
              } catch (error: any) {
                dialog.showErrorBox('Backup Failed', error.message);
              }
            }
          },
        },
        {
          label: 'Restore All Data (DB + Files)',
          click: async () => {
            if (!isMasterMode()) {
              dialog.showMessageBox({ type: 'info', title: 'Master Only', message: 'Database restore is only available on the Master machine.' });
              return;
            }

            const { response } = await dialog.showMessageBox({
              type: 'warning',
              title: 'Confirm Restore',
              message: 'Restoring will overwrite all current data (DB and Files). Are you sure?',
              buttons: ['Cancel', 'Restore'],
              defaultId: 0,
            });

            if (response === 1) {
              const { filePaths } = await dialog.showOpenDialog({
                title: 'Select Backup Folder',
                properties: ['openDirectory'],
              });

              if (filePaths && filePaths.length > 0) {
                try {
                  const selectedPath = filePaths[0];
                  const dbToRestore = path.join(selectedPath, 'erp.db');
                  const uploadsToRestore = path.join(selectedPath, 'uploads');

                  if (!fs.existsSync(dbToRestore)) {
                    throw new Error('Selected folder does not contain erp.db');
                  }

                  const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
                  closeDatabase();
                  fs.copyFileSync(dbToRestore, dbPath);

                  if (fs.existsSync(uploadsToRestore)) {
                    const targetUploadsPath = path.join(app.getPath('userData'), 'uploads');
                    if (fs.existsSync(targetUploadsPath)) {
                      fs.rmSync(targetUploadsPath, { recursive: true, force: true });
                    }
                    fs.cpSync(uploadsToRestore, targetUploadsPath, { recursive: true });
                  }

                  dialog.showMessageBox({ type: 'info', title: 'Restore Success', message: 'All data restored successfully. The application will now restart.' }).then(() => {
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
          label: 'Restore Database Only (.db file)',
          click: async () => {
            if (!isMasterMode()) {
              dialog.showMessageBox({ type: 'info', title: 'Master Only', message: 'Database restore is only available on the Master machine.' });
              return;
            }

            const { response } = await dialog.showMessageBox({
              type: 'warning',
              title: 'Confirm Restore',
              message: 'Restoring will overwrite your current database. Files will remain unchanged. Are you sure?',
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
                  closeDatabase();
                  fs.copyFileSync(filePaths[0], dbPath);

                  dialog.showMessageBox({ type: 'info', title: 'Restore Success', message: 'Database restored successfully. The application will now restart.' }).then(() => {
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
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron.erpdesktop');
  }
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
    return new Promise((resolve) => {
      console.log('[Print Handler] Starting print dialog...');
      try {
        event.sender.print({ silent: false, printBackground: true }, (success: boolean, failureReason: string) => {
          console.log('[Print Handler] Print dialog closed', { success, failureReason });
          resolve({ success, error: failureReason });
        });
      } catch (error) {
        console.error('[Print Handler] Failed to open print dialog:', error);
        resolve({ success: false, error: String(error) });
      }
    });
  });

  // After initializing DB and server, emit readiness event
  const emitLetterheadReady = () => {
    // Send to all existing windows (if any)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('letterhead-ready');
    });
  };

  // Wrap initialization to ensure event is emitted after DB is ready
  try {
    if (isMasterMode()) {
      initializeDatabase();
      console.log('Database initialized successfully at:', path.join(app.getPath('userData'), 'database', 'erp.db'));
      startServer();
      scheduleAutomaticDatabaseBackups();
    } else {
      console.log('Running in CLIENT mode. Connecting to Master server.');
    }
    // Signal readiness immediately after init
    emitLetterheadReady();
  } catch (error) {
    console.error('Database/Server initialization error:', error);
  }

  createWindow();
  createTray();

  // Also emit when a new window is created (e.g., after reload)
  const originalCreateWindow = createWindow;
  const wrappedCreateWindow = () => {
    originalCreateWindow();
    const win = BrowserWindow.getAllWindows().slice(-1)[0];
    if (win) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('letterhead-ready');
      });
    }
  };

  // Replace the earlier call with wrapped version
  // (Note: we already called createWindow above, so this ensures future creations use wrapped)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      wrappedCreateWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('App is quitting, cleaning up resources...');
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
  stopServer();
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
        margins: { marginType: 'custom', top: 0.5, bottom: 2.0, left: 0.5, right: 0.5 },
        pageSize: 'A4',
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="font-size:11px; font-weight:700; color:#111; width:100%; text-align:right; padding-right:15mm; padding-bottom: 6mm; -webkit-print-color-adjust: exact; print-color-adjust: exact;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
      });
      fs.writeFileSync(filePath, data);
      return { success: true, filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Save cancelled' };
});

// Remember the globally used last save folder to make consecutive saving fast and delightful
const lastSavePathFile = path.join(app.getPath('userData'), 'last_save_directory.txt');

function getLastSavedDirectory(): string {
  try {
    if (fs.existsSync(lastSavePathFile)) {
      const savedDir = fs.readFileSync(lastSavePathFile, 'utf8').trim();
      if (savedDir && fs.existsSync(savedDir)) {
        return savedDir;
      }
    }
  } catch (err) {
    console.error('Failed to read last saved directory:', err);
  }
  return app.getPath('documents');
}

function setLastSavedDirectory(dir: string) {
  try {
    fs.writeFileSync(lastSavePathFile, dir, 'utf8');
  } catch (err) {
    console.error('Failed to save last saved directory:', err);
  }
}

// Step 1: Show save dialog and return chosen path (no capturing yet)
ipcMain.handle('file:getSavePath', async (_event, defaultName: string) => {
  const currentLastSavedDir = getLastSavedDirectory();
  const defaultPath = path.isAbsolute(defaultName)
    ? defaultName
    : path.join(currentLastSavedDir, defaultName || 'ERP_Document.pdf');

  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save File',
    defaultPath,
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'All Files', extensions: ['*'] }
    ],
  });

  if (canceled || !filePath) return { success: false, error: 'Save cancelled' };

  // Remember the folder path of the saved file
  const folderPath = path.dirname(filePath);
  setLastSavedDirectory(folderPath);

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
      margins: { marginType: 'custom', top: 0.5, bottom: 2.0, left: 0.5, right: 0.5 },
      pageSize,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:11px; font-weight:700; color:#111; width:100%; text-align:right; padding-right:15mm; padding-bottom: 6mm; -webkit-print-color-adjust: exact; print-color-adjust: exact;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
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
      margins: { marginType: 'custom', top: 0.5, bottom: 2.0, left: 0.5, right: 0.5 },
      pageSize,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:11px; font-weight:700; color:#111; width:100%; text-align:right; padding-right:15mm; padding-bottom: 6mm; -webkit-print-color-adjust: exact; print-color-adjust: exact;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
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
ipcMain.on('app:log', (event, level: string, message: string) => {
  mainLogger.log(level, message);
});

ipcMain.handle('file:save', async (event, base64Data: string, fileName: string, subDir: string) => {
  return dbBridge.files.saveFile(base64Data, fileName, subDir);
});

ipcMain.handle('file:readAsDataURL', async (event, path: string) => {
  return dbBridge.files.readAsDataURL(path);
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

ipcMain.handle('db:customers:getUnpaidInvoices', async (event, customerId: number, companyId?: number) => {
  return dbBridge.customers.getUnpaidInvoices(customerId, companyId);
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
ipcMain.handle('db:customers:deleteMultiple', async (event, ids: number[]) => {
  return dbBridge.customers.deleteMultiple(ids);
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
ipcMain.handle('db:vendors:deleteMultiple', async (event, ids: number[]) => {
  return dbBridge.vendors.deleteMultiple(ids);
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
ipcMain.handle('db:brands:deleteMultiple', async (event, ids: number[]) => {
  return dbBridge.brands.deleteMultiple(ids);
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
ipcMain.handle('db:items:deleteMultiple', async (event, ids: number[]) => {
  return dbBridge.items.deleteMultiple(ids);
});
ipcMain.handle('db:items:getNextCode', async () => {
  return dbBridge.items.getNextCode();
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

ipcMain.handle('db:salesInvoices:createFromQuotation', async (event, quotationId: number, createdBy?: number, fiscalYear?: number | string, force: boolean = false) => {
  return dbBridge.salesInvoices.createFromQuotation(quotationId, createdBy, fiscalYear, force);
});

ipcMain.handle('db:salesInvoices:createFromChallan', async (event, challanId: number, createdBy?: number, fiscalYear?: number | string, force: boolean = false) => {
  return dbBridge.salesInvoices.createFromChallan(challanId, createdBy, fiscalYear, force);
});

ipcMain.handle('db:salesInvoices:getSalesByItem', async (event, companyId: number, filters?: any) => {
  return dbBridge.salesInvoices.getSalesByItem(companyId, filters);
});

ipcMain.handle('db:salesInvoices:getPendingWithItems', async (event, companyId: number, filters?: any) => {
  return dbBridge.salesInvoices.getPendingWithItems(companyId, filters);
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

ipcMain.handle('db:deliveryChallans:createFromInvoice', async (event, invoiceId: number, createdBy?: number, fiscalYear?: number | string, force: boolean = false) => {
  return dbBridge.deliveryChallans.createFromInvoice(invoiceId, createdBy, fiscalYear, force);
});

ipcMain.handle('db:deliveryChallans:createFromQuotation', async (event, quotationId: number, createdBy?: number, selectedItems?: any[], poNumber?: string, fiscalYear?: number | string, force: boolean = false) => {
  return dbBridge.deliveryChallans.createFromQuotation(quotationId, createdBy, selectedItems, poNumber, fiscalYear, force);
});

ipcMain.handle('db:deliveryChallans:getChallansByItem', async (event, companyId: number, filters?: any) => {
  return dbBridge.deliveryChallans.getChallansByItem(companyId, filters);
});

ipcMain.handle('db:adjustmentNotes:getAll', async (event, companyId: number, filters?: any) => {
  return dbBridge.adjustmentNotes.getAll(companyId, filters);
});

ipcMain.handle('db:adjustmentNotes:getById', async (event, id: number) => {
  return dbBridge.adjustmentNotes.getById(id);
});

ipcMain.handle('db:adjustmentNotes:getNextNumber', async (event, companyId: number, fiscalYear?: number | string) => {
  return dbBridge.adjustmentNotes.getNextNumber(companyId, fiscalYear);
});

ipcMain.handle('db:adjustmentNotes:create', async (event, note: any) => {
  return dbBridge.adjustmentNotes.create(note);
});

ipcMain.handle('db:adjustmentNotes:update', async (event, id: number, note: any) => {
  return dbBridge.adjustmentNotes.update(id, note);
});

ipcMain.handle('db:adjustmentNotes:delete', async (event, id: number) => {
  return dbBridge.adjustmentNotes.delete(id);
});

ipcMain.handle('db:purchaseInvoices:getAll', async (event, companyId: number, filters?: any) => {
  return dbBridge.purchaseInvoices.getAll(companyId, filters);
});

ipcMain.handle('db:purchaseInvoices:getById', async (event, id: number) => {
  return dbBridge.purchaseInvoices.getById(id);
});

ipcMain.handle('db:purchaseInvoices:getNextNumber', async (event, companyId: number, fiscalYear?: number) => {
  return dbBridge.purchaseInvoices.getNextNumber(companyId, fiscalYear);
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

// Custom Reports
ipcMain.handle('db:customReports:getAll', async (event, companyId: number) => {
  return dbBridge.customReports.getAll(companyId);
});

ipcMain.handle('db:customReports:create', async (event, report: any) => {
  return dbBridge.customReports.create(report);
});

ipcMain.handle('db:customReports:delete', async (event, id: number) => {
  return dbBridge.customReports.delete(id);
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

ipcMain.handle('db:payments:update', async (event, id: number, payment: any) => {
  return dbBridge.payments.update(id, payment);
});

ipcMain.handle('db:payments:delete', async (event, id: number) => {
  return dbBridge.payments.delete(id);
});

ipcMain.handle('db:dashboard:getKPIs', async (event, companyId: number, filters?: any) => {
  return dbBridge.dashboard.getKPIs(companyId, filters);
});

ipcMain.handle('db:dashboard:getHistory', async (event, companyId: number, filters?: any) => {
  return dbBridge.dashboard.getHistory(companyId, filters);
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

ipcMain.handle('db:auth:verifyAdminPassword', async (event, password: string) => {
  return dbBridge.auth.verifyAdminPassword(password);
});

// Global search handler
ipcMain.handle('db:search:global', async (event, companyId: number, query: string) => {
  return dbBridge.search.global(companyId, query);
});

// Warehouse handlers
ipcMain.handle('db:warehouses:getAll', async (event, companyId: number) => {
  return dbBridge.warehouses.getAll(companyId);
});
ipcMain.handle('db:warehouses:create', async (event, warehouse: any) => {
  return dbBridge.warehouses.create(warehouse);
});
ipcMain.handle('db:warehouses:update', async (event, id: number, warehouse: any) => {
  return dbBridge.warehouses.update(id, warehouse);
});
ipcMain.handle('db:warehouses:delete', async (event, id: number) => {
  return dbBridge.warehouses.delete(id);
});
ipcMain.handle('db:warehouses:deleteMultiple', async (event, ids: number[]) => {
  return dbBridge.warehouses.deleteMultiple(ids);
});

// Heartbeat handler
ipcMain.handle('db:heartbeat', async () => {
  if (isMasterMode()) return { success: true };
  return apiClient.heartbeat();
});

// Settings handlers
ipcMain.handle('db:settings:getAll', async () => {
  return dbBridge.settings.getAll();
});
ipcMain.handle('db:settings:get', async (event, key: string) => {
  return dbBridge.settings.get(key);
});
ipcMain.handle('db:settings:set', async (event, key: string, value: string) => {
  return dbBridge.settings.set(key, value);
});

// App restart handler
ipcMain.handle('app:restart', async () => {
  app.relaunch();
  app.exit();
});

// Config handlers
ipcMain.handle('db:config:get', async () => {
  return getConfig();
});

ipcMain.handle('db:config:save', async (event, newConfig: any) => {
  const oldConfig = getConfig();
  saveConfig(newConfig);

  // If mode changed (MASTER -> CLIENT or vice-versa), prompt for restart
  if (oldConfig.mode !== newConfig.mode) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Restart Required',
      message: 'Mode changed. The application will now restart to apply changes.',
      buttons: ['OK'],
      defaultId: 0
    }).then(() => {
      app.relaunch();
      app.exit();
    });
  }

  return { success: true };
});
