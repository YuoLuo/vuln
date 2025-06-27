'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Form, Input, Select, Button, Card, message, Spin, Typography } from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import MonacoEditor from '@monaco-editor/react';

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

const { Title } = Typography;
const { TextArea } = Input;

interface VulnerabilityData {
  title: string;
  description: string;
  codeSnippet?: string;
  severity: string;
  affectedSystem?: string;
  reproductionSteps?: string;
  impact?: string;
  recommendation?: string;
}

export default function EditVulnerabilityPage() {
  const params = useParams();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState('');

  const id = params.id as string;

  useEffect(() => {
    const fetchVulnerability = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          const data = result.data;
          
          form.setFieldsValue({
            title: data.title,
            description: data.description,
            severity: data.severity,
            affectedSystem: data.affectedSystem,
            reproductionSteps: data.reproductionSteps,
            impact: data.impact,
            recommendation: data.recommendation,
          });
          
          setCodeSnippet(data.codeSnippet || '');
        } else {
          message.error('获取漏洞详情失败');
          router.push('/dashboard/vulnerabilities/list');
        }
      } catch (error) {
        console.error('获取漏洞详情失败:', error);
        message.error('获取漏洞详情失败');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchVulnerability();
    }
  }, [id, form, router]);

  const onFinish = async (values: VulnerabilityData) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          codeSnippet,
        }),
      });

      if (response.ok) {
        message.success('漏洞更新成功');
        router.push(`/dashboard/vulnerabilities/${id}`);
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '更新失败');
      }
    } catch (error) {
      console.error('更新漏洞失败:', error);
      message.error('更新漏洞失败');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => router.back()}
          className="mb-4"
        >
          返回
        </Button>
        <Title level={2}>编辑漏洞</Title>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            severity: 'MEDIUM',
          }}
        >
          <Form.Item
            label="漏洞标题"
            name="title"
            rules={[
              { required: true, message: '请输入漏洞标题' },
              { min: 5, message: '标题至少5个字符' },
              { max: 200, message: '标题最多200个字符' },
            ]}
          >
            <Input placeholder="请输入漏洞标题" />
          </Form.Item>

          <Form.Item
            label="漏洞描述"
            name="description"
            rules={[
              { required: true, message: '请输入漏洞描述' },
              { min: 20, message: '描述至少20个字符' },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述漏洞的具体情况"
            />
          </Form.Item>

          <Form.Item label="代码片段">
            <div className="border border-gray-300 rounded">
              <MonacoEditor
                height="300px"
                language={detectLanguage(codeSnippet)}
                value={codeSnippet}
                onChange={(value) => setCodeSnippet(value || '')}
                theme="vs"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  colorDecorators: true,
                  bracketPairColorization: {
                    enabled: true
                  },
                  renderWhitespace: 'selection',
                  wordWrap: 'on',
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  formatOnType: true,
                  formatOnPaste: true,
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
                      'editor.inactiveSelectionBackground': '#d0e8e8',
                      'editorCursor.foreground': '#006666',
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
                        [/https?:\/\/[^\s]+/, 'string.url'],
                      ]
                    }
                  });
                  
                  // 提供HTTP代码补全
                  monaco.languages.registerCompletionItemProvider('http', {
                    provideCompletionItems: () => {
                      return {
                        suggestions: [
                          {
                            label: 'GET',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'GET /api/endpoint HTTP/1.1\nHost: example.com\nContent-Type: application/json\n\n',
                          },
                          {
                            label: 'POST',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'POST /api/endpoint HTTP/1.1\nHost: example.com\nContent-Type: application/json\nContent-Length: 0\n\n{\n  \n}',
                          },
                          {
                            label: 'Content-Type: application/json',
                            kind: monaco.languages.CompletionItemKind.Text,
                            insertText: 'Content-Type: application/json',
                          },
                          {
                            label: 'Authorization: Bearer',
                            kind: monaco.languages.CompletionItemKind.Text,
                            insertText: 'Authorization: Bearer token',
                          },
                        ]
                      };
                    }
                  });
                }}
                onMount={(editor, monaco) => {
                  monaco.editor.setTheme('cyan-theme');
                }}
              />
            </div>
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label="严重程度"
              name="severity"
              rules={[{ required: true, message: '请选择严重程度' }]}
            >
              <Select placeholder="请选择严重程度">
                <Select.Option value="CRITICAL">严重</Select.Option>
                <Select.Option value="HIGH">高危</Select.Option>
                <Select.Option value="MEDIUM">中危</Select.Option>
                <Select.Option value="LOW">低危</Select.Option>
                <Select.Option value="INFO">信息</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="受影响系统"
              name="affectedSystem"
            >
              <Input placeholder="如：Web应用、移动应用等" />
            </Form.Item>
          </div>

          <Form.Item
            label="复现步骤"
            name="reproductionSteps"
          >
            <TextArea
              rows={3}
              placeholder="请详细描述如何复现该漏洞"
            />
          </Form.Item>

          <Form.Item
            label="影响评估"
            name="impact"
          >
            <TextArea
              rows={3}
              placeholder="请描述该漏洞可能造成的影响"
            />
          </Form.Item>

          <Form.Item
            label="修复建议"
            name="recommendation"
          >
            <TextArea
              rows={3}
              placeholder="请提供修复该漏洞的建议"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={updating}
              icon={<SaveOutlined />}
              size="large"
            >
              更新漏洞
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}