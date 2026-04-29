const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const { deliveryChallanHandlers } = require('./dist/database/handlers.js');

app.whenReady().then(() => {
  try {
    const challanData = {
      company_id: 1, // 3m Enterprise
      challan_number: 'TEST-123',
      customer_id: 1, // Assumed valid customer
      challan_date: '2026-04-18',
      fiscal_year: '26',
      items: [
        { item_id: 10, quantity: 100 } // 6205-2RSR, stock is 0
      ]
    };
    
    console.log("Creating DC for 3m Enterprise (should fail due to qty):");
    const res1 = deliveryChallanHandlers.create(challanData);
    console.log(res1);

    challanData.company_id = 3; // INDUSTRIAL HUB
    challanData.challan_number = 'TEST-124';
    console.log("Creating DC for INDUSTRIAL HUB (should succeed because stock tracking is off for this company):");
    const res2 = deliveryChallanHandlers.create(challanData);
    console.log(res2);

    app.exit(0);
  } catch(e) {
    console.error(e);
    app.exit(1);
  }
});
