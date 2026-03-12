import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, InputNumber, message, Popconfirm, Row, Col, Tag, AutoComplete, Checkbox, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, FileTextOutlined, CheckCircleOutlined, MinusCircleOutlined, LockOutlined, StopOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PrintTemplate from '../../components/PrintTemplate';

const VALIDITY_STORAGE_KEY = 'erp_validity_suggestions';
const REMARKS_STORAGE_KEY = 'erp_remarks_suggestions';

const DEFAULT_REMARKS = ['Ready Stock', 'Not Available', 'Convey later'];

function loadSuggestions(key: string, defaults: string[] = []): string[] {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                const merged = [...new Set([...defaults, ...arr])];
                return merged;
            }
        }
    } catch { /* ignore */ }
    return defaults;
}

function saveSuggestion(key: string, value: string, defaults: string[] = []) {
    if (!value?.trim()) return;
    const existing = loadSuggestions(key, defaults);
    if (!existing.includes(value.trim())) {
        existing.push(value.trim());
        localStorage.setItem(key, JSON.stringify(existing));
    }
}

const SalesQuotations: React.FC = () => {
    const { currentCompany, companies, user, fiscalYear } = useApp();
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingQuotation, setEditingQuotation] = useState<any>(null);
    const [form] = Form.useForm();
    const [printData, setPrintData] = useState<any>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [contentScale, setContentScale] = useState<number>(1);
    const [printWithLetterhead, setPrintWithLetterhead] = useState(true);

    // Admin password delete
    const [deletePasswordModal, setDeletePasswordModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [adminPassword, setAdminPassword] = useState('');

    // DC from quotation - item selection
    const [dcSelectionModal, setDcSelectionModal] = useState(false);
    const [dcSourceQuotation, setDcSourceQuotation] = useState<any>(null);
    const [dcSelectedItems, setDcSelectedItems] = useState<number[]>([]);

    // Autocomplete suggestions
    const [validitySuggestions, setValiditySuggestions] = useState<string[]>([]);
    const [remarksSuggestions, setRemarksSuggestions] = useState<string[]>([]);

    const watchedCustomerId = Form.useWatch('customer_id', form);

    // Section permissions (Sales)
    const isAdminUser = user?.role_id === 1 || user?.role === 'admin' || user?.username === 'admin';
    const sectionPerms = (user as any)?.section_permissions || {};
    const salesPerm: string = isAdminUser ? 'all' : (sectionPerms.sales || 'read');
    const canCreateOrEdit = isAdminUser || salesPerm === 'write' || salesPerm === 'edit' || salesPerm === 'all';
    const canEditOrDelete = isAdminUser || salesPerm === 'edit' || salesPerm === 'all';
    const isReadOnlySection = !isAdminUser && salesPerm === 'read';

    useEffect(() => {
        setValiditySuggestions(loadSuggestions(VALIDITY_STORAGE_KEY));
        setRemarksSuggestions(loadSuggestions(REMARKS_STORAGE_KEY, DEFAULT_REMARKS));
    }, []);

    useEffect(() => {
        if (currentCompany) {
            loadQuotations();
            loadCustomers();
            loadItems();
            loadBrands();
        }
    }, [currentCompany]);

    useEffect(() => {
        if (!modalVisible) return;

        if (watchedCustomerId == null || watchedCustomerId === '') {
            form.setFieldsValue({ terms_and_conditions: [] });
            return;
        }

        const id = Number(watchedCustomerId);
        if (!id) return;

        const parseTerms = (raw: any): string[] => {
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') {
                try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch { /* legacy */ }
                return raw.trim() ? [raw] : [];
            }
            return [];
        };

        const fromList = customers.find((c: any) => c.id === id);
        if (fromList && fromList.terms_and_conditions != null) {
            form.setFieldsValue({ terms_and_conditions: parseTerms(fromList.terms_and_conditions) });
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const result = await (window as any).electronAPI.db.customers.getById(id);
                if (cancelled) return;
                if (result?.success && result?.data) {
                    form.setFieldsValue({ terms_and_conditions: parseTerms(result.data.terms_and_conditions) });
                }
            } catch (_) { }
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

    const loadBrands = async () => {
        const result = await (window as any).electronAPI.db.brands.getAll();
        if (result.success) setBrands(result.data || []);
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
            const pathResult = await (window as any).electronAPI.db.files.getSavePath('Quotation.pdf');
            if (!pathResult.success) return;
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

    const loadNextQuotationNumber = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.salesQuotations.getNextNumber(currentCompany.id, fiscalYear);
        if (result.success && result.data) form.setFieldValue('quotation_number', result.data);
    };

    const handleEdit = async (record: any) => {
        const result = await (window as any).electronAPI.db.salesQuotations.getById(record.id);
        if (result.success) {
            setEditingQuotation(result.data);
            let terms: string[] = [];
            const raw = result.data.terms_and_conditions;
            if (raw) { try { const arr = JSON.parse(raw); terms = Array.isArray(arr) ? arr : [raw]; } catch { terms = [raw]; } }
            form.setFieldsValue({
                ...result.data,
                quotation_date: dayjs(result.data.quotation_date),
                terms_and_conditions: terms,
            });
            setModalVisible(true);
        } else {
            message.error('Failed to fetch quotation details');
        }
    };

    const handleCreateChallan = async (record: any) => {
        const hasExistingDc = (record.delivery_challan_count ?? 0) > 0;

        const proceed = async () => {
            try {
                const result = await (window as any).electronAPI.db.salesQuotations.getById(record.id);
                if (result.success && result.data && result.data.items?.length) {
                    setDcSourceQuotation(result.data);
                    setDcSelectedItems(result.data.items.map((_: any, i: number) => i));
                    setDcSelectionModal(true);
                } else {
                    message.error('Quotation has no items');
                }
            } catch {
                message.error('Failed to load quotation');
            }
        };

        if (hasExistingDc) {
            Modal.confirm({
                title: 'Delivery challan already exists',
                content: 'A delivery challan already exists for this quotation. Do you want to create another one as a duplicate?',
                okText: 'Create Duplicate DC',
                cancelText: 'Cancel',
                onOk: proceed,
            });
        } else {
            proceed();
        }
    };

    const confirmCreateDC = async () => {
        if (!dcSourceQuotation || dcSelectedItems.length === 0) {
            message.warning('Select at least one item');
            return;
        }
        try {
            const selectedItems = dcSelectedItems.map(i => dcSourceQuotation.items[i]);
            const result = await (window as any).electronAPI.db.deliveryChallans.createFromQuotation(
                dcSourceQuotation.id, user?.id, selectedItems.map((it: any) => it.item_id)
            );
            if (result.success && result.data) {
                message.success(`Delivery Challan ${result.data.challan_number} created`);
                setDcSelectionModal(false);
                setDcSourceQuotation(null);
                navigate('/sales/delivery-challans');
            } else {
                message.error(result.error || 'Failed to create delivery challan');
            }
        } catch (error: any) {
            message.error(error.message || 'Failed to create delivery challan');
        }
    };

    const handleRequestDelete = (id: number) => {
        setPendingDeleteId(id);
        setAdminPassword('');
        setDeletePasswordModal(true);
    };

    const handleConfirmDelete = async () => {
        if (adminPassword !== 'admin123') {
            message.error('Incorrect admin password');
            setAdminPassword('');
            return;
        }
        if (pendingDeleteId == null) return;
        try {
            const result = await (window as any).electronAPI.db.salesQuotations.delete(pendingDeleteId);
            if (result.success) {
                message.success('Quotation deleted');
                loadQuotations();
            } else {
                message.error(result.error || 'Failed to delete');
            }
        } catch {
            message.error('Failed to delete');
        } finally {
            setDeletePasswordModal(false);
            setPendingDeleteId(null);
            setAdminPassword('');
        }
    };

    const handleDisable = async (id: number) => {
        try {
            // Fetch the full quotation first, then update with status changed
            const fetched = await (window as any).electronAPI.db.salesQuotations.getById(id);
            if (!fetched.success || !fetched.data) {
                message.error('Failed to load quotation');
                return;
            }
            const data = fetched.data;
            const result = await (window as any).electronAPI.db.salesQuotations.update(id, {
                ...data,
                quotation_number: data.quotation_number,
                status: 'cancelled',
            });
            if (result.success) {
                message.success('Quotation disabled');
                loadQuotations();
            } else {
                message.error(result.error || 'Failed to disable');
            }
        } catch {
            message.error('Failed to disable');
        }
    };

    const handleSave = async (values: any) => {
        if (!currentCompany) return;
        try {
            // Save validity suggestion
            if (values.quotation_validity?.trim()) {
                saveSuggestion(VALIDITY_STORAGE_KEY, values.quotation_validity);
                setValiditySuggestions(loadSuggestions(VALIDITY_STORAGE_KEY));
            }

            // Save any new remarks suggestions
            values.items?.forEach((item: any) => {
                if (item.availability?.trim()) {
                    saveSuggestion(REMARKS_STORAGE_KEY, item.availability, DEFAULT_REMARKS);
                }
            });
            setRemarksSuggestions(loadSuggestions(REMARKS_STORAGE_KEY, DEFAULT_REMARKS));

            const quotationData = {
                ...values,
                company_id: currentCompany.id,
                quotation_number: values.quotation_number?.trim?.() || undefined,
                fiscal_year: fiscalYear,
                quotation_date: values.quotation_date.format('YYYY-MM-DD'),
                expiry_date: values.quotation_date && values.quotation_validity
                    ? computeExpiryDate(values.quotation_date, values.quotation_validity)
                    : undefined,
                created_by: user?.id,
                terms_and_conditions: JSON.stringify((values.terms_and_conditions || []).filter((t: string) => t?.trim())),
            };

            delete quotationData.payment_terms;

            let subtotal = 0;
            quotationData.items?.forEach((item: any) => {
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                item.tax_rate = 0;
                item.tax_amount = 0;
                item.line_total = lineTotal;
                subtotal += lineTotal;
            });
            quotationData.subtotal = subtotal;
            quotationData.tax_amount = 0;
            quotationData.total_amount = subtotal;

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

    const computeExpiryDate = (quoDate: any, validity: string): string | undefined => {
        if (!quoDate || !validity) return undefined;
        const match = validity.match(/^(\d+)\s*days?$/i);
        if (match) {
            return dayjs(quoDate).add(Number(match[1]), 'day').format('YYYY-MM-DD');
        }
        return undefined;
    };

    const getItemsForBrand = (brandId: number | undefined) => {
        if (!brandId) return items;
        return items.filter(i => i.brand_id === brandId);
    };

    const columns = [
        { title: 'Quo #', dataIndex: 'quotation_number', key: 'quo_number' },
        { title: 'Customer', dataIndex: 'customer_name', key: 'customer' },
        { title: 'Date', dataIndex: 'quotation_date', key: 'date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'Amount', dataIndex: 'total_amount', key: 'amount', render: (a: number) => a?.toLocaleString() },
        {
            title: 'DC',
            key: 'dc',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: any) => {
                const hasDc = (record.delivery_challan_count ?? 0) > 0;
                return hasDc ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>DC made</Tag>
                ) : (
                    <Tag color="default" icon={<MinusCircleOutlined />}>No DC</Tag>
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => {
                const isDisabled = record.status === 'cancelled';
                if (isDisabled) {
                    return <Tag color="red">Disabled</Tag>;
                }
                if (isReadOnlySection) {
                    // Read-only: only allow viewing/printing
                    return (
                        <Space>
                            <Button icon={<EyeOutlined />} onClick={() => handlePrint(record)} title="View Quotation" />
                        </Space>
                    );
                }
                return (
                    <Space>
                        <Button icon={<FileTextOutlined />} onClick={() => handleCreateChallan(record)} title="Create Delivery Challan" />
                        <Button icon={<PrinterOutlined />} onClick={() => handlePrint(record)} title="Print" />
                        {canCreateOrEdit && (
                            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} title="Edit" />
                        )}
                        {canEditOrDelete && (
                            <>
                                <Popconfirm title="Are you sure you want to disable this quotation? This cannot be undone." onConfirm={() => handleDisable(record.id)} okText="Yes, Disable" cancelText="Cancel">
                                    <Button icon={<StopOutlined />} title="Disable" />
                                </Popconfirm>
                                <Button danger icon={<DeleteOutlined />} onClick={() => handleRequestDelete(record.id)} title="Delete (Admin)" />
                            </>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <h1>Sales Quotations</h1>
                {!isReadOnlySection && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={async () => {
                        setEditingQuotation(null);
                        form.resetFields();
                        setModalVisible(true);
                        await loadNextQuotationNumber();
                    }}>
                        New Quotation
                    </Button>
                )}
            </div>

            <Table columns={columns} dataSource={quotations} loading={loading} rowKey="id" />

            <Modal title={editingQuotation ? 'Edit Quotation' : 'New Quotation'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()} width={1100} destroyOnClose>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                >
                    <Row gutter={16}>
                        <Col span={4}>
                            <Form.Item name="quotation_number" label="Quotation #" rules={[{ required: true, message: 'Required' }]}>
                                <Input placeholder="e.g. QUO-0001/26" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
                                <Select
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                                    }
                                    placeholder="Type to search customer..."
                                >
                                    {customers.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="quotation_date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="quotation_validity" label="Quotation Validity" rules={[{ required: true, message: 'Enter validity' }]}>
                                <AutoComplete
                                    options={validitySuggestions.filter(s => s).map(s => ({ value: s }))}
                                    filterOption={(input, option) =>
                                        (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                                    }
                                    placeholder="e.g. 30 days"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.List
                        name="items"
                        rules={[{ validator: async (_, names) => { if (!names || names.length < 1) return Promise.reject(new Error('At least one item is required')); } }]}
                    >
                        {(fields, { add, remove }, { errors }) => (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#fafafa', borderBottom: '1px solid #d9d9d9' }}>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 140 }}>Brand</th>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 200 }}>Item</th>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 220 }}>Description</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: 70 }}>Qty</th>
                                                <th style={{ padding: '8px', textAlign: 'center', width: 100 }}>Price</th>
                                                <th style={{ padding: '8px', textAlign: 'left', width: 150 }}>Remarks</th>
                                                <th style={{ padding: '8px', width: 40 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map(({ key, name, ...restField }) => {
                                                const currentBrandId = form.getFieldValue(['items', name, 'brand_id']);
                                                const filteredItems = getItemsForBrand(currentBrandId);
                                                return (
                                                    <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'brand_id']} style={{ marginBottom: 0 }}>
                                                                <Select
                                                                    placeholder="Brand"
                                                                    allowClear
                                                                    showSearch
                                                                    optionFilterProp="children"
                                                                    style={{ width: '100%' }}
                                                                    onChange={(brandId) => {
                                                                        const currentItems = form.getFieldValue('items') || [];
                                                                        currentItems[name] = { ...currentItems[name], brand_id: brandId, item_id: undefined, description: '', unit_price: undefined, brand: brands.find(b => b.id === brandId)?.name || '' };
                                                                        form.setFieldsValue({ items: [...currentItems] });
                                                                    }}
                                                                >
                                                                    {brands.map(b => <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>)}
                                                                </Select>
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'item_id']} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                                <Select
                                                                    placeholder="Item"
                                                                    showSearch
                                                                    optionFilterProp="children"
                                                                    style={{ width: '100%' }}
                                                                    onChange={(itemId) => {
                                                                        const item = items.find(i => i.id === itemId);
                                                                        if (item) {
                                                                            const currentItems = form.getFieldValue('items') || [];
                                                                            currentItems[name] = {
                                                                                ...currentItems[name],
                                                                                item_id: itemId,
                                                                                description: item.description || '',
                                                                                brand: item.brand_name || '',
                                                                                brand_id: item.brand_id || currentItems[name]?.brand_id,
                                                                                unit_price: item.selling_price || 0,
                                                                            };
                                                                            form.setFieldsValue({ items: [...currentItems] });
                                                                        }
                                                                    }}
                                                                >
                                                                    {filteredItems.map(i => <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>)}
                                                                </Select>
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'description']} style={{ marginBottom: 0 }}>
                                                                <Input placeholder="Description" />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'quantity']} rules={[{ required: true, message: 'Qty' }]} style={{ marginBottom: 0 }}>
                                                                <InputNumber placeholder="Qty" min={1} style={{ width: '100%' }} />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'unit_price']} rules={[{ required: true, message: 'Price' }]} style={{ marginBottom: 0 }}>
                                                                <InputNumber placeholder="Price" min={0} style={{ width: '100%' }} />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <Form.Item {...restField} name={[name, 'availability']} style={{ marginBottom: 0 }}>
                                                                <AutoComplete
                                                                    options={remarksSuggestions.map(s => ({ value: s }))}
                                                                    filterOption={(input, option) =>
                                                                        (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                    placeholder="Remarks"
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </Form.Item>
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f', fontSize: 16 }} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginTop: 8 }}>Add Item</Button>
                                <div style={{ color: '#ff4d4f', marginTop: 8 }}>
                                    <Form.ErrorList errors={errors} />
                                </div>
                            </>
                        )}
                    </Form.List>

                    <div style={{ marginTop: 20 }}>
                        <label style={{ fontWeight: 500 }}>Terms and Conditions</label>
                        <Form.List name="terms_and_conditions" rules={[{ validator: async (_, list) => { if (!list || list.filter((t: string) => t?.trim()).length === 0) throw new Error('Add at least one term'); } }]}>
                            {(fields, { add, remove }, { errors }) => (
                                <>
                                    {fields.map((field) => (
                                        <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <Form.Item {...field} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, whitespace: true, message: 'Enter a term or remove this row' }]}>
                                                <Input placeholder={`Term ${field.name + 1}`} />
                                            </Form.Item>
                                            <MinusCircleOutlined onClick={() => remove(field.name)} style={{ marginTop: 8, color: '#ff4d4f' }} />
                                        </div>
                                    ))}
                                    <Button type="dashed" onClick={() => add('')} block icon={<PlusOutlined />} size="small">Add Term</Button>
                                    <Form.ErrorList errors={errors} />
                                </>
                            )}
                        </Form.List>
                    </div>
                </Form>
            </Modal>

            {/* Admin password for delete */}
            <Modal
                title="Admin Authorization Required"
                open={deletePasswordModal}
                onCancel={() => { setDeletePasswordModal(false); setPendingDeleteId(null); }}
                onOk={handleConfirmDelete}
                okText="Delete"
                okButtonProps={{ danger: true }}
            >
                <p>Enter admin password to delete this quotation:</p>
                <Input.Password
                    prefix={<LockOutlined />}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Admin password"
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmDelete(); }}
                    autoFocus
                />
            </Modal>

            {/* DC item selection modal */}
            <Modal
                title="Create Delivery Challan — Select Items"
                open={dcSelectionModal}
                onCancel={() => { setDcSelectionModal(false); setDcSourceQuotation(null); }}
                onOk={confirmCreateDC}
                okText="Create DC"
                width={700}
            >
                {dcSourceQuotation?.items && (
                    <Table
                        dataSource={dcSourceQuotation.items.map((it: any, i: number) => ({ ...it, _idx: i }))}
                        rowKey="_idx"
                        pagination={false}
                        size="small"
                        rowSelection={{
                            selectedRowKeys: dcSelectedItems,
                            onChange: (keys) => setDcSelectedItems(keys as number[]),
                        }}
                        columns={[
                            { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
                            { title: 'Description', dataIndex: 'description', key: 'description' },
                            { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
                            { title: 'Brand', dataIndex: 'brand', key: 'brand' },
                        ]}
                    />
                )}
            </Modal>

            <Modal
                title="Print Preview"
                open={isPreviewVisible}
                onCancel={() => {
                    setIsPreviewVisible(false);
                    setPrintData(null);
                }}
                width={900}
                footer={[
                    <Button key="cancel" onClick={() => setIsPreviewVisible(false)}>Close</Button>,
                    <Button key="pdf" icon={<PrinterOutlined />} onClick={handleSavePDF}>Save as PDF</Button>,
                    <Button key="print" type="primary" onClick={actualPrint}>Print</Button>
                ]}
                className="print-preview-modal"
            >
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span>Scale:</span>
                    <Select value={contentScale} onChange={v => setContentScale(v)} style={{ width: 90 }} options={[{ value: 0.5, label: '50%' }, { value: 0.6, label: '60%' }, { value: 0.7, label: '70%' }, { value: 0.8, label: '80%' }, { value: 0.9, label: '90%' }, { value: 1, label: '100%' }]} />
                    <span>Letterhead:</span>
                    <Switch
                        checked={printWithLetterhead}
                        onChange={setPrintWithLetterhead}
                        checkedChildren="With"
                        unCheckedChildren="Without"
                    />
                </div>
                <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', background: '#f5f5f5' }}>
                    <div className="preview-page-wrapper">
                        {printData && (
                            <PrintTemplate
                                type="quotation"
                                data={printData}
                                company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                                withLetterhead={printWithLetterhead}
                                contentScale={contentScale}
                            />
                        )}
                    </div>
                </div>
            </Modal>

            <div id="print-container">
                {printData && (
                    <PrintTemplate
                        type="quotation"
                        data={printData}
                        company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                        withLetterhead={printWithLetterhead}
                        contentScale={contentScale}
                    />
                )}
            </div>

        </div>
    );
};

export default SalesQuotations;
