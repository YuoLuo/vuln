'use client';

import { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Alert } from 'antd';

const { Title, Text, Paragraph } = Typography;

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    setDebugInfo({
      hasToken: !!token,
      token: token ? token.substring(0, 20) + '...' : null,
      hasUser: !!user,
      user: user ? JSON.parse(user) : null,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      currentUrl: window.location.href
    });
  }, []);

  const testAPI = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vulnerabilities`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setDebugInfo(prev => ({
        ...prev,
        apiTest: {
          status: response.status,
          ok: response.ok,
          data: data
        }
      }));
    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        apiTest: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  };

  const testAuth = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setDebugInfo(prev => ({
        ...prev,
        authTest: {
          status: response.status,
          ok: response.ok,
          data: data
        }
      }));
    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        authTest: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  };

  return (
    <div className="p-6">
      <Title level={2}>调试信息</Title>
      
      <Card title="环境信息" className="mb-4">
        <div className="space-y-2">
          <div><strong>API URL:</strong> {debugInfo.apiUrl}</div>
          <div><strong>当前页面:</strong> {debugInfo.currentUrl}</div>
          <div><strong>有Token:</strong> {debugInfo.hasToken ? '是' : '否'}</div>
          <div><strong>Token预览:</strong> {debugInfo.token || '无'}</div>
          <div><strong>有用户信息:</strong> {debugInfo.hasUser ? '是' : '否'}</div>
        </div>
      </Card>

      {debugInfo.user && (
        <Card title="用户信息" className="mb-4">
          <pre>{JSON.stringify(debugInfo.user, null, 2)}</pre>
        </Card>
      )}

      <Card title="API测试" className="mb-4">
        <Space direction="vertical" className="w-full">
          <Button onClick={testAuth} type="primary">
            测试认证接口 (/api/auth/me)
          </Button>
          <Button onClick={testAPI}>
            测试漏洞接口 (/api/vulnerabilities)
          </Button>
          
          {debugInfo.authTest && (
            <Alert
              message="认证测试结果"
              description={<pre>{JSON.stringify(debugInfo.authTest, null, 2)}</pre>}
              type={debugInfo.authTest.ok ? "success" : "error"}
            />
          )}
          
          {debugInfo.apiTest && (
            <Alert
              message="API测试结果"
              description={<pre>{JSON.stringify(debugInfo.apiTest, null, 2)}</pre>}
              type={debugInfo.apiTest.ok ? "success" : "error"}
            />
          )}
        </Space>
      </Card>

      <Card title="完整调试信息">
        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      </Card>
    </div>
  );
}