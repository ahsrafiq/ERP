import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Switch, message, notification } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Warehouses: React.FC = () => {
  const { currentCompany } = useApp();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [form] = Form.useForm();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Admin password for delete
  const [deletePasswordModal, setDeletePasswordModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
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

  useEffect(() => {
    if (currentCompany) {
      loadWarehouses();
    }
  }, [currentCompany]);

  const loadWarehouses = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.warehouses.getAll(currentCompany.id);
      if (result.success) {
        setWarehouses(result.data || []);
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load warehouses', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    if (!currentCompany) {
      notification.error({ message: 'Error', description: 'Please add a company first', duration: 0 });
      return;
    }
    try {
      if (editingWarehouse) {
        const result = await (window as any).electronAPI.db.warehouses.update(editingWarehouse.id, values);
        if (result.success) {
          message.success('Warehouse updated successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to update warehouse', duration: 0 });
        }
      } else {
        const result = await (window as any).electronAPI.db.warehouses.create({
          ...values,
          company_id: currentCompany.id,
          is_default: values.is_default ? 1 : 0,
        });
        if (result.success) {
          message.success('Warehouse created successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to create warehouse', duration: 0 });
        }
      }
      setModalVisible(false);
      setEditingWarehouse(null);
      form.resetFields();
      loadWarehouses();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Operation failed', duration: 0 });
    }
  };

  const handleRequestDelete = (id: number) => {
    setPendingDeleteId(id);
    setPendingDeleteIds([]);
    setAdminPassword('');
    setDeletePasswordModal(true);
  };

  const handleRequestBulkDelete = () => {
    setPendingDeleteIds(selectedRowKeys.map(k => Number(k)));
    setPendingDeleteId(null);
    setAdminPassword('');
    setDeletePasswordModal(true);
  };

  const handleConfirmDelete = async () => {
    const verify = await (window as any).electronAPI.db.auth.verifyAdminPassword(adminPassword);
    if (!verify.success || !verify.data) {
        notification.error({ message: 'Error', description: 'Incorrect admin password' });
        setAdminPassword('');
        return;
    }

    if (pendingDeleteId != null) {
      try {
        const result = await (window as any).electronAPI.db.warehouses.delete(pendingDeleteId);
        if (result.success) {
          message.success('Warehouse deleted successfully');
          loadWarehouses();
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to delete warehouse' });
        }
      } catch (error) {
        notification.error({ message: 'Error', description: 'Failed to delete warehouse' });
      }
    } else if (pendingDeleteIds.length > 0) {
      try {
        const result = await (window as any).electronAPI.db.warehouses.deleteMultiple(pendingDeleteIds);
        if (result.success) {
          const { total, deleted, skipped } = result.data;
          if (skipped === 0) {
            message.success(`Deleted ${deleted} warehouses successfully`);
          } else {
            message.warning(`Deleted ${deleted} warehouses. ${skipped} were skipped.`);
          }
          setSelectedRowKeys([]);
          loadWarehouses();
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to delete warehouses' });
        }
      } catch (error) {
        notification.error({ message: 'Error', description: 'Failed to delete warehouses' });
      }
    }
    
    setDeletePasswordModal(false);
    setPendingDeleteId(null);
    setPendingDeleteIds([]);
    setAdminPassword('');
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: 'Default',
      dataIndex: 'is_default',
      key: 'is_default',
      render: (isDefault: number) => (isDefault ? 'Yes' : 'No'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingWarehouse(record);
              form.setFieldsValue({
                ...record,
                is_default: record.is_default === 1,
              });
              setModalVisible(true);
            }}
          />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleRequestDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Warehouses</h1>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Button 
                danger 
                icon={<DeleteOutlined />} 
                onClick={handleRequestBulkDelete}
            >
                Delete Selected ({selectedRowKeys.length})
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingWarehouse(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Add Warehouse
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={warehouses}
        loading={loading}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingWarehouse(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="code"
            label="Warehouse Code"
            rules={[
              { required: true, message: 'Please enter warehouse code' },
              { pattern: /^[0-9]+$/, message: 'Code must contain only numbers' }
            ]}
          >
            <Input placeholder="e.g., 4001" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="is_default" label="Default Warehouse" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Admin password delete */}
      <Modal
        title="Admin Authorization Required"
        open={deletePasswordModal}
        onCancel={() => { setDeletePasswordModal(false); setPendingDeleteId(null); }}
        onOk={handleConfirmDelete}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Enter admin password to delete {pendingDeleteId ? 'this warehouse' : `${pendingDeleteIds.length} warehouses`}:</p>
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

export default Warehouses;
