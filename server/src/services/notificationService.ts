import nodemailer from 'nodemailer';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
const NotificationType = {
  EMAIL: 'EMAIL',
  DINGTALK: 'DINGTALK',
  WECHAT: 'WECHAT'
} as const;

const NotificationEvent = {
  VULNERABILITY_SUBMITTED: 'VULNERABILITY_SUBMITTED',
  VULNERABILITY_APPROVED: 'VULNERABILITY_APPROVED',
  VULNERABILITY_REJECTED: 'VULNERABILITY_REJECTED',
  VULNERABILITY_NEED_INFO: 'VULNERABILITY_NEED_INFO',
  VULNERABILITY_ASSIGNED: 'VULNERABILITY_ASSIGNED',
  VULNERABILITY_RESOLVED: 'VULNERABILITY_RESOLVED'
} as const;

type NotificationEvent = typeof NotificationEvent[keyof typeof NotificationEvent];
type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export class NotificationService {
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    // 初始化邮件发送器
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendNotification(
    userId: string,
    vulnerabilityId: string,
    event: NotificationEvent,
    customTitle?: string,
    customMessage?: string
  ) {
    try {
      // 获取用户信息和通知设置
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { settings: true }
      });

      if (!user) {
        logger.error(`User not found: ${userId}`);
        return;
      }

      // 获取漏洞信息
      const vulnerability = await prisma.vulnerability.findUnique({
        where: { id: vulnerabilityId },
        include: {
          submitter: true,
          assignee: true
        }
      });

      if (!vulnerability) {
        logger.error(`Vulnerability not found: ${vulnerabilityId}`);
        return;
      }

      const title = customTitle || this.getNotificationTitle(event, vulnerability);
      const message = customMessage || this.getNotificationMessage(event, vulnerability);

      // 发送邮件通知
      if (user.settings?.emailEnabled !== false) {
        await this.sendEmailNotification(user, title, message, vulnerability);
      }

      // 发送钉钉通知
      if (user.settings?.dingtalkEnabled && user.settings?.dingtalkWebhook) {
        await this.sendDingTalkNotification(
          user.settings.dingtalkWebhook,
          title,
          message,
          vulnerability
        );
      }

      // 发送微信通知
      if (user.settings?.wechatEnabled && user.settings?.wechatWebhook) {
        await this.sendWeChatNotification(
          user.settings.wechatWebhook,
          title,
          message,
          vulnerability
        );
      }

      logger.info(`Notifications sent for user ${userId}, event ${event}`);
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  private async sendEmailNotification(
    user: any,
    title: string,
    message: string,
    vulnerability: any
  ) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          vulnerabilityId: vulnerability.id,
          type: NotificationType.EMAIL,
          event: vulnerability.status,
          title,
          message
        }
      });

      const htmlContent = this.generateEmailTemplate(title, message, vulnerability);

      await this.emailTransporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: title,
        html: htmlContent
      });

      await prisma.notification.update({
        where: { id: notification.id },
        data: { isSent: true, sentAt: new Date() }
      });

      logger.info(`Email sent to ${user.email}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      // 记录发送失败
      await prisma.notification.updateMany({
        where: { userId: user.id, isSent: false },
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  private async sendDingTalkNotification(
    webhookUrl: string,
    title: string,
    message: string,
    vulnerability: any
  ) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: vulnerability.submitterId,
          vulnerabilityId: vulnerability.id,
          type: NotificationType.DINGTALK,
          event: vulnerability.status,
          title,
          message
        }
      });

      const severityEmoji = this.getSeverityEmoji(vulnerability.severity);
      const statusEmoji = this.getStatusEmoji(vulnerability.status);
      const severityColor = this.getSeverityColor(vulnerability.severity);
      
      const markdownText = this.generateDingTalkTemplate(title, message, vulnerability, severityEmoji, statusEmoji);

      const payload = {
        msgtype: 'actionCard',
        actionCard: {
          title: `${severityEmoji} ${title}`,
          text: markdownText,
          btnOrientation: '0',
          btns: [
            {
              title: '查看详情',
              actionURL: `${process.env.FRONTEND_URL}/dashboard/vulnerabilities/${vulnerability.id}`
            },
            {
              title: '管理后台',
              actionURL: `${process.env.FRONTEND_URL}/dashboard`
            }
          ]
        }
      };

      await axios.post(webhookUrl, payload);

      await prisma.notification.update({
        where: { id: notification.id },
        data: { isSent: true, sentAt: new Date() }
      });

      logger.info('DingTalk notification sent');
    } catch (error) {
      logger.error('Failed to send DingTalk notification:', error);
    }
  }

  private async sendWeChatNotification(
    webhookUrl: string,
    title: string,
    message: string,
    vulnerability: any
  ) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: vulnerability.submitterId,
          vulnerabilityId: vulnerability.id,
          type: NotificationType.WECHAT,
          event: vulnerability.status,
          title,
          message
        }
      });

      const severityEmoji = this.getSeverityEmoji(vulnerability.severity);
      const statusEmoji = this.getStatusEmoji(vulnerability.status);
      const severityText = this.getSeverityText(vulnerability.severity);
      const statusText = this.getStatusText(vulnerability.status);

      const content = `## ${severityEmoji} ${title}

**📋 漏洞信息**
> 标题：${vulnerability.title}
> 描述：${message}

**🔍 详细信息**
> 🆔 ID：\`${vulnerability.id.substring(0, 12)}\`
> ${severityEmoji} 严重程度：<font color="warning">**${severityText}**</font>
> ${statusEmoji} 状态：<font color="info">**${statusText}**</font>
> 📅 时间：${new Date(vulnerability.createdAt).toLocaleString('zh-CN')}
> 👤 提交者：${vulnerability.submitter?.username || '未知'}
${vulnerability.assignee ? `> 👨‍💻 处理人：${vulnerability.assignee.username}` : ''}

**🚀 下一步操作**
${this.getNextStepMessage(vulnerability.status)}

---
💡 请及时登录系统查看详情并进行相关操作`;

      const payload = {
        msgtype: 'markdown',
        markdown: {
          content
        }
      };

      await axios.post(webhookUrl, payload);

      await prisma.notification.update({
        where: { id: notification.id },
        data: { isSent: true, sentAt: new Date() }
      });

      logger.info('WeChat notification sent');
    } catch (error) {
      logger.error('Failed to send WeChat notification:', error);
    }
  }

  private getNotificationTitle(event: NotificationEvent, vulnerability: any): string {
    const severityText = this.getSeverityText(vulnerability.severity);
    const titles: Record<NotificationEvent, string> = {
      VULNERABILITY_SUBMITTED: `🔔 ${severityText}漏洞提交成功`,
      VULNERABILITY_APPROVED: `✅ 漏洞审核通过 - 等待认领`,
      VULNERABILITY_REJECTED: `❌ 漏洞审核未通过`,
      VULNERABILITY_NEED_INFO: `❓ 漏洞需要补充信息`,
      VULNERABILITY_ASSIGNED: `👨‍💻 漏洞已被认领 - 开始处理`,
      VULNERABILITY_RESOLVED: `🎉 漏洞修复完成 - 感谢贡献！`
    };
    return titles[event] || `📋 漏洞状态更新`;
  }

  private getNotificationMessage(event: NotificationEvent, vulnerability: any): string {
    const messages: Record<NotificationEvent, string> = {
      VULNERABILITY_SUBMITTED: `恭喜！您提交的安全漏洞已成功进入审核流程。我们的安全专家将在24小时内完成初步审核，请耐心等待。`,
      VULNERABILITY_APPROVED: `太棒了！您的漏洞报告已通过审核认定为有效安全漏洞。系统已将其加入修复队列，等待技术团队认领处理。`,
      VULNERABILITY_REJECTED: `经过仔细评估，您提交的报告暂未被认定为安全漏洞。请查看详细的审核反馈意见，欢迎根据建议进行调整后重新提交。`,
      VULNERABILITY_NEED_INFO: `您的漏洞报告很有价值！为了更好地评估和处理，我们需要您补充一些技术细节。请尽快完善相关信息。`,
      VULNERABILITY_ASSIGNED: `好消息！您报告的安全漏洞已被我们的技术专家${vulnerability.assignee?.username || ''}认领。修复工作正式启动，我们会持续跟进处理进度。`,
      VULNERABILITY_RESOLVED: `🎊 重大进展！您报告的安全漏洞已被成功修复并通过验证。感谢您为系统安全做出的重要贡献，让网络世界更加安全！`
    };
    return messages[event] || `您关注的安全漏洞状态已发生重要更新，请及时查看最新进展。`;
  }

  private generateEmailTemplate(title: string, message: string, vulnerability: any): string {
    const severityText = this.getSeverityText(vulnerability.severity);
    const statusText = this.getStatusText(vulnerability.status);
    const severityColor = this.getSeverityColor(vulnerability.severity);
    const statusColor = this.getStatusColor(vulnerability.status);
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #333; 
          background: #f5f5f5;
        }
        .email-container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; 
          padding: 30px 20px; 
          text-align: center;
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="%23ffffff" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
        }
        .header p {
          font-size: 16px;
          opacity: 0.9;
          position: relative;
          z-index: 1;
        }
        .content { 
          padding: 40px 30px;
        }
        .message-box {
          background: #f8f9ff;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        .message-box h2 {
          color: #4a5568;
          font-size: 20px;
          margin-bottom: 12px;
        }
        .message-box p {
          color: #718096;
          font-size: 16px;
        }
        .vulnerability-card { 
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .vulnerability-card h3 {
          color: #2d3748;
          font-size: 18px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
        }
        .vulnerability-card h3::before {
          content: '🔍';
          margin-right: 8px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .info-item {
          padding: 12px;
          background: #f7fafc;
          border-radius: 8px;
        }
        .info-label {
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 14px;
          color: #2d3748;
          font-weight: 500;
        }
        .vulnerability-title {
          background: #edf2f7;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
          border-left: 3px solid #4299e1;
        }
        .vulnerability-title h4 {
          color: #2b6cb0;
          font-size: 16px;
          margin: 0;
        }
        .tag { 
          display: inline-block; 
          padding: 6px 12px; 
          border-radius: 20px; 
          color: white; 
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .tag-critical { background: linear-gradient(135deg, #e53e3e, #c53030); }
        .tag-high { background: linear-gradient(135deg, #dd6b20, #c05621); }
        .tag-medium { background: linear-gradient(135deg, #d69e2e, #b7791f); }
        .tag-low { background: linear-gradient(135deg, #38a169, #2f855a); }
        .tag-info { background: linear-gradient(135deg, #3182ce, #2c5282); }
        .tag-pending { background: linear-gradient(135deg, #ed8936, #dd6b20); }
        .tag-approved { background: linear-gradient(135deg, #38a169, #2f855a); }
        .tag-rejected { background: linear-gradient(135deg, #e53e3e, #c53030); }
        .tag-assigned { background: linear-gradient(135deg, #3182ce, #2c5282); }
        .tag-resolved { background: linear-gradient(135deg, #38a169, #2f855a); }
        .cta-section {
          text-align: center;
          margin: 30px 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .footer { 
          background: #f7fafc;
          text-align: center; 
          padding: 25px; 
          color: #718096; 
          font-size: 13px;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #e2e8f0, transparent);
          margin: 20px 0;
        }
        @media (max-width: 600px) {
          .email-container { margin: 10px; }
          .content { padding: 30px 20px; }
          .info-grid { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>🛡️ 漏洞管理平台</h1>
          <p>安全第一，防护为先</p>
        </div>
        <div class="content">
          <div class="message-box">
            <h2>${title}</h2>
            <p>${message}</p>
          </div>
          
          <div class="vulnerability-card">
            <h3>漏洞详细信息</h3>
            
            <div class="vulnerability-title">
              <h4>${vulnerability.title}</h4>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">漏洞ID</div>
                <div class="info-value">#${vulnerability.id.substring(0, 8)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">提交时间</div>
                <div class="info-value">${new Date(vulnerability.createdAt).toLocaleDateString('zh-CN')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">严重程度</div>
                <div class="info-value">
                  <span class="tag tag-${vulnerability.severity.toLowerCase()}">${severityText}</span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">当前状态</div>
                <div class="info-value">
                  <span class="tag tag-${vulnerability.status.toLowerCase()}">${statusText}</span>
                </div>
              </div>
            </div>
            
            ${vulnerability.assignee ? `
            <div class="divider"></div>
            <div class="info-item">
              <div class="info-label">处理人员</div>
              <div class="info-value">${vulnerability.assignee.username}</div>
            </div>
            ` : ''}
          </div>
          
          <div class="cta-section">
            <a href="${process.env.FRONTEND_URL}/dashboard/vulnerabilities/${vulnerability.id}" class="cta-button">
              📋 查看详细信息
            </a>
          </div>
          
          <div style="text-align: center; color: #718096; font-size: 14px;">
            <p>💡 如有疑问，请及时联系管理员</p>
          </div>
        </div>
        <div class="footer">
          <p>🤖 此邮件由漏洞管理平台自动发送，请勿直接回复</p>
          <p>© 2024 漏洞管理平台 - 让安全成为习惯</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  private getSeverityEmoji(severity: string): string {
    const emojis: Record<string, string> = {
      CRITICAL: '🔴',
      HIGH: '🟠',  
      MEDIUM: '🟡',
      LOW: '🟢',
      INFO: '🔵'
    };
    return emojis[severity] || '⚪';
  }

  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      PENDING: '⏳',
      APPROVED: '✅',
      REJECTED: '❌',
      NEED_INFO: '❓',
      ASSIGNED: '👨‍💻',
      IN_PROGRESS: '⚙️',
      RESOLVED: '🎉',
      CLOSED: '🔒'
    };
    return emojis[status] || '📋';
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      CRITICAL: '#ff4d4f',
      HIGH: '#fa8c16',
      MEDIUM: '#fadb14',
      LOW: '#52c41a',
      INFO: '#1890ff'
    };
    return colors[severity] || '#666666';
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      PENDING: '#fa8c16',
      APPROVED: '#52c41a',
      REJECTED: '#ff4d4f',
      NEED_INFO: '#722ed1',
      ASSIGNED: '#1890ff',
      IN_PROGRESS: '#13c2c2',
      RESOLVED: '#a0d911',
      CLOSED: '#666666'
    };
    return colors[status] || '#666666';
  }

  private getSeverityText(severity: string): string {
    const texts: Record<string, string> = {
      CRITICAL: '严重',
      HIGH: '高危',
      MEDIUM: '中危',
      LOW: '低危',
      INFO: '信息'
    };
    return texts[severity] || severity;
  }

  private getStatusText(status: string): string {
    const texts: Record<string, string> = {
      PENDING: '待审核',
      APPROVED: '已通过',
      REJECTED: '已拒绝',
      NEED_INFO: '需补充',
      ASSIGNED: '已认领',
      IN_PROGRESS: '处理中',
      RESOLVED: '已解决',
      CLOSED: '已关闭'
    };
    return texts[status] || status;
  }

  private generateDingTalkTemplate(title: string, message: string, vulnerability: any, severityEmoji: string, statusEmoji: string): string {
    const severityText = this.getSeverityText(vulnerability.severity);
    const statusText = this.getStatusText(vulnerability.status);
    
    return `
# ${severityEmoji} ${title}

---

## 📋 基本信息

**漏洞标题：** ${vulnerability.title}

**漏洞描述：** ${message}

---

## 🔍 详细信息

| 项目 | 内容 |
|------|------|
| 🆔 漏洞ID | \`${vulnerability.id.substring(0, 12)}\` |
| ${severityEmoji} 严重程度 | **${severityText}** |
| ${statusEmoji} 当前状态 | **${statusText}** |
| 📅 提交时间 | ${new Date(vulnerability.createdAt).toLocaleString('zh-CN')} |
| 👤 提交者 | ${vulnerability.submitter?.username || '未知'} |
${vulnerability.assignee ? `| 👨‍💻 处理人 | ${vulnerability.assignee.username} |` : ''}

---

## 🚀 下一步操作

${this.getNextStepMessage(vulnerability.status)}

> 💡 **提示：** 点击下方按钮可直接进入系统进行相关操作
    `;
  }

  private getNextStepMessage(status: string): string {
    const messages: Record<string, string> = {
      PENDING: '等待审核员审核处理',
      APPROVED: '等待修复人员认领处理',
      REJECTED: '请根据审核意见修改后重新提交',
      NEED_INFO: '请补充更多详细信息',
      ASSIGNED: '修复人员正在处理中',
      IN_PROGRESS: '漏洞正在修复中，请耐心等待',
      RESOLVED: '漏洞已修复，等待验证',
      CLOSED: '漏洞处理流程已完成'
    };
    return messages[status] || '请关注漏洞状态变化';
  }
}

export const notificationService = new NotificationService();