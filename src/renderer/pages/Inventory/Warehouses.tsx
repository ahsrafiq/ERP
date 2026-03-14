import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Switch, message, notification, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Warehouses: React.FC = () => {
  const { currentCompany } = useApp();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [form] = Form.useForm();

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

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.warehouses.delete(id);
      if (result.success) {
        message.success('Warehouse deleted successfully');
        loadWarehouses();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete warehouse', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete warehouse', duration: 0 });
    }
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
          <Popconfirm
            title="Are you sure you want to delete this warehouse?"
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
        <h1>Warehouses</h1>
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
      </div>

      <Table
        columns={columns}
        dataSource={warehouses}
        loading={loading}
        rowKey="id"
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
    </div>
  );
};

export default Warehouses;
