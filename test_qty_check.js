const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

app.whenReady().then(() => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'database', 'erp.db');
    const db = new Database(dbPath);

    function isStockEnabled(db, companyId) {
      const globalSetting = db.prepare("SELECT value FROM global_settings WHERE key = 'is_purchase_module_enabled'").get();
      if (globalSetting?.value === '0') return false;
    
      const row = db.prepare('SELECT is_stock_management_enabled FROM companies WHERE id = ?').get(companyId);
      return !!(row?.is_stock_management_enabled ?? 1);
    }
    
    function validateItemQuantitiesForChallan(db, items, companyId) {
      if (!isStockEnabled(db, companyId)) return;
    
      const getItem = db.prepare('SELECT name, quantity FROM items WHERE id = ?');
      for (const item of items) {
        const row = getItem.get(item.item_id);
        const current = Number(row?.quantity ?? 0);
        const qty = Math.abs(Number(item.quantity) || 0);
        if (current < qty) {
          throw new Error(`Insufficient quantity for "${row?.name || 'Item'}". Available: ${current}, required: ${qty}.`);
        }
      }
    }

    const items = [{ item_id: 10, quantity: 100 }]; // 6205-2RSR, stock is 0
    console.log("Testing on INDUSTRIAL HUB (id 3):");
    try {
      validateItemQuantitiesForChallan(db, items, 3);
      console.log("SUCCESS (No error thrown)");
    } catch(e) {
      console.error("ERROR THROWN:", e.message);
    }

    console.log("Testing on NOVELTY ENTERPRISES (id 2):");
    try {
      validateItemQuantitiesForChallan(db, items, 2);
      console.log("SUCCESS (No error thrown)");
    } catch(e) {
      console.error("ERROR THROWN:", e.message);
    }

    app.exit(0);
  } catch(e) {
    console.error(e);
    app.exit(1);
  }
});
