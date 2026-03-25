import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, notification } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, LockOutlined, MinusSquareOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { filterRowsByOperationalFiscalYear } from '../../utils/fiscalYearFilter';
import { useLocation } from 'react-router-dom';

const Expenses: React.FC = () => {
  const { currentCompany, user, fiscalYear, minimizeModal } = useApp();
  const location = useLocation();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [form] = Form.useForm();

  // Admin password delete
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const passwordInputRef = React.useRef<any>(null);

  useEffect(() => {
    if (deletePasswordModal) {
      setTimeout(() => {
        passwordInputRef.current?.select();
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [deletePasswordModal]);

  // Section permissions (Expenses)
  const isAdminUser = user?.role_id === 1 || (user as any)?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const expensesPerm: string = isAdminUser ? 'all' : (sectionPerms.expenses || 'read');
  const canEditOrDelete = isAdminUser || expensesPerm === 'edit' || expensesPerm === 'all' || expensesPerm === 'write';
  const isReadOnlySection = !isAdminUser && expensesPerm === 'read';

  useEffect(() => {
    if (currentCompany) {
      if (location.pathname === '/expenses/list') {
        loadExpenses();
        loadCategories();
      } else if (expenses.length === 0) {
        loadExpenses();
        loadCategories();
      }
    }
  }, [currentCompany, location.pathname, fiscalYear]);

  const loadExpenses = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.expenses.getAll(currentCompany.id);
      if (result.success) {
        setExpenses(filterRowsByOperationalFiscalYear(result.data || [], fiscalYear));
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load expenses', duration: 0 });
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


  const handleSave = async (values: any) => {
    if (!currentCompany) return;
    try {
      const expenseData = {
        ...values,
        company_id: currentCompany.id,
        expense_date: values.expense_date?.format?.('YYYY-MM-DD') || values.expense_date,
        total_amount: Number(values.amount) || 0,
      };

      if (editingExpense) {
        const result = await (window as any).electronAPI.db.expenses.update(editingExpense.id, expenseData);
        if (result.success) {
          message.success('Expense updated successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to update expense', duration: 0 });
        }
      } else {
        const result = await (window as any).electronAPI.db.expenses.create(expenseData);
        if (result.success) {
          message.success('Expense created successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to create expense', duration: 0 });
        }
      }
      setModalVisible(false);
      setEditingExpense(null);
      form.resetFields();
      loadExpenses();
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
      const result = await (window as any).electronAPI.db.expenses.delete(pendingDeleteId);
      if (result.success) {
        message.success('Expense deleted successfully');
        loadExpenses();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete expense', duration: 0 });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to delete expense', duration: 0 });
    } finally {
      setDeletePasswordModal(false);
      setPendingDeleteId(null);
      setAdminPassword('');
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
        closeIcon={
          <Space>
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setModalVisible(false);
                const values = form.getFieldsValue();
                const expNum = values.expense_number || 'New Expense';
                minimizeModal({
                  id: editingExpense ? `expense-edit-${editingExpense.id}` : 'expense-new',
                  title: editingExpense ? `Edit Expense ${expNum}` : `New Expense ${expNum}`,
                  onRestore: () => {
                    setEditingExpense(editingExpense);
                    setModalVisible(true);
                  }
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setModalVisible(false);
              setEditingExpense(null);
              form.resetFields();
            }} />
          </Space>
        }
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
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
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
          ref={passwordInputRef}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default Expenses;
