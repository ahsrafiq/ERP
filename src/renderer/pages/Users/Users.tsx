import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, notification, message, Popconfirm, Tag, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'edit', label: 'Edit' },
  { value: 'all', label: 'All' },
];

const SECTIONS = [
  { key: 'sales', label: 'Sales' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'expenses', label: 'Expenses' },
];

const Users: React.FC = () => {
  const { currentCompany, companies, user: currentUser } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form] = Form.useForm();

  const isAdmin = currentUser?.role_id === 1 || currentUser?.role_name === 'Administrator' || currentUser?.username === 'admin';

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
      notification.error({ message: 'Error', description: 'Failed to load users', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSectionPermissions = () => Object.fromEntries(SECTIONS.map(s => [s.key, 'read']));

  const handleSave = async (values: any) => {
    try {
      const dataToSave = { ...values };
      if (editingUser && !dataToSave.password_hash) {
        delete dataToSave.password_hash;
      }

      const isAdminUser = editingUser?.username === 'admin';
      if (!isAdminUser) {
        const company_ids = Array.isArray(values.company_ids) ? values.company_ids.filter((id: number) => id != null) : [];
        if (company_ids.length === 0) {
          notification.error({ message: 'Error', description: 'Please assign at least one company', duration: 0 });
          return;
        }
        dataToSave.company_ids = company_ids;
        dataToSave.section_permissions = { ...getDefaultSectionPermissions(), ...(values.section_permissions || {}) };
      }
      delete dataToSave.company_assignments;

      if (editingUser) {
        const result = await (window as any).electronAPI.db.users.update(editingUser.id, dataToSave);
        if (result.success) {
          message.success('User updated successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to update user', duration: 0 });
        }
      } else {
        const result = await (window as any).electronAPI.db.users.create({
          ...dataToSave,
          password_hash: dataToSave.password_hash || 'temp',
        });
        if (result.success) {
          message.success('User created successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to create user', duration: 0 });
        }
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      loadUsers();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Operation failed', duration: 0 });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.users.delete(id);
      if (result.success) {
        message.success('User deleted successfully');
        loadUsers();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete user', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete user', duration: 0 });
    }
  };

  const openEdit = (record: any) => {
    setEditingUser(record);
    const isAdminUser = record.username === 'admin';
    if (isAdminUser) {
      form.setFieldsValue({
        username: record.username,
        full_name: record.full_name,
        password_hash: '',
        is_active: record.is_active,
        role_id: record.role_id,
      });
    } else {
      const section_permissions = { ...getDefaultSectionPermissions(), ...(record.section_permissions || {}) };
      form.setFieldsValue({
        ...record,
        company_ids: record.company_ids && record.company_ids.length > 0 ? record.company_ids : undefined,
        section_permissions,
      });
    }
    setModalVisible(true);
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (val: string, record: any) => (
        <span>
          {val}
          {record.username === 'admin' && <Tag color="blue" style={{ marginLeft: 8 }}>Admin</Tag>}
        </span>
      ),
    },
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: 'Companies',
      key: 'companies',
      render: (_: any, record: any) => {
        if (record.username === 'admin') return <Tag color="blue">All</Tag>;
        const ids = record.company_ids || [];
        if (ids.length === 0) return <span>None</span>;
        return (
          <span>
            {ids.slice(0, 3).map((id: number) => {
              const name = companies.find((c: any) => c.id === id)?.name || `#${id}`;
              return <Tag key={id} style={{ marginBottom: 4 }}>{name}</Tag>;
            })}
            {ids.length > 3 && <Tag>+{ids.length - 3}</Tag>}
          </span>
        );
      },
    },
    {
      title: 'Section rights',
      key: 'section_rights',
      render: (_: any, record: any) => {
        if (record.username === 'admin') return <Tag color="blue">All</Tag>;
        const perms = record.section_permissions || {};
        const entries = SECTIONS.filter(s => perms[s.key]).map(s => `${s.label}: ${perms[s.key] || 'read'}`);
        if (entries.length === 0) return <span>—</span>;
        return <span title={entries.join(', ')}>{entries.length} sections</span>;
      },
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
      render: (_: any, record: any) => {
        const isAdminUser = record.username === 'admin';
        if (isAdminUser && !isAdmin) return null;
        return (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
            {!isAdminUser && (
              <Popconfirm
                title="Are you sure you want to delete this user?"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const displayedUsers = users.filter(u => u.username !== 'admin' || isAdmin);
  const isEditingAdmin = editingUser?.username === 'admin';

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Users & Role Management</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingUser(null);
            form.setFieldsValue({
              company_ids: [],
              section_permissions: getDefaultSectionPermissions(),
              role_id: 2,
              is_active: 1,
            });
            setModalVisible(true);
          }}
        >
          Add User
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={displayedUsers}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingUser ? (isEditingAdmin ? 'Edit Admin (e.g. update password)' : 'Edit User') : 'Add User'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input disabled={isEditingAdmin} placeholder={isEditingAdmin ? 'admin' : undefined} />
          </Form.Item>
          <Form.Item name="full_name" label="Full Name">
            <Input />
          </Form.Item>

          <Form.Item name="role_id" label="Role" initialValue={2} hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="password_hash"
            label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
            rules={[{ required: !editingUser, message: 'Please input password' }]}
          >
            <Input.Password />
          </Form.Item>

          {isEditingAdmin ? (
            <Alert
              type="info"
              message="Admin has full access to all companies and all sections. Company assignment and section rights are not used for admin."
              style={{ marginBottom: 16 }}
              showIcon
            />
          ) : (
            <>
              <Form.Item
                name="company_ids"
                label="Assign companies"
                rules={[{ required: true, message: 'Select at least one company' }]}
                tooltip="Which companies this user can access."
              >
                <Select mode="multiple" placeholder="Select companies" showSearch optionFilterProp="label">
                  {companies.map((c: any) => (
                    <Select.Option key={c.id} value={c.id} label={c.name}>{c.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Section rights (Read / Write / Edit / All)"
                tooltip="Permission per section. Read is default. Applies within assigned companies."
              />
              {SECTIONS.map(section => (
                <Form.Item
                  key={section.key}
                  name={['section_permissions', section.key]}
                  label={section.label}
                  initialValue="read"
                  style={{ marginBottom: 12 }}
                >
                  <Select options={PERMISSION_OPTIONS} placeholder="Read" />
                </Form.Item>
              ))}
            </>
          )}

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
