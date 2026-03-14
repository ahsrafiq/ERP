import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const Expenses: React.FC = () => {
  const { currentCompany, user } = useApp();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [form] = Form.useForm();

  // Admin password delete
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');

  // Section permissions (Expenses)
  const isAdminUser = user?.role_id === 1 || (user as any)?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const expensesPerm: string = isAdminUser ? 'all' : (sectionPerms.expenses || 'read');
  const canEditOrDelete = isAdminUser || expensesPerm === 'edit' || expensesPerm === 'all' || expensesPerm === 'write';
  const isReadOnlySection = !isAdminUser && expensesPerm === 'read';

  useEffect(() => {
    if (currentCompany) {
      loadExpenses();
      loadCategories();
      loadVendors();
    }
  }, [currentCompany]);

  const loadExpenses = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.expenses.getAll(currentCompany.id);
      if (result.success) {
        setExpenses(result.data || []);
      }
    } catch (error) {
      message.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.expenses.getCategories(currentCompany.id);
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load expense categories');
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

  const handleSave = async (values: any) => {
    if (!currentCompany) return;
    try {
      const expenseData = {
        ...values,
        company_id: currentCompany.id,
        expense_date: values.expense_date?.format?.('YYYY-MM-DD') || values.expense_date,
        total_amount: (Number(values.amount) || 0) + (Number(values.tax_amount) || 0),
      };

      if (editingExpense) {
        const result = await (window as any).electronAPI.db.expenses.update(editingExpense.id, expenseData);
        if (result.success) {
          message.success('Expense updated successfully');
        } else {
          message.error(result.error || 'Failed to update expense');
        }
      } else {
        const result = await (window as any).electronAPI.db.expenses.create(expenseData);
        if (result.success) {
          message.success('Expense created successfully');
        } else {
          message.error(result.error || 'Failed to create expense');
        }
      }
      setModalVisible(false);
      setEditingExpense(null);
      form.resetFields();
      loadExpenses();
    } catch (error) {
      message.error('Operation failed');
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
            message.error('Incorrect admin password');
            setAdminPassword('');
            return;
        }
    if (pendingDeleteId == null) return;
    try {
      const result = await (window as any).electronAPI.db.expenses.delete(pendingDeleteId);
      if (result.success) {
        message.success('Expense deleted successfully');
        loadExpenses();
      } else {
        message.error(result.error || 'Failed to delete expense');
      }
    } catch {
      message.error('Failed to delete expense');
    } finally {
      setDeletePasswordModal(false);
      setPendingDeleteId(null);
      setAdminPassword('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'green';
      case 'pending': return 'orange';
      case 'rejected': return 'red';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Expense Number',
      dataIndex: 'expense_number',
      key: 'expense_number',
    },
    {
      title: 'Date',
      dataIndex: 'expense_date',
      key: 'expense_date',
    },
    {
      title: 'Category',
      dataIndex: 'category_name',
      key: 'category_name',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (amount != null ? Number(amount).toFixed(2) : '—'),
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => (amount != null ? Number(amount).toFixed(2) : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
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
                setEditingExpense(record);
                form.setFieldsValue({
                  ...record,
                  expense_date: dayjs(record.expense_date),
                });
                setModalVisible(true);
              }}
            />
            {canEditOrDelete && (
              <Button danger icon={<DeleteOutlined />} onClick={() => handleRequestDelete(record.id)} />
            )}
          </Space>
        );
      },
    },
  ];

  const [searchQuery, setSearchQuery] = useState('');

  const filteredExpenses = expenses.filter(exp =>
    (exp.expense_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (exp.category_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (exp.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>Expenses</h1>
          <Input
            placeholder="Search by exp #, category or desc..."
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
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
              setEditingExpense(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Add Expense
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={filteredExpenses}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingExpense(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="expense_date" label="Expense Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="category_id" label="Category" rules={[{ required: true, message: 'Select category' }]}>
            <Select placeholder="Select category" showSearch optionFilterProp="children">
              {categories.map(cat => (
                <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="vendor_id" label="Vendor">
            <Select allowClear>
              {vendors.map(vendor => (
                <Select.Option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tax_amount" label="Tax Amount" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="pending">
            <Select>
              <Select.Option value="pending">Pending</Select.Option>
              <Select.Option value="approved">Approved</Select.Option>
              <Select.Option value="rejected">Rejected</Select.Option>
            </Select>
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
      >
        <p>Enter admin password to delete this expense:</p>
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

export default Expenses;
