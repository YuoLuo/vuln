import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * 输入清理和验证工具类
 */
export class InputSanitizer {
  /**
   * 清理HTML内容，防止XSS
   */
  static sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: ['class'],
      FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
      KEEP_CONTENT: true
    });
  }

  /**
   * 清理纯文本，移除HTML标签
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
  }

  /**
   * 验证和清理邮箱
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';
    const sanitized = validator.normalizeEmail(email.trim()) || '';
    return validator.isEmail(sanitized) ? sanitized : '';
  }

  /**
   * 验证和清理用户名
   */
  static sanitizeUsername(username: string): string {
    if (!username || typeof username !== 'string') return '';
    const sanitized = username.trim().toLowerCase();
    // 只允许字母、数字、下划线、连字符
    return /^[a-z0-9_-]+$/.test(sanitized) ? sanitized : '';
  }

  /**
   * 验证URL，防止SSRF
   */
  static validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      
      // 只允许HTTP和HTTPS协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // 禁止访问内网地址
      const hostname = urlObj.hostname;
      
      // 禁止localhost和127.0.0.1
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return false;
      }
      
      // 禁止内网IP段
      const ipRegex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
      const match = hostname.match(ipRegex);
      if (match) {
        const [, a, b, c, d] = match.map(Number);
        
        // 私有IP地址段
        if (
          (a === 10) ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) ||
          (a === 169 && b === 254) || // 链路本地地址
          (a === 0) || // 当前网络
          (a >= 224) // 多播地址
        ) {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全地清理URL，将不安全的URL替换为安全的文本
   */
  static sanitizeUrls(input: string, replacement: string = '[已屏蔽的链接]', options: { logUnsafe?: boolean } = {}): string {
    if (!input || typeof input !== 'string') return '';
    
    const urlPattern = /https?:\/\/[^\s]+/g;
    const { logUnsafe = true } = options;
    
    const result = input.replace(urlPattern, (url) => {
      if (this.validateUrl(url)) {
        return url; // 安全URL保持不变
      } else {
        // 记录安全事件到日志，但不暴露给用户
        if (logUnsafe) {
          try {
            const { logger } = require('./logger');
            logger.warn('Unsafe URL detected and sanitized', { 
              url: url,
              timestamp: new Date().toISOString(),
              action: 'sanitized',
              replacedWith: replacement
            });
          } catch (error) {
            // 如果日志记录失败，静默处理
          }
        }
        return replacement; // 不安全URL替换为安全文本
      }
    });
    
    return result;
  }

  /**
   * 更智能的URL清理，根据上下文提供不同的替换策略
   */
  static smartSanitizeUrls(input: string, context: 'display' | 'code' | 'description' = 'display'): string {
    if (!input || typeof input !== 'string') return '';
    
    const replacements = {
      display: '[已屏蔽的链接地址]',
      code: '[代码中的链接已脱敏]',
      description: '[安全过滤：链接地址]'
    };
    
    return this.sanitizeUrls(input, replacements[context]);
  }

  /**
   * 提取URL的域名部分作为安全的文本显示
   */
  static extractSafeDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      // 只显示域名，不显示完整路径
      return `[链接: ${urlObj.hostname}]`;
    } catch {
      return '[链接地址]';
    }
  }

  /**
   * 更友好的URL清理，显示域名而不是完全删除
   */
  static friendlySanitizeUrls(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    const urlPattern = /https?:\/\/[^\s]+/g;
    
    return input.replace(urlPattern, (url) => {
      if (this.validateUrl(url)) {
        return url; // 安全URL保持不变
      } else {
        // 不安全URL显示为友好的文本
        return this.extractSafeDomain(url);
      }
    });
  }

  /**
   * 验证文件名，防止路径遍历
   */
  static sanitizeFileName(filename: string): string {
    if (!filename || typeof filename !== 'string') return '';
    
    // 移除路径分隔符和特殊字符
    const sanitized = filename
      .replace(/[\/\\]/g, '') // 移除路径分隔符
      .replace(/\.\./g, '') // 移除父目录引用
      .replace(/[<>:"|?*]/g, '') // 移除Windows不允许的字符
      .trim();
    
    // 确保不以点开头（隐藏文件）
    return sanitized.startsWith('.') ? sanitized.substring(1) : sanitized;
  }

  /**
   * 验证文件路径，防止路径遍历
   */
  static validateFilePath(filepath: string, allowedDir: string): boolean {
    if (!filepath || typeof filepath !== 'string') return false;
    
    try {
      const path = require('path');
      const resolvedPath = path.resolve(filepath);
      const resolvedAllowedDir = path.resolve(allowedDir);
      
      // 确保文件路径在允许的目录内
      return resolvedPath.startsWith(resolvedAllowedDir);
    } catch {
      return false;
    }
  }

  /**
   * 清理代码片段，保留基本结构但移除潜在危险内容
   */
  static sanitizeCode(code: string): string {
    if (!code || typeof code !== 'string') return '';
    
    // 先清理不安全的URL，使用代码上下文的替换
    let cleanCode = this.smartSanitizeUrls(code, 'code');
    
    // 移除潜在的脚本注入
    return cleanCode
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * 验证严重程度枚举
   */
  static validateSeverity(severity: string): boolean {
    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    return validSeverities.includes(severity);
  }

  /**
   * 验证状态枚举
   */
  static validateStatus(status: string): boolean {
    const validStatuses = [
      'PENDING', 'APPROVED', 'REJECTED', 'NEED_INFO', 
      'ASSIGNED', 'IN_PROGRESS', 'PENDING_RETEST', 'RESOLVED', 'CLOSED'
    ];
    return validStatuses.includes(status);
  }

  /**
   * 验证用户角色枚举
   */
  static validateUserRole(role: string): boolean {
    const validRoles = ['SUPERADMIN', 'SECURITY_RESEARCHER', 'VULNERABILITY_REVIEWER', 'FIX_ENGINEER'];
    return validRoles.includes(role);
  }

  /**
   * 限制字符串长度
   */
  static limitLength(input: string, maxLength: number): string {
    if (!input || typeof input !== 'string') return '';
    return input.length > maxLength ? input.substring(0, maxLength) : input;
  }

  /**
   * 验证分页参数
   */
  static validatePagination(page: any, limit: any): { page: number; limit: number } {
    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 10;
    
    return {
      page: Math.max(1, Math.min(parsedPage, 1000)), // 限制页码范围
      limit: Math.max(1, Math.min(parsedLimit, 100))  // 限制每页数量
    };
  }
}

/**
 * 输出转义工具
 */
export class OutputEscaper {
  /**
   * HTML转义
   */
  static escapeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * JSON转义
   */
  static escapeJson(input: any): string {
    try {
      return JSON.stringify(input).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    } catch {
      return '{}';
    }
  }

  /**
   * SQL转义（虽然使用Prisma，但作为额外保护）
   */
  static escapeSql(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/'/g, "''");
  }
}