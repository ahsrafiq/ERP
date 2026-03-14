import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const Login: React.FC = () => {
    const { login } = useApp();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const onFinish = async (values: any) => {
        try {
            const success = await login(values.username, values.password);
            if (success) {
                navigate('/dashboard');
            } else {
                setError('Invalid credentials. Please check your username and password.');
            }
        } catch (err: any) {
            const msg = err?.message || err?.error || 'Invalid credentials. Please check your username and password.';
            setError(msg);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f0f2f5'
        }}>
            <Card style={{ width: 350, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={2} style={{ color: '#1890ff', margin: 0 }}>ERP Desktop</Title>
                    <Typography.Text type="secondary">Sign in to your account</Typography.Text>
                </div>

                {error && (
                    <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
                )}

                <Form
                    name="login"
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    onValuesChange={() => {
                        if (error) setError('');
                    }}
                    size="large"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Please input your Username!' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Username" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your Password!' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>
                            Log in
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
