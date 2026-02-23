import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, InputNumber, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PrintTemplate from '../../components/PrintTemplate';

const SalesQuotations: React.FC = () => {
    const { currentCompany, companies, user, fiscalYear } = useApp();
    const docLabel = currentCompany?.is_gst_enabled ? 'Invoice' : 'Bill';
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingQuotation, setEditingQuotation] = useState<any>(null);
    const [form] = Form.useForm();
    const [printData, setPrintData] = useState<any>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    const watchedCustomerId = Form.useWatch('customer_id', form);

    useEffect(() => {
        if (currentCompany) {
            loadQuotations();
            loadCustomers();
            loadItems();
        }
    }, [currentCompany]);

    // When customer is selected in quotation form, load their terms and conditions into the field
    useEffect(() => {
        if (!modalVisible) return;

        if (watchedCustomerId == null || watchedCustomerId === '') {
            form.setFieldsValue({ terms_and_conditions: '' });
            return;
        }

        const id = Number(watchedCustomerId);
        if (!id) return;

        const fromList = customers.find((c: any) => c.id === id);
        if (fromList && fromList.terms_and_conditions != null) {
            form.setFieldsValue({ terms_and_conditions: String(fromList.terms_and_conditions) });
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const result = await (window as any).electronAPI.db.customers.getById(id);
                if (cancelled) return;
                if (result?.success && result?.data) {
                    const terms = result.data.terms_and_conditions != null ? String(result.data.terms_and_conditions) : '';
                    form.setFieldsValue({ terms_and_conditions: terms });
                }
            } catch (_) {}
        })();
        return () => { cancelled = true; };
    }, [modalVisible, watchedCustomerId, form]);

    const loadQuotations = async () => {
        if (!currentCompany) return;
        setLoading(true);
        try {
            const result = await (window as any).electronAPI.db.salesQuotations.getAll(currentCompany.id);
            if (result.success) setQuotations(result.data || []);
        } catch (error) {
            message.error('Failed to load quotations');
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.customers.getAll(currentCompany.id);
        if (result.success) setCustomers(result.data || []);
    };

    const loadItems = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
        if (result.success) setItems(result.data || []);
    };

    const handlePrint = async (record: any) => {
        try {
            const result = await (window as any).electronAPI.db.salesQuotations.getById(record.id);
            if (result.success && result.data) {
                setPrintData(result.data);
                setIsPreviewVisible(true);
            }
        } catch (error) {
            message.error('Failed to prepare print');
        }
    };

    const actualPrint = () => {
        setTimeout(async () => {
            try {
                await (window as any).electronAPI.db.files.print();
            } catch (err) {
                window.print();
            }
        }, 300);
    };

    const handleSavePDF = async () => {
        try {
            const result = await (window as any).electronAPI.db.files.printToPDF();
            if (result.success) {
                message.success(`Saved to: ${result.filePath}`);
            } else if (result.error !== 'Save cancelled') {
                message.error(result.error || 'Failed to save PDF');
            }
        } catch (error) {
            message.error('Failed to save PDF');
        }
    };

    const loadNextQuotationNumber = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.salesQuotations.getNextNumber(currentCompany.id, fiscalYear);
        if (result.success && result.data) form.setFieldValue('quotation_number', result.data);
    };

    const handleEdit = async (record: any) => {
        const result = await (window as any).electronAPI.db.salesQuotations.getById(record.id);
        if (result.success) {
            setEditingQuotation(result.data);
            form.setFieldsValue({
                ...result.data,
                quotation_date: dayjs(result.data.quotation_date),
                expiry_date: result.data.expiry_date ? dayjs(result.data.expiry_date) : null,
            });
            setModalVisible(true);
        } else {
            message.error('Failed to fetch quotation details');
        }
    };

    const handleCreateInvoice = async (record: any) => {
        try {
            const result = await (window as any).electronAPI.db.salesInvoices.createFromQuotation(record.id, user?.id);
            if (result.success && result.data) {
                message.success(`${docLabel} ${result.data.invoice_number} created from quotation`);
                navigate('/sales/invoices');
            } else {
                message.error(result.error || `Failed to create ${docLabel.toLowerCase()}`);
            }
        } catch (error: any) {
            message.error(error.message || `Failed to create ${docLabel.toLowerCase()}`);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const result = await (window as any).electronAPI.db.salesQuotations.delete(id);
            if (result.success) {
                message.success('Quotation deleted successfully');
                loadQuotations();
            } else {
                message.error(result.error || 'Failed to delete quotation');
            }
        } catch (error) {
            message.error('Failed to delete quotation');
        }
    };

    const handleSave = async (values: any) => {
        if (!currentCompany) return;
        try {
            const quotationData = {
                ...values,
                company_id: currentCompany.id,
                quotation_number: values.quotation_number?.trim?.() || undefined,
                fiscal_year: fiscalYear,
                quotation_date: values.quotation_date.format('YYYY-MM-DD'),
                expiry_date: values.expiry_date?.format('YYYY-MM-DD'),
                created_by: user?.id,
            };

            // Calculate totals
            let subtotal = 0;
            quotationData.items?.forEach((item: any) => {
                item.line_total = item.quantity * item.unit_price;
                subtotal += item.line_total;
            });
            quotationData.subtotal = subtotal;
            quotationData.total_amount = subtotal; // Simplified

            if (editingQuotation) {
                const result = await (window as any).electronAPI.db.salesQuotations.update(editingQuotation.id, quotationData);
                if (result.success) {
                    message.success('Quotation updated successfully');
                    setModalVisible(false);
                    setEditingQuotation(null);
                    loadQuotations();
                } else {
                    message.error(result.error || 'Failed to update quotation');
                }
            } else {
                const result = await (window as any).electronAPI.db.salesQuotations.create(quotationData);
                if (result.success) {
                    message.success('Quotation created successfully');
                    setModalVisible(false);
                    setEditingQuotation(null);
                    loadQuotations();
                } else {
                    message.error(result.error || 'Failed to create quotation');
                }
            }
        } catch (error: any) {
            console.error('Save error:', error);
            message.error(error.message || 'Operation failed');
        }
    };

    const columns = [
        { title: 'Quo #', dataIndex: 'quotation_number', key: 'quo_number' },
        { title: 'Customer', dataIndex: 'customer_name', key: 'customer' },
        { title: 'Date', dataIndex: 'quotation_date', key: 'date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'Amount', dataIndex: 'total_amount', key: 'amount', render: (a: number) => a?.toLocaleString() },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => (
                <Space>
                    <Button icon={<FileTextOutlined />} onClick={() => handleCreateInvoice(record)} title={`Create ${docLabel}`} />
                    <Button icon={<PrinterOutlined />} onClick={() => handlePrint(record)} title="Print" />
                    <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} title="Edit" />
                    <Popconfirm
                        title="Delete?"
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button danger icon={<DeleteOutlined />} title="Delete" />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <h1>Sales Quotations</h1>
                <Button type="primary" icon={<PlusOutlined />} onClick={async () => {
                    setEditingQuotation(null);
                    form.resetFields();
                    setModalVisible(true);
                    await loadNextQuotationNumber();
                }}>
                    New Quotation
                </Button>
            </div>

            <Table columns={columns} dataSource={quotations} loading={loading} rowKey="id" />

            <Modal title={editingQuotation ? 'Edit Quotation' : 'New Quotation'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()} width={900}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Row gutter={16} style={{ marginBottom: 0 }}>
                        <Col flex="0 0 160px">
                            <Form.Item name="quotation_number" label="Quotation #" rules={[{ required: true, message: 'Required' }]}>
                                <Input placeholder="e.g. QUO-0001/26" />
                            </Form.Item>
                        </Col>
                        <Col flex="0 0 240px">
                            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
                                <Select
                                    showSearch
                                    optionFilterProp="children"
                                    placeholder="Select customer"
                                >
                                    {customers.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col flex="0 0 120px">
                            <Form.Item name="quotation_date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col flex="0 0 120px">
                            <Form.Item name="expiry_date" label="Expiry Date">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col flex="0 0 180px">
                            <Form.Item name="quotation_validity" label="Quotation Validity" rules={[{ required: true, message: 'Please select quotation validity' }]}>
                                <Select placeholder="e.g. 30 days" style={{ width: '100%' }}>
                                    <Select.Option value="7 days">7 days</Select.Option>
                                    <Select.Option value="15 days">15 days</Select.Option>
                                    <Select.Option value="30 days">30 days</Select.Option>
                                    <Select.Option value="60 days">60 days</Select.Option>
                                    <Select.Option value="90 days">90 days</Select.Option>
                                    <Select.Option value="Until expiry date">Until expiry date</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col flex="0 0 200px">
                            <Form.Item name="payment_terms" label="Payment Terms" rules={[{ required: true, message: 'Please select payment terms' }]}>
                                <Select placeholder="e.g. Net 30" style={{ width: '100%' }}>
                                    <Select.Option value="Due on receipt">Due on receipt</Select.Option>
                                    <Select.Option value="Net 7">Net 7</Select.Option>
                                    <Select.Option value="Net 15">Net 15</Select.Option>
                                    <Select.Option value="Net 30">Net 30</Select.Option>
                                    <Select.Option value="Net 60">Net 60</Select.Option>
                                    <Select.Option value="50% advance, 50% on delivery">50% advance, 50% on delivery</Select.Option>
                                    <Select.Option value="100% advance">100% advance</Select.Option>
                                    <Select.Option value="100% on delivery">100% on delivery</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.List
                        name="items"
                        rules={[
                            {
                                validator: async (_, names) => {
                                    if (!names || names.length < 1) {
                                        return Promise.reject(new Error('At least one item is required'));
                                    }
                                },
                            },
                        ]}
                    >
                        {(fields, { add, remove }, { errors }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                        <Form.Item {...restField} name={[name, 'item_id']} rules={[{ required: true, message: 'Select item' }]}>
                                            <Select placeholder="Item" style={{ width: 250 }}>
                                                {items.map(i => <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>)}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'quantity']} rules={[{ required: true, message: 'Enter qty' }]}>
                                            <InputNumber placeholder="Qty" min={1} />
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'unit_price']} rules={[{ required: true, message: 'Enter price' }]}>
                                            <InputNumber placeholder="Price" min={0} />
                                        </Form.Item>
                                        <Button onClick={() => remove(name)}>Remove</Button>
                                    </Space>
                                ))}
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Add Item</Button>
                                <div style={{ color: '#ff4d4f', marginTop: 8 }}>
                                    <Form.ErrorList errors={errors} />
                                </div>
                            </>
                        )}
                    </Form.List>

                    <Form.Item name="terms_and_conditions" label="Terms and Conditions" rules={[{ required: true, message: 'Please enter terms and conditions' }]} style={{ marginTop: 20 }}>
                        <Input.TextArea rows={4} placeholder="Select a customer to auto-fill, or enter manually" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Print Preview"
                open={isPreviewVisible}
                onCancel={() => setIsPreviewVisible(false)}
                width={1000}
                footer={[
                    <Button key="cancel" onClick={() => setIsPreviewVisible(false)}>Close</Button>,
                    <Button key="pdf" icon={<PrinterOutlined />} onClick={handleSavePDF}>Save as PDF</Button>,
                    <Button key="print" type="primary" onClick={actualPrint}>Print</Button>
                ]}
                className="print-preview-modal"
            >
                <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', background: '#f5f5f5' }}>
                    <div style={{ background: 'white', padding: '10px', width: '210mm', margin: '0 auto', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
                        {printData && <PrintTemplate type="quotation" data={printData} company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany} />}
                    </div>
                </div>
            </Modal>

            <div id="print-container">
                {printData && <PrintTemplate type="quotation" data={printData} company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany} />}
            </div>
        </div>
    );
};

export default SalesQuotations;
