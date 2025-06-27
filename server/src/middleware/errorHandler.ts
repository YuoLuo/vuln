import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  let statusCode = 500;
  let message = '服务器内部错误';
  let errors: Record<string, string[]> = {};

  // 记录错误日志
  logger.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: (req as any).user?.id
  });

  // 自定义应用错误
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Prisma错误
  else if (error instanceof PrismaClientKnownRequestError) {
    statusCode = 400;
    
    switch (error.code) {
      case 'P2002':
        message = '数据重复，该记录已存在';
        const field = error.meta?.target as string[];
        if (field) {
          errors[field[0]] = ['该值已存在'];
        }
        break;
      case 'P2025':
        message = '记录不存在';
        statusCode = 404;
        break;
      case 'P2003':
        message = '外键约束错误';
        break;
      default:
        message = '数据库操作错误';
    }
  }
  // 验证错误
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = '数据验证失败';
  }
  // JWT错误
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '认证令牌无效';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '认证令牌已过期';
  }

  // 开发环境返回详细错误信息
  const response: any = {
    success: false,
    message,
    ...(Object.keys(errors).length > 0 && { errors })
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `路由 ${req.originalUrl} 未找到`
  });
}