/**
 * One-time migration: add default_tax_rate to customers table.
 * Run from project root: node scripts/add-default-tax-rate.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'database', 'erp.db');
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const cols = db.prepare('PRAGMA table_info(customers)').all().map((c) => c.name);
if (cols.includes('default_tax_rate')) {
  console.log('Column default_tax_rate already exists. Nothing to do.');
  db.close();
  process.exit(0);
}

db.prepare('ALTER TABLE customers ADD COLUMN default_tax_rate REAL').run();
console.log('Added column default_tax_rate to customers table.');
db.close();
