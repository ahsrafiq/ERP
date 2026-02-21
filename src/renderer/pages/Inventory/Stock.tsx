import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Select, InputNumber, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Stock: React.FC = () => {
  const { currentCompany, user } = useApp();
  const [balances, setBalances] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (currentCompany) {
      loadBalances();
      loadWarehouses();
      loadItems();
    }
  }, [currentCompany]);

  const loadBalances = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.stock.getBalances(currentCompany.id);
      if (result.success) setBalances(result.data || []);
    } catch (error) {
      message.error('Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    if (!currentCompany) return;
    const result = await (window as any).electronAPI.db.warehouses.getAll(currentCompany.id);
    if (result.success) setWarehouses(result.data || []);
  };

  const loadItems = async () => {
    if (!currentCompany) return;
    const result = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
    if (result.success) setItems(result.data || []);
  };

  const handleAdjust = async (values: any) => {
    if (!currentCompany) return;
    const qty = Number(values.quantity) || 0;
    const quantity_delta = values.type === 'OUT' ? -qty : qty;
    try {
      const result = await (window as any).electronAPI.db.stock.adjust({
        company_id: currentCompany.id,
        warehouse_id: values.warehouse_id,
        item_id: values.item_id,
        quantity_delta,
        type: values.type,
        notes: values.notes || undefined,
        created_by: user?.id,
      });
      if (result.success) {
        message.success('Stock adjusted successfully');
        setModalVisible(false);
        form.resetFields();
        loadBalances();
      } else {
        message.error(result.error || 'Failed to adjust stock');
      }
    } catch (error: any) {
      message.error(error.message || 'Operation failed');
    }
  };

  const columns = [
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse' },
    { title: 'Item', dataIndex: 'item_name', key: 'item', render: (_: any, r: any) => `${r.item_name || ''} (${r.item_code || ''})` },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', render: (q: number) => Number(q).toLocaleString() },
    { title: 'Updated', dataIndex: 'updated_at', key: 'updated', render: (d: string) => d ? new Date(d).toLocaleString() : '—' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Stock</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true); }}>
          Stock adjustment
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={balances}
        loading={loading}
        rowKey={(r) => `${r.warehouse_id}-${r.item_id}`}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Stock adjustment"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAdjust}>
          <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true, message: 'Select warehouse' }]}>
            <Select placeholder="Select warehouse" showSearch optionFilterProp="children">
              {warehouses.map((w) => (
                <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="item_id" label="Item" rules={[{ required: true, message: 'Select item' }]}>
            <Select placeholder="Select item" showSearch optionFilterProp="children">
              {items.map((i) => (
                <Select.Option key={i.id} value={i.id}>{i.name} ({i.code})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]} initialValue="IN">
            <Select>
              <Select.Option value="IN">IN (add stock)</Select.Option>
              <Select.Option value="OUT">OUT (remove stock)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: 'Enter quantity' }]}>
            <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Stock;
