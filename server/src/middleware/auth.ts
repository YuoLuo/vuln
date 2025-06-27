import { Request, Response, NextFunction } from 'express';
const UserRole = {
  SUPERADMIN: 'SUPERADMIN',  // 超级管理员：系统管理
  SECURITY_RESEARCHER: 'SECURITY_RESEARCHER',  // 安全研究员：提交漏洞
  VULNERABILITY_REVIEWER: 'VULNERABILITY_REVIEWER',  // 漏洞审核员：审核漏洞，分配修复人员
  FIX_ENGINEER: 'FIX_ENGINEER'  // 修复人员：认领漏洞，修改状态为待复测
} as const;

type UserRole = typeof UserRole[keyof typeof UserRole];
import { verifyToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const token = authHeader.substring(7);
    const payload: JwtPayload = verifyToken(token);

    // 验证用户是否仍然存在且激活
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: '认证令牌无效'
    });
  }
}

export function authorize(roles: string[] = []) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证用户'
      });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
}

// 具体权限检查函数
export const requireSuperAdmin = authorize([UserRole.SUPERADMIN]);
export const requireReviewer = authorize([UserRole.SUPERADMIN, UserRole.VULNERABILITY_REVIEWER]);
export const requireSecurityResearcher = authorize([UserRole.SECURITY_RESEARCHER]);
export const requireFixEngineer = authorize([UserRole.FIX_ENGINEER]);
export const requireAnyRole = authorize([UserRole.SUPERADMIN, UserRole.SECURITY_RESEARCHER, UserRole.VULNERABILITY_REVIEWER, UserRole.FIX_ENGINEER]);