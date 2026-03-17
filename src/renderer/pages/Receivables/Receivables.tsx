import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Select, message, notification, Tag, Space, Popconfirm } from 'antd';
import { DollarOutlined, DeleteOutlined, CloseOutlined, EditOutlined, SearchOutlined, LockOutlined, MinusSquareOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const Receivables: React.FC = () => {
  const { currentCompany, user, minimizeModal } = useApp();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [receiptForm] = Form.useForm();
  
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [selectedReceiptKeys, setSelectedReceiptKeys] = useState<React.Key[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [searchQuery, setSearchQuery] = useState('');

  // Delete authorization
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');

  // Form watchers for dynamic calculations
  const receiptAmount = Form.useWatch('amount', receiptForm);
  const receiptTaxRate = Form.useWatch('tax_deduction_rate', receiptForm);
  const receiptTaxAmount = (Number(receiptAmount) || 0) * ((Number(receiptTaxRate) || 0) / 100);
  const receiptNetAmount = (Number(receiptAmount) || 0) - receiptTaxAmount;

  const editAmount = Form.useWatch('amount', editForm);
  const editTaxRate = Form.useWatch('tax_deduction_rate', editForm);
  const editTaxAmount = (Number(editAmount) || 0) * ((Number(editTaxRate) || 0) / 100);
  const editNetAmount = (Number(editAmount) || 0) - editTaxAmount;

  useEffect(() => {
    if (currentCompany?.id) loadCustomers();
  }, [currentCompany?.id]);

  const loadCustomers = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const api = (window as any).electronAPI?.db?.customers;
      if (!api?.getAll) {
        setCustomers([]);
        return;
      }
      const result = await api.getAll(currentCompany.id);
      if (result && result.success && Array.isArray(result.data)) {
        setCustomers(result.data);
      } else {
        setCustomers([]);
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load customers', duration: 0 });
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentHistory = async (customerId: number) => {
    setPaymentsLoading(true);
    try {
      const result = await (window as any).electronAPI.db.payments.getAll(currentCompany!.id);
      if (result.success && Array.isArray(result.data)) {
        const filtered = result.data.filter((p: any) => p.customer_id === customerId);
        setPayments(filtered);
      }
    } catch {
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const openReceiptForm = async (customerArg: any) => {
    setLoading(true);
    let customer = customerArg;
    try {
      // Fetch fresh customer data to avoid balance lag
      const fresh = await (window as any).electronAPI.db.customers.getById(customerArg.id);
      if (fresh.success && fresh.data) {
        customer = fresh.data;
      }
    } catch (e) {}
    
    setSelectedCustomer(customer);
    setEditingPayment(null);
    setSelectedReceiptKeys([]);
    setUnpaidInvoices([]);
    setPayments([]);
    
    // Fetch unpaid invoices
    try {
      const uInvs = await (window as any).electronAPI.db.customers.getUnpaidInvoices(customer.id, currentCompany!.id);
      const dues = uInvs.data || [];
      
      const sumOfInvoices = dues.reduce((sum: number, i: any) => sum + i.balance, 0);
      const customerBalance = Number(customer.balance) || 0;
      const openingBal = Math.round((customerBalance - sumOfInvoices) * 100) / 100;
      
      const mappedDues = dues.map((d: any) => ({ ...d, key: `invoice_${d.id}` }));
      
      if (openingBal > 0.01) {
          mappedDues.unshift({
              id: 'opening_balance',
              key: 'opening_balance',
              invoice_number: 'Opening/General Balance',
              invoice_date: null,
              total_amount: openingBal,
              balance: openingBal,
          });
      }
      setUnpaidInvoices(mappedDues);
    } catch (err) {
      setUnpaidInvoices([]);
    }

    receiptForm.setFieldsValue({
      amount: 0,
      tax_deduction_rate: 0,
      payment_date: dayjs(),
      payment_method: 'cash',
      notes: '',
    });
    
    // Load payment history into the modal section
    loadPaymentHistory(customer.id);
    setReceiptModalVisible(true);
    setLoading(false);
  };

  const openEditModal = (payment: any) => {
    setEditingPayment(payment);
    editForm.setFieldsValue({
      amount: payment.amount,
      tax_deduction_rate: payment.tax_deduction_rate || 0,
      payment_date: dayjs(payment.payment_date),
      payment_method: payment.payment_method || 'cash',
      notes: payment.notes || '',
    });
    setEditModalVisible(true);
  };

  const calculateSelectedTotal = (keys: React.Key[]) => {
    const total = keys.reduce((sum: number, key) => {
      const inv = unpaidInvoices.find(i => i.key === key);
      return sum + (inv ? inv.balance : 0);
    }, 0);
    return Math.round(total * 100) / 100;
  };

  const handleSelectionChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedReceiptKeys(newSelectedRowKeys);
    if (newSelectedRowKeys.length > 0) {
      const total = calculateSelectedTotal(newSelectedRowKeys);
      receiptForm.setFieldsValue({ amount: total });
    } else {
      receiptForm.setFieldsValue({ amount: 0 });
    }
  };

  const handleRecordReceipt = async (values: any) => {
    if (!currentCompany || !selectedCustomer) return;
    const amount = Number(values.amount);
    if (amount <= 0) {
      notification.error({ message: 'Error', description: 'Enter a valid amount received', duration: 0 });
      return;
    }

    try {
      const paymentDate = values.payment_date && typeof values.payment_date.format === 'function'
        ? values.payment_date.format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');
      
      const taxDeductionRate = Number(values.tax_deduction_rate) || 0;
        
      const basePayment: any = {
        company_id: currentCompany.id,
        payment_date: paymentDate,
        payment_type: 'in',
        customer_id: selectedCustomer.id,
        payment_method: values.payment_method || 'cash',
        notes: values.notes || null,
        created_by: user?.id,
      };

      // Handle new payment(s) - Distribute across selection
      let remainingAmount = amount;
      
      if (selectedReceiptKeys.length > 0) {
         // Get selected invoices in order
         const selectedInvoices = selectedReceiptKeys
           .map(key => unpaidInvoices.find(i => i.key === key))
           .filter(Boolean)
           .sort((a, b) => {
              const dateA = a.invoice_date || '0000-00-00';
              const dateB = b.invoice_date || '0000-00-00';
              return dateA.localeCompare(dateB);
           });

         for (const inv of selectedInvoices) {
            if (remainingAmount <= 0) break;
            
            const applyToThis = Math.min(remainingAmount, inv.balance);
            const taxAmount = applyToThis * (taxDeductionRate / 100);
            
            const paymentData = {
                ...basePayment,
                amount: applyToThis,
                tax_deduction: taxAmount,
                tax_deduction_rate: taxDeductionRate,
                reference_type: inv.id === 'opening_balance' ? null : 'sales_invoice',
                reference_id: inv.id === 'opening_balance' ? null : inv.id,
            };
            
            await (window as any).electronAPI.db.payments.create(paymentData);
            remainingAmount = Math.round((remainingAmount - applyToThis) * 100) / 100;
         }
      }

      // If any amount remains (or no selection was made)
      if (remainingAmount > 0.001 || selectedReceiptKeys.length === 0) {
         const taxAmount = remainingAmount * (taxDeductionRate / 100);
         const paymentData = {
             ...basePayment,
             amount: remainingAmount,
             tax_deduction: taxAmount,
             tax_deduction_rate: taxDeductionRate,
             reference_type: null,
             reference_id: null,
         };
         await (window as any).electronAPI.db.payments.create(paymentData);
      }

      message.success(`Receipt recorded for ${selectedCustomer.name}`);
      receiptForm.resetFields();
      setSelectedReceiptKeys([]);
      openReceiptForm(selectedCustomer); // Reload fresh dues/history
      loadCustomers();
    } catch (e: any) {
      notification.error({ message: 'Error', description: e?.message || 'Failed to record receipt', duration: 0 });
    }
  };

  const handleEditPayment = async (values: any) => {
    if (!editingPayment || !selectedCustomer) return;
    const amount = Number(values.amount);
    const taxDeductionRate = Number(values.tax_deduction_rate) || 0;
    const taxAmount = amount * (taxDeductionRate / 100);

    try {
      const paymentDate = values.payment_date && typeof values.payment_date.format === 'function'
        ? values.payment_date.format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');

      const result = await (window as any).electronAPI.db.payments.update(editingPayment.id, {
        amount,
        tax_deduction: taxAmount,
        tax_deduction_rate: taxDeductionRate,
        payment_date: paymentDate,
        payment_method: values.payment_method,
        notes: values.notes
      });

      if (result.success) {
        message.success('Payment updated');
        setEditModalVisible(false);
        setEditingPayment(null);
        openReceiptForm(selectedCustomer); // Refresh current view
        loadCustomers();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to update payment', duration: 0 });
      }
    } catch (e: any) {
      notification.error({ message: 'Error', description: e?.message || 'Failed to update payment', duration: 0 });
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
        notification.error({ message: 'Error', description: 'Incorrect admin password', duration: 0 });
        setAdminPassword('');
        return;
    }
    if (pendingDeleteId == null) return;
    try {
      const result = await (window as any).electronAPI.db.payments.delete(pendingDeleteId);
      if (result.success) {
        message.success('Payment deleted');
        if (selectedCustomer) {
          openReceiptForm(selectedCustomer); // Refresh visual state
          loadCustomers();
        }
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete payment', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete payment', duration: 0 });
    } finally {
      setDeletePasswordModal(false);
      setPendingDeleteId(null);
      setAdminPassword('');
    }
  };

  const customerColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: (v: unknown) => (v != null ? String(v) : '—') },
    { title: 'Customer', dataIndex: 'name', key: 'name', render: (v: unknown) => (v != null ? String(v) : '—') },
    {
      title: 'Outstanding',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (val: number) => {
        const n = Number(val) || 0;
        if (n <= 0) return <Tag color="green">Settled</Tag>;
        return <span style={{ color: '#cf1322', fontWeight: 600 }}>{n.toLocaleString()}</span>;
      },
    },
    {
      title: 'Actions',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
           <Button type="primary" size="small" icon={<DollarOutlined />} onClick={() => openReceiptForm(record)}>
            Receipt / History
          </Button>
        </Space>
      ),
    },
  ];

  const filteredCustomers = (Array.isArray(customers) ? customers : []).filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentCompany && loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Receivables</h1>
        <p style={{ color: '#666', marginTop: 8 }}>Loading…</p>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Receivables</h1>
        <p style={{ color: '#666', marginTop: 8 }}>Please select a company first.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>Receivables</h1>
          <Input
            placeholder="Search by name or code..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          Record payments and track customer outstanding balances.
        </p>
      </div>

      <Table
        columns={customerColumns}
        dataSource={filteredCustomers}
        loading={loading}
        rowKey={(r: any) => (r?.id != null ? String(r.id) : `row-${Math.random()}`)}
        pagination={{ pageSize: 15 }}
        size="small"
      />

      <Modal
        title="Record Receipt"
        open={receiptModalVisible}
        onCancel={() => {
          setReceiptModalVisible(false);
          receiptForm.resetFields();
        }}
        onOk={() => receiptForm.submit()}
        closeIcon={
          <Space>
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setReceiptModalVisible(false);
                minimizeModal({
                  id: `receivables-receipt-${selectedCustomer?.id || 'new'}`,
                  title: `Receipt: ${selectedCustomer?.name || 'Customer'}`,
                  onRestore: () => setReceiptModalVisible(true),
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setReceiptModalVisible(false);
              receiptForm.resetFields();
              setSelectedReceiptKeys([]);
            }} />
          </Space>
        }
        okText="Save receipt"
        destroyOnClose
        width={1000}
      >
        {selectedCustomer && (
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '12px 16px', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: '#666' }}>Customer</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{selectedCustomer.name || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#666' }}>Total Outstanding Due</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#cf1322' }}>{(Number(selectedCustomer.balance) || 0).toLocaleString()}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          {/* Left Side: Pending Dues */}
          <div style={{ flex: 2, borderRight: '1px solid #f0f0f0', paddingRight: 24 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Unpaid Dues</h3>
            <Table
              dataSource={unpaidInvoices}
              rowKey="key"
              size="small"
              pagination={false}
              scroll={{ y: 240 }}
              rowSelection={{
                selectedRowKeys: selectedReceiptKeys,
                onChange: handleSelectionChange,
              }}
              columns={[
                { title: 'Inv/Type', dataIndex: 'invoice_number', key: 'invoice_number', width: 140 },
                { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '—' },
                { title: 'Amount', dataIndex: 'total_amount', key: 'amount', align: 'right', render: (v) => Number(v).toLocaleString() },
                { title: 'Pending', dataIndex: 'balance', key: 'balance', align: 'right', render: (v) => <strong style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</strong> },
              ]}
              locale={{ emptyText: "No pending dues." }}
            />
          </div>

          {/* Right Side: Payment Form */}
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Record Payment</h3>
            <Form form={receiptForm} layout="vertical" onFinish={handleRecordReceipt}>
              <Form.Item
                name="amount"
                label="Amount received"
                rules={[{ required: true, message: 'Enter amount received' }]}
              >
                <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="Amount" />
              </Form.Item>
              <Form.Item name="tax_deduction_rate" label="Tax deduction %" initialValue={0} required tooltip="Percentage of tax deducted (0-100)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="%" addonAfter="%" />
              </Form.Item>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, background: '#fafafa', padding: 12, borderRadius: 4, border: '1px solid #f0f0f0' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888' }}>Tax Amount</div>
                  <div style={{ fontWeight: 600, color: '#cf1322' }}>{receiptTaxAmount.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#888' }}>Net Received</div>
                  <div style={{ fontWeight: 700, color: '#52c41a' }}>{receiptNetAmount.toLocaleString()}</div>
                </div>
              </div>

              <Form.Item name="payment_date" label="Payment date" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="payment_method" label="Payment method" initialValue="cash">
                <Select>
                  <Select.Option value="cash">Cash</Select.Option>
                  <Select.Option value="bank">Bank Transfer</Select.Option>
                  <Select.Option value="cheque">Cheque</Select.Option>
                  <Select.Option value="online">Online Payment</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="notes" label="Notes" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="Optional" />
              </Form.Item>
            </Form>
          </div>
        </div>

        {/* Bottom Side: Payment History */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Payment History</h3>
          <Table
            dataSource={payments}
            rowKey="id"
            size="small"
            loading={paymentsLoading}
            pagination={{ pageSize: 5 }}
            columns={[
              { title: 'Date', dataIndex: 'payment_date', key: 'date', render: (d) => dayjs(d).format('DD/MM/YYYY') },
              { title: 'Method', dataIndex: 'payment_method', key: 'method', render: (m) => <Tag>{m}</Tag> },
              { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v) => Number(v).toLocaleString() },
              { title: 'Ded %', dataIndex: 'tax_deduction_rate', key: 'tax_deduction_rate', align: 'right' as const, render: (v) => v ? `${v}%` : '—' },
              { title: 'Ref', dataIndex: 'reference_type', key: 'ref', render: (v, r: any) => v && v !== 'null' ? `${v} (#${r.reference_id})` : 'General' },
              {
                title: 'Action',
                key: 'action',
                render: (_, record: any) => (
                  <Space>
                    <Button 
                      size="small" 
                      icon={<EditOutlined />} 
                      onClick={() => openEditModal(record)} 
                    />
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleRequestDelete(record.id)} />
                  </Space>
                )
              }
            ]}
          />
        </div>
      </Modal>

      <Modal
        title="Edit Payment"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        width={400}
        zIndex={1100}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditPayment}>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: 'Enter amount' }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tax_deduction_rate" label="Tax deduction %">
            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, background: '#fafafa', padding: 12, borderRadius: 4, border: '1px solid #f0f0f0' }}>
            <div>
              <div style={{ fontSize: 12, color: '#888' }}>Tax Amount</div>
              <div style={{ fontWeight: 600, color: '#cf1322' }}>{editTaxAmount.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888' }}>Net Received</div>
              <div style={{ fontWeight: 700, color: '#52c41a' }}>{editNetAmount.toLocaleString()}</div>
            </div>
          </div>

          <Form.Item name="payment_date" label="Payment date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="payment_method" label="Payment method" initialValue="cash">
            <Select>
              <Select.Option value="cash">Cash</Select.Option>
              <Select.Option value="bank">Bank Transfer</Select.Option>
              <Select.Option value="cheque">Cheque</Select.Option>
              <Select.Option value="online">Online Payment</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
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
        zIndex={1200}
      >
        <p>Enter admin password to delete this payment record:</p>
        <Input.Password
          prefix={<LockOutlined />}
          value={adminPassword}
          onChange={e => setAdminPassword(e.target.value)}
          placeholder="Admin password"
          onKeyDown={e => { if (e.key === 'Enter') handleConfirmDelete(); }}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default Receivables;

