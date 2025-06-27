'use client';

import { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Space, 
  Tag, 
  Typography,
  message,
  Popconfirm,
  Card,
  Alert,
  Switch
} from 'antd';
import { 
  UserAddOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    submittedVulnerabilities: number;
    assignedVulnerabilities: number;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = currentUser.role === 'SUPERADMIN';

  const roleOptions = [
    { value: 'SECURITY_RESEARCHER', label: '安全研究员', color: 'blue' },
    { value: 'VULNERABILITY_REVIEWER', label: '漏洞审核员', color: 'green' },
    { value: 'FIX_ENGINEER', label: '修复人员', color: 'orange' },
    { value: 'ADMIN', label: '管理员', color: 'red' },
    { value: 'REVIEWER', label: '审核员', color: 'purple' },
    { value: 'SUBMITTER', label: '提交者', color: 'default' },
  ];

  useEffect(() => {
    if (!isSuperAdmin) {
      message.error('权限不足，只有超级管理员可以管理用户');
      return;
    }
    fetchUsers();
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setUsers(result.data);
      } else {
        message.error('获取用户列表失败');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem('token');
      const url = editingUser 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/users/${editingUser.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`;
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success(editingUser ? '用户更新成功' : '用户创建成功');
        setModalVisible(false);
        fetchUsers();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || (editingUser ? '更新失败' : '创建失败'));
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error(editingUser ? '更新用户失败' : '创建用户失败');
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (response.ok) {
        message.success(`用户已${!user.isActive ? '激活' : '禁用'}`);
        fetchUsers();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        message.success('用户已删除');
        fetchUsers();
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '删除失败');
      }
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('删除用户失败');
    }
  };

  const getRoleInfo = (role: string) => {
    const roleInfo = roleOptions.find(r => r.value === role);
    return roleInfo || { label: role, color: 'default' };
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: User) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
          {record.role === 'SUPERADMIN' && <Tag color="gold">超级管理员</Tag>}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '姓名',
      key: 'fullName',
      render: (record: User) => {
        const fullName = [record.firstName, record.lastName].filter(Boolean).join(' ');
        return fullName || '-';
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleInfo = getRoleInfo(role);
        return <Tag color={roleInfo.color}>{roleInfo.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: User) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="激活"
          unCheckedChildren="禁用"
          disabled={record.role === 'SUPERADMIN'}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: User) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
            disabled={record.role === 'SUPERADMIN'}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDeleteUser(record)}
            disabled={record.role === 'SUPERADMIN'}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.role === 'SUPERADMIN'}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Alert
          message="权限不足"
          description="只有超级管理员可以管理用户"
          type="error"
          showIcon
          icon={<WarningOutlined />}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title level={2}>用户管理</Title>
            <Text type="secondary">管理系统用户和权限分配</Text>
          </div>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={handleCreateUser}
          >
            添加用户
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个用户`,
          }}
        />

        <Modal
          title={editingUser ? '编辑用户' : '添加用户'}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              role: 'SUBMITTER',
              isActive: true,
            }}
          >
            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input placeholder="user@example.com" />
            </Form.Item>

            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 20, message: '用户名最多20个字符' },
              ]}
            >
              <Input placeholder="username" />
            </Form.Item>

            {!editingUser && (
              <Form.Item
                label="密码"
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6个字符' },
                ]}
              >
                <Input.Password placeholder="密码" />
              </Form.Item>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="名"
                name="firstName"
              >
                <Input placeholder="名" />
              </Form.Item>

              <Form.Item
                label="姓"
                name="lastName"
              >
                <Input placeholder="姓" />
              </Form.Item>
            </div>

            <Form.Item
              label="角色"
              name="role"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select placeholder="选择用户角色">
                {roleOptions.map(role => (
                  <Option key={role.value} value={role.value}>
                    <Tag color={role.color}>{role.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="isActive" valuePropName="checked">
              <Switch checkedChildren="激活" unCheckedChildren="禁用" />
            </Form.Item>

            <div className="text-right">
              <Space>
                <Button onClick={() => setModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  {editingUser ? '更新' : '创建'}
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </Card>
    </div>
  );
}