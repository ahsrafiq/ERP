import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Vendors: React.FC = () => {
  const { currentCompany } = useApp();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (currentCompany) {
      loadVendors();
    }
  }, [currentCompany]);

  const loadVendors = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.vendors.getAll(currentCompany.id);
      if (result.success) {
        setVendors(result.data || []);
      }
    } catch (error) {
      message.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    if (!currentCompany) {
      message.error('Please add a company first');
      return;
    }
    try {
      if (editingVendor) {
        const result = await (window as any).electronAPI.db.vendors.update(editingVendor.id, values);
        if (result.success) {
          message.success('Vendor updated successfully');
        } else {
          message.error(result.error || 'Failed to update vendor');
        }
      } else {
        const result = await (window as any).electronAPI.db.vendors.create({
          ...values,
          company_id: currentCompany.id,
        });
        if (result.success) {
          message.success('Vendor created successfully');
        } else {
          message.error(result.error || 'Failed to create vendor');
        }
      }
      setModalVisible(false);
      setEditingVendor(null);
      form.resetFields();
      loadVendors();
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.vendors.delete(id);
      if (result.success) {
        message.success('Vendor deleted successfully');
        loadVendors();
      } else {
        message.error(result.error || 'Failed to delete vendor');
      }
    } catch (error) {
      message.error('Failed to delete vendor');
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
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number) => balance.toFixed(2),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingVendor(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Popconfirm
            title="Are you sure you want to delete this vendor?"
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
        <h1>Vendors</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingVendor(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          Add Vendor
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={vendors}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingVendor(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="code"
            label="Vendor Code"
            rules={[
              { required: true, message: 'Please enter vendor code' },
              { pattern: /^[0-9]+$/, message: 'Code must contain only numbers' }
            ]}
          >
            <Input placeholder="e.g., 2001" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="city" label="City">
            <Input />
          </Form.Item>
          <Form.Item name="state" label="State">
            <Input />
          </Form.Item>
          <Form.Item name="country" label="Country">
            <Input />
          </Form.Item>
          <Form.Item name="postal_code" label="Postal Code">
            <Input />
          </Form.Item>
          <Form.Item name="tax_number" label="Tax Number">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Vendors;
