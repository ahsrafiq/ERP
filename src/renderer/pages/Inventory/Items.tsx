import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, AutoComplete, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Items: React.FC = () => {
  const { currentCompany } = useApp();
  const [items, setItems] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadItems();
    loadBrands();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.items.getAll(currentCompany?.id);
      if (result.success) {
        setItems(result.data || []);
      }
    } catch (error) {
      message.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    try {
      const result = await (window as any).electronAPI.db.brands.getAll();
      if (result.success) {
        setBrands(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load brands');
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (editingItem) {
        const result = await (window as any).electronAPI.db.items.update(editingItem.id, values);
        if (result.success) {
          message.success('Item updated successfully');
        } else {
          message.error(result.error || 'Failed to update item');
        }
      } else {
        const result = await (window as any).electronAPI.db.items.create(values);
        if (result.success) {
          message.success('Item created successfully. It will appear for all companies.');
        } else {
          message.error(result.error || 'Failed to create item');
        }
      }
      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
      loadItems();
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.items.delete(id);
      if (result.success) {
        message.success('Item deleted successfully');
        loadItems();
      } else {
        message.error(result.error || 'Failed to delete item');
      }
    } catch (error) {
      message.error('Failed to delete item');
    }
  };

  const locationOptions = Array.from(
    new Set(items.map((i: any) => i.location).filter(Boolean))
  ).sort().map((loc) => ({ value: loc as string }));

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
      title: 'Brand',
      dataIndex: 'brand_name',
      key: 'brand_name',
      render: (name: string) => name || '—',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (loc: string) => loc || '—',
    },
    {
      title: 'Purchase Price',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      render: (price: number) => price?.toFixed(2) || '0.00',
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      key: 'selling_price',
      render: (price: number) => price.toFixed(2),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q: number) => (q != null ? Number(q) : 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingItem(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Popconfirm
            title="Are you sure you want to delete this item?"
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
        <h1>Items</h1>
        <span style={{ color: '#666', fontSize: 12 }}>Items are shared across all companies</span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingItem(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          Add Item
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={items}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingItem ? 'Edit Item' : 'Add Item'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingItem(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="code"
            label="Item Code"
            rules={[
              { required: true, message: 'Please enter item code' },
              { pattern: /^[0-9]+$/, message: 'Code must contain only numbers' }
            ]}
          >
            <Input placeholder="e.g., 3001" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="brand_id" label="Brand" rules={[{ required: true, message: 'Please select a brand' }]}>
            <Select placeholder="Select brand">
              {brands.map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="location"
            label="Location"
            tooltip="Storage location of this item (e.g. A, B, C, Rack-1). Previously used locations are suggested."
          >
            <AutoComplete
              options={locationOptions}
              placeholder="e.g. A, B, Rack-1"
              filterOption={(input, option) =>
                (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="type" label="Type" initialValue="product">
            <Select>
              <Select.Option value="product">Product</Select.Option>
              <Select.Option value="service">Service</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="purchase_price" label="Purchase Price" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="selling_price" label="Selling Price" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="track_inventory" label="Track Inventory" initialValue={1}>
            <Select>
              <Select.Option value={1}>Yes</Select.Option>
              <Select.Option value={0}>No</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="reorder_level" label="Reorder Level" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Items;
