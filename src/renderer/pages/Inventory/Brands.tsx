import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const Brands: React.FC = () => {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [form] = Form.useForm();

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
      message.error('Failed to load brands');
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
          message.error(result.error || 'Failed to update brand');
        }
      } else {
        const result = await (window as any).electronAPI.db.brands.create(values);
        if (result.success) {
          message.success('Brand created successfully');
        } else {
          message.error(result.error || 'Failed to create brand');
        }
      }
      setModalVisible(false);
      setEditingBrand(null);
      form.resetFields();
      loadBrands();
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.brands.delete(id);
      if (result.success) {
        message.success('Brand deleted successfully');
        loadBrands();
      } else {
        message.error(result.error || 'Failed to delete brand');
      }
    } catch (error) {
      message.error('Failed to delete brand');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingBrand(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Popconfirm
            title="Delete this brand?"
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
        <h1>Brands</h1>
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
    </div>
  );
};

export default Brands;
