import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, notification, Tag, Tooltip, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, WarningOutlined, MinusCircleOutlined, BoldOutlined, UploadOutlined, SearchOutlined, LockOutlined, MinusSquareOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { parseExcelToRows, getCol, getColNum } from '../../utils/excelImport';
import { documentMatchesFiscalYearSuffix } from '../../utils/fiscalYearFilter';

const Customers: React.FC = () => {
  const { currentCompany, user, fiscalYear, globalRefreshKey, minimizeModal } = useApp();
  const location = useLocation();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [form] = Form.useForm();

  // Advance payment modal
  const [advanceModal, setAdvanceModal] = useState(false);
  const [advanceCustomer, setAdvanceCustomer] = useState<any>(null);
  const [advanceForm] = Form.useForm();
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFormatModal, setImportFormatModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin password delete
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const passwordInputRef = React.useRef<any>(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (deletePasswordModal) {
      setTimeout(() => {
        passwordInputRef.current?.select();
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [deletePasswordModal]);

  // Section permissions (Sales)
  const isAdminUser = user?.role_id === 1 || (user as any)?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const salesPerm: string = isAdminUser ? 'all' : (sectionPerms.sales || 'read');
  const canEditOrDelete = isAdminUser || salesPerm === 'edit' || salesPerm === 'all' || salesPerm === 'write';
  const isReadOnlySection = !isAdminUser && salesPerm === 'read';

  useEffect(() => {
    if (currentCompany) {
      loadCustomers();
    }
  }, [currentCompany, globalRefreshKey, fiscalYear, location.pathname]);

  // Auto-refresh when window gains focus (useful for multi-user/multi-window sync)
  useEffect(() => {
    const handleFocus = () => {
      if (currentCompany) loadCustomers();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentCompany]);

  const loadCustomers = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const [custRes, invRes] = await Promise.all([
        (window as any).electronAPI.db.customers.getAll(currentCompany.id),
        (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id),
      ]);

      if (custRes.success) {
        const invoices = (invRes.success ? invRes.data : []) || [];
        const customersWithRemaining = (custRes.data || []).map((c: any) => {
          const customerInvoices = invoices.filter((inv: any) => 
            inv.customer_id === c.id && 
            documentMatchesFiscalYearSuffix(inv.invoice_number, fiscalYear)
          );
          const invoiceBalanceSum = customerInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.balance) || 0), 0);
          let remainingOpening = Math.round((Number(c.balance) - invoiceBalanceSum) * 100) / 100;
          if (Math.abs(remainingOpening) < 0.01) remainingOpening = 0;
          return { ...c, remaining_opening_balance: remainingOpening };
        });
        setCustomers(customersWithRemaining);
      }
    } catch { notification.error({ message: 'Error', description: 'Failed to load customers', duration: 0 }); }
    finally { setLoading(false); }
  };

  const handleSave = async (values: any) => {
    if (!currentCompany) { notification.error({ message: 'Error', description: 'Please add a company first', duration: 0 }); return; }
    try {
      const payload = {
        ...values,
        terms_and_conditions: JSON.stringify((values.terms_and_conditions || []).filter((t: string) => t?.trim())),
      };
      if (editingCustomer) {
        const result = await (window as any).electronAPI.db.customers.update(editingCustomer.id, payload);
        if (result.success) message.success('Customer updated successfully');
        else notification.error({ message: 'Error', description: result.error || 'Failed to update customer', duration: 0 });
      } else {
        const result = await (window as any).electronAPI.db.customers.create({ ...payload, company_id: currentCompany.id });
        if (result.success) message.success('Customer created successfully');
        else notification.error({ message: 'Error', description: result.error || 'Failed to create customer', duration: 0 });
      }
      setModalVisible(false);
      setEditingCustomer(null);
      form.resetFields();
      loadCustomers();
    } catch { notification.error({ message: 'Error', description: 'Operation failed', duration: 0 }); }
  };

  const handleRequestDelete = (id: number) => {
    setPendingDeleteId(id);
    setPendingDeleteIds([]);
    setAdminPassword('');
    setDeletePasswordModal(true);
  };

  const handleRequestBulkDelete = () => {
    setPendingDeleteIds(selectedRowKeys.map(k => Number(k)));
    setPendingDeleteId(null);
    setAdminPassword('');
    setDeletePasswordModal(true);
  };

  const handleConfirmDelete = async () => {
    const verify = await (window as any).electronAPI.db.auth.verifyAdminPassword(adminPassword);
    if (!verify.success || !verify.data) {
        notification.error({ message: 'Error', description: 'Incorrect admin password', duration: 0 });
        setAdminPassword('');
        return;
    }
    
    if (pendingDeleteId != null) {
      try {
        const result = await (window as any).electronAPI.db.customers.delete(pendingDeleteId);
        if (result.success) {
          message.success('Customer deleted successfully');
          loadCustomers();
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to delete customer', duration: 0 });
        }
      } catch (error) {
        notification.error({ message: 'Error', description: 'Failed to delete customer', duration: 0 });
      }
    } else if (pendingDeleteIds.length > 0) {
      try {
        const result = await (window as any).electronAPI.db.customers.deleteMultiple(pendingDeleteIds);
        if (result.success) {
          const { total, deleted, skipped } = result.data;
          if (skipped === 0) {
            message.success(`Deleted ${deleted} customers successfully`);
          } else {
            message.warning(`Deleted ${deleted} customers. ${skipped} were skipped (possibly due to existing records).`);
          }
          setSelectedRowKeys([]);
          loadCustomers();
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to delete customers', duration: 0 });
        }
      } catch (error) {
        notification.error({ message: 'Error', description: 'Failed to delete customers', duration: 0 });
      }
    }

    setDeletePasswordModal(false);
    setPendingDeleteId(null);
    setPendingDeleteIds([]);
    setAdminPassword('');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!currentCompany) { notification.error({ message: 'Error', description: 'Please select a company first', duration: 0 }); return; }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      notification.error({ message: 'Error', description: 'Please select an Excel file (.xlsx or .xls)', duration: 0 });
      return;
    }
    setImporting(true);
    try {
      const rows = await parseExcelToRows(file);
      if (rows.length === 0) {
        message.warning('No rows found in the Excel file');
        setImporting(false);
        return;
      }
      let created = 0;
      let failed = 0;
      const existingCodes = (Array.isArray(customers) ? customers : [])
        .map((c: any) => {
          const raw = c && c.code != null ? String(c.code) : '';
          const numeric = raw.replace(/\D/g, '');
          return numeric ? Number(numeric) : NaN;
        })
        .filter((n) => !Number.isNaN(n));
      let nextCodeNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = getCol(row, 'Name', 'name');
        const salesPerson = getCol(row, 'Sales Person', 'Salesperson Name', 'salesperson_name');
        if (!name || !salesPerson) { failed++; continue; }

        const payload = {
          company_id: currentCompany.id,
          name,
          code: `C-${String(nextCodeNum++).padStart(4, '0')}`,
          email: getCol(row, 'Email', 'email'),
          phone: getCol(row, 'Phone', 'phone'),
          address: getCol(row, 'Address', 'address'),
          city: getCol(row, 'City', 'city'),
          tax_number: getCol(row, 'Tax Number', 'NTN Number', 'tax_number'),
          credit_limit: getColNum(row, 'Credit Limit', 'credit_limit'),
          attention_person: getCol(row, 'Attention Person', 'attention_person'),
          salesperson_name: salesPerson,
          gst_number: getCol(row, 'GST Number', 'gst_number'),
          opening_balance: getColNum(row, 'Opening Balance', 'opening_balance') || 0,
          payment_terms_days: getColNum(row, 'Payment Terms Days', 'Payment Terms', 'payment_terms_days') || 30,
        };
        try {
          const result = await (window as any).electronAPI.db.customers.create(payload);
          const data = result && typeof result === 'object' && 'data' in result ? (result as any).data : result;
          if (data?.id != null) created++;
          else failed++;
        } catch (_) {
          failed++;
        }
      }
      message.success(`Import complete: ${created} created, ${failed} failed or skipped.`);
      loadCustomers();
    } catch (err: any) {
      notification.error({ message: 'Error', description: err?.message || 'Failed to import Excel', duration: 0 });
    } finally {
      setImporting(false);
    }
  };

  const openAdvanceModal = (record: any) => {
    setAdvanceCustomer(record);
    advanceForm.setFieldsValue({
      payment_date: dayjs(),
      payment_method: 'cash',
      amount: undefined,
      notes: '',
    });
    setAdvanceModal(true);
  };

  const handleAdvanceSave = async (values: any) => {
    if (!currentCompany || !advanceCustomer) return;
    setAdvanceSaving(true);
    try {
      const result = await (window as any).electronAPI.db.payments.create({
        company_id: currentCompany.id,
        payment_date: values.payment_date.format('YYYY-MM-DD'),
        payment_type: 'in',
        reference_type: 'advance',
        reference_id: null,
        customer_id: advanceCustomer.id,
        amount: values.amount,
        payment_method: values.payment_method,
        notes: values.notes || null,
        created_by: user?.id || null,
      });
      if (result.success) {
        message.success(`Advance of ${Number(values.amount).toLocaleString()} recorded for ${advanceCustomer.name}`);
        setAdvanceModal(false);
        advanceForm.resetFields();
        loadCustomers();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to record advance payment', duration: 0 });
      }
    } catch { notification.error({ message: 'Error', description: 'Failed to record advance payment', duration: 0 }); }
    finally { setAdvanceSaving(false); }
  };

  const columns = [
    { title: 'Code',      dataIndex: 'code',      key: 'code' },
    { title: 'Name',      dataIndex: 'name',      key: 'name' },
    { title: 'Email',     dataIndex: 'email',     key: 'email' },
    { title: 'Phone',     dataIndex: 'phone',     key: 'phone' },
    {
      title: 'Payment Terms',
      dataIndex: 'payment_terms_days',
      key: 'payment_terms_days',
      render: (days: any) => <Tag color="geekblue">{days !== undefined ? Number(days) : 30} Days</Tag>,
    },
    {
      title: 'Balance / Credit',
      key: 'balance_credit',
      render: (_: any, record: any) => {
        const balance = Number(record.balance) || 0;
        const limit   = Number(record.credit_limit) || 0;
        const over    = limit > 0 && balance > limit;
        const near    = limit > 0 && !over && balance >= limit * 0.8;
        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              {balance > 0
                ? <Tag color={over ? 'red' : 'orange'}>{balance.toLocaleString()}</Tag>
                : balance < 0
                  ? <Tag color="blue">Advance: {Math.abs(balance).toLocaleString()}</Tag>
                  : <Tag color="green">Settled</Tag>}
              {over && <Tag color="red" icon={<WarningOutlined />}>Limit Exceeded</Tag>}
              {near && <Tag color="orange" icon={<WarningOutlined />}>Near Limit</Tag>}
            </Space>
            {limit > 0 && (
              <span style={{ fontSize: 11, color: '#888' }}>
                Limit: {limit.toLocaleString()}
                {limit > 0 && balance > 0 && ` · ${Math.min(Math.round((balance / limit) * 100), 100)}% used`}
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        if (isReadOnlySection) {
          return null;
        }
        return (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingCustomer(record);
                let terms: string[] = [];
                try { terms = JSON.parse(record.terms_and_conditions || '[]'); } catch { terms = record.terms_and_conditions ? [record.terms_and_conditions] : []; }
                form.setFieldsValue({ ...record, terms_and_conditions: terms });
                setModalVisible(true);
              }}
            />
            <Tooltip title="Record Advance Payment">
              <Button
                icon={<DollarOutlined />}
                style={{ color: '#389e0d', borderColor: '#389e0d' }}
                onClick={() => openAdvanceModal(record)}
              />
            </Tooltip>
            {canEditOrDelete && (
              <Button danger icon={<DeleteOutlined />} onClick={() => handleRequestDelete(record.id)} />
            )}
          </Space>
        );
      },
    },
  ];

  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>Customers</h1>
          <Input
            placeholder="Search by name or code..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
          {selectedRowKeys.length > 0 && canEditOrDelete && (
            <Button 
                danger 
                icon={<DeleteOutlined />} 
                onClick={handleRequestBulkDelete}
            >
                Delete Selected ({selectedRowKeys.length})
            </Button>
          )}
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCustomers} loading={loading}>Refresh</Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportFormatModal(true)}>Excel format</Button>
          {!isReadOnlySection && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
              <Button icon={<UploadOutlined />} loading={importing} onClick={() => fileInputRef.current?.click()}>Import from Excel</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCustomer(null); form.resetFields(); setModalVisible(true); }}>
                Add Customer
              </Button>
            </>
          )}
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={filteredCustomers} 
        loading={loading} 
        rowKey="id" 
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{ pageSize: 15 }} 
      />

      {/* Add / Edit Customer Modal */}
      <Modal
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingCustomer(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={800}
        closeIcon={
          <Space>
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setModalVisible(false);
                const values = form.getFieldsValue();
                const custName = values.name || 'New Customer';
                minimizeModal({
                  id: editingCustomer ? `cust-edit-${editingCustomer.id}` : 'cust-new',
                  title: editingCustomer ? `Edit Customer ${custName}` : `New Customer ${custName}`,
                  onRestore: () => {
                    setEditingCustomer(editingCustomer);
                    setModalVisible(true);
                  }
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setModalVisible(false);
              setEditingCustomer(null);
              form.resetFields();
            }} />
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Customer Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="credit_limit" label="Credit Limit (assigned at account opening)" rules={[{ required: true, message: 'Please set credit limit at customer opening' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} placeholder="e.g. 50000" />
          </Form.Item>
          <Form.Item name="payment_terms_days" label="Payment Terms / Credit Period (Days)" initialValue={30} rules={[{ required: true, message: 'Please specify payment terms' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={0} placeholder="e.g., 30" />
          </Form.Item>
          <Form.Item 
            name="opening_balance" 
            label="Opening Balance" 
            initialValue={0}
            extra={editingCustomer && editingCustomer.remaining_opening_balance !== undefined ? (
              <span style={{ color: editingCustomer.remaining_opening_balance > 0 ? '#fa8c16' : '#52c41a', fontWeight: 500 }}>
                Remaining to settle: {editingCustomer.remaining_opening_balance.toLocaleString()}
              </span>
            ) : 'Initial balance at account opening'}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="attention_person" label="Attention Person" rules={[{ required: true, message: 'Please enter attention person' }]} tooltip="This name will appear automatically on quotations for this customer.">
            <Input placeholder="e.g., Mr. Ali Khan" />
          </Form.Item>
          <Form.Item name="salesperson_name" label="Sales Person" rules={[{ required: true, message: 'Please enter sales person' }]} tooltip="Sales representative for this customer — shown on quotations.">
            <Input placeholder="e.g., Ahmed Raza" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Please enter phone' }]}><Input /></Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="city" label="City" rules={[{ required: true, message: 'Please enter city' }]}><Input /></Form.Item>
          <Form.Item name="tax_number" label="NTN Number" rules={[{ required: true, message: 'Please enter NTN number' }]}>
            <Input placeholder="e.g., 1234567-8" />
          </Form.Item>
          {!!currentCompany?.is_gst_enabled && (
            <Form.Item name="gst_number" label="GST Number" rules={[{ required: true, message: 'Please enter GST number' }]}>
              <Input placeholder="e.g., 1234567-8" />
            </Form.Item>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Terms and Conditions</label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Wrap text with ** to make it bold (e.g. **This is bold**)</div>
            <Form.List name="terms_and_conditions" rules={[{ validator: async (_, list) => { if (!list || list.filter((t: string) => t?.trim()).length === 0) throw new Error('Add at least one term'); } }]}>
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field) => {
                    const val = form.getFieldValue(['terms_and_conditions', field.name]) || '';
                    const isBold = typeof val === 'string' && val.startsWith('**') && val.endsWith('**') && val.length > 4;
                    return (
                      <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Form.Item {...field} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, whitespace: true, message: 'Enter a term or remove this row' }]}>
                          <Input placeholder={`Term ${field.name + 1}`} style={isBold ? { fontWeight: 700 } : undefined} />
                        </Form.Item>
                        <Button
                          type={isBold ? 'primary' : 'default'}
                          icon={<BoldOutlined />}
                          size="small"
                          style={{ marginTop: 4 }}
                          title="Toggle bold"
                          onClick={() => {
                            const terms = form.getFieldValue('terms_and_conditions') || [];
                            const current = terms[field.name] || '';
                            if (isBold) {
                              terms[field.name] = current.slice(2, -2);
                            } else {
                              terms[field.name] = `**${current}**`;
                            }
                            form.setFieldsValue({ terms_and_conditions: [...terms] });
                          }}
                        />
                        <MinusCircleOutlined onClick={() => remove(field.name)} style={{ marginTop: 8, color: '#ff4d4f' }} />
                      </div>
                    );
                  })}
                  <Button type="dashed" onClick={() => add('')} block icon={<PlusOutlined />}>Add Term</Button>
                  <Form.ErrorList errors={errors} />
                </>
              )}
            </Form.List>
          </div>
        </Form>
      </Modal>

      {/* Advance Payment Modal */}
      <Modal
        title={`Record Advance Payment — ${advanceCustomer?.name || ''}`}
        open={advanceModal}
        onCancel={() => { setAdvanceModal(false); advanceForm.resetFields(); }}
        onOk={() => advanceForm.submit()}
        okText="Record Payment"
        confirmLoading={advanceSaving}
        width={480}
        closeIcon={
          <Space>
            <MinusSquareOutlined
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setAdvanceModal(false);
                minimizeModal({
                  id: `cust-advance-${advanceCustomer?.id || 'new'}`,
                  title: `Advance: ${advanceCustomer?.name || 'Customer'}`,
                  onRestore: () => setAdvanceModal(true),
                });
              }}
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setAdvanceModal(false);
              advanceForm.resetFields();
            }} />
          </Space>
        }
      >
        <Form form={advanceForm} layout="vertical" onFinish={handleAdvanceSave}>
          <Form.Item name="amount" label="Amount" rules={[{ required: true, message: 'Please enter amount' }, { type: 'number', min: 0.01, message: 'Amount must be greater than 0' }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} precision={2} placeholder="e.g. 50000" />
          </Form.Item>
          <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true, message: 'Please select date' }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>
          <Form.Item name="payment_method" label="Payment Method" rules={[{ required: true }]}>
            <Select options={[
              { label: 'Cash',           value: 'cash' },
              { label: 'Bank Transfer',  value: 'bank_transfer' },
              { label: 'Cheque',         value: 'cheque' },
              { label: 'Online',         value: 'online' },
            ]} />
          </Form.Item>
          <Form.Item name="notes" label="Notes / Reference">
            <Input.TextArea rows={2} placeholder="Cheque number, reference, etc." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Customers – Excel import format"
        open={importFormatModal}
        onCancel={() => setImportFormatModal(false)}
        footer={[
          <Button key="close" onClick={() => setImportFormatModal(false)}>Close</Button>,
          <Button key="import" type="primary" onClick={() => { setImportFormatModal(false); fileInputRef.current?.click(); }}>Choose file to import</Button>,
        ]}
        width={560}
      >
        <Alert type="info" style={{ marginBottom: 16 }} message="First row must be headers. Use the column names below (case-insensitive)." />
        <p><strong>Required columns:</strong></p>
        <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
          <li><strong>Name</strong> – Customer name</li>
          <li><strong>Sales Person</strong> – Sales representative name</li>
        </ul>
        <p><strong>Optional columns:</strong></p>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>Email, Phone, Address, City</li>
          <li>Tax Number (NTN), Attention Person, Sales Person, GST Number, Opening Balance</li>
        </ul>
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
        <p>Enter admin password to delete {pendingDeleteId ? 'this customer' : `${pendingDeleteIds.length} customers`}:</p>
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

export default Customers;
