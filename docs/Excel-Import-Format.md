# Excel Import Format

Use **Import from Excel** on the **Items** and **Customers** pages. The first row of the sheet must be headers (column names). Column names are **case-insensitive** and extra spaces are ignored.

---

## Items (Inventory)

**File:** One sheet; first row = headers.

| Required columns | Optional columns |
|------------------|------------------|
| **Name** – Item name | SKU, Description, Type (product/service), Purchase Price, Selling Price, GST Rate |
| **Code** – Item code (numbers only; non-digits are stripped) | Reorder Level, Location, **H.S Code** |
| **Brand** – Brand name (created if it doesn’t exist) | |

**Example header row:**  
`Name`, `Code`, `Brand`, `SKU`, `Description`, `Type`, `Purchase Price`, `Selling Price`, `GST Rate`, `Reorder Level`, `Location`, `H.S Code`

---

## Customers

**File:** One sheet; first row = headers. Import is for the **currently selected company**.

| Required columns | Optional columns |
|------------------|------------------|
| **Name** – Customer name | Email, Phone, Address, City, State, Country, Postal Code |
| **Code** – Customer code (numbers only; non-digits are stripped) | Tax Number (NTN), Attention Person, Sales Person, GST Number, PR Number |
| **Credit Limit** – Numeric value | |

**Example header row:**  
`Name`, `Code`, `Credit Limit`, `Email`, `Phone`, `Address`, `City`, `State`, `Country`, `Postal Code`, `Tax Number`, `Attention Person`, `Sales Person`, `GST Number`, `PR Number`

---

## Tips

- Use **.xlsx** or **.xls**.
- Empty cells are allowed; required columns must have a value for the row to be imported.
- Duplicate **Code** (for items globally, or for customers in the same company) will cause that row to fail; the rest will still be processed.
- On each page, use **Excel format** to open the in-app help with the same column list.
