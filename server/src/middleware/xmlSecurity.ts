import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * XML安全处理中间件 - 防止XXE攻击
 */
export const xmlSecurity = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 检查Content-Type是否为XML相关
    const contentType = req.headers['content-type'];
    
    if (contentType && (
      contentType.includes('application/xml') ||
      contentType.includes('text/xml') ||
      contentType.includes('application/soap+xml')
    )) {
      // 直接拒绝XML请求，因为我们的应用不需要XML
      throw new AppError('不支持XML格式的请求', 400);
    }

    // 检查请求体中是否包含XML内容
    if (req.body && typeof req.body === 'string') {
      const xmlPatterns = [
        /<!DOCTYPE/i,
        /<!ENTITY/i,
        /<\?xml/i,
        /SYSTEM\s+["'][^"']*["']/i,
        /PUBLIC\s+["'][^"']*["']\s+["'][^"']*["']/i
      ];

      const hasXmlContent = xmlPatterns.some(pattern => pattern.test(req.body));
      
      if (hasXmlContent) {
        throw new AppError('检测到XML内容，请使用JSON格式', 400);
      }
    }

    // 检查文件上传中的XML内容
    if (req.file && req.file.buffer) {
      const fileContent = req.file.buffer.toString('utf8', 0, Math.min(1024, req.file.buffer.length));
      
      const xmlPatterns = [
        /<!DOCTYPE/i,
        /<!ENTITY/i,
        /<\?xml/i
      ];

      const hasXmlContent = xmlPatterns.some(pattern => pattern.test(fileContent));
      
      if (hasXmlContent) {
        throw new AppError('上传的文件包含XML内容，不允许上传', 400);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 安全的XML解析器配置（如果必须使用XML）
 */
export const createSecureXMLParser = () => {
  // 注意：我们的应用不使用XML，但如果将来需要，这里是安全配置
  const config = {
    // 禁用外部实体
    resolveExternalEntities: false,
    // 禁用DTD处理
    processDTD: false,
    // 禁用内联DTD
    processInlineDTD: false,
    // 限制实体扩展
    entityExpansionLimit: 0,
    // 禁用网络访问
    networkAccess: false,
    // 设置超时
    timeout: 5000
  };
  
  return config;
};