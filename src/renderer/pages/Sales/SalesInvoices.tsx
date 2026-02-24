import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, CarryOutOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PrintTemplate from '../../components/PrintTemplate';

const SalesInvoices: React.FC = () => {
  const { currentCompany, companies, user, fiscalYear } = useApp();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [printData, setPrintData] = useState<any>(null);

  useEffect(() => {
    if (currentCompany) {
      loadInvoices();
      loadCustomers();
      loadItems();
    }
  }, [currentCompany]);

  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id);
      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (error) {
      message.error(`Failed to load ${docLabel}s`);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.customers.getAll(currentCompany.id);
      if (result.success) {
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load customers');
    }
  };

  const loadItems = async () => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
      if (result.success) {
        setItems(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load items');
    }
  };

  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [letterheadReady, setLetterheadReady] = useState(false);

  const handlePrint = async (record: any) => {
    try {
      setLetterheadReady(false);
      const result = await (window as any).electronAPI.db.salesInvoices.getById(record.id);
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
        console.log('[Print] Calling electronAPI.db.files.print()...');
        const result = await (window as any).electronAPI.db.files.print();
        console.log('[Print] Result:', result);
      } catch (err) {
        console.error('[Print] IPC print failed, falling back to window.print():', err);
        window.print();
      }
    }, 300);
  };

  const handleSavePDF = async () => {
    try {
      document.body.classList.add('capturing-pdf');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const result = await (window as any).electronAPI.db.files.printToPDF();
      if (result.success) {
        message.success(`Saved to: ${result.filePath}`);
      } else if (result.error !== 'Save cancelled') {
        message.error(result.error || 'Failed to save PDF');
      }
    } catch (error) {
      message.error('Failed to save PDF');
    } finally {
      document.body.classList.remove('capturing-pdf');
    }
  };

  const handleNewInvoice = async () => {
    setEditingInvoice(null);
    form.resetFields();
    setModalVisible(true);

    if (currentCompany) {
      try {
        const [invRes, poRes] = await Promise.all([
          (window as any).electronAPI.db.salesInvoices.getNextNumber(currentCompany.id, fiscalYear, isGst),
          (window as any).electronAPI.db.salesInvoices.getNextPoNumber(currentCompany.id, fiscalYear)
        ]);

        form.setFieldsValue({
          invoice_number: invRes.success ? invRes.data : undefined,
          po_number: poRes.success ? poRes.data : undefined,
          invoice_date: dayjs(),
        });
      } catch (err) {
        console.error('Failed to pre-fill invoice:', err);
        form.setFieldsValue({ invoice_date: dayjs() });
      }
    }
  };

  const isGst = currentCompany?.is_gst_enabled === 1;
  const docLabel = isGst ? 'Invoice' : 'Bill';
  const docPlaceholder = isGst ? 'INV-0001/26' : 'BILL-0001/26';


  const handleSave = async (values: any) => {
    if (!currentCompany) return;
    try {
      const invoiceData = {
        ...values,
        company_id: currentCompany.id,
        is_gst_enabled: currentCompany.is_gst_enabled,
        invoice_number: values.invoice_number?.trim?.() || undefined,
        fiscal_year: fiscalYear,
        invoice_date: values.invoice_date.format('YYYY-MM-DD'),
        due_date: values.due_date?.format('YYYY-MM-DD'),
        items: values.items || [],
        created_by: user?.id,
      };

      // Calculate totals
      let subtotal = 0;
      let gstTotal = 0;
      invoiceData.items.forEach((item: any) => {
        const lineTotal = item.quantity * item.unit_price;
        subtotal += lineTotal;
        const gstAmount = isGst ? lineTotal * ((item.gst_rate || 0) / 100) : 0;
        gstTotal += gstAmount;
        item.gst_amount = gstAmount;
        item.line_total = lineTotal + gstAmount;
      });
      invoiceData.subtotal = subtotal;
      invoiceData.gst_total = gstTotal;
      invoiceData.total_amount = subtotal + gstTotal;
      invoiceData.balance = invoiceData.total_amount;

      if (editingInvoice) {
        const result = await (window as any).electronAPI.db.salesInvoices.update(editingInvoice.id, invoiceData);
        if (result.success) {
          message.success(`${docLabel} updated successfully`);
        } else {
          message.error(result.error || `Failed to update ${docLabel.toLowerCase()}`);
        }
      } else {
        const result = await (window as any).electronAPI.db.salesInvoices.create(invoiceData);
        if (result.success) {
          message.success(`${docLabel} created successfully`);
        } else {
          message.error(result.error || `Failed to create ${docLabel.toLowerCase()}`);
        }
      }
      setModalVisible(false);
      setEditingInvoice(null);
      form.resetFields();
      loadInvoices();
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const handleRecordPayment = async (values: any) => {
    if (!currentCompany || !selectedInvoice) return;
    try {
      const paymentData = {
        ...values,
        company_id: currentCompany.id,
        payment_date: values.payment_date.format('YYYY-MM-DD'),
        payment_type: 'in',
        reference_type: 'sales_invoice',
        reference_id: selectedInvoice.id,
        customer_id: selectedInvoice.customer_id,
        created_by: user?.id,
      };

      const result = await (window as any).electronAPI.db.payments.create(paymentData);
      if (result.success) {
        message.success('Payment recorded successfully');
        setPaymentModalVisible(false);
        paymentForm.resetFields();
        loadInvoices();
      } else {
        message.error(result.error || 'Failed to record payment');
      }
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.salesInvoices.delete(id);
      if (result.success) {
        message.success('Invoice deleted successfully');
        loadInvoices();
      } else {
        message.error(result.error || 'Failed to delete invoice');
      }
    } catch (error) {
      message.error('Failed to delete invoice');
    }
  };

  const handleCreateDC = async (record: any) => {
    try {
      const result = await (window as any).electronAPI.db.deliveryChallans.createFromInvoice(record.id, user?.id);
      if (result.success && result.data) {
        message.success(`Delivery Challan ${result.data.challan_number} created from ${docLabel.toLowerCase()}`);
        navigate('/sales/delivery-challans');
      } else {
        message.error(result.error || 'Failed to create delivery challan');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to create delivery challan');
    }
  };

  const columns = [
    {
      title: `${docLabel} #`,
      dataIndex: 'invoice_number',
      key: 'invoice_number',
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
    },
    {
      title: 'PO Number',
      dataIndex: 'po_number',
      key: 'po_number',
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => amount.toFixed(2),
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number) => (
        <span style={{ color: balance > 0 ? '#f5222d' : '#52c41a', fontWeight: 'bold' }}>
          {balance.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            title="Record Payment"
            type="primary"
            size="small"
            disabled={record.balance <= 0}
            onClick={() => {
              setSelectedInvoice(record);
              paymentForm.setFieldsValue({
                amount: record.balance,
                payment_date: dayjs(),
              });
              setPaymentModalVisible(true);
            }}
          >
            Pay
          </Button>
          <Button
            icon={<CarryOutOutlined />}
            onClick={() => handleCreateDC(record)}
            title="Create Delivery Challan"
          />
          <Button
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
            title={`Print ${docLabel}`}
          />
          <Button
            icon={<EditOutlined />}
            onClick={async () => {
              const hide = message.loading('Fetching invoice details...', 0);
              try {
                const result = await (window as any).electronAPI.db.salesInvoices.getById(record.id);
                if (result.success && result.data) {
                  const detailedInvoice = result.data;
                  setEditingInvoice(detailedInvoice);
                  form.setFieldsValue({
                    ...detailedInvoice,
                    invoice_number: detailedInvoice.invoice_number,
                    invoice_date: dayjs(detailedInvoice.invoice_date),
                    due_date: detailedInvoice.due_date ? dayjs(detailedInvoice.due_date) : null,
                  });
                  setModalVisible(true);
                } else {
                  message.error('Failed to fetch invoice details');
                }
              } catch (error) {
                message.error('Failed to fetch invoice details');
              } finally {
                hide();
              }
            }}
          />
          <Popconfirm
            title={`Are you sure you want to delete this ${docLabel.toLowerCase()}?`}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Sales {docLabel}s</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewInvoice}
        >
          New {docLabel}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={invoices}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingInvoice ? `Edit ${docLabel}` : `New ${docLabel}`}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingInvoice(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Space align="start">
            <Form.Item name="invoice_number" label={`${docLabel} #`} rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder={`e.g. ${docPlaceholder}`} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="po_number" label="PO Number">
              <Input placeholder="e.g. PO-12345" style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
            <Select>
              {customers.map(customer => (
                <Select.Option key={customer.id} value={customer.id}>
                  {customer.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Space>
            <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
              <DatePicker />
            </Form.Item>
            <Form.Item name="due_date" label="Due Date">
              <DatePicker />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="draft">
              <Select>
                <Select.Option value="draft">Draft</Select.Option>
                <Select.Option value="finalized">Finalized</Select.Option>
              </Select>
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
                    <Form.Item
                      {...restField}
                      name={[name, 'item_id']}
                      rules={[{ required: true, message: 'Select item' }]}
                    >
                      <Select
                        placeholder="Item"
                        style={{ width: 220 }}
                        onChange={(value) => {
                          const item = items.find(i => i.id === value);
                          if (item) {
                            const currentItems = form.getFieldValue('items');
                            currentItems[name] = {
                              ...currentItems[name],
                              description: item.description || '',
                              brand: item.brand_name || '',
                              unit_price: item.selling_price,
                              gst_rate: item.gst_rate || 0,
                            };
                            form.setFieldsValue({ items: currentItems });
                          }
                        }}
                      >
                        {items.map(item => (
                          <Select.Option key={item.id} value={item.id}>
                            {item.name} ({item.code})
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'description']}>
                      <Input placeholder="Description" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'brand']}>
                      <Input placeholder="Brand" style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'availability']}>
                      <Input placeholder="Availability" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      rules={[{ required: true, message: 'Quantity' }]}
                    >
                      <InputNumber placeholder="Qty" min={0.01} style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'unit_price']}
                      rules={[{ required: true, message: 'Price' }]}
                    >
                      <InputNumber placeholder="Price" min={0} />
                    </Form.Item>

                    {currentCompany?.is_gst_enabled && (
                      <Form.Item {...restField} name={[name, 'gst_rate']} initialValue={0}>
                        <InputNumber placeholder="GST %" min={0} max={100} />
                      </Form.Item>
                    )}

                    <Button onClick={() => remove(name)}>Remove</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block>
                    Add Item
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        title="Record Payment"
        open={paymentModalVisible}
        onCancel={() => {
          setPaymentModalVisible(false);
          paymentForm.resetFields();
        }}
        onOk={() => paymentForm.submit()}
      >
        <Form form={paymentForm} layout="vertical" onFinish={handleRecordPayment}>
          <div style={{ marginBottom: 16 }}>
            <strong>{docLabel}: </strong> {selectedInvoice?.invoice_number} <br />
            <strong>Pending Balance: </strong> {selectedInvoice?.balance.toFixed(2)}
          </div>
          <Form.Item
            name="amount"
            label="Payment Amount"
            rules={[
              { required: true, message: 'Please enter amount' },
              { type: 'number', max: selectedInvoice?.balance, message: 'Amount exceeds balance' }
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0.01} />
          </Form.Item>
          <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="payment_method" label="Payment Method" initialValue="cash">
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

      <Modal
        title="Print Preview"
        open={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        width={1000}
        footer={[
          <Button key="cancel" onClick={() => setIsPreviewVisible(false)}>
            Close
          </Button>,
          <Button
            key="pdf"
            icon={<PrinterOutlined />}
            onClick={handleSavePDF}
            disabled={(printData && (companies || []).find((c: any) => c.id === printData.company_id)?.letterhead_path) && !letterheadReady}
          >
            Save as PDF
          </Button>,
          <Button key="print" type="primary" onClick={actualPrint}>
            Print
          </Button>,
        ]}
        className="print-preview-modal"
      >
        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', background: '#f5f5f5' }}>
          <div style={{ background: 'white', padding: '10px', width: '210mm', margin: '0 auto', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
            {printData && (
              <PrintTemplate
                type={isGst ? 'invoice' : 'bill'}
                data={printData}
                company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                onLetterheadReady={() => setLetterheadReady(true)}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Hidden Print Container - used for PDF capture */}
      <div id="print-container">
        {printData && (
          <PrintTemplate
            type={isGst ? 'invoice' : 'bill'}
            data={printData}
            company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
            onLetterheadReady={() => setLetterheadReady(true)}
          />
        )}
      </div>
    </div>
  );
};

export default SalesInvoices;
