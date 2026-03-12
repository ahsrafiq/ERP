# Excel Import Format

Use **Import from Excel** on the **Items** and **Customers** pages. The first row of the sheet must be headers (column names). Column names are **case-insensitive** and extra spaces are ignored.

---

## Items (Inventory)

**File:** One sheet; first row = headers.

Item **codes are generated automatically** during import (sequential numbers after the highest existing code). You do **not** need to provide a Code column; if present, it will be ignored.

| Required columns | Optional columns |
|------------------|------------------|
| **Name** – Item name | SKU, Type (product/service), Purchase Price, Selling Price, GST Rate |
| **Brand** – Brand name (created if it doesn’t exist) | Reorder Level, Location, **H.S Code** |
| **Description** – Item description | |

**Example header row:**  
`Name`, `Brand`, `Description`, `SKU`, `Type`, `Purchase Price`, `Selling Price`, `GST Rate`, `Reorder Level`, `Location`, `H.S Code`

---

## Customers

**File:** One sheet; first row = headers. Import is for the **currently selected company**.

Customer **codes are generated automatically** during import (sequential numbers after the highest existing code for that company). You do **not** need to provide a Code column; if present, it will be ignored.

| Required columns | Optional columns |
|------------------|------------------|
| **Name** – Customer name | Email, Phone, Address, City, State, Country, Postal Code |
| **Sales Person** – Sales representative name | Tax Number (NTN), Attention Person, GST Number, PO Number |
| | Credit Limit (numeric) |

**Example header row:**  
`Name`, `Sales Person`, `Credit Limit`, `Email`, `Phone`, `Address`, `City`, `State`, `Country`, `Postal Code`, `Tax Number`, `Attention Person`, `GST Number`, `PO Number`

---

## Tips

- Use **.xlsx** or **.xls**.
- Empty cells are allowed; required columns must have a value for the row to be imported.
- Duplicate **Code** (for items globally, or for customers in the same company) will cause that row to fail; the rest will still be processed. Codes are auto-generated, so duplicates should only occur if existing data already uses the same numbers.
- On each page, use **Excel format** to open the in-app help with the same column list.
