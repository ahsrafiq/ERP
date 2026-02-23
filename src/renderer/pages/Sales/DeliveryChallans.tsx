import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, InputNumber, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, PrinterOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import PrintTemplate from '../../components/PrintTemplate';

const DeliveryChallans: React.FC = () => {
    const { currentCompany, companies, user, fiscalYear } = useApp();
    const [challans, setChallans] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingChallan, setEditingChallan] = useState<any>(null);
    const [form] = Form.useForm();
    const [printData, setPrintData] = useState<any>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

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

    const loadNextChallanNumber = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.deliveryChallans.getNextNumber(currentCompany.id, fiscalYear);
        if (result.success && result.data) form.setFieldValue('challan_number', result.data);
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
        { title: 'Total Qty', dataIndex: 'total_quantity', key: 'qty' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => (
                <Space>
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
                <Button type="primary" icon={<PlusOutlined />} onClick={async () => {
                    setEditingChallan(null);
                    form.resetFields();
                    setModalVisible(true);
                    await loadNextChallanNumber();
                }}>
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
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                        <Form.Item {...restField} name={[name, 'item_id']} rules={[{ required: true, message: 'Select item' }]}>
                                            <Select placeholder="Item" style={{ width: 400 }}>
                                                {items.map(i => <Select.Option key={i.id} value={i.id}>{i.name} ({i.code})</Select.Option>)}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'quantity']} rules={[{ required: true, message: 'Enter qty' }]}>
                                            <InputNumber placeholder="Qty" min={1} />
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

                    <Form.Item name="notes" label="Notes" style={{ marginTop: 20 }}>
                        <Input.TextArea />
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
                        {printData && <PrintTemplate type="challan" data={printData} company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany} />}
                    </div>
                </div>
            </Modal>

            <div id="print-container">
                {printData && <PrintTemplate type="challan" data={printData} company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany} />}
            </div>
        </div>
    );
};

export default DeliveryChallans;
