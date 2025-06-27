'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Row, 
  Col,
  message,
  Divider,
  Switch,
  InputNumber,
  Select,
  Alert
} from 'antd';
import { SettingOutlined, SaveOutlined, WarningOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SystemSettings {
  emailSettings: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    enabled: boolean;
  };
  notificationSettings: {
    dingtalkWebhook: string;
    wechatWebhook: string;
    enableEmail: boolean;
    enableDingtalk: boolean;
    enableWechat: boolean;
  };
  securitySettings: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    requireSpecialChars: boolean;
  };
  systemInfo: {
    version: string;
    environment: string;
    dbStatus: string;
  };
}

export default function SystemPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [form] = Form.useForm();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = currentUser.role === 'SUPERADMIN';

  useEffect(() => {
    if (!isSuperAdmin) {
      message.error('权限不足，只有超级管理员可以访问系统设置');
      return;
    }
    fetchSystemSettings();
  }, [isSuperAdmin]);

  const fetchSystemSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setSettings(result.data);
        form.setFieldsValue(result.data);
      } else {
        message.error('获取系统设置失败');
      }
    } catch (error) {
      console.error('获取系统设置失败:', error);
      message.error('获取系统设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success('系统设置保存成功');
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '保存失败');
      }
    } catch (error) {
      console.error('保存系统设置失败:', error);
      message.error('保存系统设置失败');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Alert
          message="权限不足"
          description="只有超级管理员可以访问系统设置页面"
          type="error"
          showIcon
          icon={<WarningOutlined />}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Title level={2}>
          <SettingOutlined className="mr-2" />
          系统设置
        </Title>
        <Text type="secondary">配置系统全局设置（仅超级管理员可见）</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          emailSettings: {
            enabled: true,
            smtpPort: 587,
          },
          securitySettings: {
            sessionTimeout: 24,
            maxLoginAttempts: 5,
            passwordMinLength: 8,
            requireSpecialChars: true,
          },
        }}
      >
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <Card title="邮件设置" className="mb-4">
              <Form.Item name={['emailSettings', 'enabled']} valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
              
              <Form.Item
                label="SMTP服务器"
                name={['emailSettings', 'smtpHost']}
                rules={[{ required: true, message: '请输入SMTP服务器地址' }]}
              >
                <Input placeholder="smtp.gmail.com" />
              </Form.Item>
              
              <Form.Item
                label="SMTP端口"
                name={['emailSettings', 'smtpPort']}
                rules={[{ required: true, message: '请输入SMTP端口' }]}
              >
                <InputNumber min={1} max={65535} className="w-full" />
              </Form.Item>
              
              <Form.Item
                label="用户名"
                name={['emailSettings', 'smtpUser']}
                rules={[{ required: true, message: '请输入SMTP用户名' }]}
              >
                <Input placeholder="your-email@example.com" />
              </Form.Item>
              
              <Form.Item
                label="密码"
                name={['emailSettings', 'smtpPassword']}
                rules={[{ required: true, message: '请输入SMTP密码' }]}
              >
                <Input.Password placeholder="SMTP密码或应用专用密码" />
              </Form.Item>
              
              <Form.Item
                label="发件人邮箱"
                name={['emailSettings', 'fromEmail']}
                rules={[{ required: true, type: 'email', message: '请输入有效的发件人邮箱' }]}
              >
                <Input placeholder="noreply@example.com" />
              </Form.Item>
              
              <Form.Item
                label="发件人名称"
                name={['emailSettings', 'fromName']}
              >
                <Input placeholder="漏洞管理平台" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="通知设置" className="mb-4">
              <Form.Item name={['notificationSettings', 'enableEmail']} valuePropName="checked">
                <Switch checkedChildren="邮件通知" unCheckedChildren="邮件通知" />
              </Form.Item>
              
              <Form.Item name={['notificationSettings', 'enableDingtalk']} valuePropName="checked">
                <Switch checkedChildren="钉钉通知" unCheckedChildren="钉钉通知" />
              </Form.Item>
              
              <Form.Item
                label="钉钉Webhook"
                name={['notificationSettings', 'dingtalkWebhook']}
              >
                <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
              </Form.Item>
              
              <Form.Item name={['notificationSettings', 'enableWechat']} valuePropName="checked">
                <Switch checkedChildren="微信通知" unCheckedChildren="微信通知" />
              </Form.Item>
              
              <Form.Item
                label="微信Webhook"
                name={['notificationSettings', 'wechatWebhook']}
              >
                <Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
              </Form.Item>
            </Card>

            <Card title="安全设置" className="mb-4">
              <Form.Item
                label="会话超时时间（小时）"
                name={['securitySettings', 'sessionTimeout']}
                rules={[{ required: true, message: '请输入会话超时时间' }]}
              >
                <InputNumber min={1} max={168} className="w-full" />
              </Form.Item>
              
              <Form.Item
                label="最大登录尝试次数"
                name={['securitySettings', 'maxLoginAttempts']}
                rules={[{ required: true, message: '请输入最大登录尝试次数' }]}
              >
                <InputNumber min={1} max={20} className="w-full" />
              </Form.Item>
              
              <Form.Item
                label="密码最小长度"
                name={['securitySettings', 'passwordMinLength']}
                rules={[{ required: true, message: '请输入密码最小长度' }]}
              >
                <InputNumber min={6} max={50} className="w-full" />
              </Form.Item>
              
              <Form.Item name={['securitySettings', 'requireSpecialChars']} valuePropName="checked">
                <Switch checkedChildren="要求特殊字符" unCheckedChildren="要求特殊字符" />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider />

        <div className="text-center">
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            icon={<SaveOutlined />}
            size="large"
          >
            保存设置
          </Button>
        </div>
      </Form>
    </div>
  );
}