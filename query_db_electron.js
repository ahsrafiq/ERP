const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

app.whenReady().then(() => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
    const db = new Database(dbPath);
    console.log('--- GLOBAL SETTINGS ---');
    console.log(db.prepare("SELECT * FROM global_settings").all());
    console.log('--- COMPANIES ---');
    console.log(db.prepare("SELECT id, name, is_stock_management_enabled FROM companies").all());
    app.exit(0);
  } catch(e) {
    console.error(e);
    app.exit(1);
  }
});
