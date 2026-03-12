import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, AutoComplete, message, Popconfirm, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { parseExcelToRows, getCol, getColNum } from '../../utils/excelImport';

const Items: React.FC = () => {
  const { currentCompany, user } = useApp();
  const [items, setItems] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();
  const [importing, setImporting] = useState(false);
  const [importFormatModal, setImportFormatModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section permissions (Inventory)
  const isAdminUser = user?.role_id === 1 || (user as any)?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const inventoryPerm: string = isAdminUser ? 'all' : (sectionPerms.inventory || 'read');
  const canEditOrDelete = isAdminUser || inventoryPerm === 'edit' || inventoryPerm === 'all' || inventoryPerm === 'write';
  const isReadOnlySection = !isAdminUser && inventoryPerm === 'read';

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    loadItems();
  }, [currentCompany?.id]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.items.getAll(currentCompany?.id);
      if (result && result.success && Array.isArray(result.data)) {
        setItems(result.data);
      } else {
        setItems([]);
      }
    } catch (error) {
      message.error('Failed to load items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    try {
      const result = await (window as any).electronAPI.db.brands.getAll();
      if (result && result.success && Array.isArray(result.data)) {
        setBrands(result.data);
      } else {
        setBrands([]);
      }
    } catch (error) {
      console.error('Failed to load brands');
      setBrands([]);
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (editingItem) {
        const { quantity: _q, purchase_price: _pp, selling_price: _sp, ...rest } = values;
        const result = await (window as any).electronAPI.db.items.update(editingItem.id, rest);
        if (result.success) {
          message.success('Item updated successfully');
        } else {
          message.error(result.error || 'Failed to update item');
        }
      } else {
        const result = await (window as any).electronAPI.db.items.create({ ...values, quantity: 0, purchase_price: 0, selling_price: 0 });
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

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      message.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    setImporting(true);
    try {
      const rows = await parseExcelToRows(file);
      if (rows.length === 0) {
        message.warning('No rows found in the Excel file');
        setImporting(false);
        return;
      }
      let created = 0;
      let failed = 0;

      // Determine next auto code based on existing item codes (numeric part).
      const existingCodes = (Array.isArray(items) ? items : [])
        .map((it: any) => {
          const raw = it && it.code != null ? String(it.code) : '';
          const numeric = raw.replace(/\D/g, '');
          return numeric ? Number(numeric) : NaN;
        })
        .filter((n) => !Number.isNaN(n));
      let nextCode = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = getCol(row, 'Name', 'name');
        const description = getCol(row, 'Description', 'description');
        const brandName = getCol(row, 'Brand', 'brand');
        if (!name || !brandName || !description) {
          failed++;
          continue;
        }
        // For each row, ensure a brand exists with this name.
        // brandHandlers.create makes names unique (normalized), so calling it
        // per row is safe and always gives the correct brand id for that name.
        let brandId: number | null = null;
        try {
          const cr = await (window as any).electronAPI.db.brands.create({ name: brandName.trim() });
          const brandData = (cr && typeof cr === 'object' && 'data' in cr) ? (cr as any).data : cr;
          if (brandData?.id != null) {
            brandId = brandData.id;
          } else if ((cr as any)?.id != null) {
            brandId = (cr as any).id;
          }
        } catch {
          brandId = null;
        }
        if (brandId == null) {
          failed++;
          continue;
        }
        const payload = {
          name,
          code: String(nextCode++),
          sku: getCol(row, 'SKU', 'sku'),
          description,
          brand_id: brandId,
          type: (getCol(row, 'Type', 'type') || 'product').toLowerCase().startsWith('service') ? 'service' : 'product',
          purchase_price: getColNum(row, 'Purchase Price', 'purchase_price'),
          selling_price: getColNum(row, 'Selling Price', 'selling_price'),
          gst_rate: getColNum(row, 'GST Rate', 'gst_rate'),
          reorder_level: getColNum(row, 'Reorder Level', 'reorder_level'),
          location: getCol(row, 'Location', 'location'),
          hs_code: getCol(row, 'H.S Code', 'HS Code', 'hs_code'),
        };
        try {
          const result = await (window as any).electronAPI.db.items.create(payload);
          if (result?.id != null) created++;
          else failed++;
        } catch (_) {
          failed++;
        }
      }
      message.success(`Import complete: ${created} created, ${failed} failed or skipped.`);
      loadItems();
    } catch (err: any) {
      message.error(err?.message || 'Failed to import Excel');
    } finally {
      setImporting(false);
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
    new Set((Array.isArray(items) ? items : []).map((i: any) => (i && i.location != null ? String(i.location) : '')).filter(Boolean))
  ).sort().map((loc) => ({ value: loc as string }));

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (v: unknown) => (v != null ? String(v) : '—'),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: unknown) => (v != null ? String(v) : '—'),
    },
    {
      title: 'Brand',
      dataIndex: 'brand_name',
      key: 'brand_name',
      render: (name: string) => (name != null ? String(name) : '—'),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (loc: unknown) => (loc != null && loc !== '' ? String(loc) : '—'),
    },
    {
      title: 'Purchase Price',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      render: (price: number) => (price != null && !Number.isNaN(Number(price)) ? Number(price).toFixed(2) : '0.00'),
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      key: 'selling_price',
      render: (price: number) => (price != null && !Number.isNaN(Number(price)) ? Number(price).toFixed(2) : '0.00'),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q: number) => (q != null && !Number.isNaN(Number(q)) ? Number(q) : 0),
    },
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
                setEditingItem(record);
                const { quantity: _q, purchase_price: _pp, selling_price: _sp, ...values } = record;
                form.setFieldsValue(values);
                setModalVisible(true);
              }}
            />
            {canEditOrDelete && (
              <Popconfirm
                title="Are you sure you want to delete this item?"
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Items</h1>
        <span style={{ color: '#666', fontSize: 12 }}>Items are shared across all companies</span>
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportFormatModal(true)}
          >
            Excel format
          </Button>
          {!isReadOnlySection && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleImportExcel}
              />
              <Button
                icon={<UploadOutlined />}
                loading={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                Import from Excel
              </Button>
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
            </>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={Array.isArray(items) ? items : []}
        loading={loading}
        rowKey={(r) => (r?.id != null ? String(r.id) : String(Math.random()))}
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
            <Select
              placeholder="Type to search brand"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const label = (option?.children ?? '') as string;
                const search = (input || '').trim().toLowerCase();
                if (!search) return true;
                if (label.toLowerCase().includes(search)) return true;
                const initials = label.split(/\s+/).map((w) => (w[0] || '').toLowerCase()).join('');
                return initials.startsWith(search) || initials.includes(search);
              }}
            >
              {(Array.isArray(brands) ? brands : []).filter((b) => b != null && b.id != null).map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name ?? ''}</Select.Option>
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
          <Form.Item name="hs_code" label="H.S Code">
            <Input placeholder="e.g. 8504.40" />
          </Form.Item>
          <Form.Item name="type" label="Type" initialValue="product">
            <Select>
              <Select.Option value="product">Product</Select.Option>
              <Select.Option value="service">Service</Select.Option>
            </Select>
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
        </Form>
      </Modal>

      <Modal
        title="Items – Excel import format"
        open={importFormatModal}
        onCancel={() => setImportFormatModal(false)}
        footer={[
          <Button key="close" onClick={() => setImportFormatModal(false)}>Close</Button>,
          <Button key="import" type="primary" onClick={() => { setImportFormatModal(false); fileInputRef.current?.click(); }}>Choose file to import</Button>,
        ]}
        width={560}
      >
        <Alert type="info" style={{ marginBottom: 16 }} message="First row of the Excel file must be headers. Use the column names below (case-insensitive)." />
        <p><strong>Required columns:</strong></p>
        <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
          <li><strong>Name</strong> – Item name</li>
          <li><strong>Brand</strong> – Brand name (will be created if it does not exist)</li>
          <li><strong>Description</strong> – Item description</li>
        </ul>
        <p><strong>Optional columns:</strong></p>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>SKU, Type (product/service), Purchase Price, Selling Price, GST Rate</li>
          <li>Reorder Level, Location, H.S Code</li>
        </ul>
      </Modal>
    </div>
  );
};

export default Items;
