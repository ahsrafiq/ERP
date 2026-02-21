import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';

const Expenses: React.FC = () => {
  const { currentCompany } = useApp();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [form] = Form.useForm();

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

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.expenses.delete(id);
      if (result.success) {
        message.success('Expense deleted successfully');
        loadExpenses();
      } else {
        message.error(result.error || 'Failed to delete expense');
      }
    } catch (error) {
      message.error('Failed to delete expense');
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
      render: (_: any, record: any) => (
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
          <Popconfirm
            title="Are you sure you want to delete this expense?"
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
        <h1>Expenses</h1>
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
      </div>

      <Table
        columns={columns}
        dataSource={expenses}
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
    </div>
  );
};

export default Expenses;
