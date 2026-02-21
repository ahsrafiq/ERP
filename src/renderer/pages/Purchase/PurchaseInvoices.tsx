import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const PurchaseInvoices: React.FC = () => {
  const { currentCompany, user } = useApp();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();

  useEffect(() => {
    if (currentCompany) {
      loadInvoices();
      loadVendors();
      loadItems();
    }
  }, [currentCompany]);

  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.purchaseInvoices.getAll(currentCompany.id);
      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (error) {
      message.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.vendors.getAll(currentCompany.id);
      if (result.success) {
        setVendors(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load vendors');
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

  const handleSave = async (values: any) => {
    if (!currentCompany) return;
    try {
      const invoiceData = {
        ...values,
        company_id: currentCompany.id,
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

        let gstAmount = 0;
        if (currentCompany?.is_gst_enabled) {
          gstAmount = lineTotal * (item.gst_rate / 100);
        }

        gstTotal += gstAmount;
        item.gst_amount = gstAmount;
        item.line_total = lineTotal + gstAmount;
      });
      invoiceData.subtotal = subtotal;
      invoiceData.gst_total = gstTotal;
      invoiceData.total_amount = subtotal + gstTotal;
      invoiceData.balance = invoiceData.total_amount;

      if (editingInvoice) {
        const result = await (window as any).electronAPI.db.purchaseInvoices.update(editingInvoice.id, invoiceData);
        if (result.success) {
          message.success('Invoice updated successfully');
        } else {
          message.error(result.error || 'Failed to update invoice');
        }
      } else {
        const result = await (window as any).electronAPI.db.purchaseInvoices.create(invoiceData);
        if (result.success) {
          message.success('Invoice created successfully');
        } else {
          message.error(result.error || 'Failed to create invoice');
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
        payment_type: 'out',
        reference_type: 'purchase_invoice',
        reference_id: selectedInvoice.id,
        vendor_id: selectedInvoice.vendor_id,
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
      const result = await (window as any).electronAPI.db.purchaseInvoices.delete(id);
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

  const columns = [
    {
      title: 'Invoice Number',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
    },
    {
      title: 'Vendor',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
    },
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
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
          <Button icon={<PrinterOutlined />} />
          <Button
            icon={<EditOutlined />}
            onClick={async () => {
              const hide = message.loading('Fetching invoice details...', 0);
              try {
                const result = await (window as any).electronAPI.db.purchaseInvoices.getById(record.id);
                if (result.success && result.data) {
                  const detailedInvoice = result.data;
                  setEditingInvoice(detailedInvoice);
                  form.setFieldsValue({
                    ...detailedInvoice,
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
            title="Are you sure you want to delete this invoice?"
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
        <h1>Purchase Invoices</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingInvoice(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          New Invoice
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
        title={editingInvoice ? 'Edit Invoice' : 'New Purchase Invoice'}
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
          <Form.Item name="vendor_id" label="Vendor" rules={[{ required: true }]}>
            <Select>
              {vendors.map(vendor => (
                <Select.Option key={vendor.id} value={vendor.id}>
                  {vendor.name}
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
                              unit_price: item.purchase_price,
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
                    <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      rules={[{ required: true, message: 'Quantity' }]}
                    >
                      <InputNumber placeholder="Qty" min={0.01} />
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
            <strong>Invoice: </strong> {selectedInvoice?.invoice_number} <br />
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
    </div>
  );
};

export default PurchaseInvoices;
