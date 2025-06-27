import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked?: boolean;
  blockUntil?: number;
}

/**
 * 内存型速率限制器
 */
export class RateLimiter {
  private static attempts = new Map<string, RateLimitEntry>();

  /**
   * 检查速率限制
   */
  static checkLimit(
    key: string, 
    maxAttempts: number, 
    windowMs: number, 
    blockDurationMs?: number
  ): boolean {
    const now = Date.now();
    const entry = this.attempts.get(key);

    // 如果条目不存在或已过期，创建新条目
    if (!entry || now > entry.resetTime) {
      this.attempts.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }

    // 检查是否在阻止期间
    if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
      return false;
    }

    // 如果不在阻止期间，重置阻止状态
    if (entry.blocked && entry.blockUntil && now >= entry.blockUntil) {
      entry.blocked = false;
      entry.blockUntil = undefined;
      entry.count = 1;
      entry.resetTime = now + windowMs;
      return true;
    }

    // 增加计数
    entry.count++;

    // 检查是否超过限制
    if (entry.count > maxAttempts) {
      if (blockDurationMs) {
        entry.blocked = true;
        entry.blockUntil = now + blockDurationMs;
      }
      return false;
    }

    return true;
  }

  /**
   * 获取剩余尝试次数
   */
  static getRemainingAttempts(key: string, maxAttempts: number): number {
    const entry = this.attempts.get(key);
    if (!entry) return maxAttempts;
    
    return Math.max(0, maxAttempts - entry.count);
  }

  /**
   * 重置计数器
   */
  static reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * 清理过期条目
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (now > entry.resetTime && (!entry.blocked || (entry.blockUntil && now > entry.blockUntil))) {
        this.attempts.delete(key);
      }
    }
  }
}

/**
 * 通用速率限制中间件
 */
export const createRateLimit = (
  maxAttempts: number, 
  windowMs: number, 
  keyGenerator?: (req: Request) => string,
  blockDurationMs?: number
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator ? keyGenerator(req) : req.ip;
      const allowed = RateLimiter.checkLimit(key, maxAttempts, windowMs, blockDurationMs);
      
      if (!allowed) {
        const remainingTime = Math.ceil(windowMs / 1000);
        throw new AppError(
          `请求过于频繁，请在 ${remainingTime} 秒后重试`, 
          429
        );
      }

      // 设置响应头
      const remaining = RateLimiter.getRemainingAttempts(key, maxAttempts);
      res.set({
        'X-RateLimit-Limit': maxAttempts.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 登录速率限制（防爆破）
 */
export const loginRateLimit = createRateLimit(
  5,           // 5次尝试
  15 * 60 * 1000, // 15分钟窗口
  (req: Request) => `login:${req.ip}:${req.body.email || req.body.username}`, // 基于IP和用户名
  60 * 60 * 1000  // 1小时阻止时间
);

/**
 * 注册速率限制
 */
export const registerRateLimit = createRateLimit(
  3,           // 3次尝试
  60 * 60 * 1000, // 1小时窗口
  (req: Request) => `register:${req.ip}`, // 基于IP
  24 * 60 * 60 * 1000 // 24小时阻止时间
);

/**
 * 密码重置速率限制
 */
export const passwordResetRateLimit = createRateLimit(
  3,           // 3次尝试
  30 * 60 * 1000, // 30分钟窗口
  (req: Request) => `password-reset:${req.ip}:${req.body.email}`, // 基于IP和邮箱
  2 * 60 * 60 * 1000 // 2小时阻止时间
);

/**
 * 文件上传速率限制
 */
export const uploadRateLimit = createRateLimit(
  10,          // 10次上传
  60 * 60 * 1000, // 1小时窗口
  (req: Request) => {
    const user = (req as any).user;
    return `upload:${user?.id || req.ip}`; // 基于用户ID或IP
  },
  30 * 60 * 1000  // 30分钟阻止时间
);

/**
 * API调用速率限制
 */
export const apiRateLimit = createRateLimit(
  100,         // 100次请求
  15 * 60 * 1000, // 15分钟窗口
  (req: Request) => {
    const user = (req as any).user;
    return `api:${user?.id || req.ip}`; // 基于用户ID或IP
  }
);

/**
 * 敏感操作速率限制
 */
export const sensitiveOperationRateLimit = createRateLimit(
  5,           // 5次操作
  60 * 60 * 1000, // 1小时窗口
  (req: Request) => {
    const user = (req as any).user;
    return `sensitive:${user?.id || req.ip}:${req.path}`; // 基于用户ID、IP和路径
  },
  60 * 60 * 1000  // 1小时阻止时间
);

// 定期清理过期条目
setInterval(() => {
  RateLimiter.cleanup();
}, 5 * 60 * 1000); // 每5分钟清理一次