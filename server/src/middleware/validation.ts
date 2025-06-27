import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Validating request body', { 
        body: req.body,
        url: req.url,
        method: req.method 
      });
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        logger.error('Validation failed', {
          body: req.body,
          errors: errors,
          zodErrors: error.errors,
          url: req.url,
          method: req.method
        });

        return res.status(400).json({
          success: false,
          message: '数据验证失败',
          errors
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        return res.status(400).json({
          success: false,
          message: '查询参数验证失败',
          errors
        });
      }
      next(error);
    }
  };
}