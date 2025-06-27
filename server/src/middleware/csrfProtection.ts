import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from './errorHandler';

interface RequestWithSession extends Request {
  session?: {
    csrfToken?: string;
  };
}

/**
 * CSRF Token管理器
 */
export class CSRFTokenManager {
  private static tokens = new Map<string, { token: string; timestamp: number; userId?: string }>();
  private static readonly TOKEN_EXPIRY = 30 * 60 * 1000; // 30分钟

  /**
   * 生成CSRF Token
   */
  static generateToken(userId?: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    this.tokens.set(sessionId, {
      token,
      timestamp: Date.now(),
      userId
    });

    // 清理过期token
    this.cleanupExpiredTokens();
    
    return `${sessionId}:${token}`;
  }

  /**
   * 验证CSRF Token
   */
  static validateToken(tokenString: string, userId?: string): boolean {
    if (!tokenString || typeof tokenString !== 'string') {
      return false;
    }

    const [sessionId, token] = tokenString.split(':');
    if (!sessionId || !token) {
      return false;
    }

    const storedData = this.tokens.get(sessionId);
    if (!storedData) {
      return false;
    }

    // 检查token是否匹配
    if (storedData.token !== token) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - storedData.timestamp > this.TOKEN_EXPIRY) {
      this.tokens.delete(sessionId);
      return false;
    }

    // 检查用户ID是否匹配（如果提供）
    if (userId && storedData.userId && storedData.userId !== userId) {
      return false;
    }

    // 使用后删除token（一次性使用）
    this.tokens.delete(sessionId);
    return true;
  }

  /**
   * 清理过期token
   */
  private static cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens.entries()) {
      if (now - data.timestamp > this.TOKEN_EXPIRY) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

/**
 * 获取CSRF Token的端点
 */
export const getCSRFToken = (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const token = CSRFTokenManager.generateToken(user?.id);
    
    res.json({
      success: true,
      csrfToken: token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成CSRF Token失败'
    });
  }
};

/**
 * CSRF保护中间件
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // 只对状态改变的操作进行CSRF保护
  const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!protectedMethods.includes(req.method)) {
    return next();
  }

  // 跳过某些路径（如登录、注册）
  const skipPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/csrf-token'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  try {
    const token = req.headers['x-csrf-token'] as string || req.body.csrfToken;
    
    if (!token) {
      throw new AppError('缺少CSRF Token', 403);
    }

    const user = (req as any).user;
    const isValid = CSRFTokenManager.validateToken(token, user?.id);
    
    if (!isValid) {
      throw new AppError('无效的CSRF Token', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 双重提交Cookie模式的CSRF保护
 */
export const doubleSubmitCsrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!protectedMethods.includes(req.method)) {
    return next();
  }

  try {
    const headerToken = req.headers['x-csrf-token'] as string;
    const cookieToken = req.cookies['csrf-token'];
    
    if (!headerToken || !cookieToken) {
      throw new AppError('缺少CSRF Token', 403);
    }

    if (headerToken !== cookieToken) {
      throw new AppError('CSRF Token不匹配', 403);
    }

    // 验证token格式和时效性
    if (!CSRFTokenManager.validateToken(headerToken)) {
      throw new AppError('CSRF Token无效或已过期', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};