const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

app.whenReady().then(() => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
    const db = new Database(dbPath);
    console.log('--- ITEMS ---');
    console.log(db.prepare("SELECT id, name, quantity, track_inventory FROM items LIMIT 10").all());
    app.exit(0);
  } catch(e) {
    console.error(e);
    app.exit(1);
  }
});
