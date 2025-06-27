'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Button, message } from 'antd';
import {
  DashboardOutlined,
  SecurityScanOutlined,
  AuditOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined
} from '@ant-design/icons';
import Link from 'next/link';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/auth/login');
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch (error) {
      router.push('/auth/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    message.success('已退出登录');
    router.push('/auth/login');
  };

  const getDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
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

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/dashboard">仪表盘</Link>,
    },
    {
      key: '/dashboard/vulnerabilities',
      icon: <SecurityScanOutlined />,
      label: <Link href="/dashboard/vulnerabilities">漏洞管理</Link>,
      children: [
        {
          key: '/dashboard/vulnerabilities/list',
          label: <Link href="/dashboard/vulnerabilities/list">漏洞列表</Link>,
        },
        ...(user?.role !== 'FIX_ENGINEER' ? [{
          key: '/dashboard/vulnerabilities/submit',
          label: <Link href="/dashboard/vulnerabilities/submit">提交漏洞</Link>,
        }] : []),
        ...(user?.role === 'VULNERABILITY_REVIEWER' || user?.role === 'SUPERADMIN' ? [{
          key: '/dashboard/vulnerabilities/review',
          label: <Link href="/dashboard/vulnerabilities/review">审核漏洞</Link>,
        }] : []),
      ],
    },
    ...(user?.role === 'SUPERADMIN' ? [{
      key: '/dashboard/users',
      icon: <UserOutlined />,
      label: <Link href="/dashboard/users">用户管理</Link>,
    }] : []),
    ...(user?.role === 'SUPERADMIN' ? [{
      key: '/dashboard/system',
      icon: <SettingOutlined />,
      label: <Link href="/dashboard/system">系统设置</Link>,
    }] : []),
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => router.push('/dashboard/profile'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (!user) {
    return null; // 或者显示加载中状态
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        className="shadow-lg"
        theme="light"
      >
        <div className="p-4 text-center border-b">
          <Typography.Title level={4} className={`${collapsed ? 'hidden' : 'block'} m-0 text-blue-600`}>
            漏洞管理平台
          </Typography.Title>
          {collapsed && (
            <SecurityScanOutlined className="text-2xl text-blue-600" />
          )}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[pathname]}
          defaultOpenKeys={['/dashboard/vulnerabilities']}
          items={menuItems}
          className="border-0"
        />
      </Sider>
      
      <Layout>
        <Header className="bg-white shadow-sm p-0 flex justify-between items-center">
          <div className="flex items-center">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="ml-4"
            />
          </div>
          
          <div className="flex items-center mr-4">
            <Space size="middle">
              <Button type="text" icon={<BellOutlined />} />
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space className="cursor-pointer hover:bg-gray-50 px-3 py-2 rounded">
                  <Avatar icon={<UserOutlined />} />
                  <div className="text-left">
                    <div className="text-sm font-medium">{getDisplayName(user)}</div>
                    <div className="text-xs text-gray-500">{getRoleText(user.role)}</div>
                  </div>
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>
        
        <Content className="m-6 p-6 bg-white rounded-lg shadow-sm">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}