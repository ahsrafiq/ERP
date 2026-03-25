import React from 'react';
import './ReportPdf.css';

export type ReportLedgerPdfRow = {
  date: string;
  transType: string;
  poNumber: string;
  invRef: string;
  debit: string;
  credit: string;
  balance: string;
};

export interface ReportLedgerPdfDocumentProps {
  reportTitle: string;
  companyName: string;
  /** e.g. 01-Sep-2025 */
  dateFromLabel: string;
  dateToLabel: string;
  entityLabel: string;
  entityName: string;
  rows: ReportLedgerPdfRow[];
  totalDebit?: string;
  totalCredit?: string;
  closingBalance?: string;
  footerNote?: string;
}

/**
 * Customer / vendor ledger PDF layout (centered title block + gridded table).
 */
export const ReportLedgerPdfDocument: React.FC<ReportLedgerPdfDocumentProps> = ({
  reportTitle,
  companyName,
  dateFromLabel,
  dateToLabel,
  entityLabel,
  entityName,
  rows,
  totalDebit,
  totalCredit,
  closingBalance,
  footerNote,
}) => (
  <div className="erp-report-pdf-root">
    <div className="erp-report-pdf-header-block">
      <div className="erp-report-pdf-title">{reportTitle}</div>
      <div className="erp-report-pdf-date-range">
        Date From {dateFromLabel} To {dateToLabel}
      </div>
      <div className="erp-report-pdf-company">{companyName}</div>
    </div>
    <div className="erp-report-pdf-entity-line">
      <span>{entityLabel} : </span>
      <span className="erp-report-pdf-entity-name">{entityName}</span>
    </div>
    <table className="erp-report-pdf-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Trans. Type</th>
          <th>P.O Number</th>
          <th>INV #</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Closing Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="erp-report-pdf-td-center">{r.date}</td>
            <td className="erp-report-pdf-td-left">{r.transType}</td>
            <td className="erp-report-pdf-td-left">{r.poNumber}</td>
            <td className="erp-report-pdf-td-left">{r.invRef}</td>
            <td className="erp-report-pdf-td-num">{r.debit}</td>
            <td className="erp-report-pdf-td-num">{r.credit}</td>
            <td className="erp-report-pdf-td-num">{r.balance}</td>
          </tr>
        ))}
      </tbody>
      {(totalDebit || totalCredit || closingBalance) && (
        <tfoot>
          <tr className="erp-report-pdf-total-row" style={{ fontWeight: 'bold', borderTop: '2px solid #000' }}>
            <td colSpan={4} style={{ textAlign: 'right', paddingRight: '10px' }}>TOTAL</td>
            <td className="erp-report-pdf-td-num">{totalDebit || '-'}</td>
            <td className="erp-report-pdf-td-num">{totalCredit || '-'}</td>
            <td className="erp-report-pdf-td-num">{closingBalance || '-'}</td>
          </tr>
        </tfoot>
      )}
    </table>
    {footerNote ? <div className="erp-report-pdf-footer">{footerNote}</div> : null}
  </div>
);

/** Payment / receipt row label for PDF (title case). */
export function formatLedgerPaymentTransType(paymentMethod?: string | null): string {
  const raw = (paymentMethod || '').trim().replace(/_/g, ' ');
  if (!raw) return 'Payment';
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
