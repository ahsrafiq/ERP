import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, notification, Popconfirm, Switch, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const Companies: React.FC = () => {
  const { companies, setCompanies, setCurrentCompany } = useApp();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [letterheadBase64, setLetterheadBase64] = useState<string | null>(null);
  const [letterheadFileName, setLetterheadFileName] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.db.companies.getAll();
      if (result.success) {
        const data = result.data || [];
        setCompanies(data);
        return data;
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to load companies', duration: 0 });
    } finally {
      setLoading(false);
    }
    return [];
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSave = async (values: any) => {
    try {
      const companyData = { ...values };
      companyData.logo_path = null; // Logo removed - PDF letterhead only

      // Handle letterhead upload (PDF or image)
      if (!letterheadBase64 && !editingCompany?.letterhead_path) {
        notification.error({ message: 'Error', description: 'Please upload a letterhead (PDF or Image)', duration: 0 });
        return;
      }

      if (letterheadBase64) {
        const ext = letterheadFileName.split('.').pop()?.toLowerCase() || 'pdf';
        const fileName = `letterhead_${Date.now()}.${ext}`;
        const result = await (window as any).electronAPI.db.files.save(letterheadBase64, fileName, 'letterheads');
        if (result.success) {
          companyData.letterhead_path = result.filePath;
        }
      }

      if (editingCompany) {
        const result = await (window as any).electronAPI.db.companies.update(editingCompany.id, companyData);
        if (result.success) {
          message.success('Company updated successfully');
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to update company', duration: 0 });
        }
      } else {
        const wasFirstCompany = companies.length === 0;
        const result = await (window as any).electronAPI.db.companies.create(companyData);
        if (result.success) {
          message.success('Company created successfully');
          const refreshed = await loadCompanies();
          if (wasFirstCompany && refreshed.length > 0) {
            setCurrentCompany(refreshed[0]);
          }
        } else {
          notification.error({ message: 'Error', description: result.error || 'Failed to create company', duration: 0 });
        }
      }
      setModalVisible(false);
      setEditingCompany(null);
      setLetterheadBase64(null);
      setLetterheadFileName('');
      form.resetFields();
      loadCompanies();
    } catch (error) {
      notification.error({ message: 'Error', description: 'Operation failed', duration: 0 });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await (window as any).electronAPI.db.companies.delete(id);
      if (result.success) {
        message.success('Company deleted successfully');
        loadCompanies();
      } else {
        notification.error({ message: 'Error', description: result.error || 'Failed to delete company', duration: 0 });
      }
    } catch (error) {
      notification.error({ message: 'Error', description: 'Failed to delete company', duration: 0 });
    }
  };

  const columns = [
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
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCompany(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Popconfirm
            title="Are you sure you want to delete this company?"
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
        <h1>Company Management</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingCompany(null);
            setLetterheadBase64(null);
            setLetterheadFileName('');
            form.resetFields();
            setModalVisible(true);
          }}
        >
          Add Company
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={companies}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingCompany ? 'Edit Company' : 'Add Company'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingCompany(null);
          setLetterheadBase64(null);
          setLetterheadFileName('');
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div style={{ width: 320 }}>
              <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Email is required' }, { type: 'email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Phone is required' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="currency" label="Currency" initialValue="PKR" rules={[{ required: true, message: 'Currency is required' }]}>
                <Input />
              </Form.Item>
            </div>
            <div style={{ width: 320 }}>
              <Form.Item label="Letterhead (PDF or Image)" required>
                <Upload
                  accept=".pdf,.jpg,.jpeg,.png"
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    const base64 = await convertToBase64(file);
                    setLetterheadBase64(base64);
                    setLetterheadFileName(file.name);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload Letterhead (PDF/JPG/PNG)</Button>
                </Upload>
                {/* Preview: show chosen file or existing letterhead */}
                {letterheadBase64 ? (
                  // Newly selected file preview
                  /\.(jpg|jpeg|png)$/i.test(letterheadFileName) ? (
                    <div style={{ marginTop: 8, border: '1px solid #ddd', padding: 4, textAlign: 'center' }}>
                      <img src={letterheadBase64} alt="Letterhead preview" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
                      <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{letterheadFileName}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, border: '1px solid #ddd', padding: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 24 }}>📄</div>
                      <div>{letterheadFileName}</div>
                    </div>
                  )
                ) : editingCompany?.letterhead_path ? (
                  // Existing saved letterhead
                  /\.(jpg|jpeg|png)/i.test(editingCompany.letterhead_path) ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                      🖼️ Current: {editingCompany.letterhead_path.split('/').pop()}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, border: '1px solid #ddd', padding: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 24 }}>📄</div>
                      <div style={{ fontSize: 12 }}>{editingCompany.letterhead_path.split('/').pop()}</div>
                    </div>
                  )
                ) : null}
              </Form.Item>
            </div>
          </Space>

          <Form.Item name="address" label="Address" rules={[{ required: true, message: 'Address is required' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Space>
            <Form.Item name="city" label="City" rules={[{ required: true, message: 'City is required' }]}><Input /></Form.Item>
            <Form.Item name="state" label="State" rules={[{ required: true, message: 'State is required' }]}><Input /></Form.Item>
          </Space>

          <Form.Item
            name="is_gst_enabled"
            label="Enable GST"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.is_gst_enabled !== currentValues.is_gst_enabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('is_gst_enabled') ? (
                <>
                  <Form.Item name="tax_number" label="NTN/Tax Number" rules={[{ required: true, message: 'NTN/Tax Number is required' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="gst_registration_number"
                    label="GST Registration Number"
                    rules={[{ required: true, message: 'Please enter GST registration number' }]}
                  >
                    <Input placeholder="e.g., 12-345678-9" />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Companies;
