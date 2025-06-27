'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text } = Typography;

interface RegisterForm {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: RegisterForm) => {
    const { confirmPassword, ...registerData } = values;
    
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerData)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        message.success('注册成功，欢迎加入！');
        router.push('/dashboard');
      } else {
        if (data.errors) {
          // 显示字段级别的错误
          Object.entries(data.errors).forEach(([field, errors]) => {
            message.error(`${field}: ${(errors as string[]).join(', ')}`);
          });
        } else {
          message.error(data.message || '注册失败');
        }
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-6">
          <Title level={2} className="text-gray-800 mb-2">
            创建账户
          </Title>
          <Text type="secondary">
            加入漏洞管理平台
          </Text>
        </div>

        <Form
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="email"
            label="邮箱地址"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="your@email.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 20, message: '用户名长度为3-20个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Space.Compact className="w-full">
            <Form.Item
              name="firstName"
              label="姓名"
              className="w-1/2 mr-2"
            >
              <Input placeholder="姓" />
            </Form.Item>
            <Form.Item
              name="lastName"
              className="w-1/2"
            >
              <Input placeholder="名" />
            </Form.Item>
          </Space.Compact>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              className="w-full"
            >
              注册
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <Space>
            <Text type="secondary">已有账户？</Text>
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-800">
              立即登录
            </Link>
          </Space>
        </div>
      </Card>
    </div>
  );
}