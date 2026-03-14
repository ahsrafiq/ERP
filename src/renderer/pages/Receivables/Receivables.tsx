import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Select, message, notification, Tag, Space, Popconfirm } from 'antd';
import { DollarOutlined, FileTextOutlined, DeleteOutlined, MinusSquareOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const Receivables: React.FC = () => {
  const { currentCompany, user, minimizeModal } = useApp();
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [receiptForm] = Form.useForm();
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentHistoryModalVisible, setPaymentHistoryModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);

  const docLabel = (currentCompany && (currentCompany as any).is_gst_enabled) ? 'Invoice' : 'Bill';

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

  const loadInvoicesForCustomer = async (customerId: number) => {
    if (!currentCompany?.id) return;
    try {
      const api = (window as any).electronAPI?.db?.salesInvoices;
      if (!api?.getAll) {
        setInvoices([]);
        return;
      }
      const result = await api.getAll(currentCompany.id);
      if (result && result.success && Array.isArray(result.data)) {
        const list = result.data.filter((inv: any) => Number(inv.customer_id) === Number(customerId));
        setInvoices(list);
      } else {
        setInvoices([]);
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load invoices', duration: 0 });
      setInvoices([]);
    }
  };

  const handleCustomerClick = (record: any) => {
    if (!record?.id) return;
    setSelectedCustomer(record);
    setCustomerModalVisible(true);
    loadInvoicesForCustomer(record.id);
  };

  const openReceiptForm = (invoice: any, paymentToEdit?: any) => {
    setSelectedInvoice(invoice);
    setEditingPayment(paymentToEdit || null);
    
    if (paymentToEdit) {
      receiptForm.setFieldsValue({
        amount: paymentToEdit.amount,
        tax_deduction: paymentToEdit.tax_deduction || 0,
        payment_date: dayjs(paymentToEdit.payment_date),
        payment_method: paymentToEdit.payment_method || 'cash',
        notes: paymentToEdit.notes || '',
      });
    } else {
      const bal = Number(invoice?.balance) || 0;
      receiptForm.setFieldsValue({
        amount: bal > 0 ? bal : 0,
        tax_deduction: 0,
        payment_date: dayjs(),
        payment_method: 'cash',
        notes: '',
      });
    }
    setReceiptModalVisible(true);
  };

  const handleRecordReceipt = async (values: any) => {
    if (!currentCompany || !selectedCustomer || !selectedInvoice) return;
    const amount = Number(values.amount);
    if (amount < 0) {
      notification.error({ message: 'Error', description: 'Enter a valid amount received', duration: 0 });
      return;
    }
    const outstanding = (Number(selectedInvoice.balance) || 0) + (editingPayment ? Number(editingPayment.amount) : 0);
    if (amount > outstanding) {
      notification.error({ message: 'Error', description: 'Amount cannot exceed outstanding balance', duration: 0 });
      return;
    }
    try {
      const paymentDate = values.payment_date && typeof values.payment_date.format === 'function'
        ? values.payment_date.format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');
      const paymentData = {
        company_id: currentCompany.id,
        payment_date: paymentDate,
        payment_type: 'in',
        reference_type: 'sales_invoice',
        reference_id: selectedInvoice.id,
        customer_id: selectedCustomer.id,
        amount: amount,
        tax_deduction: Number(values.tax_deduction) || 0,
        payment_method: values.payment_method || 'cash',
        notes: values.notes || null,
        created_by: user?.id,
      };

      let result;
      if (editingPayment) {
        result = await (window as any).electronAPI.db.payments.update(editingPayment.id, paymentData);
      } else {
        result = await (window as any).electronAPI.db.payments.create(paymentData);
      }
      if (result?.success) {
        message.success(editingPayment ? 'Payment updated' : `Receipt of ${amount.toLocaleString()} recorded`);
        setReceiptModalVisible(false);
        setEditingPayment(null);
        receiptForm.resetFields();
        setSelectedInvoice(null);
        loadInvoicesForCustomer(selectedCustomer.id);
        loadCustomers();
      } else {
        notification.error({ message: 'Error', description: result?.error || 'Failed to record receipt', duration: 0 });
      }
    } catch (e: any) {
      notification.error({ message: 'Error', description: e?.message || 'Failed to record receipt', duration: 0 });
    }
  };

  const handleViewPayments = async (invoice: any) => {
    setSelectedInvoice(invoice);
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.payments.getAll(currentCompany!.id);
      if (result.success && Array.isArray(result.data)) {
        const filtered = result.data.filter((p: any) => p.reference_id === invoice.id && p.reference_type === 'sales_invoice');
        setPayments(filtered);
        setPaymentHistoryModalVisible(true);
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load payments', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      const result = await (window as any).electronAPI.db.payments.delete(paymentId);
      if (result.success) {
        message.success('Payment deleted');
        if (selectedInvoice) handleViewPayments(selectedInvoice);
        if (selectedCustomer) loadInvoicesForCustomer(selectedCustomer.id);
        loadCustomers();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete payment', duration: 0 });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to delete payment', duration: 0 });
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
      title: 'Credit Limit',
      dataIndex: 'credit_limit',
      key: 'credit_limit',
      align: 'right' as const,
      render: (val: unknown) => {
        const n = Number(val);
        return (val != null && !Number.isNaN(n)) ? n.toLocaleString() : '—';
      },
    },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Button type="primary" size="small" icon={<FileTextOutlined />} onClick={() => handleCustomerClick(record)}>
          {docLabel}s
        </Button>
      ),
    },
  ];

  const invoiceColumns = [
    { title: 'Doc', key: 'doc', width: 80, render: () => docLabel },
    { title: 'Number', dataIndex: 'invoice_number', key: 'invoice_number', width: 140 },
    { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', width: 110, render: (d: unknown) => (d ? dayjs(String(d)).format('DD/MM/YYYY') : '—') },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (v: unknown) => {
        const n = Number(v);
        return (v != null && !Number.isNaN(n)) ? n.toLocaleString() : '—';
      },
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => {
        const n = Number(v) || 0;
        if (n <= 0) return <Tag color="green">Paid</Tag>;
        return <span style={{ color: '#cf1322' }}>{n.toLocaleString()}</span>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 280,
      render: (_: any, record: any) => {
        const balance = Number(record.balance) || 0;
        return (
          <Space>
            {balance > 0 && (
              <Button type="primary" size="small" icon={<DollarOutlined />} onClick={() => openReceiptForm(record)}>
                Receipt
              </Button>
            )}
            <Button size="small" onClick={() => handleViewPayments(record)}>
              Payments
            </Button>
          </Space>
        );
      },
    },
  ];

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
      <div style={{ marginBottom: 16 }}>
        <h1>Receivables</h1>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
          Click a customer to view their invoices and bills. Record received amount and tax deduction per document.
        </p>
      </div>

      <Table
        columns={customerColumns}
        dataSource={Array.isArray(customers) ? customers : []}
        loading={loading}
        rowKey={(r: any) => (r?.id != null ? String(r.id) : `row-${Math.random()}`)}
        pagination={{ pageSize: 15 }}
        size="small"
      />

      <Modal
        title={selectedCustomer ? `Invoices & Bills — ${selectedCustomer.name || 'Customer'}` : 'Invoices & Bills'}
        open={customerModalVisible}
        onCancel={() => {
          setCustomerModalVisible(false);
          setSelectedCustomer(null);
          setInvoices([]);
        }}
        closeIcon={
          <Space>
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setCustomerModalVisible(false);
                const title = selectedCustomer ? `Invoices — ${selectedCustomer.name}` : `Invoices & Bills`;
                minimizeModal({
                  id: selectedCustomer ? `receivable-cust-${selectedCustomer.id}` : 'receivable-cust-new',
                  title,
                  onRestore: () => setCustomerModalVisible(true)
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setCustomerModalVisible(false);
              setSelectedCustomer(null);
              setInvoices([]);
            }} />
          </Space>
        }
        footer={null}
        width={720}
      >
        <Table
          dataSource={Array.isArray(invoices) ? invoices : []}
          columns={invoiceColumns}
          rowKey={(r: any) => (r?.id != null ? String(r.id) : String(Math.random()))}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No invoices or bills for this customer.' }}
        />
      </Modal>

      <Modal
        title="Record receipt"
        open={receiptModalVisible}
        onCancel={() => {
          setReceiptModalVisible(false);
          setSelectedInvoice(null);
          setEditingPayment(null);
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
                const title = selectedInvoice ? `Receipt — ${selectedInvoice.invoice_number}` : 'Record Receipt';
                minimizeModal({
                  id: selectedInvoice ? `receivable-receipt-${selectedInvoice.id}` : 'receivable-receipt-new',
                  title,
                  onRestore: () => setReceiptModalVisible(true)
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setReceiptModalVisible(false);
              setSelectedInvoice(null);
              setEditingPayment(null);
              receiptForm.resetFields();
            }} />
          </Space>
        }
        okText={editingPayment ? "Update receipt" : "Save receipt"}
        destroyOnClose
      >
        {selectedInvoice && (
          <p style={{ marginBottom: 16, color: '#666' }}>
            {docLabel} <strong>{selectedInvoice.invoice_number || '—'}</strong> — Outstanding: <strong>{(Number(selectedInvoice.balance) || 0).toLocaleString()}</strong>
          </p>
        )}
        <Form form={receiptForm} layout="vertical" onFinish={handleRecordReceipt}>
          <Form.Item
            name="amount"
            label="Amount received"
            rules={[{ required: true, message: 'Enter amount received' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Amount" />
          </Form.Item>
          <Form.Item name="tax_deduction" label="Tax deduction" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
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
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={selectedInvoice ? `Payment History — ${selectedInvoice.invoice_number}` : 'Payment History'}
        open={paymentHistoryModalVisible}
        onCancel={() => setPaymentHistoryModalVisible(false)}
        footer={null}
        width={600}
      >
        <Table
          dataSource={payments}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: 'Date', dataIndex: 'payment_date', key: 'date', render: (d) => dayjs(d).format('DD/MM/YYYY') },
            { title: 'Method', dataIndex: 'payment_method', key: 'method', render: (m) => <Tag>{m}</Tag> },
            { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (v) => Number(v).toLocaleString() },
            {
              title: 'Action',
              key: 'action',
              render: (_, record) => (
                <Space>
                  <Button 
                    size="small" 
                    icon={<EditOutlined />} 
                    onClick={() => {
                      setPaymentHistoryModalVisible(false);
                      openReceiptForm(selectedInvoice, record);
                    }} 
                  />
                  <Popconfirm title="Delete this payment? This will restore the invoice balance." onConfirm={() => handleDeletePayment(record.id)}>
                    <Button danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
};

export default Receivables;
