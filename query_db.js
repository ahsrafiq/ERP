const db = require('better-sqlite3')('C:/Users/HP/AppData/Roaming/Electron/database/erp.db');
console.log('Global Setting:', db.prepare("SELECT value FROM global_settings WHERE key = 'is_purchase_module_enabled'").get());
console.log('Companies:', db.prepare('SELECT id, name, is_stock_management_enabled FROM companies').all());
