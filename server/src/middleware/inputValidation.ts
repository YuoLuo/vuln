import { Request, Response, NextFunction } from 'express';
import { InputSanitizer } from '../utils/sanitizer';
import { AppError } from './errorHandler';

/**
 * 输入验证中间件
 */
export const validateAndSanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 递归清理对象中的字符串值
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return InputSanitizer.sanitizeText(obj);
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // 跳过某些特殊字段的清理
          if (['codeSnippet', 'reproductionSteps'].includes(key)) {
            sanitized[key] = typeof value === 'string' ? InputSanitizer.sanitizeCode(value) : value;
          } else if (key === 'description' || key === 'comment' || key === 'impact' || key === 'recommendation') {
            // 对于富文本字段，使用友好的URL清理再清理HTML
            let cleanValue = value;
            if (typeof value === 'string') {
              cleanValue = InputSanitizer.friendlySanitizeUrls(value as string);
              cleanValue = InputSanitizer.sanitizeHtml(cleanValue);
            }
            sanitized[key] = cleanValue;
          } else if (key === 'email') {
            sanitized[key] = typeof value === 'string' ? InputSanitizer.sanitizeEmail(value) : value;
          } else if (key === 'username') {
            sanitized[key] = typeof value === 'string' ? InputSanitizer.sanitizeUsername(value) : value;
          } else {
            sanitized[key] = sanitizeObject(value);
          }
        }
        return sanitized;
      }
      
      return obj;
    };

    // 清理请求体
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // 清理查询参数
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // 清理路径参数
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    next(new AppError('输入验证失败', 400));
  }
};

/**
 * 验证枚举值
 */
export const validateEnums = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { severity, status, role } = req.body;

    if (severity && !InputSanitizer.validateSeverity(severity)) {
      throw new AppError('无效的严重程度', 400);
    }

    if (status && !InputSanitizer.validateStatus(status)) {
      throw new AppError('无效的状态', 400);
    }

    if (role && !InputSanitizer.validateUserRole(role)) {
      throw new AppError('无效的用户角色', 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 验证分页参数
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = InputSanitizer.validatePagination(req.query.page, req.query.limit);
    req.query.page = page.toString();
    req.query.limit = limit.toString();
    next();
  } catch (error) {
    next(new AppError('分页参数无效', 400));
  }
};

/**
 * 验证文件上传
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next();
  }

  try {
    const file = req.file;
    
    // 验证文件类型
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError('不支持的文件类型，只允许上传图片', 400);
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new AppError('文件大小超过限制（5MB）', 400);
    }

    // 清理文件名
    if (file.originalname) {
      file.originalname = InputSanitizer.sanitizeFileName(file.originalname);
    }

    // 验证文件名长度
    if (file.originalname && file.originalname.length > 255) {
      throw new AppError('文件名过长', 400);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * URL验证和清理中间件
 */
export const validateUrls = (req: Request, res: Response, next: NextFunction) => {
  try {
    const sanitizeUrls = (obj: any): any => {
      if (typeof obj === 'string') {
        // 使用统一的URL清理方法
        return InputSanitizer.sanitizeUrls(obj, '[已屏蔽的链接]');
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeUrls);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeUrls(value);
        }
        return sanitized;
      }
      return obj;
    };

    if (req.body) {
      req.body = sanitizeUrls(req.body);
    }

    if (req.query) {
      req.query = sanitizeUrls(req.query);
    }

    next();
  } catch (error) {
    next(new AppError('输入处理失败', 400));
  }
};