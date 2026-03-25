import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, notification } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, LockOutlined, MinusSquareOutlined, CloseOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useLocation } from 'react-router-dom';

const Vendors: React.FC = () => {
  const { currentCompany, user, minimizeModal } = useApp();
  const location = useLocation();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
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

  // Section permissions (Purchase)
  const isAdminUser = user?.role_id === 1 || (user as any)?.role === 'admin' || user?.username === 'admin';
  const sectionPerms = (user as any)?.section_permissions || {};
  const purchasePerm: string = isAdminUser ? 'all' : (sectionPerms.purchase || 'read');
  const canEditOrDelete = isAdminUser || purchasePerm === 'edit' || purchasePerm === 'all' || purchasePerm === 'write';
  const isReadOnlySection = !isAdminUser && purchasePerm === 'read';

  useEffect(() => {
    if (currentCompany) {
      if (location.pathname === '/purchases/vendors') {
        loadVendors();
      } else if (vendors.length === 0) {
        loadVendors();
      }
    }
  }, [currentCompany, location.pathname]);

  const loadVendors = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.vendors.getAll(currentCompany.id);
      if (result.success) {
        setVendors(result.data || []);
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load vendors', duration: 0 });
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
      if (editingVendor) {
        const result = await (window as any).electronAPI.db.vendors.update(editingVendor.id, values);
        if (result.success) {
          message.success('Vendor updated successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to update vendor', duration: 0 });
        }
      } else {
        const result = await (window as any).electronAPI.db.vendors.create({
          ...values,
          company_id: currentCompany.id,
        });
        if (result.success) {
          message.success('Vendor created successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to create vendor', duration: 0 });
        }
      }
      setModalVisible(false);
      setEditingVendor(null);
      form.resetFields();
      loadVendors();
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
      const result = await (window as any).electronAPI.db.vendors.delete(pendingDeleteId);
      if (result.success) {
        message.success('Vendor deleted successfully');
        loadVendors();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete vendor', duration: 0 });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to delete vendor', duration: 0 });
    } finally {
      setDeletePasswordModal(false);
      setPendingDeleteId(null);
      setAdminPassword('');
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
      render: (_: any, record: any) => {
        if (isReadOnlySection) {
          return null;
        }
        return (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingVendor(record);
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

  const [searchQuery, setSearchQuery] = useState('');

  const filteredVendors = vendors.filter(v =>
    (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0 }}>Vendors</h1>
          <Input
            placeholder="Search by name or code..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>
        {!isReadOnlySection && (
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
        )}
      </div>

      <Table
        columns={columns}
        dataSource={filteredVendors}
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
        closeIcon={
          <Space>
            <MinusSquareOutlined 
              style={{ fontSize: 18, color: '#1890ff' }}
              onClick={(e) => {
                e.stopPropagation();
                setModalVisible(false);
                const values = form.getFieldsValue();
                const vendorName = values.name || 'New Vendor';
                minimizeModal({
                  id: editingVendor ? `vendor-edit-${editingVendor.id}` : 'vendor-new',
                  title: editingVendor ? `Edit Vendor ${vendorName}` : `New Vendor ${vendorName}`,
                  onRestore: () => {
                    setEditingVendor(editingVendor);
                    setModalVisible(true);
                  }
                });
              }} 
            />
            <CloseOutlined style={{ fontSize: 18 }} onClick={() => {
              setModalVisible(false);
              setEditingVendor(null);
              form.resetFields();
            }} />
          </Space>
        }
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

      {/* Admin password for delete */}
      <Modal
        title="Admin Authorization Required"
        open={deletePasswordModal}
        onCancel={() => { setDeletePasswordModal(false); setPendingDeleteId(null); }}
        onOk={handleConfirmDelete}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Enter admin password to delete this vendor:</p>
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

export default Vendors;
