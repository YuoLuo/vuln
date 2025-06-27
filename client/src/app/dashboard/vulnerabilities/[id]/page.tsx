'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Card, 
  Typography, 
  Tag, 
  Button, 
  Space, 
  Descriptions, 
  Timeline, 
  message,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Alert,
  Divider,
  Row,
  Col
} from 'antd';
import { 
  EditOutlined, 
  CheckOutlined, 
  CloseOutlined, 
  UserAddOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Editor } from '@monaco-editor/react';
import { api } from '../../../../utils/api';
import SafeHtmlRenderer from '../../../../components/SafeHtmlRenderer';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 语言检测函数
const detectLanguage = (code: string): string => {
  const content = code.toLowerCase().trim();
  
  // HTTP 请求检测
  if (/^(get|post|put|delete|head|options|patch)\s+/.test(content) || 
      /^http\/[0-9]\.[0-9]/.test(content) ||
      /^[a-z-]+:\s*/.test(content.split('\n')[1] || '')) {
    return 'http';
  }
  
  // JavaScript/TypeScript 检测
  if (content.includes('function') || content.includes('const ') || 
      content.includes('let ') || content.includes('var ') ||
      content.includes('=>') || content.includes('console.log') ||
      content.includes('document.') || content.includes('window.')) {
    return 'javascript';
  }
  
  // Python 检测
  if (content.includes('def ') || content.includes('import ') ||
      content.includes('print(') || content.includes('__name__') ||
      /^class\s+\w+/.test(content)) {
    return 'python';
  }
  
  // Java 检测
  if (content.includes('public class') || content.includes('public static void main') ||
      content.includes('System.out.println') || content.includes('package ')) {
    return 'java';
  }
  
  // PHP 检测
  if (content.includes('<?php') || content.includes('$_') ||
      content.includes('echo ') || content.includes('function ')) {
    return 'php';
  }
  
  // SQL 检测
  if (content.includes('select ') || content.includes('insert ') ||
      content.includes('update ') || content.includes('delete ') ||
      content.includes('create table') || content.includes('drop table')) {
    return 'sql';
  }
  
  // HTML 检测
  if (content.includes('<html') || content.includes('<!doctype') ||
      content.includes('<div') || content.includes('<script')) {
    return 'html';
  }
  
  // CSS 检测
  if (content.includes('{') && content.includes('}') && 
      /[.#]\w+\s*{/.test(content)) {
    return 'css';
  }
  
  // Shell/Bash 检测
  if (content.includes('#!/bin/bash') || content.includes('#!/bin/sh') ||
      /^[a-z_]+=[^=]/.test(content) || content.includes('curl ')) {
    return 'shell';
  }
  
  // XML 检测
  if (content.includes('<?xml') || /<\w+.*>/.test(content)) {
    return 'xml';
  }
  
  // JSON 检测
  if ((content.startsWith('{') && content.endsWith('}')) ||
      (content.startsWith('[') && content.endsWith(']'))) {
    try {
      JSON.parse(code);
      return 'json';
    } catch {
      // 不是有效JSON，继续其他检测
    }
  }
  
  // 默认为纯文本
  return 'plaintext';
};

interface Vulnerability {
  id: string;
  title: string;
  description: string;
  codeSnippet?: string;
  severity: string;
  status: string;
  affectedSystem?: string;
  reproductionSteps?: string;
  impact?: string;
  recommendation?: string;
  submitter: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  assignee?: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  reviews: Array<{
    id: string;
    status: string;
    comment?: string;
    createdAt: string;
    reviewer: {
      id: string;
      username: string;
      firstName?: string;
      lastName?: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function VulnerabilityDetailPage() {
  const [vulnerability, setVulnerability] = useState<Vulnerability | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewForm] = Form.useForm();
  const router = useRouter();
  const params = useParams();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = currentUser.role === 'SUPERADMIN';
  const isReviewer = currentUser.role === 'VULNERABILITY_REVIEWER' || currentUser.role === 'SUPERADMIN';
  const isFixEngineer = currentUser.role === 'FIX_ENGINEER';
  const isSubmitter = vulnerability?.submitter.id === currentUser.id;

  useEffect(() => {
    if (params.id) {
      fetchVulnerability();
    }
  }, [params.id]);

  const fetchVulnerability = async () => {
    try {
      const response = await api.get(`/api/vulnerabilities/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setVulnerability(data.data);
      } else {
        message.error(data.message || '获取数据失败');
      }
    } catch (error) {
      if (error instanceof Response) {
        if (error.status === 404) {
          message.error('漏洞不存在');
          router.push('/dashboard/vulnerabilities/list');
        } else if (error.status === 403) {
          message.warning('您没有权限查看此漏洞');
          router.push('/dashboard/vulnerabilities/list');
        } else {
          message.error('获取数据失败');
        }
      } else {
        message.error('网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (values: { status: string; comment?: string }) => {
    setActionLoading(true);
    try {
      const response = await api.post(`/api/vulnerabilities/${params.id}/review`, values);
      const data = await response.json();

      if (data.success) {
        message.success('审核完成');
        setReviewModalVisible(false);
        reviewForm.resetFields();
        fetchVulnerability();
      } else {
        message.error(data.message || '审核失败');
      }
    } catch (error) {
      if (error instanceof Response && error.status === 403) {
        message.warning('您没有权限审核此漏洞');
        setReviewModalVisible(false);
      } else {
        message.error('网络错误，请稍后重试');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async () => {
    setActionLoading(true);
    try {
      const response = await api.post(`/api/vulnerabilities/${params.id}/claim`, {});
      const data = await response.json();

      if (data.success) {
        message.success('认领成功');
        fetchVulnerability();
      } else {
        message.error(data.message || '认领失败');
      }
    } catch (error) {
      if (error instanceof Response && error.status === 403) {
        message.warning('您没有权限认领此漏洞');
      } else {
        message.error('网络错误，请稍后重试');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setActionLoading(true);
    try {
      const response = await api.patch(`/api/vulnerabilities/${params.id}/status`, { status: newStatus });
      const data = await response.json();

      if (data.success) {
        message.success('状态更新成功');
        fetchVulnerability();
      } else {
        message.error(data.message || '状态更新失败');
      }
    } catch (error) {
      if (error instanceof Response && error.status === 403) {
        message.warning('您没有权限更新此漏洞状态');
      } else {
        message.error('网络错误，请稍后重试');
      }
    } finally {
      setActionLoading(false);
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
      NEED_INFO: '需补充信息',
      ASSIGNED: '已分配',
      IN_PROGRESS: '处理中',
      PENDING_RETEST: '待复测',
      RESOLVED: '已修复',
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

  const canReview = isReviewer && ['PENDING', 'NEED_INFO', 'PENDING_RETEST'].includes(vulnerability?.status || '');
  const canClaim = isFixEngineer && vulnerability?.status === 'APPROVED' && !vulnerability.assigneeId;
  const canEdit = isSubmitter && ['PENDING', 'NEED_INFO'].includes(vulnerability?.status || '');
  const canUpdateStatus = isFixEngineer && vulnerability?.assigneeId === currentUser.id && 
    ['ASSIGNED', 'IN_PROGRESS'].includes(vulnerability?.status || '');
  const canStartProgress = isFixEngineer && vulnerability?.assigneeId === currentUser.id && 
    vulnerability?.status === 'ASSIGNED';
  const canMarkFixed = isFixEngineer && vulnerability?.assigneeId === currentUser.id && 
    vulnerability?.status === 'IN_PROGRESS';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!vulnerability) {
    return (
      <Alert
        message="漏洞不存在"
        description="请检查URL是否正确"
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <Title level={2} className="m-0">漏洞详情</Title>
        </Space>
        <Space>
          {canEdit && (
            <Button 
              icon={<EditOutlined />}
              onClick={() => router.push(`/dashboard/vulnerabilities/${params.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {canReview && (
            <Button 
              type="primary" 
              icon={<CheckOutlined />}
              onClick={() => setReviewModalVisible(true)}
            >
              审核
            </Button>
          )}
          {canClaim && (
            <Button 
              type="primary" 
              icon={<UserAddOutlined />}
              onClick={handleClaim}
              loading={actionLoading}
            >
              认领
            </Button>
          )}
          {canStartProgress && (
            <Button 
              type="primary" 
              onClick={() => handleStatusUpdate('IN_PROGRESS')}
              loading={actionLoading}
            >
              开始处理
            </Button>
          )}
          {canMarkFixed && (
            <Button 
              type="primary" 
              icon={<CheckOutlined />}
              onClick={() => handleStatusUpdate('PENDING_RETEST')}
              loading={actionLoading}
            >
              标记为已修复
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card title="基本信息" className="mb-4">
            <Title level={3}>{vulnerability.title}</Title>
            <Space className="mb-4">
              <Tag color={getSeverityColor(vulnerability.severity)} className="text-sm px-3 py-1">
                {getSeverityText(vulnerability.severity)}
              </Tag>
              <Tag color={getStatusColor(vulnerability.status)} className="text-sm px-3 py-1">
                {getStatusText(vulnerability.status)}
              </Tag>
            </Space>
            
            <Descriptions column={1} className="mb-4">
              <Descriptions.Item label="漏洞描述">
                <SafeHtmlRenderer 
                  content={vulnerability.description}
                  allowImages={true}
                  allowLinks={false}
                />
              </Descriptions.Item>
              {vulnerability.affectedSystem && (
                <Descriptions.Item label="受影响系统">
                  <SafeHtmlRenderer 
                    content={vulnerability.affectedSystem}
                    allowImages={false}
                    allowLinks={false}
                  />
                </Descriptions.Item>
              )}
              {vulnerability.reproductionSteps && (
                <Descriptions.Item label="复现步骤">
                  <SafeHtmlRenderer 
                    content={vulnerability.reproductionSteps}
                    className="prose max-w-none whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded border"
                    allowImages={true}
                    allowLinks={false}
                  />
                </Descriptions.Item>
              )}
              {vulnerability.impact && (
                <Descriptions.Item label="影响描述">
                  <SafeHtmlRenderer 
                    content={vulnerability.impact}
                    allowImages={true}
                    allowLinks={false}
                  />
                </Descriptions.Item>
              )}
              {vulnerability.recommendation && (
                <Descriptions.Item label="修复建议">
                  <SafeHtmlRenderer 
                    content={vulnerability.recommendation}
                    allowImages={true}
                    allowLinks={false}
                  />
                </Descriptions.Item>
              )}
            </Descriptions>

            {vulnerability.codeSnippet && (
              <div>
                <Title level={5}>代码片段</Title>
                <div className="border rounded-lg overflow-hidden">
                  <Editor
                    height="300px"
                    language={detectLanguage(vulnerability.codeSnippet)}
                    value={vulnerability.codeSnippet}
                    theme="vs"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      colorDecorators: true,
                      bracketPairColorization: {
                        enabled: true
                      },
                      renderWhitespace: 'selection',
                      wordWrap: 'on',
                    }}
                    beforeMount={(monaco) => {
                      // 定义青色主题
                      monaco.editor.defineTheme('cyan-theme', {
                        base: 'vs',
                        inherit: true,
                        rules: [
                          { token: 'comment', foreground: '008080', fontStyle: 'italic' },
                          { token: 'keyword', foreground: '006666', fontStyle: 'bold' },
                          { token: 'string', foreground: '009999' },
                          { token: 'number', foreground: '007777' },
                          { token: 'type', foreground: '004444', fontStyle: 'bold' },
                          { token: 'function', foreground: '005555', fontStyle: 'bold' },
                          { token: 'variable', foreground: '008888' },
                          { token: 'operator', foreground: '006666' },
                        ],
                        colors: {
                          'editor.background': '#f0ffff',
                          'editor.foreground': '#003333',
                          'editorLineNumber.foreground': '#008080',
                          'editor.selectionBackground': '#b0e0e6',
                          'editor.lineHighlightBackground': '#e0ffff',
                        }
                      });
                      
                      // 注册HTTP语言
                      monaco.languages.register({ id: 'http' });
                      monaco.languages.setMonarchTokensProvider('http', {
                        tokenizer: {
                          root: [
                            [/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+/, 'keyword.http-method'],
                            [/^HTTP\/[0-9]\.[0-9]\s+[0-9]+/, 'keyword.http-version'],
                            [/^[A-Za-z-]+:/, 'keyword.http-header'],
                            [/".*?"/, 'string'],
                            [/\{.*\}/, 'type.json'],
                            [/[0-9]+/, 'number'],
                          ]
                        }
                      });
                    }}
                    onMount={(editor, monaco) => {
                      monaco.editor.setTheme('cyan-theme');
                    }}
                  />
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="详细信息" className="mb-4" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="提交者">
                <Space>
                  {getDisplayName(vulnerability.submitter)}
                  <Text type="secondary">({vulnerability.submitter.email})</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="处理人">
                {vulnerability.assignee ? (
                  <Space>
                    {getDisplayName(vulnerability.assignee)}
                    <Text type="secondary">({vulnerability.assignee.email})</Text>
                  </Space>
                ) : (
                  <Text type="secondary">未分配</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {new Date(vulnerability.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(vulnerability.updatedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {vulnerability.reviews.length > 0 && (
            <Card title="审核历史" size="small">
              <Timeline
                items={vulnerability.reviews.map(review => ({
                  children: (
                    <div>
                      <div className="flex items-center mb-2">
                        <Tag color={getStatusColor(review.status)}>
                          {getStatusText(review.status)}
                        </Tag>
                        <Text type="secondary" className="ml-2">
                          {getDisplayName(review.reviewer)}
                        </Text>
                      </div>
                      {review.comment && (
                        <Text className="block text-gray-600">{review.comment}</Text>
                      )}
                      <Text type="secondary" className="text-xs">
                        {new Date(review.createdAt).toLocaleString()}
                      </Text>
                    </div>
                  ),
                  color: getStatusColor(review.status)
                }))}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* 审核Modal */}
      <Modal
        title={vulnerability?.status === 'PENDING_RETEST' ? '🔍 复测漏洞修复结果' : '📋 审核漏洞'}
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
      >
        <Form
          form={reviewForm}
          onFinish={handleReview}
          layout="vertical"
        >
          <Form.Item
            name="status"
            label={vulnerability?.status === 'PENDING_RETEST' ? '复测结果' : '审核结果'}
            rules={[{ required: true, message: vulnerability?.status === 'PENDING_RETEST' ? '请选择复测结果' : '请选择审核结果' }]}
          >
            <Select placeholder="选择审核结果">
              {vulnerability?.status === 'PENDING_RETEST' ? (
                <>
                  <Option value="RESOLVED">✅ 复测通过 - 漏洞已修复</Option>
                  <Option value="IN_PROGRESS">❌ 复测未通过 - 需要继续修复</Option>
                </>
              ) : (
                <>
                  <Option value="APPROVED">✅ 通过审核</Option>
                  <Option value="REJECTED">❌ 拒绝</Option>
                  <Option value="NEED_INFO">📝 需要补充信息</Option>
                </>
              )}
            </Select>
          </Form.Item>

          <Form.Item
            name="comment"
            label={vulnerability?.status === 'PENDING_RETEST' ? '复测意见' : '审核意见'}
          >
            <TextArea 
              rows={4} 
              placeholder={vulnerability?.status === 'PENDING_RETEST' ? '请输入复测意见...' : '请输入审核意见...'}
            />
          </Form.Item>

          <div className="text-right">
            <Space>
              <Button onClick={() => setReviewModalVisible(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={actionLoading}
              >
                {vulnerability?.status === 'PENDING_RETEST' ? '提交复测结果' : '提交审核'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}