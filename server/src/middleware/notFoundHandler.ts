import { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `路由 ${req.originalUrl} 未找到`
  });
}