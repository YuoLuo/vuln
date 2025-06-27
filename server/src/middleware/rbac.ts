import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';

const UserRole = {
  SUPERADMIN: 'SUPERADMIN',
  SECURITY_RESEARCHER: 'SECURITY_RESEARCHER',
  VULNERABILITY_REVIEWER: 'VULNERABILITY_REVIEWER',
  FIX_ENGINEER: 'FIX_ENGINEER'
} as const;

type UserRole = typeof UserRole[keyof typeof UserRole];

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
}

/**
 * 基于角色的访问控制 (RBAC) 权限检查
 */
export class RBACService {
  
  /**
   * 检查用户是否有访问资源的权限
   */
  static async checkResourceAccess(
    userId: string,
    resourceType: 'vulnerability' | 'user' | 'system',
    resourceId: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true }
      });

      if (!user || !user.isActive) {
        return false;
      }

      // 超级管理员拥有所有权限
      if (user.role === UserRole.SUPERADMIN) {
        return true;
      }

      switch (resourceType) {
        case 'vulnerability':
          return await this.checkVulnerabilityAccess(user, resourceId, action);
        case 'user':
          return await this.checkUserAccess(user, resourceId, action);
        case 'system':
          return this.checkSystemAccess(user, action);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查漏洞访问权限
   */
  private static async checkVulnerabilityAccess(
    user: { id: string; role: UserRole },
    vulnerabilityId: string,
    action: string
  ): Promise<boolean> {
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id: vulnerabilityId },
      select: { submitterId: true, assigneeId: true }
    });

    if (!vulnerability) {
      return false;
    }

    switch (user.role) {
      case UserRole.VULNERABILITY_REVIEWER:
        // 审核员可以访问所有漏洞
        return true;

      case UserRole.SECURITY_RESEARCHER:
        // 安全研究员只能访问自己提交的漏洞
        switch (action) {
          case 'read':
          case 'update':
            return vulnerability.submitterId === user.id;
          case 'create':
            return true;
          case 'delete':
            return vulnerability.submitterId === user.id;
          default:
            return false;
        }

      case UserRole.FIX_ENGINEER:
        // 修复人员只能访问分配给自己的漏洞
        switch (action) {
          case 'read':
          case 'update':
            return vulnerability.assigneeId === user.id;
          case 'create':
          case 'delete':
            return false;
          default:
            return false;
        }

      default:
        return false;
    }
  }

  /**
   * 检查用户管理权限
   */
  private static async checkUserAccess(
    user: { id: string; role: UserRole },
    targetUserId: string,
    action: string
  ): Promise<boolean> {
    switch (user.role) {
      case UserRole.VULNERABILITY_REVIEWER:
        // 审核员可以管理其他用户（除了超级管理员）
        if (action === 'read') return true;
        
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { role: true }
        });
        
        return targetUser?.role !== UserRole.SUPERADMIN;

      case UserRole.SECURITY_RESEARCHER:
      case UserRole.FIX_ENGINEER:
        // 普通用户只能访问自己的信息
        return action === 'read' && targetUserId === user.id;

      default:
        return false;
    }
  }

  /**
   * 检查系统管理权限
   */
  private static checkSystemAccess(user: { role: UserRole }, action: string): boolean {
    // 只有超级管理员可以访问系统设置
    return user.role === UserRole.SUPERADMIN;
  }
}

/**
 * 资源权限检查中间件
 */
export const checkResourcePermission = (
  resourceType: 'vulnerability' | 'user' | 'system',
  action: 'create' | 'read' | 'update' | 'delete',
  resourceIdParam?: string
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('未认证的用户', 401);
      }

      const resourceId = resourceIdParam ? req.params[resourceIdParam] : req.params.id;
      
      // 对于创建操作，可能没有资源ID
      if (action !== 'create' && !resourceId) {
        throw new AppError('缺少资源ID', 400);
      }

      const hasPermission = await RBACService.checkResourceAccess(
        req.user.id,
        resourceType,
        resourceId || '',
        action
      );

      if (!hasPermission) {
        throw new AppError('权限不足', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 检查漏洞所有权
 */
export const checkVulnerabilityOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('未认证的用户', 401);
    }

    const vulnerabilityId = req.params.id;
    if (!vulnerabilityId) {
      throw new AppError('缺少漏洞ID', 400);
    }

    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id: vulnerabilityId },
      select: { 
        submitterId: true, 
        assigneeId: true,
        status: true
      }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    const user = req.user;
    let hasAccess = false;

    switch (user.role) {
      case UserRole.SUPERADMIN:
      case UserRole.VULNERABILITY_REVIEWER:
        hasAccess = true;
        break;

      case UserRole.SECURITY_RESEARCHER:
        hasAccess = vulnerability.submitterId === user.id;
        break;

      case UserRole.FIX_ENGINEER:
        hasAccess = vulnerability.assigneeId === user.id;
        break;

      default:
        hasAccess = false;
    }

    if (!hasAccess) {
      throw new AppError('您没有权限访问此漏洞', 403);
    }

    // 将漏洞信息附加到请求对象
    (req as any).vulnerability = vulnerability;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 检查用户是否可以修改其他用户
 */
export const checkUserModificationPermission = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('未认证的用户', 401);
    }

    const targetUserId = req.params.id;
    const currentUser = req.user;

    // 用户可以修改自己的信息
    if (targetUserId === currentUser.id) {
      return next();
    }

    // 只有审核员和超级管理员可以修改其他用户
    if (![UserRole.VULNERABILITY_REVIEWER, UserRole.SUPERADMIN].includes(currentUser.role)) {
      throw new AppError('权限不足，无法修改其他用户信息', 403);
    }

    // 获取目标用户信息
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, isActive: true }
    });

    if (!targetUser) {
      throw new AppError('目标用户不存在', 404);
    }

    // 非超级管理员不能修改超级管理员
    if (currentUser.role !== UserRole.SUPERADMIN && targetUser.role === UserRole.SUPERADMIN) {
      throw new AppError('权限不足，无法修改超级管理员', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 数据隔离中间件 - 确保用户只能看到有权限的数据
 */
export const dataIsolation = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('未认证的用户', 401);
    }

    const user = req.user;

    // 根据用户角色添加数据过滤条件
    switch (user.role) {
      case UserRole.SECURITY_RESEARCHER:
        // 安全研究员只能看到自己提交的漏洞
        (req as any).dataFilter = { submitterId: user.id };
        break;

      case UserRole.FIX_ENGINEER:
        // 修复人员只能看到分配给自己的漏洞
        (req as any).dataFilter = { assigneeId: user.id };
        break;

      case UserRole.VULNERABILITY_REVIEWER:
      case UserRole.SUPERADMIN:
        // 审核员和超级管理员可以看到所有数据
        (req as any).dataFilter = {};
        break;

      default:
        throw new AppError('无效的用户角色', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};