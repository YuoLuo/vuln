'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Avatar, 
  Upload, 
  message, 
  Descriptions, 
  Typography, 
  Row, 
  Col,
  Statistic,
  Spin,
  Divider
} from 'antd';
import { UserOutlined, EditOutlined, UploadOutlined, SaveOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Title, Text } = Typography;

interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    submittedVulnerabilities: number;
    assignedVulnerabilities: number;
    reviews: number;
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setProfile(result.data);
        form.setFieldsValue({
          firstName: result.data.firstName,
          lastName: result.data.lastName,
        });
      } else {
        message.error('获取个人资料失败');
      }
    } catch (error) {
      console.error('获取个人资料失败:', error);
      message.error('获取个人资料失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (values: { firstName?: string; lastName?: string; avatar?: string }) => {
    if (!profile) return;
    
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${profile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success('个人资料更新成功');
        setEditing(false);
        fetchProfile();
        
        // 更新localStorage中的用户信息
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...user,
          firstName: values.firstName,
          lastName: values.lastName,
        }));
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '更新失败');
      }
    } catch (error) {
      console.error('更新个人资料失败:', error);
      message.error('更新个人资料失败');
    } finally {
      setUpdating(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'avatar',
    action: `${process.env.NEXT_PUBLIC_API_URL}/api/upload/avatar`,
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    beforeUpload: (file) => {
      const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
      if (!isJpgOrPng) {
        message.error('只能上传 JPG/PNG 格式的图片!');
        return false;
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('图片大小不能超过 2MB!');
        return false;
      }
      return true;
    },
    onChange: (info) => {
      if (info.file.status === 'done') {
        message.success('头像上传成功');
        fetchProfile();
      } else if (info.file.status === 'error') {
        message.error('头像上传失败');
      }
    },
  };

  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      SUPERADMIN: '超级管理员',
      SECURITY_RESEARCHER: '安全研究员',
      VULNERABILITY_REVIEWER: '漏洞审核员',
      FIX_ENGINEER: '修复人员'
    };
    return roleMap[role] || role;
  };

  const getDisplayName = () => {
    if (!profile) return '';
    if (profile.firstName || profile.lastName) {
      return `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    }
    return profile.username;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center">
        <Text type="secondary">无法加载个人资料</Text>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Title level={2}>个人资料</Title>

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card>
            <div className="text-center">
              <Avatar
                size={120}
                src={profile.avatar}
                icon={<UserOutlined />}
                className="mb-4"
              />
              <Title level={4}>{getDisplayName()}</Title>
              <Text type="secondary">{profile.email}</Text>
              <div className="mt-4">
                <Upload {...uploadProps} showUploadList={false}>
                  <Button icon={<UploadOutlined />}>更换头像</Button>
                </Upload>
              </div>
            </div>

            <Divider />

            <Descriptions column={1} size="small">
              <Descriptions.Item label="用户名">
                {profile.username}
              </Descriptions.Item>
              <Descriptions.Item label="角色">
                {getRoleText(profile.role)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Text type={profile.isActive ? 'success' : 'danger'}>
                  {profile.isActive ? '活跃' : '已禁用'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {new Date(profile.createdAt).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>

            {profile._count && (
              <>
                <Divider />
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="提交漏洞"
                      value={profile._count.submittedVulnerabilities}
                      valueStyle={{ fontSize: '18px' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="认领漏洞"
                      value={profile._count.assignedVulnerabilities}
                      valueStyle={{ fontSize: '18px' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="审核次数"
                      value={profile._count.reviews || 0}
                      valueStyle={{ fontSize: '18px' }}
                    />
                  </Col>
                </Row>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title="基本信息"
            extra={
              !editing ? (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setEditing(true)}
                >
                  编辑
                </Button>
              ) : null
            }
          >
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleUpdate}
                initialValues={{
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="名"
                      name="firstName"
                    >
                      <Input placeholder="请输入名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="姓"
                      name="lastName"
                    >
                      <Input placeholder="请输入姓" />
                    </Form.Item>
                  </Col>
                </Row>

                <div className="text-right">
                  <Button
                    className="mr-2"
                    onClick={() => {
                      setEditing(false);
                      form.resetFields();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={updating}
                    icon={<SaveOutlined />}
                  >
                    保存
                  </Button>
                </div>
              </Form>
            ) : (
              <Descriptions column={2}>
                <Descriptions.Item label="邮箱地址">
                  {profile.email}
                </Descriptions.Item>
                <Descriptions.Item label="用户名">
                  {profile.username}
                </Descriptions.Item>
                <Descriptions.Item label="名">
                  {profile.firstName || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="姓">
                  {profile.lastName || <Text type="secondary">未设置</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="最后更新">
                  {new Date(profile.updatedAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}