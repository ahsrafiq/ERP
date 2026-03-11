/**
 * Parse an Excel file (first sheet) and return an array of row objects.
 * First row is used as headers (column names). Header names are trimmed.
 */
import * as XLSX from 'xlsx';

export function parseExcelToRows(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          reject(new Error('No sheet found in Excel file'));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          raw: false,
          defval: '',
        });
        // Normalize keys: trim and collapse spaces
        const normalized = rows.map((row) => {
          const out: Record<string, unknown> = {};
          Object.keys(row).forEach((key) => {
            const k = String(key).trim().replace(/\s+/g, ' ');
            const v = row[key];
            out[k] = v === undefined || v === null ? '' : v;
          });
          return out;
        });
        resolve(normalized);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/** Get value from row by possible column names (case-insensitive, trimmed) */
export function getCol(row: Record<string, unknown>, ...names: string[]): string {
  const keys = Object.keys(row);
  for (const name of names) {
    const lower = name.toLowerCase().trim();
    const found = keys.find((k) => k.toLowerCase().trim() === lower);
    if (found != null) {
      const v = row[found];
      return v === undefined || v === null ? '' : String(v).trim();
    }
  }
  return '';
}

/** Get numeric value from row */
export function getColNum(row: Record<string, unknown>, ...names: string[]): number {
  const s = getCol(row, ...names);
  if (s === '') return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}
