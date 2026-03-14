import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, notification, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, StopOutlined, EyeOutlined, SearchOutlined, MinusSquareOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const PurchaseInvoices: React.FC = () => {
  const { currentCompany, user, minimizeModal } = useApp();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedInvoice, _setSelectedInvoice] = useState<any>(null);
  // Admin password delete
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();

  // Section permissions (Purchase)
  const isAdminUser = user?.role_id === 1 || user?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const purchasePerm: string = isAdminUser ? 'all' : (sectionPerms.purchase || 'read');
  // const canCreateOrEdit = isAdminUser || purchasePerm === 'write' || purchasePerm === 'edit' || purchasePerm === 'all';
  const canEditOrDelete = isAdminUser || purchasePerm === 'edit' || purchasePerm === 'all';
  const isReadOnlySection = !isAdminUser && purchasePerm === 'read';

  useEffect(() => {
    if (currentCompany) {
      loadInvoices();
      loadVendors();
      loadItems();
      loadBrands();
    }
  }, [currentCompany]);

  const loadBrands = async () => {
    try {
      const result = await (window as any).electronAPI.db.brands.getAll();
      if (result?.success && Array.isArray(result.data)) setBrands(result.data);
    } catch (_) {}
  };

  const getItemsForBrand = (brandId: number | undefined) => {
    if (!brandId) return items;
    return items.filter((i: any) => i.brand_id === brandId);
  };

  const loadInvoices = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.purchaseInvoices.getAll(currentCompany.id);
      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load purchase invoices', duration: 0 });
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
        items: values.items || [],
        created_by: user?.id,
      };

      // Calculate totals
      let subtotal = 0;
      let gstTotal = 0;
      invoiceData.items.forEach((item: any) => {
        const lineTotal = item.quantity * item.unit_price;
        subtotal += lineTotal;

        // Purchase invoices: do not use per-line GST rate field anymore
        const gstAmount = 0;
        item.gst_rate = 0;
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
          notification.error({ message: 'Error', description: result.error || 'Failed to update invoice', duration: 0 });
        }
      } else {
        const result = await (window as any).electronAPI.db.purchaseInvoices.create(invoiceData);
        if (result.success) {
          message.success('Invoice created successfully');
        } else {
          Modal.error({ title: 'Error', content: result.error || 'Failed to create invoice' });
        }
      }
      setModalVisible(false);
      setEditingInvoice(null);
      form.resetFields();
      loadInvoices();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Operation failed', duration: 0 });
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
        notification.error({ message: 'Error', description: result.error || 'Failed to record payment', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Operation failed', duration: 0 });
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
      const result = await (window as any).electronAPI.db.purchaseInvoices.delete(pendingDeleteId);
      if (result.success) {
        message.success('Invoice deleted successfully');
        loadInvoices();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete invoice', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete invoice', duration: 0 });
    } finally {
      setDeletePasswordModal(false);
      setPendingDeleteId(null);
      setAdminPassword('');
    }
  };

  const handleDisableInvoice = async (id: number) => {
    try {
      const fetched = await (window as any).electronAPI.db.purchaseInvoices.getById(id);
      if (!fetched.success || !fetched.data) {
        message.error('Failed to load invoice');
        return;
      }
      const data = fetched.data;
      const result = await (window as any).electronAPI.db.purchaseInvoices.update(id, {
        ...data,
        status: 'cancelled',
      });
      if (result.success) {
        message.success('Invoice disabled');
        loadInvoices();
      } else {
        message.error(result.error || 'Failed to disable invoice');
      }
    } catch (error) {
      message.error('Failed to disable invoice');
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
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        if (record.status === 'cancelled') {
          return <Tag color="red">Disabled</Tag>;
        }
        if (isReadOnlySection) {
          return (
            <Space>
              <Button
                icon={<EyeOutlined />}
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
                title="View Invoice"
              />
            </Space>
          );
        }
        return (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={async () => {
                const hide = message.loading('Fetching invoice details...', 0);
                try {
                  const result = await (window as any).electronAPI.db.purchaseInvoices.getById(record.id);
                  if (result.success && result.data) {
                    const detailedInvoice = result.data;
                    setEditingInvoice(detailedInvoice);
                    const itemsWithBrand = (detailedInvoice.items || []).map((line: any) => ({
                      ...line,
                      brand_id: items.find((i: any) => i.id === line.item_id)?.brand_id,
                    }));
                    form.setFieldsValue({
                      ...detailedInvoice,
                      invoice_date: dayjs(detailedInvoice.invoice_date),
                      due_date: detailedInvoice.due_date ? dayjs(detailedInvoice.due_date) : null,
                      items: itemsWithBrand,
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
            {canEditOrDelete && (
              <>
                <Popconfirm title="Are you sure you want to disable this invoice? This cannot be undone." onConfirm={() => handleDisableInvoice(record.id)} okText="Yes, Disable" cancelText="Cancel">
                  <Button icon={<StopOutlined />} title="Disable" />
                </Popconfirm>
                <Button danger icon={<DeleteOutlined />} onClick={() => handleRequestDelete(record.id)} />
              </>
            )}
          </Space>
        );
      },
    },
  ];

  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = invoices.filter(inv =>
    (inv.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.vendor_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>Purchase Invoices</h1>
          <Input
            placeholder="Search by inv # or vendor..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>
        {!isReadOnlySection && (
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
        )}
      </div>

      <Table
        columns={columns}
        dataSource={filteredInvoices}
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
        closeIcon={
          <Space>
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setModalVisible(false);
                const values = form.getFieldsValue();
                const invNum = values.invoice_number || 'New PI';
                minimizeModal({
                  id: editingInvoice ? `pi-edit-${editingInvoice.id}` : 'pi-new',
                  title: editingInvoice ? `Edit PI ${invNum}` : `New PI ${invNum}`,
                  onRestore: () => setModalVisible(true)
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setModalVisible(false);
              setEditingInvoice(null);
              form.resetFields();
            }} />
          </Space>
        }
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
                {fields.map(({ key, name, ...restField }) => {
                  const currentBrandId = form.getFieldValue(['items', name, 'brand_id']);
                  const filteredItems = getItemsForBrand(currentBrandId);
                  return (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...restField} name={[name, 'brand_id']} rules={[{ required: true, message: 'Brand' }]}>
                      <Select
                        placeholder="Brand"
                        style={{ width: 140 }}
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) => {
                          const label = (option?.children ?? '').toString().toLowerCase();
                          const search = (input || '').trim().toLowerCase();
                          if (!search) return true;
                          if (label.includes(search)) return true;
                          const initials = label.split(/\s+/).map((w: string) => (w[0] || '').toLowerCase()).join('');
                          return initials.startsWith(search) || initials.includes(search);
                        }}
                        onChange={(brandId) => {
                          const currentItems = form.getFieldValue('items') || [];
                          currentItems[name] = { ...currentItems[name], brand_id: brandId, item_id: undefined, unit_price: undefined, gst_rate: 0 };
                          form.setFieldsValue({ items: currentItems });
                        }}
                      >
                        {(brands || []).filter((b: any) => b?.id != null).map((b: any) => (
                          <Select.Option key={b.id} value={b.id}>{b.name ?? ''}</Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'item_id']}
                      rules={[{ required: true, message: 'Select item' }]}
                    >
                      <Select
                        placeholder="Item"
                        style={{ width: 220 }}
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) => {
                          const label = (option?.children || []).toString().toLowerCase();
                          const search = (input || '').trim().toLowerCase();
                          return label.includes(search);
                        }}
                        onChange={(value) => {
                          const item = items.find((i: any) => i.id === value);
                          if (item) {
                            const currentItems = form.getFieldValue('items') || [];
                            currentItems[name] = {
                              ...currentItems[name],
                              unit_price: item.purchase_price,
                              gst_rate: item.gst_rate || 0,
                            };
                            form.setFieldsValue({ items: currentItems });
                          }
                        }}
                      >
                        {filteredItems.map((item: any) => (
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
                      <InputNumber placeholder="Qty" min={0} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'unit_price']}
                      rules={[{ required: true, message: 'Price' }]}
                    >
                      <InputNumber placeholder="Price" min={0} />
                    </Form.Item>
                    <Button onClick={() => remove(name)}>Remove</Button>
                  </Space>
                );
                })}
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
        <p>Enter admin password to delete this purchase invoice:</p>
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

export default PurchaseInvoices;
