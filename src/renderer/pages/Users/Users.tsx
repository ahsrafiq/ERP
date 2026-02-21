import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Users: React.FC = () => {
  const { currentCompany, companies } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadUsers();
  }, [currentCompany]);

  const loadUsers = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.users.getAll(currentCompany.id);
      if (result.success) {
        setUsers(result.data || []);
      }
    } catch (error) {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    try {
      const dataToSave = { ...values };
      // If editing and password is empty, remove it so it's not updated to null
      if (editingUser && !dataToSave.password_hash) {
        delete dataToSave.password_hash;
      }

      if (editingUser) {
        const result = await (window as any).electronAPI.db.users.update(editingUser.id, dataToSave);
        if (result.success) {
          message.success('User updated successfully');
        } else {
          message.error(result.error || 'Failed to update user');
        }
      } else {
        const result = await (window as any).electronAPI.db.users.create({
          ...dataToSave,
          company_id: currentCompany?.id,
          password_hash: dataToSave.password_hash || 'temp',
        });
        if (result.success) {
          message.success('User created successfully');
        } else {
          message.error(result.error || 'Failed to create user');
        }
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      loadUsers();
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.users.delete(id);
      if (result.success) {
        message.success('User deleted successfully');
        loadUsers();
      } else {
        message.error(result.error || 'Failed to delete user');
      }
    } catch (error) {
      message.error('Failed to delete user');
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: 'Companies',
      key: 'companies',
      render: (_: any, record: any) => (
        <span>
          {record.company_ids && record.company_ids.length > 0
            ? `${record.company_ids.length} Assigned`
            : 'None'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: number) => (isActive ? 'Active' : 'Inactive'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingUser(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Popconfirm
            title="Are you sure you want to delete this user?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredUsers = users.filter(u => u.username !== 'admin');

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Users & Role Management</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingUser(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          Add User
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredUsers}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingUser ? 'Edit User' : 'Add User'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="full_name" label="Full Name">
            <Input />
          </Form.Item>

          <Form.Item name="role_id" label="Role" initialValue={2} hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="password_hash"
            label={editingUser ? "New Password (Leave blank to keep current)" : "Password"}
            rules={[{ required: !editingUser, message: 'Please input password' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="company_ids"
            label="Allowed Companies"
            rules={[{ required: true, message: 'Please select at least one company' }]}
          >
            <Select mode="multiple" placeholder="Select companies">
              {companies.map(company => (
                <Select.Option key={company.id} value={company.id}>
                  {company.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Status" initialValue={1}>
            <Select>
              <Select.Option value={1}>Active</Select.Option>
              <Select.Option value={0}>Inactive</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
