/**
 * Operational FY filtering (non-report screens). Reports should load all periods.
 * FY date range: July 1 (2000 + selected suffix) through June 30 next year — aligned with /YY on serialised docs.
 */

const DOC_NUMBER_KEYS = [
  'invoice_number',
  'quotation_number',
  'challan_number',
  'adjustment_number',
  'note_number',
  'entry_number',
  'payment_number',
  'expense_number',
] as const;

const DATE_KEYS = [
  'invoice_date',
  'expense_date',
  'payment_date',
  'challan_date',
  'quotation_date',
  'entry_date',
  'note_date',
  'adjustment_date',
] as const;

export function getOperationalFiscalYearDateRange(fiscalYear: number): { start: string; end: string } {
  const startYear = (2000 + (Number(fiscalYear) % 100)) - 1;
  return {
    start: `${startYear}-07-01`,
    end: `${startYear + 1}-06-30`,
  };
}

export function documentMatchesFiscalYearSuffix(doc: string | null | undefined, fiscalYear: number): boolean {
  if (doc == null || doc === '') return false;
  const yy = String(Number(fiscalYear) % 100).padStart(2, '0');
  return doc.includes(`/${yy}`);
}

export function dateInOperationalFiscalYear(isoDate: string | null | undefined, fiscalYear: number): boolean {
  if (!isoDate) return false;
  const d = String(isoDate).slice(0, 10);
  const { start, end } = getOperationalFiscalYearDateRange(fiscalYear);
  return d >= start && d <= end;
}

function rowHasSlashStyleDocNumber(row: Record<string, unknown>): boolean {
  for (const key of DOC_NUMBER_KEYS) {
    const v = row[key];
    if (typeof v === 'string' && v.includes('/')) return true;
  }
  return false;
}

export type FiscalYearExtraRefs = {
  /** e.g. linked sales invoice number for a receipt payment */
  referencedInvoiceNumber?: string | null;
};

/**
 * True if this operational row belongs to the selected FY: fiscal_year column, /YY on a document number,
 * or (if no slash-style doc number) any known date field within the default FY range.
 */
export function operationalRecordMatchesFiscalYear(
  row: Record<string, unknown>,
  fiscalYear: number,
  extra?: FiscalYearExtraRefs
): boolean {
  const fyMod = Number(fiscalYear) % 100;
  const fyCol = row.fiscal_year;
  if (fyCol != null && fyCol !== '') {
    const n = typeof fyCol === 'number' ? fyCol : parseInt(String(fyCol), 10);
    if (!Number.isNaN(n) && (n === fyMod || n === Number(fiscalYear))) return true;
  }

  for (const key of DOC_NUMBER_KEYS) {
    const v = row[key];
    if (typeof v === 'string' && documentMatchesFiscalYearSuffix(v, fiscalYear)) return true;
  }

  if (extra?.referencedInvoiceNumber && documentMatchesFiscalYearSuffix(extra.referencedInvoiceNumber, fiscalYear)) {
    return true;
  }

  if (rowHasSlashStyleDocNumber(row)) return false;

  for (const key of DATE_KEYS) {
    const v = row[key];
    if (v != null && dateInOperationalFiscalYear(String(v), fiscalYear)) return true;
  }

  return false;
}

export function filterRowsByOperationalFiscalYear<T extends Record<string, unknown>>(
  rows: T[],
  fiscalYear: number
): T[] {
  return rows.filter((r) => operationalRecordMatchesFiscalYear(r, fiscalYear));
}

/** Receipts: PAY-IN numbers have no /YY; use payment date, or linked sales invoice number. */
export function paymentMatchesOperationalFiscalYear(
  payment: Record<string, unknown>,
  fiscalYear: number,
  salesInvoiceById: Record<number, { invoice_number?: string }>
): boolean {
  const refIdRaw = payment.reference_id;
  const refId =
    typeof refIdRaw === 'number'
      ? refIdRaw
      : refIdRaw != null && refIdRaw !== ''
        ? parseInt(String(refIdRaw), 10)
        : NaN;
  const refType = payment.reference_type;
  let refNum: string | undefined;
  if (refType === 'sales_invoice' && !Number.isNaN(refId) && salesInvoiceById[refId]) {
    refNum = salesInvoiceById[refId].invoice_number;
  }
  return operationalRecordMatchesFiscalYear(payment, fiscalYear, { referencedInvoiceNumber: refNum });
}
