import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, WarningOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';

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
      if (editingCustomer) {
        const result = await (window as any).electronAPI.db.customers.update(editingCustomer.id, values);
        if (result.success) message.success('Customer updated successfully');
        else message.error(result.error || 'Failed to update customer');
      } else {
        const result = await (window as any).electronAPI.db.customers.create({ ...values, company_id: currentCompany.id });
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
    { title: 'PR Number', dataIndex: 'pr_number', key: 'pr_number' },
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
              form.setFieldsValue(record);
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Customers</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingCustomer(null); form.resetFields(); setModalVisible(true); }}>
          Add Customer
        </Button>
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
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="city" label="City"><Input /></Form.Item>
          <Form.Item name="state" label="State"><Input /></Form.Item>
          <Form.Item name="country" label="Country"><Input /></Form.Item>
          <Form.Item name="postal_code" label="Postal Code"><Input /></Form.Item>
          {!!currentCompany?.is_gst_enabled && (
            <>
              <Form.Item name="tax_number" label="Tax Number (NTN)"><Input /></Form.Item>
              <Form.Item name="default_tax_rate" label="Default Tax % (GST / Sales Tax)" rules={[{ required: true, message: 'Please enter default tax %' }]} tooltip="Tax rate applied to sales for this customer (quotations, invoices).">
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} placeholder="e.g. 18" />
              </Form.Item>
            </>
          )}
          <Form.Item name="pr_number" label="PR Number"><Input /></Form.Item>
          <Form.Item name="terms_and_conditions" label="Terms and Conditions" rules={[{ required: true, message: 'Please enter terms and conditions' }]}>
            <Input.TextArea rows={4} placeholder="Standard terms and conditions for this customer" />
          </Form.Item>
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
    </div>
  );
};

export default Customers;
