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
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Statistic,
  Alert
} from 'antd';
import { 
  AuditOutlined, 
  CheckOutlined, 
  CloseOutlined, 
  InfoCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../../../../utils/api';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  submitter: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ReviewStats {
  pending: number;
  needInfo: number;
  total: number;
}

export default function VulnerabilityReviewPage() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState<ReviewStats>({ pending: 0, needInfo: 0, total: 0 });
  const [reviewForm] = Form.useForm();
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignForm] = Form.useForm();
  const [fixEngineers, setFixEngineers] = useState<Array<{id: string; username: string; firstName?: string; lastName?: string}>>([]);
  const router = useRouter();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isReviewer = currentUser.role === 'SUPERADMIN' || 
                    currentUser.role === 'VULNERABILITY_REVIEWER';

  useEffect(() => {
    if (!isReviewer) {
      message.error('权限不足');
      router.push('/dashboard');
      return;
    }
    fetchPendingVulnerabilities();
    fetchStats();
    fetchFixEngineers();
  }, [isReviewer, router]);

  const fetchPendingVulnerabilities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities?status=PENDING,PENDING_RETEST`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVulnerabilities(data.data);
      } else {
        message.error('获取待审核漏洞失败');
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities/stats/review`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const fetchFixEngineers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=FIX_ENGINEER`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFixEngineers(data.data);
      }
    } catch (error) {
      console.error('获取修复人员列表失败:', error);
    }
  };

  const handleReview = async (vulnerabilityId: string, values: { status: string; comment?: string }) => {
    setActionLoading(true);
    try {
      const response = await api.post(`/api/vulnerabilities/${vulnerabilityId}/review`, values);
      const data = await response.json();

      if (data.success) {
        message.success('审核完成');
        setReviewModalVisible(false);
        reviewForm.resetFields();
        
        // 如果通过审核，显示分配模态框
        if (values.status === 'APPROVED') {
          setAssignModalVisible(true);
        } else {
          fetchPendingVulnerabilities();
          fetchStats();
        }
      } else {
        message.error(data.message || '审核失败');
      }
    } catch (error) {
      console.error('审核失败:', error);
      message.error('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (values: { assigneeId: string }) => {
    if (!selectedVulnerability) return;
    
    setActionLoading(true);
    try {
      const response = await api.post(`/api/vulnerabilities/${selectedVulnerability.id}/assign`, values);
      const data = await response.json();

      if (data.success) {
        message.success('漏洞分配成功');
        setAssignModalVisible(false);
        setSelectedVulnerability(null);
        assignForm.resetFields();
        fetchPendingVulnerabilities();
        fetchStats();
      } else {
        message.error(data.message || '分配失败');
      }
    } catch (error) {
      console.error('分配失败:', error);
      message.error('网络错误，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  const getDisplayName = (user: { username: string; firstName?: string; lastName?: string }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
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
      NEED_INFO: 'purple',
      PENDING_RETEST: 'geekblue'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: '待审核',
      NEED_INFO: '需补充信息',
      PENDING_RETEST: '待复测'
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

  const columns: ColumnsType<Vulnerability> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: Vulnerability) => (
        <Button 
          type="link" 
          className="p-0 h-auto text-left"
          onClick={() => router.push(`/dashboard/vulnerabilities/${record.id}`)}
        >
          {title}
        </Button>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
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
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '提交者',
      key: 'submitter',
      render: (record: Vulnerability) => getDisplayName(record.submitter),
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: Vulnerability) => (
        <Space>
          <Button
            type="primary"
            icon={<AuditOutlined />}
            onClick={() => {
              setSelectedVulnerability(record);
              setReviewModalVisible(true);
            }}
          >
            详细审核
          </Button>
        </Space>
      ),
    },
  ];

  if (!isReviewer) {
    return (
      <Alert
        message="权限不足"
        description="您没有权限访问此页面"
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={2} className="m-0">漏洞审核</Title>
        <Button 
          icon={<ReloadOutlined />}
          onClick={() => {
            fetchPendingVulnerabilities();
            fetchStats();
          }}
        >
          刷新
        </Button>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="待审核"
              value={stats.pending}
              valueStyle={{ color: '#cf1322' }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="需补充信息"
              value={stats.needInfo}
              valueStyle={{ color: '#722ed1' }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总计"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={vulnerabilities}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个待审核漏洞`,
          }}
        />
      </Card>

      <Modal
        title={selectedVulnerability?.status === 'PENDING_RETEST' ? 
          `🔍 复测漏洞：${selectedVulnerability?.title}` : 
          `📋 审核漏洞：${selectedVulnerability?.title}`
        }
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          setSelectedVulnerability(null);
          reviewForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        {selectedVulnerability && (
          <div>
            <div className="mb-4 p-4 bg-gray-50 rounded">
              <h4>漏洞描述：</h4>
              <p>{selectedVulnerability.description}</p>
            </div>
            
            <Form
              form={reviewForm}
              onFinish={(values) => handleReview(selectedVulnerability.id, values)}
              layout="vertical"
            >
              <Form.Item
                name="status"
                label={selectedVulnerability?.status === 'PENDING_RETEST' ? '复测结果' : '审核结果'}
                rules={[{ required: true, message: selectedVulnerability?.status === 'PENDING_RETEST' ? '请选择复测结果' : '请选择审核结果' }]}
              >
                <Select placeholder={selectedVulnerability?.status === 'PENDING_RETEST' ? '选择复测结果' : '选择审核结果'}>
                  {selectedVulnerability?.status === 'PENDING_RETEST' ? (
                    <>
                      <Option value="RESOLVED">
                        <CheckOutlined className="text-green-600 mr-2" />
                        ✅ 复测通过 - 漏洞已修复
                      </Option>
                      <Option value="IN_PROGRESS">
                        <CloseOutlined className="text-red-600 mr-2" />
                        ❌ 复测未通过 - 需要继续修复
                      </Option>
                    </>
                  ) : (
                    <>
                      <Option value="APPROVED">
                        <CheckOutlined className="text-green-600 mr-2" />
                        通过
                      </Option>
                      <Option value="REJECTED">
                        <CloseOutlined className="text-red-600 mr-2" />
                        拒绝
                      </Option>
                      <Option value="NEED_INFO">
                        <InfoCircleOutlined className="text-blue-600 mr-2" />
                        需要补充信息
                      </Option>
                    </>
                  )}
                </Select>
              </Form.Item>

              <Form.Item
                name="comment"
                label={selectedVulnerability?.status === 'PENDING_RETEST' ? '复测意见' : '审核意见'}
                rules={[{ required: true, message: selectedVulnerability?.status === 'PENDING_RETEST' ? '请输入复测意见' : '请输入审核意见' }]}
              >
                <TextArea 
                  rows={4} 
                  placeholder={selectedVulnerability?.status === 'PENDING_RETEST' ? '请输入复测意见...' : '请输入审核意见...'}
                />
              </Form.Item>

              <div className="text-right">
                <Space>
                  <Button onClick={() => {
                    setReviewModalVisible(false);
                    setSelectedVulnerability(null);
                    reviewForm.resetFields();
                  }}>
                    取消
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={actionLoading}
                    icon={<AuditOutlined />}
                  >
                    {selectedVulnerability?.status === 'PENDING_RETEST' ? '提交复测结果' : '提交审核'}
                  </Button>
                </Space>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title={`分配漏洞：${selectedVulnerability?.title}`}
        open={assignModalVisible}
        onCancel={() => {
          setAssignModalVisible(false);
          setSelectedVulnerability(null);
          assignForm.resetFields();
          fetchPendingVulnerabilities();
          fetchStats();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={assignForm}
          onFinish={handleAssign}
          layout="vertical"
        >
          <Form.Item
            name="assigneeId"
            label="选择修复人员"
            rules={[{ required: true, message: '请选择修复人员' }]}
          >
            <Select placeholder="选择修复人员">
              {fixEngineers.map(engineer => (
                <Option key={engineer.id} value={engineer.id}>
                  {engineer.firstName && engineer.lastName 
                    ? `${engineer.firstName} ${engineer.lastName} (${engineer.username})`
                    : engineer.username
                  }
                </Option>
              ))}
            </Select>
          </Form.Item>

          <div className="text-right">
            <Space>
              <Button onClick={() => {
                setAssignModalVisible(false);
                setSelectedVulnerability(null);
                assignForm.resetFields();
                fetchPendingVulnerabilities();
                fetchStats();
              }}>
                跳过
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={actionLoading}
              >
                分配
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}