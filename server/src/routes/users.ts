import { Router } from 'express';
import { checkResourcePermission, dataIsolation } from '../middleware/rbac';
import { csrfProtection } from '../middleware/csrfProtection';
import { sensitiveOperationRateLimit } from '../middleware/rateLimiter';
import { validateUrls } from '../middleware/inputValidation';
import { xmlSecurity } from '../middleware/xmlSecurity';
const UserRole = {
  SUPERADMIN: 'SUPERADMIN',  // 超级管理员：系统管理
  SECURITY_RESEARCHER: 'SECURITY_RESEARCHER',  // 安全研究员：提交漏洞
  VULNERABILITY_REVIEWER: 'VULNERABILITY_REVIEWER',  // 漏洞审核员：审核漏洞，分配修复人员
  FIX_ENGINEER: 'FIX_ENGINEER'  // 修复人员：认领漏洞，修改状态为待复测
} as const;
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireReviewer } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import { updateUserSchema, paginationSchema, notificationSettingsSchema } from 'vnlu-shared';

const router = Router();

// 获取用户列表
router.get('/', 
  authenticate, 
  dataIsolation,
  validateQuery(paginationSchema), 
  async (req: AuthRequest, res, next) => {
  try {
    const { page, limit, search, sortBy, sortOrder, role } = req.query as any;
    
    // 项目简化：允许所有用户查看用户列表（用于分配功能）
    const where: any = {};
    
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { username: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } }
      ];
    }
    
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              submittedVulnerabilities: true,
              assignedVulnerabilities: true
            }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取用户详情
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    // 只允许管理员或用户本人查看详情
    if (req.user!.role !== UserRole.VULNERABILITY_REVIEWER && req.user!.id !== id) {
      throw new AppError('权限不足', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            submittedVulnerabilities: true,
            assignedVulnerabilities: true,
            reviews: true
          }
        }
      }
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// 更新用户信息
router.put('/:id', 
  authenticate, 
  csrfProtection,
  xmlSecurity,
  validateUrls,
  checkResourcePermission('user', 'update', 'id'),
  validate(updateUserSchema), 
  async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    // 过滤允许更新的字段
    const allowedFields = ['firstName', 'lastName', 'avatar', 'email', 'username'];
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    
    // 审核员可以更新角色和状态
    if (req.user!.role === UserRole.VULNERABILITY_REVIEWER) {
      if (req.body.role !== undefined) {
        updateData.role = req.body.role;
      }
      if (req.body.isActive !== undefined) {
        updateData.isActive = req.body.isActive;
      }
    }
    
    // 只允许审核员或用户本人更新信息
    if (req.user!.role !== UserRole.VULNERABILITY_REVIEWER && req.user!.id !== id) {
      throw new AppError('权限不足', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: '用户信息更新成功',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// 更新用户角色（仅管理员）
router.patch('/:id/role', 
  authenticate, 
  requireReviewer, 
  csrfProtection,
  sensitiveOperationRateLimit,
  xmlSecurity,
  checkResourcePermission('user', 'update', 'id'),
  async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!Object.values(UserRole).includes(role)) {
      throw new AppError('无效的用户角色', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    // 防止最后一个管理员被降级
    if (user.role === UserRole.VULNERABILITY_REVIEWER && role !== UserRole.VULNERABILITY_REVIEWER) {
      const adminCount = await prisma.user.count({
        where: { role: UserRole.VULNERABILITY_REVIEWER, isActive: true }
      });
      
      if (adminCount <= 1) {
        throw new AppError('至少需要保留一个管理员账户', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: '用户角色更新成功',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// 激活/禁用用户（仅管理员）
router.patch('/:id/status', 
  authenticate, 
  requireReviewer, 
  csrfProtection,
  sensitiveOperationRateLimit,
  xmlSecurity,
  checkResourcePermission('user', 'update', 'id'),
  async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new AppError('isActive 必须是布尔值', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    // 防止最后一个管理员被禁用
    if (user.role === UserRole.VULNERABILITY_REVIEWER && !isActive) {
      const activeAdminCount = await prisma.user.count({
        where: { role: UserRole.VULNERABILITY_REVIEWER, isActive: true }
      });
      
      if (activeAdminCount <= 1) {
        throw new AppError('至少需要保留一个活跃的管理员账户', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: `用户已${isActive ? '激活' : '禁用'}`,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// 删除用户（仅管理员）
router.delete('/:id', 
  authenticate, 
  requireReviewer, 
  csrfProtection,
  sensitiveOperationRateLimit,
  checkResourcePermission('user', 'delete', 'id'),
  async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    // 防止删除最后一个管理员
    if (user.role === UserRole.VULNERABILITY_REVIEWER) {
      const adminCount = await prisma.user.count({
        where: { role: UserRole.VULNERABILITY_REVIEWER }
      });
      
      if (adminCount <= 1) {
        throw new AppError('不能删除最后一个管理员账户', 400);
      }
    }

    // 软删除：禁用用户而不是物理删除
    await prisma.user.update({
      where: { id },
      data: { 
        isActive: false,
        email: `deleted_${Date.now()}_${user.email}`,
        username: `deleted_${Date.now()}_${user.username}`
      }
    });

    res.json({
      success: true,
      message: '用户已删除'
    });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户的通知设置
router.get('/me/notification-settings', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const settings = await prisma.userNotificationSettings.findUnique({
      where: { userId: req.user!.id },
      select: {
        emailEnabled: true,
        dingtalkEnabled: true,
        wechatEnabled: true,
        dingtalkWebhook: true,
        wechatWebhook: true
      }
    });

    res.json({
      success: true,
      data: settings || {
        emailEnabled: true,
        dingtalkEnabled: false,
        wechatEnabled: false
      }
    });
  } catch (error) {
    next(error);
  }
});

// 更新当前用户的通知设置
router.put('/me/notification-settings', 
  authenticate, 
  csrfProtection,
  xmlSecurity,
  validateUrls,
  validate(notificationSettingsSchema), 
  async (req: AuthRequest, res, next) => {
  try {
    const settingsData = req.body;

    const settings = await prisma.userNotificationSettings.upsert({
      where: { userId: req.user!.id },
      update: settingsData,
      create: {
        userId: req.user!.id,
        ...settingsData
      },
      select: {
        emailEnabled: true,
        dingtalkEnabled: true,
        wechatEnabled: true,
        dingtalkWebhook: true,
        wechatWebhook: true
      }
    });

    res.json({
      success: true,
      message: '通知设置更新成功',
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

export default router;