import React from 'react';
import { Table } from 'antd';
import { pdfFileToImage } from '../utils/pdfToImage';
import './PrintTemplate.css';

interface PrintTemplateProps {
    type: 'invoice' | 'bill' | 'quotation' | 'challan';
    data: any;
    company: any;
    onLetterheadReady?: () => void;
    withLetterhead?: boolean;  // default true; set false to suppress letterhead even if company has one
    /** Scale content to fit more on page (e.g. 0.9 = 90% = more rows fit). 1 = 100%. */
    contentScale?: number;
}

const PrintTemplate: React.FC<PrintTemplateProps> = ({ type, data, company, onLetterheadReady, withLetterhead = true, contentScale = 1 }) => {
    if (!data || !company) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    const getTitle = () => {
        switch (type) {
            case 'invoice': return 'SALES INVOICE';
            case 'bill': return 'COMMERCIAL INVOICE';
            case 'quotation': return 'QUOTATION';
            case 'challan': return 'DELIVERY CHALLAN';
            default: return 'DOCUMENT';
        }
    };

    const getNumberLabel = () => {
        switch (type) {
            case 'invoice': return 'Invoice No:';
            case 'bill': return 'Commercial Invoice No:';
            case 'quotation': return 'Quotation No:';
            case 'challan': return 'Challan No:';
            default: return 'No:';
        }
    };

    const getNumber = () => {
        switch (type) {
            case 'invoice':
            case 'bill': return data.invoice_number;
            case 'quotation': return data.quotation_number;
            case 'challan': return data.challan_number;
            default: return '';
        }
    };

    const getDate = () => {
        switch (type) {
            case 'invoice':
            case 'bill': return data.invoice_date;
            case 'quotation': return data.quotation_date;
            case 'challan': return data.challan_date;
            default: return '';
        }
    };

    const [letterheadBase64, setLetterheadBase64] = React.useState<string | null>(null);
    const [letterheadError, setLetterheadError] = React.useState<string | null>(null);
    const onReadyRef = React.useRef(onLetterheadReady);
    onReadyRef.current = onLetterheadReady;

    // Detect if a path is an image (not PDF)
    const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const isImagePath = (p: string) => IMAGE_EXTS.some(ext => p.toLowerCase().endsWith(ext));
    const isPdfPath = (p: string) => p.toLowerCase().endsWith('.pdf');

    React.useEffect(() => {
        let cancelled = false;
        const loadLetterhead = async () => {
            const lhPath = company?.letterhead_path;
            if (!lhPath) {
                // No letterhead â€” nothing to load, signal ready immediately
                setLetterheadBase64(null);
                setLetterheadError(null);
                onReadyRef.current?.();
                return;
            }

            setLetterheadError(null);

            try {
                const timeoutMs = 20000;

                let dataUrlPromise: Promise<string>;

                if (isPdfPath(lhPath)) {
                    // PDF: convert first page to PNG via pdf.js
                    dataUrlPromise = pdfFileToImage(lhPath);
                } else if (isImagePath(lhPath)) {
                    // Image: read file directly as data URL via IPC
                    dataUrlPromise = (async () => {
                        const api = (window as any).electronAPI?.db?.files;
                        if (!api?.readAsDataURL) throw new Error('File API not available');
                        const result = await api.readAsDataURL(lhPath);
                        if (!result?.success || !result?.data) {
                            throw new Error(result?.error || 'Failed to read image file');
                        }
                        return result.data;
                    })();
                } else {
                    // Unknown type â€” skip, signal ready
                    onReadyRef.current?.();
                    return;
                }

                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Letterhead load timed out')), timeoutMs)
                );

                const dataUrl = await Promise.race([dataUrlPromise, timeoutPromise]);

                if (!cancelled) {
                    setLetterheadBase64(dataUrl);
                    // onLetterheadReady() will be called by the <img onLoad> handler
                    // once the browser has rendered the letterhead image.
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('Error loading letterhead:', err);
                    setLetterheadBase64(null);
                    setLetterheadError(err?.message || 'Failed to load letterhead');
                    onReadyRef.current?.();
                }
            }
        };

        loadLetterhead();
        return () => { cancelled = true; };
    }, [company?.letterhead_path]);

    const isInvoice = type === 'invoice';
    const isBill    = type === 'bill';

    // GST Invoice columns â€” with tax columns + HS Code
    const invoiceColumns: any[] = isInvoice ? [
        { title: 'Sr.', key: 'index', align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
        { title: 'Item', dataIndex: 'item_name', key: 'item_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t || '-'}</span> },
        { title: 'Description', dataIndex: 'description', key: 'description', render: (t: string) => (t != null && String(t).trim() !== '' ? String(t) : '-') },
        { title: 'H.S Code', dataIndex: 'hs_code', key: 'hs_code', align: 'center' as const, render: (v: string) => (v != null && String(v).trim() !== '' ? String(v) : '-') },
        { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
        { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', align: 'right' as const, render: (v: number) => (v != null && v !== '') ? Number(v).toLocaleString() : '-' },
        { title: 'Amount (Excl. Tax)', key: 'amount_excl', align: 'right' as const, render: (_: any, row: any) => ((row.quantity || 0) * (row.unit_price || 0)).toLocaleString() },
        { title: 'Sales Tax Rate', dataIndex: 'gst_rate', key: 'gst_rate', align: 'center' as const, render: (_: any, row: any) => (row.gst_rate != null && row.gst_rate !== '') ? `${Number(row.gst_rate)}%` : '0%' },
        { title: 'Sales Tax Payable', dataIndex: 'gst_amount', key: 'gst_amount', align: 'right' as const, render: (_: any, row: any) => (row.gst_amount != null && row.gst_amount !== '') ? Number(row.gst_amount).toLocaleString() : '0' },
        { title: 'Total Amount', dataIndex: 'line_total', key: 'line_total', align: 'right' as const, render: (_: any, row: any) => (row.line_total != null && row.line_total !== '') ? Number(row.line_total).toLocaleString() : '-' },
    ] : [];

    // Bill columns â€” simple, no tax, with brand and HS Code
    const billColumns: any[] = isBill ? [
        { title: 'Sr. No.', key: 'index', align: 'center' as const, width: 60, render: (_: any, __: any, index: number) => index + 1 },
        {
            title: 'Item & Description', key: 'item_desc',
            render: (_: any, row: any) => (
                <span style={{ fontWeight: 600 }}>
                    {[row.item_name, row.description].filter(Boolean).join(' ')}
                </span>
            ),
        },
        { title: 'Brand', dataIndex: 'brand', key: 'brand', align: 'center' as const, render: (v: string) => (v != null && String(v).trim() !== '' ? String(v) : '-') },
        { title: 'H.S Code', dataIndex: 'hs_code', key: 'hs_code', align: 'center' as const, render: (v: string) => (v != null && String(v).trim() !== '' ? String(v) : '-') },
        { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'center' as const },
        { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', align: 'right' as const, render: (v: number) => (v != null && v !== '') ? Number(v).toLocaleString() : '-' },
        { title: 'Total Amount', dataIndex: 'line_total', key: 'line_total', align: 'right' as const, render: (_: any, row: any) => (row.line_total != null && row.line_total !== '') ? Number(row.line_total).toLocaleString() : ((row.quantity || 0) * (row.unit_price || 0)).toLocaleString() },
    ] : [];

    // Quotation / Challan columns
    const columns: any[] = [
        { title: 'Sr.', dataIndex: 'index', key: 'index', width: 40, render: (_: any, __: any, index: number) => index + 1 },
        { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 150, render: (text: string) => <div style={{ fontWeight: 'bold' }}>{text}</div> },
        { title: 'Description', dataIndex: 'description', key: 'description', width: 250 },
        { title: 'Brand', dataIndex: 'brand', key: 'brand', width: 100, render: (text: string) => (text != null && String(text).trim() !== '' ? text : '-') },
        { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 60, align: 'right' as const },
    ];

    if (type !== 'challan' && !isInvoice && !isBill) {
        columns.push(
            { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', width: 90, align: 'right' as const, render: (price: number) => <span>{price?.toLocaleString()}</span> },
            { title: 'Total', dataIndex: 'line_total', key: 'line_total', width: 110, align: 'right' as const, render: (total: number) => <span>{total?.toLocaleString()}</span> }
        );
    }

    const tableColumns = isInvoice ? invoiceColumns : isBill ? billColumns : columns;

    const showLetterhead = withLetterhead && !!company.letterhead_path;
    const scale = contentScale >= 0.5 && contentScale <= 1 ? contentScale : 1;
    const tableScale = scale < 1;

    // Content area width for no-letterhead centering
    const contentAreaW = 180;

    /* Content above table: title + customer/doc details */
    const contentAboveTable = (
        <>
            <div className={`document-title ${isInvoice ? 'document-title-invoice' : ''} ${isBill ? 'document-title-bill' : ''}`}>
                <h2>{getTitle()}</h2>
            </div>
            {/* Content block - same in scaled and non-scaled render */}
            {isInvoice && (
                <>
                    <div className="inv-two-col">
                        <div className="inv-block inv-bill-to">
                            <div className="inv-block-label">Invoice to</div>
                            <p className="inv-company-name">{data.customer_name}</p>
                            {data.customer_address != null && String(data.customer_address).trim() !== '' && <p className="inv-address">{data.customer_address}</p>}
                            {data.customer_tax_number != null && String(data.customer_tax_number).trim() !== '' && <p className="inv-tax"><strong>NTN #:</strong> {data.customer_tax_number}</p>}
                            {(data.customer_gst_number != null && String(data.customer_gst_number).trim() !== '') && <p className="inv-tax"><strong>STN #:</strong> {data.customer_gst_number}</p>}
                            {data.attention_person != null && String(data.attention_person).trim() !== '' && <p className="inv-contact"><strong>Contact Person:</strong> {data.attention_person}</p>}
                        </div>
                        <div className="inv-block inv-company-info">
                            <p className="inv-company-name">{company.name}</p>
                            {company.address != null && String(company.address).trim() !== '' && <p className="inv-address">{company.address}</p>}
                            {company.phone != null && String(company.phone).trim() !== '' && <p className="inv-contact"><strong>Contact:</strong> {company.phone}</p>}
                            {company.tax_number != null && String(company.tax_number).trim() !== '' && <p className="inv-tax"><strong>NTN #:</strong> {company.tax_number}</p>}
                            {company.gst_registration_number != null && String(company.gst_registration_number).trim() !== '' && <p className="inv-tax"><strong>STN #:</strong> {company.gst_registration_number}</p>}
                        </div>
                    </div>
                    <div className="inv-details-row">
                        <span><strong>Invoice Date:</strong> {formatDate(getDate())}</span>
                        <span><strong>Invoice Number:</strong> {getNumber()}</span>
                        {company.po_number != null && String(company.po_number).trim() !== '' && <span><strong>PO#:</strong> {company.po_number}</span>}
                        {data.person_name != null && String(data.person_name).trim() !== '' && <span><strong>Person Name:</strong> {data.person_name}</span>}
                        {data.delivery_challan_number && <span><strong>Ref D/C#:</strong> {data.delivery_challan_number}</span>}
                    </div>
                </>
            )}
            {isBill && (
                <div className="bill-info-section">
                    <div className="bill-to-block">
                        <p className="bill-to-label">To,</p>
                        <p className="bill-customer-name">{data.customer_name}</p>
                        {data.customer_address != null && String(data.customer_address).trim() !== '' && (
                            <p className="bill-customer-address">{data.customer_address}</p>
                        )}
                    </div>
                    <div className="bill-doc-info">
                        <p><strong>Commercial Invoice #</strong> {getNumber()}</p>
                        <p><strong>Date:</strong>  {formatDate(getDate())}</p>
                        {data.person_name != null && String(data.person_name).trim() !== '' && (
                            <p><strong>Ref:</strong>  {data.person_name}</p>
                        )}
                        {data.delivery_challan_number && <p><strong>DC No:</strong> {data.delivery_challan_number}</p>}
                        {data.customer_pr_number != null && String(data.customer_pr_number).trim() !== '' && (
                            <p><strong>PR No:</strong> {data.customer_pr_number}</p>
                        )}
                    </div>
                </div>
            )}
            {!isInvoice && !isBill && (
                <div className="info-section">
                    <div className="bill-to">
                        <strong>To:</strong>
                        <p className="customer-name">{data.customer_name}</p>
                        <p className="customer-details">{data.customer_address || 'Address not provided'}</p>
                        <p className="customer-contact">{data.customer_phone}</p>
                        {(data.customer_attention_person || data.attention_person) && (
                            <p className="attention-person"><strong>Attention:</strong> {data.customer_attention_person || data.attention_person}</p>
                        )}
                        {data.customer_gst_number && <p><strong>GST No:</strong> {data.customer_gst_number}</p>}
                        {data.customer_ntn_number && <p><strong>NTN:</strong> {data.customer_ntn_number}</p>}
                        {data.customer_pr_number && <p className="customer-pr"><strong>Customer PR No:</strong> {data.customer_pr_number}</p>}
                    </div>
                    <div className="doc-info">
                        <p><strong>{getNumberLabel()}</strong> {getNumber()}</p>
                        <p><strong>Date:</strong> {formatDate(getDate())}</p>
                        {(type === 'invoice' || type === 'bill') && data.delivery_challan_number && (
                            <p><strong>DC No:</strong> {data.delivery_challan_number}</p>
                        )}
                        {(data.customer_pr_number ?? data.po_number) && <p><strong>PR No:</strong> {data.customer_pr_number || data.po_number}</p>}
                        {data.customer_pr_number && type === 'quotation' && (
                            <p><strong>PR No:</strong> {data.customer_pr_number}</p>
                        )}
                        {data.expiry_date && <p><strong>Valid Until:</strong> {formatDate(data.expiry_date)}</p>}
                        {data.customer_salesperson_name && (
                            <p><strong>Sales Person:</strong> {data.customer_salesperson_name}</p>
                        )}
                    </div>
                </div>
            )}
            {type === 'quotation' && (
                <div style={{ marginBottom: 16, fontSize: '11pt', fontWeight: 500 }}>
                    Thank you for the inquiry, we are pleased to offer:
                </div>
            )}
        </>
    );

    const tableBlock = (
            <div className={`items-table ${isInvoice ? 'items-table-invoice' : ''} ${isBill ? 'items-table-bill' : ''}`}>
                <Table
                    dataSource={data.items}
                    columns={tableColumns}
                    pagination={false}
                    rowKey="id"
                    size="small"
                    bordered
                    tableLayout="auto"
                />
            </div>
    );

    /* Totals row(s) — scale with the table */
    const totalsBlock = (
        <>
            {isInvoice && (
                <div className="totals-section inv-totals-section">
                    <div className="totals">
                        <div className="inv-total-row">
                            <span>Total Invoice for Payment</span>
                            <span>{company.currency || 'PKR'} {data.total_amount?.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}
            {isBill && (
                <table className="bill-totals-table">
                    <tbody>
                        <tr>
                            <td className="bill-total-label">Total Rs.</td>
                            <td className="bill-total-value">{Number(data.total_amount || 0).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            )}
            {!isInvoice && !isBill && type !== 'challan' && (
                <div className="totals-section">
                    <div className="totals">
                        <div className="total-row">
                            <span>Subtotal:</span>
                            <span>{data.subtotal?.toLocaleString()}</span>
                        </div>
                        <div className="total-row grand-total">
                            <span>Grand Total:</span>
                            <span>{data.total_amount?.toLocaleString()} ({company.currency})</span>
                        </div>
                    </div>
                </div>
            )}
            {type === 'challan' && (
                <div className="totals-section">
                    <div className="totals">
                        <div className="total-row grand-total">
                            <span>Total Quantity:</span>
                            <span>{data.total_quantity}</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    /* Content below table: terms, footer, disclaimer (not scaled) */
    const contentBelowTable = (
            <>
            {isBill && (
                <div className="bill-totals-section">
                    {data.terms_and_conditions != null && String(data.terms_and_conditions).trim() !== '' && (() => {
                        let terms: string[] = [];
                        try { const arr = JSON.parse(data.terms_and_conditions); terms = Array.isArray(arr) ? arr : []; } catch { terms = [String(data.terms_and_conditions)]; }
                        terms = terms.filter((t: string) => t?.trim());
                        if (!terms.length) return null;
                        return (
                            <div className="bill-terms">
                                <p className="bill-terms-heading">Terms &amp; Conditions:</p>
                                <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '11pt', listStyleType: 'disc' }}>
                                    {terms.map((t: string, i: number) => {
                                        const isBold = t.startsWith('**') && t.endsWith('**');
                                        const text = isBold ? t.slice(2, -2) : t;
                                        return <li key={i} style={isBold ? { fontWeight: 700 } : undefined}>{text}</li>;
                                    })}
                                </ul>
                            </div>
                        );
                    })()}
                    <div className="bill-footer-thanks">
                        <p>Thanks for your business</p>
                        <p className="bill-footer-company">{company.name}</p>
                        {company.phone && <p>{company.phone}</p>}
                    </div>
                </div>
            )}
            {!isInvoice && !isBill && type !== 'challan' && (
                <div className="totals-section">
                    <div className="notes">
                        {type === 'quotation' ? (
                            <>
                                {data.quotation_validity && (
                                    <p><strong>Quotation Validity:</strong> {data.quotation_validity}</p>
                                )}
                                <strong>Terms and Conditions:</strong>
                                {(() => {
                                    let terms: string[] = [];
                                    try { const arr = JSON.parse(data.terms_and_conditions); terms = Array.isArray(arr) ? arr : []; } catch { terms = data.terms_and_conditions ? [String(data.terms_and_conditions)] : []; }
                                    terms = terms.filter((t: string) => t?.trim());
                                    return terms.length ? (
                                        <ul style={{ margin: '4px 0 0 18px', padding: 0, listStyleType: 'disc' }}>
                                            {terms.map((t: string, i: number) => {
                                                const isBold = t.startsWith('**') && t.endsWith('**');
                                                const text = isBold ? t.slice(2, -2) : t;
                                                return <li key={i} style={isBold ? { fontWeight: 700 } : undefined}>{text}</li>;
                                            })}
                                        </ul>
                                    ) : <p>-</p>;
                                })()}
                            </>
                        ) : (
                            <>
                                <strong>Notes:</strong>
                                <p>{data.notes || 'Thank you for your business!'}</p>
                            </>
                        )}
                    </div>
                </div>
            )}
            {type === 'quotation' && (
                <>
                    <div style={{ marginTop: 20, textAlign: 'left', fontSize: '11pt' }}>
                        <p style={{ fontWeight: 700 }}>From: {company.name}</p>
                    </div>
                    {showLetterhead ? (
                        <>
                            <div className="dc-footer" style={{ marginTop: 40 }}>
                                <div className="dc-stamp-box">
                                    <div className="dc-stamp-line" />
                                    <p>Company Stamp / Signature</p>
                                </div>
                                <div className="dc-signature-box">
                                    <div className="dc-stamp-line" />
                                    <p>Customer Signature</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="dc-footer" style={{ marginTop: 60 }}>
                            <div className="dc-stamp-box">
                                <div className="dc-stamp-line" />
                                <p>Authorized Signature</p>
                                <p style={{ fontSize: '10pt', color: '#666', marginTop: 4 }}>Date: _______________</p>
                            </div>
                            <div className="dc-signature-box">
                                <div className="dc-stamp-line" />
                                <p>Customer Signature</p>
                                <p style={{ fontSize: '10pt', color: '#666', marginTop: 4 }}>Date: _______________</p>
                            </div>
                        </div>
                    )}
                </>
            )}
            {type === 'challan' && (
                <>
                    <div className="dc-footer">
                        <div className="dc-stamp-box">
                            <div className="dc-stamp-line" />
                            <p>Stamp</p>
                        </div>
                        <div className="dc-signature-box">
                            <div className="dc-stamp-line" />
                            <p>Authorized Signature</p>
                        </div>
                    </div>
                </>
            )}
            {showLetterhead && (
                <p style={{ marginTop: 24, textAlign: 'center', fontSize: '9pt', color: '#888', fontStyle: 'italic' }}>
                    This is a computer-generated quotation and is valid without a physical signature.
                </p>
            )}
            </>
    );

    const tableSection = tableScale ? (
        <div className="print-table-scale-wrapper" style={{ zoom: scale }}>
            {tableBlock}
            {totalsBlock}
        </div>
    ) : (
        <>
            {tableBlock}
            {totalsBlock}
        </>
    );

    const documentContent = (
        <>
            {contentAboveTable}
            {tableSection}
            {contentBelowTable}
        </>
    );

    const template = (
        <div className={`print-template ${showLetterhead ? 'has-letterhead' : ''}`}>
            {/* Letterhead: header strip (top) + footer strip (bottom) â€” never scaled; footer stays at extreme bottom */}
            {showLetterhead && (
                <>
                    {letterheadBase64 ? (
                        <>
                            {/* Top strip â€” shows only the header portion of the letterhead */}
                            <img
                                className="letterhead-bg lh-header"
                                src={letterheadBase64}
                                alt="Letterhead header"
                                onLoad={() => onReadyRef.current?.()}
                                onError={() => {
                                    setLetterheadError('Failed to display letterhead image');
                                    setLetterheadBase64(null);
                                    onReadyRef.current?.();
                                }}
                            />
                            {/* Bottom strip â€” shows only the footer portion of the letterhead */}
                            <img
                                className="letterhead-bg lh-footer"
                                src={letterheadBase64}
                                alt="Letterhead footer"
                            />
                        </>
                    ) : letterheadError ? (
                        <div className="letterhead-error">âš ï¸ {letterheadError}</div>
                    ) : (
                        <div className="letterhead-loading">â³ Loading letterhead...</div>
                    )}
                </>
            )}

            {/* No letterhead fallback â€” shown when no letterhead set OR user chose without */}
            {/* For quotations without letterhead: skip company details, only show doc content */}
            {/* Company details only for quotation when without letterhead; never for invoice, bill, or DC (challan) */}
            {!showLetterhead && type === 'quotation' && (
                <div className="company-info-plain print-header-fallback">
                    <div className="company-text">
                        <h1 className="company-name">{company.name}</h1>
                        <p className="company-address">{company.address}</p>
                        <p className="company-contact">Phone: {company.phone} | Email: {company.email}</p>
                        {company.gst_registration_number && <p className="company-gst">GST No: {company.gst_registration_number}</p>}
                    </div>
                </div>
            )}

            {/* Document content: details above/below table stay fixed; only the table is scaled when scale < 100% */}
            <div className="print-content">
                {showLetterhead ? (
                    documentContent
                ) : (
                    <div
                        className="print-content-scaled-wrapper"
                        style={{ width: `${contentAreaW}mm` }}
                    >
                        {documentContent}
                    </div>
                )}
            </div>
        </div>
    );

    return template;
};

export default PrintTemplate;
