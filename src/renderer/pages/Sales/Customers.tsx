import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm, Tag, Tooltip, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, WarningOutlined, MinusCircleOutlined, BoldOutlined, UploadOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import { parseExcelToRows, getCol, getColNum } from '../../utils/excelImport';

const Customers: React.FC = () => {
  const { currentCompany, user } = useApp();
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

  useEffect(() => {
    if (currentCompany) loadCustomers();
  }, [currentCompany]);

  const loadCustomers = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.customers.getAll(currentCompany.id);
      if (result.success) setCustomers(result.data || []);
    } catch { message.error('Failed to load customers'); }
    finally { setLoading(false); }
  };

  const handleSave = async (values: any) => {
    if (!currentCompany) { message.error('Please add a company first'); return; }
    try {
      const payload = {
        ...values,
        terms_and_conditions: JSON.stringify((values.terms_and_conditions || []).filter((t: string) => t?.trim())),
      };
      if (editingCustomer) {
        const result = await (window as any).electronAPI.db.customers.update(editingCustomer.id, payload);
        if (result.success) message.success('Customer updated successfully');
        else message.error(result.error || 'Failed to update customer');
      } else {
        const result = await (window as any).electronAPI.db.customers.create({ ...payload, company_id: currentCompany.id });
        if (result.success) message.success('Customer created successfully');
        else message.error(result.error || 'Failed to create customer');
      }
      setModalVisible(false);
      setEditingCustomer(null);
      form.resetFields();
      loadCustomers();
    } catch { message.error('Operation failed'); }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.customers.delete(id);
      if (result.success) { message.success('Customer deleted successfully'); loadCustomers(); }
      else message.error(result.error || 'Failed to delete customer');
    } catch { message.error('Failed to delete customer'); }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!currentCompany) { message.error('Please select a company first'); return; }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      message.error('Please select an Excel file (.xlsx or .xls)');
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
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = getCol(row, 'Name', 'name');
        const code = getCol(row, 'Code', 'code', 'Customer Code');
        if (!name || !code) { failed++; continue; }
        const payload = {
          company_id: currentCompany.id,
          name,
          code: code.replace(/\D/g, '') || code,
          email: getCol(row, 'Email', 'email'),
          phone: getCol(row, 'Phone', 'phone'),
          address: getCol(row, 'Address', 'address'),
          city: getCol(row, 'City', 'city'),
          state: getCol(row, 'State', 'state'),
          country: getCol(row, 'Country', 'country'),
          postal_code: getCol(row, 'Postal Code', 'postal_code'),
          tax_number: getCol(row, 'Tax Number', 'NTN Number', 'tax_number'),
          credit_limit: getColNum(row, 'Credit Limit', 'credit_limit'),
          attention_person: getCol(row, 'Attention Person', 'attention_person'),
          salesperson_name: getCol(row, 'Sales Person', 'Salesperson Name', 'salesperson_name'),
          gst_number: getCol(row, 'GST Number', 'gst_number'),
          po_number: getCol(row, 'PO Number', 'po_number'),
        };
        try {
          const result = await (window as any).electronAPI.db.customers.create(payload);
          if (result?.id != null) created++;
          else failed++;
        } catch (_) {
          failed++;
        }
      }
      message.success(`Import complete: ${created} created, ${failed} failed or skipped.`);
      loadCustomers();
    } catch (err: any) {
      message.error(err?.message || 'Failed to import Excel');
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
        message.error(result.error || 'Failed to record advance payment');
      }
    } catch { message.error('Failed to record advance payment'); }
    finally { setAdvanceSaving(false); }
  };

  const columns = [
    { title: 'Code',      dataIndex: 'code',      key: 'code' },
    { title: 'Name',      dataIndex: 'name',      key: 'name' },
    { title: 'Email',     dataIndex: 'email',     key: 'email' },
    { title: 'Phone',     dataIndex: 'phone',     key: 'phone' },
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
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
      render: (_: any, record: any) => (
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
          <Popconfirm title="Are you sure you want to delete this customer?" onConfirm={() => handleDelete(record.id)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Customers</h1>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportFormatModal(true)}>Excel format</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
          <Button icon={<UploadOutlined />} loading={importing} onClick={() => fileInputRef.current?.click()}>Import from Excel</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCustomer(null); form.resetFields(); setModalVisible(true); }}>
            Add Customer
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={customers} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />

      {/* Add / Edit Customer Modal */}
      <Modal
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingCustomer(null); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="code" label="Customer Code" rules={[{ required: true, message: 'Please enter customer code' }, { pattern: /^[0-9]+$/, message: 'Code must contain only numbers' }]}>
            <Input placeholder="e.g., 1001" />
          </Form.Item>
          <Form.Item name="credit_limit" label="Credit Limit (assigned at account opening)" rules={[{ required: true, message: 'Please set credit limit at customer opening' }]}>
            <InputNumber min={0} style={{ width: '100%' }} precision={2} placeholder="e.g. 50000" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}><Input /></Form.Item>
          <Form.Item name="attention_person" label="Attention Person" rules={[{ required: true, message: 'Please enter attention person' }]} tooltip="This name will appear automatically on quotations for this customer.">
            <Input placeholder="e.g., Mr. Ali Khan" />
          </Form.Item>
          <Form.Item name="salesperson_name" label="Sales Person" rules={[{ required: true, message: 'Please enter sales person' }]} tooltip="Sales representative for this customer — shown on quotations.">
            <Input placeholder="e.g., Ahmed Raza" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please enter email' }, { type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Please enter phone' }]}><Input /></Form.Item>
          <Form.Item name="address" label="Address" rules={[{ required: true, message: 'Please enter address' }]}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="city" label="City" rules={[{ required: true, message: 'Please enter city' }]}><Input /></Form.Item>
          <Form.Item name="state" label="State" rules={[{ required: true, message: 'Please enter state' }]}><Input /></Form.Item>
          <Form.Item name="country" label="Country" rules={[{ required: true, message: 'Please enter country' }]}><Input /></Form.Item>
          <Form.Item name="postal_code" label="Postal Code" rules={[{ required: true, message: 'Please enter postal code' }]}><Input /></Form.Item>
          <Form.Item name="tax_number" label="NTN Number" rules={[{ required: true, message: 'Please enter NTN number' }]}>
            <Input placeholder="e.g., 1234567-8" />
          </Form.Item>
          {!!currentCompany?.is_gst_enabled && (
            <Form.Item name="gst_number" label="GST Number" rules={[{ required: true, message: 'Please enter GST number' }]}>
              <Input placeholder="e.g., 1234567-8" />
            </Form.Item>
          )}
          <Form.Item name="po_number" label="PO Number"><Input placeholder="e.g. PO number" /></Form.Item>
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
          <li><strong>Code</strong> – Customer code (numbers only; non-digits will be stripped)</li>
          <li><strong>Credit Limit</strong> – Numeric</li>
        </ul>
        <p><strong>Optional columns:</strong></p>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>Email, Phone, Address, City, State, Country, Postal Code</li>
          <li>Tax Number (NTN), Attention Person, Sales Person, GST Number, PO Number</li>
        </ul>
      </Modal>
    </div>
  );
};

export default Customers;
