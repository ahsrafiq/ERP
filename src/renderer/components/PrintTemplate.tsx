import React from 'react';
import { Table } from 'antd';
import './PrintTemplate.css';

interface PrintTemplateProps {
    type: 'invoice' | 'quotation' | 'challan';
    data: any;
    company: any;
}

const PrintTemplate: React.FC<PrintTemplateProps> = ({ type, data, company }) => {
    if (!data || !company) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    const getTitle = () => {
        switch (type) {
            case 'invoice': return 'SALES INVOICE';
            case 'quotation': return 'QUOTATION';
            case 'challan': return 'DELIVERY CHALLAN';
            default: return 'DOCUMENT';
        }
    };

    const getNumberLabel = () => {
        switch (type) {
            case 'invoice': return 'Invoice No:';
            case 'quotation': return 'Quotation No:';
            case 'challan': return 'Challan No:';
            default: return 'No:';
        }
    };

    const getNumber = () => {
        switch (type) {
            case 'invoice': return data.invoice_number;
            case 'quotation': return data.quotation_number;
            case 'challan': return data.challan_number;
            default: return '';
        }
    };

    const getDate = () => {
        switch (type) {
            case 'invoice': return data.invoice_date;
            case 'quotation': return data.quotation_date;
            case 'challan': return data.challan_date;
            default: return '';
        }
    };

    const [letterheadBase64, setLetterheadBase64] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadLetterhead = async () => {
            if (company.letterhead_path) {
                try {
                    const result = await (window as any).electronAPI.db.files.readAsDataURL(company.letterhead_path);
                    if (result.success) {
                        setLetterheadBase64(result.data);
                    } else {
                        console.error("Failed to load letterhead via API:", result.error);
                        setLetterheadBase64(null);
                    }
                } catch (err) {
                    console.error("Error loading letterhead:", err);
                    setLetterheadBase64(null);
                }
            } else {
                setLetterheadBase64(null);
            }
        };

        loadLetterhead();
    }, [company.letterhead_path]);

    const columns: any[] = [
        {
            title: 'Sr.',
            dataIndex: 'index',
            key: 'index',
            width: 50,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Item & Description',
            dataIndex: 'item_name',
            key: 'item_name',
            render: (text: string, record: any) => (
                <div>
                    <div style={{ fontWeight: 'bold' }}>{text}</div>
                    {record.description && <div style={{ fontSize: '0.8em', color: '#666' }}>{record.description}</div>}
                </div>
            ),
        },
        {
            title: 'Brand',
            dataIndex: 'brand',
            key: 'brand',
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
            {/* Header / Letterhead */}
            <div className="print-header">
                {company.letterhead_path ? (
                    company.letterhead_path.match(/\.pdf$/i) ? (
                        <div className="letterhead-container pdf-letterhead">
                            <iframe
                                src={`${company.letterhead_path}#toolbar=0&navpanes=0&scrollbar=0`}
                                width="100%"
                                style={{ height: '297mm', border: 'none', position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }}
                                title="Letterhead PDF"
                            />
                        </div>
                    ) : (
                        <img
                            src={letterheadBase64 || company.letterhead_path}
                            alt="Letterhead"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: 'auto',
                                maxHeight: '297mm',
                                objectFit: 'contain',
                                objectPosition: 'top center',
                                zIndex: 0,
                                pointerEvents: 'none'
                            }}
                        />
                    )
                ) : (
                    <div className="company-info-plain">
                        {company.logo_path && <img src={company.logo_path} alt="Logo" className="logo-img" />}
                        <div className="company-text">
                            <h1 className="company-name">{company.name}</h1>
                            <p className="company-address">{company.address}</p>
                            <p className="company-contact">Phone: {company.phone} | Email: {company.email}</p>
                            {company.gst_registration_number && <p className="company-gst">GST No: {company.gst_registration_number}</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* Document Content with higher z-index to appear above letterhead */}
            <div className="print-content" style={{ position: 'relative', zIndex: 1 }}>

                <div className="document-title">
                    <h2>{getTitle()}</h2>
                </div>

                <div className="info-section">
                    <div className="bill-to">
                        <strong>Bill To:</strong>
                        <p className="customer-name">{data.customer_name}</p>
                        <p className="customer-details">{data.customer_address || 'Address not provided'}</p>
                        <p className="customer-contact">{data.customer_phone}</p>
                    </div>
                    <div className="doc-info">
                        <p><strong>{getNumberLabel()}</strong> {getNumber()}</p>
                        <p><strong>Date:</strong> {formatDate(getDate())}</p>
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
                            {data.tax_amount > 0 && (
                                <div className="total-row">
                                    <span>Tax:</span>
                                    <span>{data.tax_amount?.toLocaleString()}</span>
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
