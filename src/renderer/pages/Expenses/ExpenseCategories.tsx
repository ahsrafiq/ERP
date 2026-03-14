import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Modal, Form, Input, notification, message } from 'antd';
import { PlusOutlined, DeleteOutlined, LockOutlined, MinusSquareOutlined, CloseOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const ExpenseCategories: React.FC = () => {
  const { currentCompany, user, minimizeModal } = useApp();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Admin password delete
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');

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
        notification.error({ message: 'Error', description: result.error || 'Failed to load categories', duration: 0 });
      }
    } catch (error) {
      if (!loadErrorShown.current) {
        loadErrorShown.current = true;
        notification.error({ message: 'Error', description: 'Failed to load categories', duration: 0 });
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
        notification.error({ message: 'Error', description: result.error || 'Failed to add category', duration: 0 });
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
      const result = await (window as any).electronAPI.db.expenses.deleteCategory(pendingDeleteId);
      if (result.success) {
        message.success('Category deleted successfully');
        loadCategories();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete category', duration: 0 });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to delete category', duration: 0 });
    } finally {
      setDeletePasswordModal(false);
      setPendingDeleteId(null);
      setAdminPassword('');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        if (isReadOnlySection) return null;
        return (
          <Space>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRequestDelete(record.id)}
            />
          </Space>
        );
      },
    },
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
      <Modal 
        title="Add Category" 
        open={modalVisible} 
        onCancel={() => setModalVisible(false)} 
        onOk={() => form.submit()} 
        closeIcon={
          <Space>
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setModalVisible(false);
                const values = form.getFieldsValue();
                const catName = values.name || 'New Category';
                minimizeModal({
                  id: 'exp-cat-new',
                  title: `New Category ${catName}`,
                  onRestore: () => setModalVisible(true)
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setModalVisible(false);
              form.resetFields();
            }} />
          </Space>
        }
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Enter name' }]}>
            <Input placeholder="e.g. Travel, Office Supplies" />
          </Form.Item>
          <Form.Item name="description" label="Description">
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
      >
        <p>Enter admin password to delete this category:</p>
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

export default ExpenseCategories;
