'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api, validateInput, escapeHtml } from '../../../../utils/api';
import { 
  Form, 
  Input, 
  Select, 
  Button, 
  Card, 
  Typography, 
  Row, 
  Col, 
  message,
  Space,
  Divider,
  Upload,
  Modal,
  Tooltip,
  Tabs,
  Badge
} from 'antd';
import { 
  SaveOutlined, 
  SendOutlined, 
  PictureOutlined, 
  CodeOutlined, 
  DatabaseOutlined,
  GlobalOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Editor } from '@monaco-editor/react';
import 'react-quill/dist/quill.snow.css';
import './styles.css';

// 动态导入ReactQuill避免SSR问题
const ReactQuill = dynamic(() => import('react-quill'), { 
  ssr: false,
  loading: () => <div className="h-48 bg-gray-50 rounded border animate-pulse flex items-center justify-center text-gray-400">加载编辑器中...</div>
});

// 稳定的富文本编辑器组件
interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  height: string;
  onCodeInsert: () => void;
  onImageUpload: (file: File) => boolean;
}

const RichTextEditorWithToolbar: React.FC<RichTextEditorProps> = React.memo(({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  height, 
  onCodeInsert, 
  onImageUpload 
}) => {
  const editorRef = useRef<any>(null);
  
  const handleCodeClick = useCallback(() => {
    onCodeInsert();
  }, [onCodeInsert]);

  const handleImageUpload = useCallback((file: File) => {
    return onImageUpload(file);
  }, [onImageUpload]);

  return (
    <div className="mb-4" style={{ isolation: 'isolate' }}>
      <div className="flex justify-between items-center mb-2">
        <Text strong>{label}</Text>
        <div className="editor-toolbar-buttons" style={{ zIndex: 10, position: 'relative' }}>
          <Button 
            icon={<CodeOutlined />} 
            size="small"
            type="default"
            onClick={handleCodeClick}
            style={{ marginRight: 8 }}
          >
            代码
          </Button>
          <Upload
            beforeUpload={handleImageUpload}
            showUploadList={false}
            accept="image/*"
          >
            <Button 
              icon={<PictureOutlined />} 
              size="small"
              type="default"
            >
              图片
            </Button>
          </Upload>
        </div>
      </div>
      <div className="rich-text-wrapper" style={{ position: 'relative', isolation: 'isolate' }}>
        <ReactQuill
          ref={editorRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={{
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              [{ 'indent': '-1'}, { 'indent': '+1' }],
              ['link', 'blockquote', 'code-block'],
              [{ 'color': [] }, { 'background': [] }],
              ['clean']
            ]
          }}
          formats={[
            'header', 'bold', 'italic', 'underline', 'strike',
            'list', 'bullet', 'indent', 'link', 'blockquote', 'code-block',
            'color', 'background'
          ]}
          placeholder={placeholder}
          style={{ height, marginBottom: '50px' }}
        />
      </div>
    </div>
  );
});

RichTextEditorWithToolbar.displayName = 'RichTextEditorWithToolbar';

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

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface VulnerabilityForm {
  title: string;
  description: string;
  severity: string;
  affectedSystem?: string;
  reproductionSteps?: string;
  impact?: string;
  recommendation?: string;
  codeSnippet?: string;
}

interface CodeBlock {
  id: string;
  language: string;
  code: string;
  title: string;
}

interface ImageFile {
  uid: string;
  name: string;
  url: string;
  file?: File;
}

