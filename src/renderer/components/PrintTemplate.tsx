import React from 'react';
import { Table } from 'antd';
import { pdfFileToImage } from '../utils/pdfToImage';
import './PrintTemplate.css';

interface PrintTemplateProps {
    type: 'invoice' | 'bill' | 'quotation' | 'challan';
    data: any;
    company: any;
    onLetterheadReady?: () => void;
}

const PrintTemplate: React.FC<PrintTemplateProps> = ({ type, data, company, onLetterheadReady }) => {
    if (!data || !company) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    const getTitle = () => {
        switch (type) {
            case 'invoice': return 'SALES INVOICE';
            case 'bill': return 'SALES BILL';
            case 'quotation': return 'QUOTATION';
            case 'challan': return 'DELIVERY CHALLAN';
            default: return 'DOCUMENT';
        }
    };

    const getNumberLabel = () => {
        switch (type) {
            case 'invoice': return 'Invoice No:';
            case 'bill': return 'Bill No:';
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
                // No letterhead — nothing to load, signal ready immediately
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
                    // Unknown type — skip, signal ready
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

    const columns: any[] = [
        {
            title: 'Sr.',
            dataIndex: 'index',
            key: 'index',
            width: 50,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Item',
            dataIndex: 'item_name',
            key: 'item_name',
            render: (text: string) => <div style={{ fontWeight: 'bold' }}>{text}</div>,
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Brand',
            dataIndex: 'brand',
            key: 'brand',
            render: (text: string) => text || '—',
        },
        {
            title: 'Availability',
            dataIndex: 'availability',
            key: 'availability',
            render: (text: string) => text || '—',
        },
        {
            title: 'Qty',
            dataIndex: 'quantity',
            key: 'quantity',
            align: 'right' as const,
        },
    ];

    if (type !== 'challan') {
        columns.push(
            {
                title: 'Unit Price',
                dataIndex: 'unit_price',
                key: 'unit_price',
                align: 'right' as const,
                render: (price: number) => <span>{price?.toLocaleString()}</span>,
            },
            {
                title: 'Total',
                dataIndex: 'line_total',
                key: 'line_total',
                align: 'right' as const,
                render: (total: number) => <span>{total?.toLocaleString()}</span>,
            }
        );
    }

    return (
        <div className={`print-template ${company.letterhead_path ? 'has-letterhead' : ''}`}>
            {/* Full-page letterhead background - PDF converted to PNG */}
            {company.letterhead_path && (
                <>
                    {letterheadBase64 ? (
                        <img
                            className="letterhead-bg"
                            src={letterheadBase64}
                            alt="Letterhead"
                            onLoad={() => onReadyRef.current?.()}
                            onError={() => {
                                setLetterheadError('Failed to display letterhead image');
                                setLetterheadBase64(null);
                                onReadyRef.current?.();
                            }}
                        />
                    ) : letterheadError ? (
                        <div className="letterhead-error">⚠️ {letterheadError}</div>
                    ) : (
                        <div className="letterhead-loading">⏳ Loading letterhead...</div>
                    )}
                </>
            )}

            {/* No letterhead fallback */}
            {!company.letterhead_path && (
                <div className="company-info-plain print-header-fallback">
                    <div className="company-text">
                        <h1 className="company-name">{company.name}</h1>
                        <p className="company-address">{company.address}</p>
                        <p className="company-contact">Phone: {company.phone} | Email: {company.email}</p>
                        {company.gst_registration_number && <p className="company-gst">GST No: {company.gst_registration_number}</p>}
                    </div>
                </div>
            )}

            {/* Document content - overlaid on top of letterhead */}
            <div className="print-content">

                <div className="document-title">
                    <h2>{getTitle()}</h2>
                </div>

                <div className="info-section">
                    <div className="bill-to">
                        <strong>To:</strong>
                        <p className="customer-name">{data.customer_name}</p>
                        <p className="customer-details">{data.customer_address || 'Address not provided'}</p>
                        <p className="customer-contact">{data.customer_phone}</p>
                        {data.attention_person && <p className="attention-person"><strong>Attention:</strong> {data.attention_person}</p>}
                        {data.customer_pr_number && <p className="customer-pr"><strong>Customer PR No:</strong> {data.customer_pr_number}</p>}
                    </div>
                    <div className="doc-info">
                        <p><strong>{getNumberLabel()}</strong> {getNumber()}</p>
                        <p><strong>Date:</strong> {formatDate(getDate())}</p>
                        {data.po_number && <p><strong>PO No:</strong> {data.po_number}</p>}
                        {data.expiry_date && <p><strong>Expiry Date:</strong> {formatDate(data.expiry_date)}</p>}
                    </div>
                </div>

                <div className="items-table">
                    <Table
                        dataSource={data.items}
                        columns={columns}
                        pagination={false}
                        rowKey="id"
                        size="small"
                        bordered
                    />
                </div>

                {type !== 'challan' && (
                    <div className="totals-section">
                        <div className="notes">
                            {type === 'quotation' ? (
                                <>
                                    {(data.quotation_validity || data.payment_terms) && (
                                        <p>
                                            {data.quotation_validity && <><strong>Quotation Validity:</strong> {data.quotation_validity}</>}
                                            {data.quotation_validity && data.payment_terms && ' · '}
                                            {data.payment_terms && <><strong>Payment Terms:</strong> {data.payment_terms}</>}
                                        </p>
                                    )}
                                    <strong>Terms and Conditions:</strong>
                                    <p>{data.terms_and_conditions || '—'}</p>
                                </>
                            ) : (
                                <>
                                    <strong>Notes:</strong>
                                    <p>{data.notes || 'Thank you for your business!'}</p>
                                </>
                            )}
                        </div>
                        <div className="totals">
                            <div className="total-row">
                                <span>Subtotal:</span>
                                <span>{data.subtotal?.toLocaleString()}</span>
                            </div>
                            {(data.tax_amount > 0 || (type === 'invoice' && (data.gst_total || 0) > 0)) && (
                                <div className="total-row">
                                    <span>{type === 'invoice' ? 'GST:' : 'Tax:'}</span>
                                    <span>{(type === 'invoice' ? data.gst_total : data.tax_amount)?.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="total-row grand-total">
                                <span>Grand Total:</span>
                                <span>{data.total_amount?.toLocaleString()} ({company.currency})</span>
                            </div>
                        </div>
                    </div>
                )}

                {type === 'challan' && (
                    <div className="totals-section">
                        <div className="notes">
                            <strong>Notes:</strong>
                            <p>{data.notes || 'Items delivered in good condition.'}</p>
                        </div>
                        <div className="totals">
                            <div className="total-row grand-total">
                                <span>Total Quantity:</span>
                                <span>{data.total_quantity}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="footer-section">
                    <div className="signature-box">
                        <div className="sig-line"></div>
                        <p>Customer Signature</p>
                    </div>
                    <div className="signature-box">
                        <div className="sig-line"></div>
                        <p>Authorized Signature</p>
                    </div>
                </div>
            </div> {/* Close print-content wrapper */}
        </div>
    );
};

export default PrintTemplate;
