import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, notification } from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const { Title, Text } = Typography;

const Profile: React.FC = () => {
    const { user } = useApp();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleUpdateProfile = async (values: any) => {
        if (!user) return;
        setLoading(true);
        try {
            const dataToUpdate = {
                full_name: values.name,
            };

            if (values.password) {
                (dataToUpdate as any).password_hash = values.password;
            }

            const result = await (window as any).electronAPI.db.users.update(user.id, dataToUpdate);

            if (result.success) {
                message.success('Profile updated successfully');
                form.setFieldValue('password', ''); // Clear password field after update
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to update profile', duration: 0 });
            }
        } catch (error) {
            notification.error({ message: 'Error', description: 'An error occurred during update', duration: 0 });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px' }}>
            <Title level={2}>My Profile</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                Management your personal information and security settings.
            </Text>

            <Card bordered={false} className="premium-card">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleUpdateProfile}
                    initialValues={{
                        username: user?.username,
                        full_name: user?.name,
                    }}
                >
                    <Form.Item label="Username" name="username">
                        <Input prefix={<UserOutlined />} disabled />
                    </Form.Item>

                    <Form.Item
                        label="Full Name"
                        name="name"
                        rules={[{ required: true, message: 'Please input your full name' }]}
                    >
                        <Input placeholder="Enter your full name" />
                    </Form.Item>

                    <Form.Item
                        label="Update Password"
                        name="password"
                        extra="Leave blank to keep your current password"
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Enter new password" />
                    </Form.Item>

                    <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<SaveOutlined />}
                            loading={loading}
                            block
                        >
                            Save Changes
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Profile;
