'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  Card, 
  Typography, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Select, 
  message,
  Tooltip,
  Popconfirm,
  Row,
  Col
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  EyeOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { api } from '../../../../utils/api';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

interface Vulnerability {
  id: string;
  title: string;
  severity: string;
  status: string;
  submitter: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  assignee?: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: string;
  updatedAt: string;
  _count: {
    reviews: number;
  };
}

interface QueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  severity?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export default function VulnerabilityListPage() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 1,
    limit: 10
  });
  const router = useRouter();

  useEffect(() => {
    fetchVulnerabilities();
  }, [queryParams]);

  const fetchVulnerabilities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVulnerabilities(data.data);
        setTotal(data.pagination.total);
      } else if (response.status === 403) {
        message.warning('您没有权限查看漏洞列表');
        router.push('/dashboard');
      } else {
        message.error('获取数据失败');
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await api.delete(`/api/vulnerabilities/${id}`);
      const data = await response.json();

      if (data.success) {
        message.success('删除成功');
        fetchVulnerabilities();
      } else if (response.status === 403) {
        message.warning('您没有权限删除此漏洞');
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('网络错误，请稍后重试');
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
      NEED_INFO: 'purple',
      ASSIGNED: 'blue',
      IN_PROGRESS: 'cyan',
      PENDING_RETEST: 'geekblue',
      RESOLVED: 'lime',
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
      PENDING_RETEST: '待复测',
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

  const getDisplayName = (user: { username: string; firstName?: string; lastName?: string }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'ADMIN';
  const isReviewer = currentUser.role === 'REVIEWER' || currentUser.role === 'ADMIN';

  const columns: ColumnsType<Vulnerability> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: Vulnerability) => (
        <Tooltip title={title}>
          <Button 
            type="link" 
            className="p-0 h-auto text-left"
            onClick={() => router.push(`/dashboard/vulnerabilities/${record.id}`)}
          >
            {title}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      filters: [
        { text: '严重', value: 'CRITICAL' },
        { text: '高危', value: 'HIGH' },
        { text: '中危', value: 'MEDIUM' },
        { text: '低危', value: 'LOW' },
        { text: '信息', value: 'INFO' }
      ],
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
      filters: [
        { text: '待审核', value: 'PENDING' },
        { text: '已通过', value: 'APPROVED' },
        { text: '已拒绝', value: 'REJECTED' },
        { text: '需补充', value: 'NEED_INFO' },
        { text: '已认领', value: 'ASSIGNED' },
        { text: '处理中', value: 'IN_PROGRESS' },
        { text: '待复测', value: 'PENDING_RETEST' },
        { text: '已解决', value: 'RESOLVED' },
        { text: '已关闭', value: 'CLOSED' }
      ],
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '提交者',
      dataIndex: 'submitter',
      key: 'submitter',
      width: 120,
      render: (submitter: Vulnerability['submitter']) => getDisplayName(submitter),
    },
    {
      title: '处理人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 120,
      render: (assignee?: Vulnerability['assignee']) => 
        assignee ? getDisplayName(assignee) : <span className="text-gray-400">未分配</span>,
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      sorter: true,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record: Vulnerability) => {
        const canEdit = record.submitter.id === currentUser.id && 
                       ['PENDING', 'NEED_INFO'].includes(record.status);
        const canDelete = (record.submitter.id === currentUser.id || isAdmin) && 
                         record.status === 'PENDING';

        return (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button 
                type="text" 
                icon={<EyeOutlined />} 
                size="small"
                onClick={() => router.push(`/dashboard/vulnerabilities/${record.id}`)}
              />
            </Tooltip>
            {canEdit && (
              <Tooltip title="编辑">
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  size="small"
                  onClick={() => router.push(`/dashboard/vulnerabilities/${record.id}/edit`)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="删除">
                <Popconfirm
                  title="确定要删除这个漏洞吗？"
                  onConfirm={() => handleDelete(record.id)}
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                >
                  <Button 
                    type="text" 
                    icon={<DeleteOutlined />} 
                    size="small"
                    danger
                  />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: any,
    sorter: any
  ) => {
    setQueryParams(prev => ({
      ...prev,
      page: pagination.current || 1,
      limit: pagination.pageSize || 10,
      severity: filters.severity?.[0],
      status: filters.status?.[0],
      sortBy: sorter.field,
      sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc'
    }));
  };

  const handleSearch = (value: string) => {
    setQueryParams(prev => ({
      ...prev,
      page: 1,
      search: value
    }));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={2} className="m-0">漏洞列表</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => router.push('/dashboard/vulnerabilities/submit')}
        >
          提交漏洞
        </Button>
      </div>

      <Card>
        <Row gutter={16} className="mb-4">
          <Col flex="auto">
            <Search
              placeholder="搜索漏洞标题、描述或受影响系统"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={handleSearch}
            />
          </Col>
          <Col>
            <Button 
              icon={<ReloadOutlined />} 
              size="large"
              onClick={fetchVulnerabilities}
            >
              刷新
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={vulnerabilities}
          rowKey="id"
          loading={loading}
          pagination={{
            current: queryParams.page,
            pageSize: queryParams.limit,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}