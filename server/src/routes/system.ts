import { Router } from 'express';
import { checkResourcePermission } from '../middleware/rbac';
import { csrfProtection } from '../middleware/csrfProtection';
import { sensitiveOperationRateLimit } from '../middleware/rateLimiter';
import { validateUrls } from '../middleware/inputValidation';
import { xmlSecurity } from '../middleware/xmlSecurity';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireSuperAdmin } from '../middleware/auth';
import { notificationService } from '../services/notificationService';

const router = Router();

// 获取系统设置
router.get('/settings', 
  authenticate, 
  requireSuperAdmin, 
  async (req: AuthRequest, res, next) => {
  try {
    const settings = await prisma.systemSettings.findMany();
    
    // 转换为键值对格式
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    res.json({
      success: true,
      data: settingsMap
    });
  } catch (error) {
    next(error);
  }
});

// 更新系统设置
router.put('/settings', 
  authenticate, 
  requireSuperAdmin, 
  csrfProtection,
  sensitiveOperationRateLimit,
  xmlSecurity,
  validateUrls,
  async (req: AuthRequest, res, next) => {
  try {
    const settings = req.body;
    
    // 批量更新设置
    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSettings.upsert({
        where: { key },
        update: { value: value as string },
        create: { key, value: value as string }
      });
    }

    res.json({
      success: true,
      message: '系统设置更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 邮件模板预览（仅超级管理员）
router.get('/email-preview/:event', 
  authenticate, 
  requireSuperAdmin, 
  async (req: AuthRequest, res, next) => {
  try {
    const { event } = req.params;
    
    // 创建模拟漏洞数据用于预览
    const mockVulnerability = {
      id: 'vuln-preview-123456789',
      title: 'SQL注入漏洞示例 - 用户登录接口存在注入风险',
      description: '在用户登录接口中发现SQL注入漏洞，攻击者可能通过构造恶意输入绕过身份验证',
      severity: 'CRITICAL',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      submitter: {
        id: 'user-123',
        username: 'security_researcher',
        firstName: '安全',
        lastName: '研究员',
        email: 'researcher@example.com'
      },
      assignee: event === 'VULNERABILITY_ASSIGNED' ? {
        id: 'user-456',
        username: 'fix_engineer',
        firstName: '修复',
        lastName: '工程师',
        email: 'engineer@example.com'
      } : null
    };

    // 获取通知标题和消息
    const title = (notificationService as any).getNotificationTitle(event, mockVulnerability);
    const message = (notificationService as any).getNotificationMessage(event, mockVulnerability);
    
    // 生成邮件模板
    const emailHtml = (notificationService as any).generateEmailTemplate(title, message, mockVulnerability);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(emailHtml);
  } catch (error) {
    next(error);
  }
});

// 钉钉模板预览（仅超级管理员）
router.get('/dingtalk-preview/:event', 
  authenticate, 
  requireSuperAdmin, 
  async (req: AuthRequest, res, next) => {
  try {
    const { event } = req.params;
    
    // 创建模拟漏洞数据用于预览
    const mockVulnerability = {
      id: 'vuln-preview-123456789',
      title: 'XSS跨站脚本攻击漏洞 - 评论功能未过滤用户输入',
      description: '发现网站评论功能存在存储型XSS漏洞，可能导致用户信息泄露',
      severity: 'HIGH',
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      submitter: {
        username: 'whitehacker'
      },
      assignee: {
        username: 'backend_dev'
      }
    };

    // 获取通知标题和消息
    const title = (notificationService as any).getNotificationTitle(event, mockVulnerability);
    const message = (notificationService as any).getNotificationMessage(event, mockVulnerability);
    
    // 生成钉钉模板
    const severityEmoji = (notificationService as any).getSeverityEmoji(mockVulnerability.severity);
    const statusEmoji = (notificationService as any).getStatusEmoji(mockVulnerability.status);
    const dingtalkMarkdown = (notificationService as any).generateDingTalkTemplate(title, message, mockVulnerability, severityEmoji, statusEmoji);
    
    res.json({
      title: `${severityEmoji} ${title}`,
      markdown: dingtalkMarkdown,
      event,
      mockData: mockVulnerability
    });
  } catch (error) {
    next(error);
  }
});

export default router;