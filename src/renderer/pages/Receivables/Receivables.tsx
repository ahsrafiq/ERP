import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Select, message, notification, Tag, Space } from 'antd';
import { DollarOutlined, DeleteOutlined, CloseOutlined, EditOutlined, SearchOutlined, LockOutlined, MinusSquareOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { documentMatchesFiscalYearSuffix } from '../../utils/fiscalYearFilter';

const Receivables: React.FC = () => {
  const { currentCompany, user, fiscalYear, minimizeModal, globalRefreshKey } = useApp();
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
  const [maxAllowedAmount, setMaxAllowedAmount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete authorization
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const passwordInputRef = React.useRef<any>(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

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
  }, [currentCompany, location.pathname, fiscalYear, globalRefreshKey]);

  useEffect(() => {
    if (deletePasswordModal) {
      setTimeout(() => {
        passwordInputRef.current?.select();
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [deletePasswordModal]);

  const loadCustomers = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const api = (window as any).electronAPI?.db?.customers;
      if (!api?.getAll) {
        setCustomers([]);
        return;
      }
      const [custRes, invRes] = await Promise.all([
        api.getAll(currentCompany.id),
        (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id),
      ]);

      if (custRes && custRes.success && Array.isArray(custRes.data)) {
        const fyInvoices = (invRes?.success ? (invRes.data || []) : []).filter((inv: any) =>
          documentMatchesFiscalYearSuffix(inv?.invoice_number, fiscalYear)
        );
        const outstandingByCustomer: Record<number, number> = {};
        fyInvoices.forEach((inv: any) => {
          const cid = Number(inv?.customer_id);
          if (!cid) return;
          outstandingByCustomer[cid] = (outstandingByCustomer[cid] || 0) + (Number(inv?.balance) || 0);
        });
        const withFyBalance = custRes.data.map((c: any) => ({
          ...c,
          // Use the actual balance from the database instead of overriding it with only invoice sums.
          // This ensures opening balances are covered in the main list.
          balance: Number(c.balance || 0),
        }));
        setCustomers(withFyBalance);
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
      const [payResult, invResult] = await Promise.all([
        (window as any).electronAPI.db.payments.getAll(currentCompany!.id),
        (window as any).electronAPI.db.salesInvoices.getAll(currentCompany!.id),
      ]);
      if (payResult.success && Array.isArray(payResult.data)) {
        const salesInvoiceById: Record<number, { invoice_number?: string }> = {};
        if (invResult?.success && Array.isArray(invResult.data)) {
          for (const inv of invResult.data) {
            const id = Number(inv?.id);
            if (id) salesInvoiceById[id] = { invoice_number: inv.invoice_number };
          }
        }
        // Show all payments for this customer regardless of fiscal year
        const filtered = payResult.data
          .filter((p: any) => p.customer_id === customerId)
          .map((p: any) => {
            if (p.reference_type === 'sales_invoice' && p.reference_id) {
              return { ...p, invoice_number: salesInvoiceById[Number(p.reference_id)]?.invoice_number };
            }
            return p;
          });
        setPayments(filtered);
      } else {
        setPayments([]);
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
      const dues = (uInvs.data || []).filter((inv: any) =>
        documentMatchesFiscalYearSuffix(inv?.invoice_number, fiscalYear)
      );
      
      const sumOfInvoices = dues.reduce((sum: number, i: any) => sum + i.balance, 0);
      const customerBalance = Number(customer.balance) || 0;
      const openingBal = Math.round((customerBalance - sumOfInvoices) * 100) / 100;
      
      const mappedDues = dues.map((d: any) => ({ ...d, key: `invoice_${d.id}` }));
      
      // Always show Opening Balance row to allow the required selection workflow and show it is settled
      mappedDues.unshift({
              id: 'opening_balance',
              key: 'opening_balance',
              invoice_number: 'Customer Opening Balance',
              invoice_date: null,
              total_amount: openingBal,
              balance: openingBal,
          });
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

  const openEditModal = async (payment: any) => {
    setEditingPayment(payment);
    
    let max = null;
    
    try {
        // Always check customer balance as the primary limit
        const custResult = await (window as any).electronAPI.db.customers.getById(payment.customer_id);
        if (custResult.success && custResult.data) {
            max = Math.round((Number(custResult.data.balance) + Number(payment.amount)) * 100) / 100;
        }

        // Check invoice balance if linked
        if (payment.reference_id && payment.reference_type && String(payment.reference_id) !== 'null') {
            const result = await (window as any).electronAPI.db.salesInvoices.getById(payment.reference_id);
            if (result.success && result.data) {
                const invMax = Math.round((Number(result.data.balance) + Number(payment.amount)) * 100) / 100;
                // If invoice limit is lower than customer limit, use invoice limit
                if (max === null || invMax < max) {
                    max = invMax;
                }
            }
        } else {
            // General / Opening Balance payment: Cap it by the opening portion only
            // OpeningPortion = TotalBalance - Sum(UnpaidInvoices)
            const duesRes = await (window as any).electronAPI.db.customers.getUnpaidInvoices(payment.customer_id, currentCompany!.id);
            const dues = (duesRes.data || []).filter((inv: any) =>
                documentMatchesFiscalYearSuffix(inv?.invoice_number, fiscalYear)
            );
            const invoiceSum = dues.reduce((sum: number, i: any) => sum + i.balance, 0);
            const currentOpeningPortion = Math.round((Number(custResult.data.balance) - invoiceSum + Number(payment.amount)) * 100) / 100;
            
            if (max === null || currentOpeningPortion < max) {
                max = currentOpeningPortion;
            }
        }
    } catch (e) {}
    
    setMaxAllowedAmount(max);
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
      // Auto-set amount to the total of selection
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

      if (selectedReceiptKeys.length === 0) {
        notification.error({ message: 'Error', description: 'Please select at least one invoice or opening balance row first.', duration: 0 });
        return;
      }

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

         let detailsArray = [];

         for (const inv of selectedInvoices) {
            if (remainingAmount <= 0) break;
            
            const applyToThis = Math.min(remainingAmount, inv.balance);
            
            detailsArray.push({
                reference_type: inv.id === 'opening_balance' ? null : 'sales_invoice',
                reference_id: inv.id === 'opening_balance' ? null : inv.id,
                amount: applyToThis,
                invoice_number: inv.invoice_number,
            });
            
            remainingAmount = Math.round((remainingAmount - applyToThis) * 100) / 100;
         }
         
         const taxAmount = amount * (taxDeductionRate / 100);
         
         // If only 1 invoice is fully/partially paid, we could set its ref_id. 
         // But grouping them all in 'details' works identically in our updated handler.
         const isSingle = detailsArray.length === 1;
         
         const paymentData = {
             ...basePayment,
             amount: amount - remainingAmount, // The actual applied amount
             tax_deduction: taxAmount,
             tax_deduction_rate: taxDeductionRate,
             reference_type: isSingle ? detailsArray[0].reference_type : 'bulk',
             reference_id: isSingle ? detailsArray[0].reference_id : null,
             details: JSON.stringify(detailsArray)
         };
         
         await (window as any).electronAPI.db.payments.create(paymentData);
      }

      // Selection is now required, so remainingAmount (if any) is treated as an overpayment?
      // Actually, we force selection, so if anything is left after filling selected, we just apply it to the last selection
      // OR we just don't allow general payments here.

      message.success(`Receipt recorded for ${selectedCustomer.name}`);
      receiptForm.resetFields();
      setSelectedReceiptKeys([]);

      // Always refresh the current view; never auto-close when balance hits zero
      openReceiptForm(selectedCustomer);
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
        const result = await (window as any).electronAPI.db.payments.delete(pendingDeleteId);
        if (result.success) {
          message.success('Payment deleted');
          if (selectedCustomer) {
            openReceiptForm(selectedCustomer);
            loadCustomers();
          }
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to delete payment', duration: 0 });
        }
      } catch (error) {
        notification.error({ message: 'Error', description: 'Failed to delete payment', duration: 0 });
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

  const customerColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: (v: unknown) => (v != null ? String(v) : '—') },
    { title: 'Customer', dataIndex: 'name', key: 'name', render: (v: unknown) => (v != null ? String(v) : '—') },
    {
      title: 'Outstanding',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (val: number) => <span style={{ color: '#cf1322', fontWeight: 600 }}>{(Number(val) || 0).toLocaleString()}</span>,
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

  const filteredCustomers = (Array.isArray(customers) ? customers : []).filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      (c.name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q);
    return matchesQuery;
  });

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
          {selectedRowKeys.length > 0 && (
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              onClick={handleRequestBulkDelete}
            >
              Delete Selected ({selectedRowKeys.length})
            </Button>
          )}
        </div>
        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
          Record payments and track customer outstanding balances.
        </p>
      </div>

      <Table
        columns={customerColumns}
        dataSource={filteredCustomers}
        loading={loading}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
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
              setSelectedCustomer(null);
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
                { title: 'PO Number', dataIndex: 'po_number', key: 'po_number', width: 130, render: (v) => (v != null && String(v).trim() !== '' ? String(v) : '—') },
                { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '—' },
                { title: 'Amount', dataIndex: 'total_amount', key: 'amount', align: 'right', render: (v) => Number(v).toLocaleString() },
                { title: 'Pending', dataIndex: 'balance', key: 'balance', align: 'right', render: (v) => <strong style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</strong> },
              ]}
              locale={{ emptyText: "No pending dues." }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Record Payment</h3>
            <div style={{ marginBottom: 16, display: selectedReceiptKeys.length === 0 ? 'block' : 'none' }}>
              <div style={{ padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4, color: '#d46b08', fontSize: 13 }}>
                Select dues from the left to enable payment details.
              </div>
            </div>
            <Form form={receiptForm} layout="vertical" onFinish={handleRecordReceipt}>
              <Form.Item
                name="amount"
                label="Amount received"
                rules={[{ required: true, message: 'Enter amount received' }]}
              >
                <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="Amount" disabled={selectedReceiptKeys.length === 0} />
              </Form.Item>
              <Form.Item name="tax_deduction_rate" label="Tax deduction %" initialValue={0} required tooltip="Percentage of tax deducted (0-100)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="%" addonAfter="%" disabled={selectedReceiptKeys.length === 0} />
              </Form.Item>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, background: '#fafafa', padding: 12, borderRadius: 4, border: '1px solid #f0f0f0', opacity: selectedReceiptKeys.length === 0 ? 0.5 : 1 }}>
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
                <DatePicker style={{ width: '100%' }} disabled={selectedReceiptKeys.length === 0} />
              </Form.Item>
              <Form.Item name="payment_method" label="Payment method" initialValue="cash">
                <Select disabled={selectedReceiptKeys.length === 0}>
                  <Select.Option value="cash">Cash</Select.Option>
                  <Select.Option value="bank">Bank Transfer</Select.Option>
                  <Select.Option value="cheque">Cheque</Select.Option>
                  <Select.Option value="online">Online Payment</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="notes" label="Notes" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="Optional" disabled={selectedReceiptKeys.length === 0} />
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
              { title: 'Ref', dataIndex: 'reference_type', key: 'ref', render: (v, r: any) => {
                  if (r.details) {
                      try {
                          const parsed = JSON.parse(r.details);
                          if (parsed.length > 1) return `Bulk Payment (${parsed.length} items)`;
                      } catch (e) {}
                  }
                  return v && v !== 'null' && v !== 'bulk' ? (v === 'sales_invoice' ? `Sales Invoice (${r.invoice_number || '#' + r.reference_id})` : `${v} (#${r.reference_id})`) : 'General';
              }},
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
        closeIcon={
          <Space>
            <MinusSquareOutlined
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setEditModalVisible(false);
                minimizeModal({
                  id: `receivables-editpay-${editingPayment?.id || 'new'}`,
                  title: `Edit Payment #${editingPayment?.payment_number || ''}`.trim(),
                  onRestore: () => setEditModalVisible(true),
                });
              }}
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => setEditModalVisible(false)} />
          </Space>
        }
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditPayment}>
          <Form.Item
            name="amount"
            label="Amount"
            extra={maxAllowedAmount !== null ? `Max allowed based on current balance: ${maxAllowedAmount.toLocaleString()}` : undefined}
            rules={[
                { required: true, message: 'Enter amount' },
                {
                    validator: (_, value) => {
                        if (maxAllowedAmount !== null && value > maxAllowedAmount) {
                            return Promise.reject(`Amount exceeds total due (${maxAllowedAmount.toLocaleString()})`);
                        }
                        return Promise.resolve();
                    }
                }
            ]}
          >
            <InputNumber min={1} max={maxAllowedAmount ?? undefined} precision={0} style={{ width: '100%' }} disabled={!!(editingPayment && editingPayment.details && (() => { try { return JSON.parse(editingPayment.details).length > 1; } catch (e) { return false; } })())} />
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

          {editingPayment && editingPayment.details && (() => {
              try {
                  const detailsArray = JSON.parse(editingPayment.details);
                  if (detailsArray.length > 1) {
                      return (
                          <div style={{ marginTop: 16 }}>
                              <h4 style={{ margin: '0 0 8px 0' }}>Allocated Invoices</h4>
                              <Table
                                  dataSource={detailsArray}
                                  rowKey={(r: any) => r.reference_id || 'opening_balance'}
                                  size="small"
                                  pagination={false}
                                  columns={[
                                      { title: 'Ref', dataIndex: 'invoice_number', key: 'invoice_number', render: (v, r: any) => v || (r.reference_type === null ? 'Opening Balance' : 'Unknown') },
                                      { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v) => Number(v).toLocaleString() }
                                  ]}
                                  style={{ border: '1px solid #f0f0f0', borderRadius: 4 }}
                              />
                          </div>
                      );
                  }
              } catch (e) {}
              return null;
          })()}
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
        <p>Enter admin password to delete {pendingDeleteId ? 'this record' : `${pendingDeleteIds.length} records`}:</p>
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

export default Receivables;

