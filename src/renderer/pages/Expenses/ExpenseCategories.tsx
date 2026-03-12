import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const ExpenseCategories: React.FC = () => {
  const { currentCompany, user } = useApp();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Section permissions (Expenses)
  const isAdminUser = user?.role_id === 1 || (user as any)?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const expensesPerm: string = isAdminUser ? 'all' : (sectionPerms.expenses || 'read');
  const isReadOnlySection = !isAdminUser && expensesPerm === 'read';
  const loadErrorShown = useRef(false);

  useEffect(() => {
    if (!currentCompany) return;
    loadErrorShown.current = false;
    loadCategories();
  }, [currentCompany?.id]);

  const loadCategories = async () => {
    if (!currentCompany) return;
    setLoading(true);
    loadErrorShown.current = false;
    try {
      const result = await (window as any).electronAPI.db.expenses.getCategories(currentCompany.id);
      if (result.success) {
        setCategories(result.data || []);
      } else if (!loadErrorShown.current) {
        loadErrorShown.current = true;
        message.error(result.error || 'Failed to load categories');
      }
    } catch (error) {
      if (!loadErrorShown.current) {
        loadErrorShown.current = true;
        message.error('Failed to load categories');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    if (!currentCompany) return;
    try {
      const result = await (window as any).electronAPI.db.expenses.createCategory({
        company_id: currentCompany.id,
        name: values.name,
        description: values.description,
      });
      if (result.success) {
        message.success('Category added');
        setModalVisible(false);
        form.resetFields();
        loadCategories();
      } else {
        message.error(result.error || 'Failed to add category');
      }
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Expense Categories</h1>
        {!isReadOnlySection && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true); }}>
            Add Category
          </Button>
        )}
      </div>
      <Table columns={columns} dataSource={categories} loading={loading} rowKey="id" pagination={{ pageSize: 20 }} />
      <Modal title="Add Category" open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Enter name' }]}>
            <Input placeholder="e.g. Travel, Office Supplies" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpenseCategories;
