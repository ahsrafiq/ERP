
const Database = require('better-sqlite3');
const dbPath = 'C:/Users/HP/AppData/Roaming/Electron/database/erp.db';
try {
    const db = new Database(dbPath);
    const info = db.prepare('PRAGMA table_info(delivery_challans)').all();
    console.log('TABLE INFO:');
    console.log(JSON.stringify(info, null, 2));
    
    const sample = db.prepare('SELECT * FROM delivery_challans ORDER BY id DESC LIMIT 5').all();
    console.log('SAMPLE DATA:');
    console.log(JSON.stringify(sample, null, 2));

    db.close();
} catch (e) {
    console.error(e);
}
