'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin, Alert } from 'antd';
import {
  SecurityScanOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface VulnerabilityStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  assigned: number;
  resolved: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
}

interface RecentVulnerability {
  id: string;
  title: string;
  severity: string;
  status: string;
  submitter: {
    username: string;
  };
  createdAt: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VulnerabilityStats | null>(null);
  const [recentVulnerabilities, setRecentVulnerabilities] = useState<RecentVulnerability[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [statsResponse, vulnerabilitiesResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities/stats/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (statsResponse.ok && vulnerabilitiesResponse.ok) {
        const statsData = await statsResponse.json();
        const vulnerabilitiesData = await vulnerabilitiesResponse.json();
        
        setStats(statsData.data);
        setRecentVulnerabilities(vulnerabilitiesData.data);
      } else {
        setError('获取数据失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'red',
      HIGH: 'orange', 
      MEDIUM: 'yellow',
      LOW: 'green',
      INFO: 'blue'
    };
    return colors[severity] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'orange',
      APPROVED: 'green',
      REJECTED: 'red',
      ASSIGNED: 'blue',
      IN_PROGRESS: 'purple',
      RESOLVED: 'cyan',
      CLOSED: 'gray'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: '待审核',
      APPROVED: '已通过',
      REJECTED: '已拒绝',
      NEED_INFO: '需补充',
      ASSIGNED: '已认领',
      IN_PROGRESS: '处理中',
      RESOLVED: '已解决',
      CLOSED: '已关闭'
    };
    return statusMap[status] || status;
  };

  const getSeverityText = (severity: string) => {
    const severityMap: Record<string, string> = {
      CRITICAL: '严重',
      HIGH: '高危',
      MEDIUM: '中危',
      LOW: '低危',
      INFO: '信息'
    };
    return severityMap[severity] || severity;
  };

  const columns: ColumnsType<RecentVulnerability> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>
          {getSeverityText(severity)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '提交者',
      dataIndex: ['submitter', 'username'],
      key: 'submitter',
      width: 120,
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="加载失败"
        description={error}
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      <Title level={2} className="mb-6">仪表盘</Title>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总漏洞数"
              value={stats?.total || 0}
              prefix={<SecurityScanOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待审核"
              value={stats?.pending || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已通过"
              value={stats?.approved || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已解决"
              value={stats?.resolved || 0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 严重程度分布 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={12}>
          <Card title="按严重程度分布" size="small">
            <Row gutter={8}>
              {Object.entries(stats?.bySeverity || {}).map(([severity, count]) => (
                <Col span={6} key={severity}>
                  <div className="text-center p-2">
                    <div className="text-2xl font-bold">{count}</div>
                    <Tag color={getSeverityColor(severity)} className="mt-1">
                      {getSeverityText(severity)}
                    </Tag>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="按状态分布" size="small">
            <Row gutter={8}>
              {Object.entries(stats?.byStatus || {}).slice(0, 4).map(([status, count]) => (
                <Col span={6} key={status}>
                  <div className="text-center p-2">
                    <div className="text-2xl font-bold">{count}</div>
                    <Tag color={getStatusColor(status)} className="mt-1">
                      {getStatusText(status)}
                    </Tag>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 最近漏洞 */}
      <Card title="最近提交的漏洞" size="small">
        <Table
          columns={columns}
          dataSource={recentVulnerabilities}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );
}