export default function SubmitVulnerabilityPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [currentCodeBlock, setCurrentCodeBlock] = useState<CodeBlock | null>(null);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [impact, setImpact] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [editorInstances, setEditorInstances] = useState({
    description: null as any,
    reproduction: null as any,
    impact: null as any,
    recommendation: null as any
  });
  const router = useRouter();

  // 代码模板
  const codeTemplates = {
    http: `GET /api/vulnerable-endpoint HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Accept: application/json
Authorization: Bearer token_here

`,
    sql: `-- SQL注入示例
SELECT * FROM users WHERE id = '1' OR '1'='1' --';

-- 联合查询注入
SELECT username FROM users WHERE id = 1 UNION SELECT password FROM users--
`,
    javascript: `// XSS漏洞示例
function vulnerableFunction(userInput) {
  document.getElementById('output').innerHTML = userInput; // 危险操作
}

// CSRF攻击
fetch('/api/transfer', {
  method: 'POST',
  body: JSON.stringify({
    amount: 1000,
    to: 'attacker@evil.com'
  })
});
`,
    python: `# Python代码注入示例
import subprocess

def vulnerable_function(user_input):
    # 危险：直接执行用户输入
    subprocess.call(user_input, shell=True)
    
# 文件包含漏洞
def read_file(filename):
    with open(filename, 'r') as f:  # 未验证文件路径
        return f.read()
`,
    php: `<?php
// SQL注入漏洞
$user_id = $_GET['id'];
$query = "SELECT * FROM users WHERE id = " . $user_id; // 危险

// 文件包含漏洞
include($_GET['page'] . '.php'); // 危险

// XSS漏洞
echo "Hello " . $_GET['name']; // 未过滤输出
?>
`,
    bash: `#!/bin/bash
# 命令注入示例
user_input="$1"
eval "ls $user_input"  # 危险操作

# 特权提升
sudo chmod +s /bin/bash  # 危险
`
  };

  const onFinish = async (values: VulnerabilityForm) => {
    // 前端验证
    if (!description.trim()) {
      message.error('请填写漏洞描述');
      return;
    }

    // 验证输入安全性
    if (values.title && values.title.length > 200) {
      message.error('标题过长');
      return;
    }

    // 检查是否包含潜在的恶意内容
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i
    ];

    const textToCheck = [values.title, description, reproductionSteps, impact, recommendation].join(' ');
    if (dangerousPatterns.some(pattern => pattern.test(textToCheck))) {
      message.error('输入内容包含不安全的字符，请检查后重新提交');
      return;
    }

    setLoading(true);
    try {
      // 将代码块合并到描述中
      let finalDescription = description;
      codeBlocks.forEach((block, index) => {
        finalDescription += `\n\n### ${escapeHtml(block.title)}\n\`\`\`${block.language}\n${block.code}\n\`\`\``;
      });
      
      // 处理图片上传
      const uploadedImages: string[] = [];
      for (const image of images) {
        if (image.file) {
          try {
            const response = await api.upload('/api/upload/image', image.file, 'image');
            if (response.ok) {
              const result = await response.json();
              uploadedImages.push(result.data.url);
              finalDescription += `\n\n![${escapeHtml(image.name)}](${result.data.url})`;
            } else {
              throw new Error('上传失败');
            }
          } catch (error) {
            console.error('图片上传失败:', error);
            message.warning(`图片 ${image.name} 上传失败，将跳过`);
          }
        }
      }

      const vulnerabilityData = {
        ...values,
        description: finalDescription,
        reproductionSteps,
        impact,
        recommendation,
        codeSnippet: codeBlocks.length > 0 ? codeBlocks[0].code : undefined
      };

      const response = await api.post('/api/vulnerabilities', vulnerabilityData);

      const data = await response.json();

      if (data.success) {
        // 显示成功消息
        message.success('🎉 漏洞提交成功！感谢您的贡献！');
        
        // 立即触发第一波礼花
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3']
        });
        
        // 延迟第二波礼花
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.8 },
            colors: ['#ee5a24', '#0abde3', '#10ac84', '#f368e0', '#ff9f43']
          });
        }, 200);
        
        // 第三波礼花
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.8 },
            colors: ['#a55eea', '#26de81', '#fd79a8', '#fdcb6e', '#6c5ce7']
          });
        }, 400);
        
        // 最后一波小礼花雨
        setTimeout(() => {
          const count = 200;
          const defaults = {
            origin: { y: 0.7 },
            colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#a55eea', '#26de81']
          };
          
          function fire(particleRatio: number, opts: any) {
            confetti(Object.assign({}, defaults, opts, {
              particleCount: Math.floor(count * particleRatio)
            }));
          }
          
          fire(0.25, {
            spread: 26,
            startVelocity: 55,
          });
          fire(0.2, {
            spread: 60,
          });
          fire(0.35, {
            spread: 100,
            decay: 0.91,
            scalar: 0.8
          });
          fire(0.1, {
            spread: 120,
            startVelocity: 25,
            decay: 0.92,
            scalar: 1.2
          });
          fire(0.1, {
            spread: 120,
            startVelocity: 45,
          });
        }, 600);
        
        // 等待礼花动画结束后跳转
        setTimeout(() => {
          router.push('/dashboard/vulnerabilities/list');
        }, 2000);
      } else {
        if (data.errors) {
          Object.entries(data.errors).forEach(([field, errors]) => {
            message.error(`${field}: ${(errors as string[]).join(', ')}`);
          });
        } else {
          message.error(data.message || '提交失败');
        }
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };


  // 添加代码块
  const addCodeBlock = (language: string = 'javascript', template: string = '') => {
    const newBlock: CodeBlock = {
      id: Date.now().toString(),
      language,
      code: template,
      title: `${language.toUpperCase()} 代码片段`
    };
    setCurrentCodeBlock(newBlock);
    setCodeModalVisible(true);
  };

  // 打开空的代码编辑器
  const openCodeEditor = useCallback(() => {
    console.log('Opening code editor');
    addCodeBlock('javascript', '');
  }, []);

  // 调试：监控 currentCodeBlock 变化
  useEffect(() => {
    console.log('currentCodeBlock changed:', currentCodeBlock);
  }, [currentCodeBlock]);


  // 保存代码块
  const saveCodeBlock = () => {
    if (!currentCodeBlock) {
      console.error('No current code block to save');
      return;
    }

    // 验证必填字段
    if (!currentCodeBlock.title?.trim()) {
      message.error('请输入代码片段标题');
      return;
    }

    if (!currentCodeBlock.code?.trim()) {
      message.error('请输入代码内容');
      return;
    }

    console.log('Saving code block:', currentCodeBlock);
    
    // 检查是否是编辑现有的代码块
    const existingBlockIndex = codeBlocks.findIndex(block => block.id === currentCodeBlock.id);
    
    if (existingBlockIndex !== -1) {
      // 更新现有代码块
      setCodeBlocks(blocks => blocks.map(block => 
        block.id === currentCodeBlock.id ? currentCodeBlock : block
      ));
      message.success('代码片段已更新');
    } else {
      // 添加新代码块
      setCodeBlocks(blocks => [...blocks, currentCodeBlock]);
      message.success('代码片段已保存');
    }
    
    setCodeModalVisible(false);
    setCurrentCodeBlock(null);
  };

  // 删除代码块
  const deleteCodeBlock = (id: string) => {
    setCodeBlocks(blocks => blocks.filter(block => block.id !== id));
  };

  // 稳定的图片上传处理
  const stableImageUpload = useCallback((file: File) => {
    return handleImageUpload(file);
  }, []);


  // 图片上传处理
  const handleImageUpload = (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const newImage: ImageFile = {
          uid: Date.now().toString(),
          name: file.name,
          url: reader.result as string,
          file
        };
        setImages(prev => [...prev, newImage]);
        message.success(`图片 ${file.name} 添加成功`);
      };
      reader.onerror = () => {
        message.error(`图片 ${file.name} 读取失败`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      message.error('图片处理失败');
    }
    return false; // 阻止默认上传
  };

  // 删除图片
  const removeImage = (uid: string) => {
    setImages(prev => prev.filter(img => img.uid !== uid));
  };


  const severityOptions = [
    { label: '🔴 严重 (Critical)', value: 'CRITICAL', color: '#ff4d4f' },
    { label: '🟠 高危 (High)', value: 'HIGH', color: '#fa8c16' },
    { label: '🟡 中危 (Medium)', value: 'MEDIUM', color: '#fadb14' },
    { label: '🟢 低危 (Low)', value: 'LOW', color: '#52c41a' },
    { label: '🔵 信息 (Info)', value: 'INFO', color: '#1890ff' },
  ];

  const languageOptions = [
    { label: 'HTTP请求', value: 'http', icon: <GlobalOutlined /> },
    { label: 'JavaScript', value: 'javascript', icon: <CodeOutlined /> },
    { label: 'Python', value: 'python', icon: <CodeOutlined /> },
    { label: 'SQL', value: 'sql', icon: <DatabaseOutlined /> },
    { label: 'PHP', value: 'php', icon: <CodeOutlined /> },
    { label: 'Bash/Shell', value: 'bash', icon: <CodeOutlined /> },
    { label: 'Java', value: 'java', icon: <CodeOutlined /> },
    { label: 'HTML', value: 'html', icon: <CodeOutlined /> },
    { label: 'CSS', value: 'css', icon: <CodeOutlined /> },
    { label: 'JSON', value: 'json', icon: <CodeOutlined /> },
    { label: 'XML', value: 'xml', icon: <CodeOutlined /> },
  ];

  return (
    <div>
      <div className="mb-6 text-center">
        <Title 
          level={2} 
          className="page-title"
          style={{
            background: 'linear-gradient(45deg, #1890ff, #36cfc9, #52c41a)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% 200%',
            animation: 'gradient-animation 3s ease infinite',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem'
          }}
        >
          📝 提交安全漏洞
        </Title>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        scrollToFirstError
        preserve={false}
      >
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card title="📋 基本信息" className="mb-4">
              <Form.Item
                name="title"
                label="漏洞标题"
                rules={[
                  { required: true, message: '请输入漏洞标题' },
                  { min: 5, max: 200, message: '标题长度为5-200个字符' }
                ]}
              >
                <Input 
                  placeholder="简洁明了地描述漏洞问题，例如：用户登录接口存在SQL注入漏洞" 
                  size="large"
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="severity"
                    label="严重程度"
                    rules={[{ required: true, message: '请选择严重程度' }]}
                  >
                    <Select placeholder="选择漏洞的严重程度" size="large">
                      {severityOptions.map(option => (
                        <Option key={option.value} value={option.value}>
                          <Space>
                            <span>{option.label}</span>
                          </Space>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="affectedSystem"
                    label="受影响系统"
                  >
                    <Input 
                      placeholder="例如：用户管理系统、支付模块等" 
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="📖 详细描述" className="mb-4">
              <RichTextEditorWithToolbar
                label="漏洞描述 *"
                value={description}
                onChange={setDescription}
                placeholder="详细描述漏洞的具体情况、发现过程、技术细节等..."
                height="200px"
                onCodeInsert={openCodeEditor}
                onImageUpload={handleImageUpload}
              />
            </Card>

            <Card title="🔍 技术详情" className="mb-4">
              <Tabs 
                defaultActiveKey="reproduction"
                items={[
                  {
                    key: 'reproduction',
                    label: '🔄 复现步骤',
                    children: (
                      <RichTextEditorWithToolbar
                        label="详细的漏洞复现步骤"
                        value={reproductionSteps}
                        onChange={setReproductionSteps}
                        placeholder="1. 打开目标页面...&#10;2. 点击登录按钮...&#10;3. 在用户名字段输入恶意代码...&#10;4. 观察响应结果..."
                        height="150px"
                        onCodeInsert={openCodeEditor}
                        onImageUpload={stableImageUpload}
                      />
                    )
                  },
                  {
                    key: 'impact',
                    label: '💥 影响描述',
                    children: (
                      <RichTextEditorWithToolbar
                        label="描述此漏洞可能造成的影响和危害"
                        value={impact}
                        onChange={setImpact}
                        placeholder="该漏洞可能导致用户敏感信息泄露、权限提升、系统被攻击等..."
                        height="150px"
                        onCodeInsert={openCodeEditor}
                        onImageUpload={stableImageUpload}
                      />
                    )
                  },
                  {
                    key: 'recommendation',
                    label: '🛠️ 修复建议',
                    children: (
                      <RichTextEditorWithToolbar
                        label="建议的修复方案或缓解措施"
                        value={recommendation}
                        onChange={setRecommendation}
                        placeholder="建议对用户输入进行严格过滤和验证、使用参数化查询等..."
                        height="150px"
                        onCodeInsert={openCodeEditor}
                        onImageUpload={stableImageUpload}
                      />
                    )
                  }
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            {/* 代码块管理 */}
            <Card title={
              <Space>
                <CodeOutlined />
                <span>代码片段</span>
                <Badge count={codeBlocks.length} />
              </Space>
            } className="mb-4">
              <div className="space-y-3">
                {codeBlocks.map((block) => (
                  <div key={block.id} className="code-block-card border rounded-lg p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <div className="flex justify-between items-center mb-2">
                      <Text strong className="text-sm text-blue-800">{block.title}</Text>
                      <Space size="small">
                        <Tooltip title="复制代码">
                          <Button 
                            size="small" 
                            icon={<CopyOutlined />}
                            onClick={() => {
                              navigator.clipboard.writeText(block.code);
                              message.success('代码已复制');
                            }}
                            className="hover:bg-blue-100"
                          />
                        </Tooltip>
                        <Tooltip title="删除代码块">
                          <Button 
                            size="small" 
                            icon={<DeleteOutlined />}
                            danger
                            onClick={() => deleteCodeBlock(block.id)}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                    <div className="text-xs text-blue-600 mb-2 flex items-center gap-1">
                      <CodeOutlined />
                      语言: {block.language.toUpperCase()}
                    </div>
                    <pre className="text-xs bg-white p-3 rounded border border-blue-200 overflow-auto max-h-20 font-mono shadow-sm">
                      {block.code.substring(0, 100)}{block.code.length > 100 ? '...' : ''}
                    </pre>
                    <div className="mt-3 text-xs text-gray-500">
                      代码片段已保存，可在编辑器中手动复制使用
                    </div>
                  </div>
                ))}
                
                <div 
                  className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center cursor-pointer bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300"
                  onClick={openCodeEditor}
                >
                  <CodeOutlined className="text-2xl text-blue-400 mb-2" />
                  <div className="text-sm font-medium text-blue-600 mb-1">添加代码片段</div>
                  <div className="text-xs text-blue-400">支持多种编程语言和HTTP请求</div>
                </div>
              </div>
            </Card>

            {/* 图片管理 */}
            <Card title={
              <Space>
                <PictureOutlined />
                <span>图片附件</span>
                <Badge count={images.length} />
              </Space>
            } className="mb-4">
              <div className="space-y-3">
                {images.map((image) => (
                  <div key={image.uid} className="border rounded-lg p-3 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-md transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <Text strong className="text-sm text-green-800 flex items-center gap-1">
                        <PictureOutlined />
                        {image.name}
                      </Text>
                      <Tooltip title="删除图片">
                        <Button 
                          size="small" 
                          icon={<DeleteOutlined />}
                          danger
                          onClick={() => removeImage(image.uid)}
                        />
                      </Tooltip>
                    </div>
                    <div className="relative overflow-hidden rounded-lg border border-green-200">
                      <img 
                        src={image.url} 
                        alt={image.name}
                        className="w-full h-24 object-cover hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      图片已上传，可在编辑器中使用
                    </div>
                  </div>
                ))}
                
                <Upload
                  beforeUpload={handleImageUpload}
                  showUploadList={false}
                  accept="image/*"
                  multiple
                >
                  <div className="image-upload-area bg-gradient-to-br from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100 transition-all duration-300">
                    <PictureOutlined className="text-2xl text-gray-400 mb-2" />
                    <div className="text-sm font-medium text-gray-600 mb-1">点击或拖拽上传图片</div>
                    <div className="text-xs text-gray-400">支持 JPG、PNG、GIF 格式，最大 5MB</div>
                  </div>
                </Upload>
              </div>
            </Card>

            {/* 提交指南 */}
            <Card title={
              <Space>
                <InfoCircleOutlined />
                <span>提交指南</span>
              </Space>
            } size="small">
              <div className="text-sm text-gray-600 space-y-2">
                <div>• 📝 使用富文本编辑器详细描述</div>
                <div>• 🖼️ 上传截图有助于理解问题</div>
                <div>• 💻 使用工具栏的代码块功能插入代码</div>
                <div>• 🔄 提供完整的复现步骤</div>
                <div>• ⚡ 根据实际风险选择严重程度</div>
                <div>• 🔍 提交后将进入审核流程</div>
              </div>
            </Card>
          </Col>
        </Row>

        <Divider />

        <div className="text-center">
          <Space size="middle">
            <Button 
              onClick={() => router.back()}
              size="large"
            >
              取消
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={loading ? <SendOutlined /> : <SendOutlined />}
              size="large"
              className={`submit-button ${loading ? 'submitting' : ''}`}
              style={{
                background: loading 
                  ? 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4)' 
                  : 'linear-gradient(45deg, #1890ff, #36cfc9)',
                backgroundSize: loading ? '400% 400%' : '100% 100%',
                animation: loading ? 'gradient-animation 2s ease infinite' : 'none',
                border: 'none',
                boxShadow: '0 4px 15px rgba(24, 144, 255, 0.4)',
                transform: loading ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? '🎆 正在提交...' : '🚀 提交漏洞'}
            </Button>
          </Space>
        </div>
      </Form>

      {/* 代码编辑器模态框 */}
      <Modal
        title="✨ 代码片段编辑器"
        open={codeModalVisible}
        onCancel={() => {
          setCodeModalVisible(false);
          setCurrentCodeBlock(null);
        }}
        onOk={saveCodeBlock}
        width={800}
        okText="保存代码片段"
        cancelText="取消"
        destroyOnClose={true}
        maskClosable={false}
        keyboard={false}
      >
        <div className="space-y-4">
          <Row gutter={16}>
            <Col span={12}>
              <label className="block text-sm font-medium mb-1">代码片段标题</label>
              <Input
                value={currentCodeBlock?.title || ''}
                onChange={(e) => {
                  console.log('Title changed to:', e.target.value);
                  setCurrentCodeBlock(prev => 
                    prev ? { ...prev, title: e.target.value } : null
                  );
                }}
                placeholder="例如：SQL注入POC代码"
                required
                autoFocus
                onPressEnter={(e) => {
                  e.preventDefault();
                }}
              />
            </Col>
            <Col span={12}>
              <label className="block text-sm font-medium mb-1">编程语言</label>
              <Select
                value={currentCodeBlock?.language || 'javascript'}
                onChange={(value) => {
                  console.log('Language changed to:', value);
                  setCurrentCodeBlock(prev => 
                    prev ? { ...prev, language: value } : null
                  );
                }}
                className="w-full"
              >
                {languageOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    <Space>
                      {option.icon}
                      {option.label}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>

          <div>
            <label className="block text-sm font-medium mb-1">代码模板</label>
            <Select
              placeholder="选择代码模板（可选）"
              onChange={(value) => {
                if (currentCodeBlock) {
                  setCurrentCodeBlock({
                    ...currentCodeBlock,
                    code: (codeTemplates as any)[value] || ''
                  });
                }
              }}
              className="w-full"
              allowClear
            >
              {Object.entries(codeTemplates).map(([key, template]) => (
                <Option key={key} value={key}>
                  {languageOptions.find(opt => opt.value === key)?.label || key.toUpperCase()} 模板
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">代码内容</label>
            <div className="border rounded-lg overflow-hidden">
              <Editor
                height="300px"
                language={currentCodeBlock?.language || 'javascript'}
                value={currentCodeBlock?.code || ''}
                onChange={(value) => setCurrentCodeBlock(prev => 
                  prev ? { ...prev, code: value || '' } : null
                )}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  formatOnType: true,
                  formatOnPaste: true,
                }}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}