import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, notification } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Brands: React.FC = () => {
  const { user } = useApp();
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
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

  // Section permissions (Inventory)
  const isAdminUser = user?.role_id === 1 || (user as any)?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const inventoryPerm: string = isAdminUser ? 'all' : (sectionPerms.inventory || 'read');
  const canEditOrDelete = isAdminUser || inventoryPerm === 'edit' || inventoryPerm === 'all' || inventoryPerm === 'write';
  const isReadOnlySection = !isAdminUser && inventoryPerm === 'read';

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.brands.getAll();
      if (result.success) {
        setBrands(result.data || []);
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load brands', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (editingBrand) {
        const result = await (window as any).electronAPI.db.brands.update(editingBrand.id, values);
        if (result.success) {
          message.success('Brand updated successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to update brand', duration: 0 });
        }
      } else {
        const result = await (window as any).electronAPI.db.brands.create(values);
        if (result.success) {
          message.success('Brand created successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to create brand', duration: 0 });
        }
      }
      setModalVisible(false);
      setEditingBrand(null);
      form.resetFields();
      loadBrands();
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
      const result = await (window as any).electronAPI.db.brands.delete(pendingDeleteId);
      if (result.success) {
        message.success('Brand deleted successfully');
        loadBrands();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete brand', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete brand', duration: 0 });
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
        if (isReadOnlySection) {
          return null;
        }
        return (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingBrand(record);
                form.setFieldsValue(record);
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Brands</h1>
        {!isReadOnlySection && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingBrand(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Add Brand
          </Button>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={brands}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editingBrand ? 'Edit Brand' : 'Add Brand'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingBrand(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Brand Name" rules={[{ required: true }]}>
            <Input />
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
        <p>Enter admin password to delete this brand:</p>
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

export default Brands;
