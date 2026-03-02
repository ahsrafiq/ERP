import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, InputNumber, message, Popconfirm, Switch } from 'antd';
import { PlusOutlined, EditOutlined, PrinterOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PrintTemplate from '../../components/PrintTemplate';

const DeliveryChallans: React.FC = () => {
    const { currentCompany, companies, user, fiscalYear } = useApp();
    const navigate = useNavigate();
    const docLabel = currentCompany?.is_gst_enabled ? 'Invoice' : 'Bill';
    const [challans, setChallans] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingChallan, setEditingChallan] = useState<any>(null);
    const [form] = Form.useForm();
    const [printData, setPrintData] = useState<any>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [printWithLetterhead, setPrintWithLetterhead] = useState(true);

    const watchedCustomerId = Form.useWatch('customer_id', form);

    // When customer is selected, load their terms and conditions
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
            } catch (_) { }
        })();
        return () => { cancelled = true; };
    }, [modalVisible, watchedCustomerId, form]);

    useEffect(() => {
        if (currentCompany) {
            loadChallans();
            loadCustomers();
            loadItems();
        }
    }, [currentCompany]);

    const loadChallans = async () => {
        if (!currentCompany) return;
        setLoading(true);
        try {
            const result = await (window as any).electronAPI.db.deliveryChallans.getAll(currentCompany.id);
            if (result.success) setChallans(result.data || []);
        } catch (error) {
            message.error('Failed to load delivery challans');
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
            const result = await (window as any).electronAPI.db.deliveryChallans.getById(record.id);
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
            // Step 1: show the save dialog BEFORE any visual change
            const pathResult = await (window as any).electronAPI.db.files.getSavePath('DeliveryChallan.pdf');
            if (!pathResult.success) return;

            // Step 2: apply capturing class (brief flash, dialog already gone)
            document.body.classList.add('capturing-pdf');
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const result = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);
            if (result.success) {
                message.success(`Saved to: ${result.filePath}`);
            } else {
                message.error(result.error || 'Failed to save PDF');
            }
        } catch {
            message.error('Failed to save PDF');
        } finally {
            document.body.classList.remove('capturing-pdf');
        }
    };


    const handleNewChallan = async () => {
        setEditingChallan(null);
        form.resetFields();
        setModalVisible(true);

        if (currentCompany) {
            try {
                const [challanRes, poRes] = await Promise.all([
                    (window as any).electronAPI.db.deliveryChallans.getNextNumber(currentCompany.id, fiscalYear),
                    (window as any).electronAPI.db.deliveryChallans.getNextPoNumber(currentCompany.id, fiscalYear)
                ]);

                form.setFieldsValue({
                    challan_number: challanRes.success ? challanRes.data : undefined,
                    po_number: poRes.success ? poRes.data : undefined,
                    challan_date: dayjs(),
                });
            } catch (err) {
                console.error('Failed to pre-fill challan:', err);
                form.setFieldsValue({ challan_date: dayjs() });
            }
        }
    };

    const handleEdit = async (record: any) => {
        const result = await (window as any).electronAPI.db.deliveryChallans.getById(record.id);
        if (result.success) {
            setEditingChallan(result.data);
            form.setFieldsValue({
                ...result.data,
                challan_date: dayjs(result.data.challan_date),
            });
            setModalVisible(true);
        } else {
            message.error('Failed to fetch challan details');
        }
    };

    const handleCreateInvoice = async (record: any) => {
        try {
            const result = await (window as any).electronAPI.db.salesInvoices.createFromChallan(record.id, user?.id);
            if (result.success && result.data) {
                message.success(`${docLabel} ${result.data.invoice_number} created from challan`);
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
            const result = await (window as any).electronAPI.db.deliveryChallans.delete(id);
            if (result.success) {
                message.success('Delivery Challan deleted successfully');
                loadChallans();
            } else {
                message.error(result.error || 'Failed to delete challan');
            }
        } catch (error) {
            message.error('Failed to delete challan');
        }
    };

    const handleSave = async (values: any) => {
        if (!currentCompany) return;
        try {
            const challanData = {
                ...values,
                company_id: currentCompany.id,
                challan_number: values.challan_number?.trim?.() || undefined,
                fiscal_year: fiscalYear,
                challan_date: values.challan_date.format('YYYY-MM-DD'),
                created_by: user?.id,
            };

            // Calculate total quantity
            let totalQty = 0;
            challanData.items?.forEach((item: any) => {
                totalQty += item.quantity;
            });
            challanData.total_quantity = totalQty;

            if (editingChallan) {
                const result = await (window as any).electronAPI.db.deliveryChallans.update(editingChallan.id, challanData);
                if (result.success) {
                    message.success('Delivery Challan updated successfully');
                    setModalVisible(false);
                    setEditingChallan(null);
                    loadChallans();
                } else {
                    message.error(result.error || 'Failed to update challan');
                }
            } else {
                const result = await (window as any).electronAPI.db.deliveryChallans.create(challanData);
                if (result.success) {
                    message.success('Delivery Challan created successfully');
                    setModalVisible(false);
                    setEditingChallan(null);
                    loadChallans();
                } else {
                    message.error(result.error || 'Failed to create challan');
                }
            }
        } catch (error: any) {
            console.error('Save error:', error);
            message.error(error.message || 'Operation failed');
        }
    };

    const columns = [
        { title: 'Challan #', dataIndex: 'challan_number', key: 'challan_number' },
        { title: 'Customer', dataIndex: 'customer_name', key: 'customer' },
        { title: 'Date', dataIndex: 'challan_date', key: 'date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
        { title: 'Total Qty', dataIndex: 'total_quantity', key: 'qty' },
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
                <h1>Delivery Challans</h1>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleNewChallan}>
                    New Challan
                </Button>
            </div>

            <Table columns={columns} dataSource={challans} loading={loading} rowKey="id" />

            <Modal title={editingChallan ? 'Edit Delivery Challan' : 'New Delivery Challan'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()} width={900}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="challan_number" label="Challan #" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                        <Input placeholder="e.g. DC-0001/26" style={{ width: 160 }} />
                    </Form.Item>
                    <Space align="start">
                        <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]} style={{ width: 300 }}>
                            <Select showSearch optionFilterProp="children">
                                {customers.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="challan_date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
                            <DatePicker />
                        </Form.Item>
                        <Form.Item name="po_number" label="PO Number">
                            <Input placeholder="e.g. PO-12345" style={{ width: 160 }} />
                        </Form.Item>
                    </Space>

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
                                    <div key={key} style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 16, paddingBottom: 16 }}>
                                        <Space style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                            <Form.Item {...restField} name={[name, 'item_id']} rules={[{ required: true, message: 'Select item' }]}>
                                                <Select
                                                    placeholder="Item"
                                                    style={{ width: 300 }}
                                                    showSearch
                                                    optionFilterProp="children"
                                                    onChange={(itemId) => {
                                                        const item = items.find(i => i.id === itemId);
                                                        if (item) {
                                                            const currentItems = form.getFieldValue('items') || [];
                                                            currentItems[name] = {
                                                                ...currentItems[name],
                                                                description: item.description || '',
                                                                brand: item.brand_name || ''
                                                            };
                                                            form.setFieldsValue({ items: currentItems });
                                                        }
                                                    }}
                                                >
                                                    {items.map(i => <Select.Option key={i.id} value={i.id}>{i.name} ({i.code})</Select.Option>)}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'brand']}>
                                                <Input placeholder="Brand" style={{ width: 120 }} />
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'quantity']} rules={[{ required: true, message: 'Enter qty' }]}>
                                                <InputNumber placeholder="Qty" min={1} />
                                            </Form.Item>
                                            <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} />
                                        </Space>
                                        <Form.Item {...restField} name={[name, 'description']} style={{ marginBottom: 0 }}>
                                            <Input.TextArea placeholder="Item Description" autoSize={{ minRows: 1, maxRows: 3 }} />
                                        </Form.Item>
                                    </div>
                                ))}
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Add Item</Button>
                                <div style={{ color: '#ff4d4f', marginTop: 8 }}>
                                    <Form.ErrorList errors={errors} />
                                </div>
                            </>
                        )}
                    </Form.List>

                    <Form.Item name="terms_and_conditions" label="Terms and Conditions" style={{ marginTop: 20 }}>
                        <Input.TextArea rows={4} placeholder="Select a customer to auto-fill, or enter manually" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Print Preview"
                open={isPreviewVisible}
                onCancel={() => {
                    setIsPreviewVisible(false);
                    setPrintData(null);
                }}
                width={900}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            {currentCompany?.letterhead_path && (
                                <Switch
                                    checked={printWithLetterhead}
                                    onChange={setPrintWithLetterhead}
                                    checkedChildren="With Letterhead"
                                    unCheckedChildren="Without Letterhead"
                                />
                            )}
                        </div>
                        <Space>
                            <Button onClick={() => { setIsPreviewVisible(false); setPrintData(null); }}>Close</Button>
                            <Button icon={<PrinterOutlined />} onClick={handleSavePDF}>Save as PDF</Button>
                            <Button type="primary" onClick={actualPrint}>Print</Button>
                        </Space>
                    </div>
                }
                className="print-preview-modal"
            >
                <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', background: '#f5f5f5' }}>
                    <div className="preview-page-wrapper">
                        {printData && (
                            <PrintTemplate
                                type="challan"
                                data={printData}
                                company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                                withLetterhead={printWithLetterhead}
                            />
                        )}
                    </div>
                </div>
            </Modal>

            {/* Hidden print container — revealed by @media print CSS for PDF/Print capture */}
            <div id="print-container">
                {printData && (
                    <PrintTemplate
                        type="challan"
                        data={printData}
                        company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                        withLetterhead={printWithLetterhead}
                    />
                )}
            </div>

        </div >
    );
};

export default DeliveryChallans;
