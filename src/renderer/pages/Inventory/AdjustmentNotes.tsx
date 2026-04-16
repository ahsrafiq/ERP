import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, InputNumber, message, notification, Tag, Typography } from 'antd';
const { Title, Text } = Typography;
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusSquareOutlined, SearchOutlined, CloseOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { filterRowsByOperationalFiscalYear } from '../../utils/fiscalYearFilter';

const AdjustmentNotes: React.FC = () => {
    const { currentCompany, user, fiscalYear, minimizeModal, globalRefreshKey } = useApp();
    const location = useLocation();
    
    const [notes, setNotes] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [modalVisible, setModalVisible] = useState(false);
    const [editingNote, setEditingNote] = useState<any>(null);
    const [form] = Form.useForm();
    
    const [deletePasswordModal, setDeletePasswordModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const passwordInputRef = React.useRef<any>(null);

    useEffect(() => {
        if (deletePasswordModal) {
            setTimeout(() => {
                passwordInputRef.current?.select();
                passwordInputRef.current?.focus();
            }, 100);
        }
    }, [deletePasswordModal]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                // If modal is visible, maybe print the note? 
                // For now, Adjustment Notes don't have a print template yet in this codebase, 
                // but let's keep the listener for consistency.
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isAdminUser = user?.role_id === 1 || user?.role === 'admin' || user?.username === 'admin';
    const sectionPerms = (user as any)?.section_permissions || {};
    const inventoryPerm = isAdminUser ? 'all' : (sectionPerms.inventory || 'read');
    const canCreateOrEdit = isAdminUser || inventoryPerm === 'write' || inventoryPerm === 'edit' || inventoryPerm === 'all';
    const canEditOrDelete = isAdminUser || inventoryPerm === 'edit' || inventoryPerm === 'all';
    const isReadOnlySection = !isAdminUser && inventoryPerm === 'read';

    useEffect(() => {
        if (currentCompany) {
            loadNotes();
            loadItems();
            loadBrands();
        }
    }, [currentCompany, location.pathname, fiscalYear, globalRefreshKey]);

    const loadNotes = async () => {
        if (!currentCompany) return;
        setLoading(true);
        try {
            const result = await (window as any).electronAPI.db.adjustmentNotes.getAll(currentCompany.id);
            if (result.success) {
                setNotes(filterRowsByOperationalFiscalYear(result.data || [], fiscalYear));
            }
        } catch (error) {
            notification.error({ message: 'Error', description: 'Failed to load adjustment notes' });
        } finally {
            setLoading(false);
        }
    };

    const loadItems = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
        if (result.success) setItems(result.data || []);
    };

    const loadBrands = async () => {
        try {
            const result = await (window as any).electronAPI.db.brands.getAll();
            if (result?.success && Array.isArray(result.data)) setBrands(result.data || []);
            else setBrands([]);
        } catch (_) { setBrands([]); }
    };

    const [noteStep, setNoteStep] = useState<1 | 2>(1);

    const handleNewNote = async () => {
        setEditingNote(null);
        form.resetFields();
        setNoteStep(1); // Reset to selection step
        setModalVisible(true);

        if (currentCompany) {
            try {
                const result = await (window as any).electronAPI.db.adjustmentNotes.getNextNumber(currentCompany.id, fiscalYear);
                form.setFieldsValue({
                    adjustment_number: result.data || result, 
                    adjustment_date: dayjs(),
                });
            } catch (err) {
                console.error('Failed to load next note number:', err);
                form.setFieldsValue({ adjustment_date: dayjs() });
            }
        }
    };

    const handleEdit = async (record: any) => {
        const result = await (window as any).electronAPI.db.adjustmentNotes.getById(record.id);
        if (result.success) {
            setEditingNote(result.data);
            setNoteStep(2); // Directly to form for editing
            const itemsWithBrandId = (result.data.items || []).map((row: any) => {
                const master = items.find((i: any) => i.id === row.item_id);
                return { ...row, brand_id: master?.brand_id ?? row.brand_id };
            });
            form.setFieldsValue({
                ...result.data,
                items: itemsWithBrandId,
                adjustment_date: dayjs(result.data.adjustment_date),
            });
            setModalVisible(true);
        } else {
            notification.error({ message: 'Error', description: 'Failed to fetch note details' });
        }
    };

    const handleRequestDelete = (id: number) => {
        setPendingDeleteId(id);
        setAdminPassword('');
        setDeletePasswordModal(true);
    };

    const handleConfirmDelete = async () => {
        const verify = await (window as any).electronAPI.db.auth.verifyAdminPassword(adminPassword);
        if (!verify.success || !verify.data) {
            notification.error({ message: 'Error', description: 'Incorrect admin password' });
            setAdminPassword('');
            return;
        }
        if (pendingDeleteId == null) return;
        try {
            const result = await (window as any).electronAPI.db.adjustmentNotes.delete(pendingDeleteId);
            if (result.success) {
                message.success('Adjustment Note deleted successfully');
                loadNotes();
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to delete note' });
            }
        } catch (error: any) {
            notification.error({ message: 'Error', description: error?.message || 'Failed to delete note' });
        } finally {
            setDeletePasswordModal(false);
            setPendingDeleteId(null);
            setAdminPassword('');
        }
    };

    const handleSave = async (values: any) => {
        if (!currentCompany) return;
        try {
            const noteData = {
                ...values,
                company_id: currentCompany.id,
                adjustment_number: values.adjustment_number?.trim?.() || undefined,
                fiscal_year: fiscalYear,
                adjustment_date: values.adjustment_date.format('YYYY-MM-DD'),
                created_by: user?.id,
            };

            noteData.items = (noteData.items || []).map((item: any) => {
                const brandName = (item.brand_id != null && item.brand_id !== '')
                    ? (brands.find((b: any) => Number(b.id) === Number(item.brand_id))?.name)
                    : null;
                const fallbackBrand = items.find((i: any) => i.id === item.item_id)?.brand_name;
                return { ...item, brand: brandName ?? fallbackBrand ?? item.brand };
            });

            if (editingNote) {
                const result = await (window as any).electronAPI.db.adjustmentNotes.update(editingNote.id, noteData);
                if (result.success) {
                    message.success('Adjustment Note updated successfully');
                    setModalVisible(false);
                    setEditingNote(null);
                    loadNotes();
                } else {
                    notification.error({ message: 'Error', description: result.error || 'Failed to update note' });
                }
            } else {
                const result = await (window as any).electronAPI.db.adjustmentNotes.create(noteData);
                if (result.success) {
                    message.success('Adjustment Note created successfully');
                    setModalVisible(false);
                    setEditingNote(null);
                    loadNotes();
                } else {
                    notification.error({ message: 'Error', description: result.error || 'Failed to create note' });
                }
            }
        } catch (error: any) {
            console.error('Save error:', error);
            notification.error({ message: 'Error', description: error.message || 'Operation failed' });
        }
    };

    const columns = [
        { title: 'Note #', dataIndex: 'adjustment_number', key: 'adjustment_number' },
        { 
            title: 'Type', 
            dataIndex: 'adjustment_type', 
            key: 'adjustment_type',
            render: (type: string) => <Tag color={type === 'IN' ? 'green' : 'red'}>{type === 'IN' ? 'Adjustment IN' : 'Adjustment OUT'}</Tag>
        },
        { title: 'Date', dataIndex: 'adjustment_date', key: 'date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'Remarks', dataIndex: 'remarks', key: 'remarks' },
        { title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => {
                if (isReadOnlySection) return null;
                return (
                    <Space>
                        {canCreateOrEdit && (
                            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} title="Edit" />
                        )}
                        {canEditOrDelete && (
                            <Button danger icon={<DeleteOutlined />} title="Delete" onClick={() => handleRequestDelete(record.id)} />
                        )}
                    </Space>
                );
            },
        },
    ];

    const filteredNotes = notes.filter(n =>
        (n.adjustment_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.remarks || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <h1 style={{ margin: 0 }}>Adjustment Notes</h1>
                    <Input
                        placeholder="Search by note # or remarks..."
                        prefix={<SearchOutlined />}
                        style={{ width: 250 }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        allowClear
                    />
                </div>
                <Space>
                    {!isReadOnlySection && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleNewNote}>
                            New Adjustment
                        </Button>
                    )}
                </Space>
            </div>

            <Table columns={columns} dataSource={filteredNotes} loading={loading} rowKey="id" />

            <Modal 
                title={editingNote ? 'Edit Adjustment Note' : 'New Adjustment Note'} 
                open={modalVisible} 
                onCancel={() => {
                  const noteNum = form.getFieldValue('adjustment_number') || 'New Note';
                  setModalVisible(false);
                  minimizeModal({
                    id: editingNote ? `adj-edit-${editingNote.id}` : 'adj-new',
                    title: editingNote ? `Edit Note ${noteNum}` : `New Note ${noteNum}`,
                    onRestore: () => {
                      setEditingNote(editingNote);
                      setModalVisible(true);
                      setNoteStep(noteStep);
                    }
                  });
                }}
                maskClosable={true}
                onOk={() => noteStep === 1 ? null : form.submit()} 
                width={noteStep === 1 ? 600 : 800} 
                footer={noteStep === 1 ? null : [
                    <Button key="back" onClick={() => setNoteStep(1)}>Change Type</Button>,
                    <Button key="cancel" onClick={() => setModalVisible(false)}>Cancel</Button>,
                    <Button key="submit" type="primary" onClick={() => form.submit()}>Save</Button>
                ]}
                closeIcon={
                  <Space>
                    <MinusSquareOutlined 
                      style={{ fontSize: 18, color: '#1890ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalVisible(false);
                        const values = form.getFieldsValue();
                        const noteNum = values.adjustment_number || 'New Note';
                        minimizeModal({
                          id: editingNote ? `adj-edit-${editingNote.id}` : 'adj-new',
                          title: editingNote ? `Edit Note ${noteNum}` : `New Note ${noteNum}`,
                          onRestore: () => {
                            setEditingNote(editingNote);
                            setModalVisible(true);
                            setNoteStep(noteStep);
                          }
                        });
                      }} 
                    />
                    <CloseOutlined style={{ fontSize: 18 }} onClick={() => setModalVisible(false)} />
                  </Space>
                }
            >
                {noteStep === 1 ? (
                    <div style={{ padding: '30px 0', textAlign: 'center' }}>
                        <Title level={4} style={{ marginBottom: 32 }}>Select Adjustment Type</Title>
                        <Space size={32}>
                            <Button 
                                type="primary" 
                                size="large" 
                                style={{ 
                                    width: 220, 
                                    height: 140, 
                                    background: '#52c41a', 
                                    borderColor: '#52c41a',
                                    borderRadius: 12,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.25)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer'
                                }}
                                className="adj-type-btn"
                                onClick={() => {
                                    form.setFieldsValue({ adjustment_type: 'IN' });
                                    setNoteStep(2);
                                }}
                            >
                                <span style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, display: 'block' }}>Adjustment IN</span>
                                <span style={{ fontSize: 14, opacity: 0.9 }}>(Increase Stock)</span>
                            </Button>
                            <Button 
                                type="primary" 
                                danger 
                                size="large" 
                                style={{ 
                                    width: 220, 
                                    height: 140, 
                                    borderRadius: 12,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    boxShadow: '0 4px 12px rgba(255, 77, 79, 0.25)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer'
                                }}
                                className="adj-type-btn"
                                onClick={() => {
                                    form.setFieldsValue({ adjustment_type: 'OUT' });
                                    setNoteStep(2);
                                }}
                            >
                                <span style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, display: 'block' }}>Adjustment OUT</span>
                                <span style={{ fontSize: 14, opacity: 0.9 }}>(Decrease Stock)</span>
                            </Button>
                        </Space>
                        <style>{`
                            .adj-type-btn:hover {
                                transform: translateY(-5px) scale(1.02);
                                filter: brightness(1.05);
                            }
                            .adj-type-btn:active {
                                transform: translateY(0) scale(0.98);
                            }
                        `}</style>
                    </div>
                ) : (
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: '#fafafa', padding: '8px 16px', borderRadius: 4 }}>
                            <Tag color={form.getFieldValue('adjustment_type') === 'IN' ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>
                                {form.getFieldValue('adjustment_type') === 'IN' ? 'ADJUSTMENT IN' : 'ADJUSTMENT OUT'}
                            </Tag>
                            <Text type="secondary">To change the adjustment type, use the 'Change Type' button below.</Text>
                        </div>

                        <Space align="start" wrap>
                            <Form.Item name="adjustment_number" label="Note #" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                                <Input placeholder="e.g. ADJ-0001/26" style={{ width: 160 }} />
                            </Form.Item>
                            <Form.Item name="adjustment_date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
                                <DatePicker />
                            </Form.Item>
                            {/* Hidden field for adjustment_type since we manage it via steps */}
                            <Form.Item name="adjustment_type" hidden><Input /></Form.Item>
                        </Space>
                        <Form.Item name="remarks" label="Remarks" style={{ marginBottom: 16 }}>
                            <Input.TextArea placeholder="Enter remarks or reason for adjustment" autoSize={{ minRows: 2, maxRows: 4 }} />
                        </Form.Item>

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
                                    {fields.map(({ key, name, ...restField }) => {
                                        const rowBrandId = form.getFieldValue(['items', name, 'brand_id']);
                                        const itemsForBrand = (rowBrandId != null && rowBrandId !== '')
                                            ? items.filter((i: any) => Number(i.brand_id) === Number(rowBrandId))
                                            : items;
                                        return (
                                        <div key={key} style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 16, paddingBottom: 16 }}>
                                            <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-end', gap: 12, marginBottom: 8 }}>
                                                <Form.Item {...restField} name={[name, 'brand_id']} label="Brand" rules={[{ required: true, message: 'Select brand' }]} style={{ marginBottom: 0, minWidth: 140 }}>
                                                    <Select
                                                        placeholder="Brand"
                                                        style={{ width: 140 }}
                                                        showSearch
                                                        optionFilterProp="children"
                                                        onChange={(selectedBrandId) => {
                                                            const currentItems = form.getFieldValue('items') || [];
                                                            currentItems[name] = { ...currentItems[name], brand_id: selectedBrandId, item_id: undefined, description: '' };
                                                            form.setFieldsValue({ items: currentItems });
                                                        }}
                                                    >
                                                        {(brands || []).map((b: any) => <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>)}
                                                    </Select>
                                                </Form.Item>
                                                <Form.Item {...restField} name={[name, 'item_id']} label="Item" rules={[{ required: true, message: 'Select item' }]} style={{ marginBottom: 0, minWidth: 200, flex: 1 }}>
                                                    <Select
                                                        placeholder="Item"
                                                        style={{ width: '100%' }}
                                                        showSearch
                                                        filterOption={(input, option) =>
                                                            String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                                        }
                                                        onChange={(itemId) => {
                                                            const item = items.find((i: any) => i.id === itemId);
                                                            if (item) {
                                                                const currentItems = form.getFieldValue('items') || [];
                                                                currentItems[name] = {
                                                                    ...currentItems[name],
                                                                    description: item.description || '',
                                                                    brand_id: item.brand_id,
                                                                };
                                                                form.setFieldsValue({ items: currentItems });
                                                            }
                                                        }}
                                                    >
                                                        {itemsForBrand.map((i: any) => <Select.Option key={i.id} value={i.id}>{i.name} ({i.code})</Select.Option>)}
                                                    </Select>
                                                </Form.Item>
                                                <Form.Item {...restField} name={[name, 'quantity']} label="Qty" rules={[{ required: true, message: 'Qty' }]} style={{ marginBottom: 0, width: 100, flexShrink: 0 }}>
                                                    <InputNumber placeholder="Qty" min={0.01} style={{ width: 100 }} />
                                                </Form.Item>
                                                <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} style={{ flexShrink: 0 }} />
                                            </div>
                                            <Form.Item {...restField} name={[name, 'description']} style={{ marginBottom: 0 }}>
                                                <Input.TextArea placeholder="Item Description" autoSize={{ minRows: 1, maxRows: 3 }} />
                                            </Form.Item>
                                        </div>
                                        );
                                    })}
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Add Item</Button>
                                    <div style={{ color: '#ff4d4f', marginTop: 8 }}>
                                        <Form.ErrorList errors={errors} />
                                    </div>
                                </>
                            )}
                        </Form.List>
                    </Form>
                )}
            </Modal>

            <Modal
                title="Admin password required"
                open={deletePasswordModal}
                onCancel={() => {
                    setDeletePasswordModal(false);
                    setPendingDeleteId(null);
                    setAdminPassword('');
                }}
                onOk={handleConfirmDelete}
                okText="Delete"
                okButtonProps={{ danger: true }}
            >
                <p>Enter admin password to delete this adjustment note:</p>
                <Input.Password
                    prefix={<LockOutlined />}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Admin password"
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmDelete(); }}
                    ref={passwordInputRef}
                    autoFocus
                />
            </Modal>
        </div>
    );
};

export default AdjustmentNotes;
