import React from 'react';
import './ReportPdf.css';

export type ReportTablePdfColumn = {
  title: string;
  dataIndex: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, record: any) => React.ReactNode;
};

export interface ReportTablePdfDocumentProps {
  reportTitle: string;
  companyName: string;
  companyLogo?: string;
  periodLabel: string;
  columns: ReportTablePdfColumn[];
  data: any[];
  summaryRow?: React.ReactNode;
  footerNote?: string;
}

/**
 * Generic Table Report PDF layout.
 */
export const ReportTablePdfDocument: React.FC<ReportTablePdfDocumentProps> = ({
  reportTitle,
  companyName,
  companyLogo,
  periodLabel,
  columns,
  data,
  summaryRow,
  footerNote,
}) => (
  <div className="erp-report-pdf-root">
    <div className="erp-report-pdf-header-block">
      {companyLogo && (
        <img 
          src={companyLogo.replace('atom://', 'atom-file://')} 
          alt="logo" 
          className="erp-report-pdf-logo" 
        />
      )}
      <div className="erp-report-pdf-header-content">
        <div className="erp-report-pdf-title">{reportTitle}</div>
        <div className="erp-report-pdf-date-range">{periodLabel}</div>
        <div className="erp-report-pdf-company">{companyName}</div>
      </div>
    </div>
    <table className="erp-report-pdf-table">
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={{ textAlign: col.align || 'left' }}>{col.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, ri) => (
          <tr key={ri}>
            {columns.map((col, ci) => (
              <td 
                key={ci} 
                className={`erp-report-pdf-td-${col.align || 'left'}`}
                style={{ textAlign: col.align || 'left' }}
              >
                {col.render ? col.render(row[col.dataIndex], row) : (row[col.dataIndex] ?? '-')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {summaryRow && (
          <tfoot>{summaryRow}</tfoot>
      )}
    </table>
    {footerNote && <div className="erp-report-pdf-footer">{footerNote}</div>}
  </div>
);
