import { Router } from 'express';
import { checkResourcePermission, dataIsolation } from '../middleware/rbac';
import { csrfProtection } from '../middleware/csrfProtection';
import { sensitiveOperationRateLimit } from '../middleware/rateLimiter';
import { validateUrls } from '../middleware/inputValidation';
import { xmlSecurity } from '../middleware/xmlSecurity';
// 使用字符串常量替代枚举
const VulnerabilityStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED', 
  REJECTED: 'REJECTED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_RETEST: 'PENDING_RETEST',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
} as const;

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
import { 
  createVulnerabilitySchema, 
  updateVulnerabilitySchema, 
  reviewVulnerabilitySchema,
  paginationSchema 
} from 'vnlu-shared';
import { notificationService } from '../services/notificationService';
const NotificationEvent = {
  VULNERABILITY_SUBMITTED: 'VULNERABILITY_SUBMITTED',
  VULNERABILITY_APPROVED: 'VULNERABILITY_APPROVED',
  VULNERABILITY_REJECTED: 'VULNERABILITY_REJECTED',
  VULNERABILITY_NEED_INFO: 'VULNERABILITY_NEED_INFO',
  VULNERABILITY_ASSIGNED: 'VULNERABILITY_ASSIGNED',
  VULNERABILITY_RESOLVED: 'VULNERABILITY_RESOLVED'
} as const;
import { logger } from '../utils/logger';

const router = Router();

// 获取漏洞列表
router.get('/', 
  authenticate, 
  dataIsolation,
  validateQuery(paginationSchema), 
  async (req: AuthRequest, res, next) => {
  try {
    logger.info('Getting vulnerabilities list', { query: req.query, user: req.user?.id });
    const { page, limit, search, status, severity, sortBy, sortOrder } = req.query as any;
    
    // 构建查询条件
    const where: any = {};
    
    // 权限控制：不同角色看到不同范围的漏洞
    if (req.user!.role === UserRole.SECURITY_RESEARCHER) {
      // 安全研究员可以看到自己提交的漏洞
      where.submitterId = req.user!.id;
    } else if (req.user!.role === UserRole.FIX_ENGINEER) {
      // 修复人员只看已分配给自己的漏洞
      where.assigneeId = req.user!.id;
    }
    // VULNERABILITY_REVIEWER 可以看到所有漏洞
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { affectedSystem: { contains: search } }
      ];
    }
    
    if (status) {
      if (status.includes(',')) {
        // Handle multiple status values separated by comma
        where.status = { in: status.split(',') };
      } else {
        where.status = status;
      }
    }
    
    if (severity) {
      where.severity = severity;
    }

    const [vulnerabilities, total] = await Promise.all([
      prisma.vulnerability.findMany({
        where,
        include: {
          submitter: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          },
          assignee: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: {
              reviews: true
            }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' }
      }),
      prisma.vulnerability.count({ where })
    ]);

    res.json({
      success: true,
      data: vulnerabilities,
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

// 获取漏洞详情
router.get('/:id', 
  authenticate, 
  checkResourcePermission('vulnerability', 'read', 'id'),
  async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id },
      include: {
        submitter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    // 权限检查：不同角色有不同查看权限
    const canView = req.user!.role === UserRole.VULNERABILITY_REVIEWER ||
                   vulnerability.submitterId === req.user!.id ||
                   vulnerability.assigneeId === req.user!.id ||
                   (req.user!.role === UserRole.SECURITY_RESEARCHER && vulnerability.submitterId === req.user!.id) ||
                   (req.user!.role === UserRole.FIX_ENGINEER && vulnerability.assigneeId === req.user!.id);
    
    if (!canView) {
      throw new AppError('权限不足', 403);
    }

    res.json({
      success: true,
      data: vulnerability
    });
  } catch (error) {
    next(error);
  }
});

// 提交漏洞
router.post('/', 
  authenticate, 
  csrfProtection,
  xmlSecurity,
  validateUrls,
  validate(createVulnerabilitySchema), 
  async (req: AuthRequest, res, next) => {
  try {
    const vulnerabilityData = req.body;
    
    const vulnerability = await prisma.vulnerability.create({
      data: {
        ...vulnerabilityData,
        submitterId: req.user!.id
      },
      include: {
        submitter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // 发送提交通知给提交者
    notificationService.sendNotification(
      req.user!.id,
      vulnerability.id,
      NotificationEvent.VULNERABILITY_SUBMITTED
    ).catch(error => {
      logger.error('Failed to send submission notification:', error);
    });

    res.status(201).json({
      success: true,
      message: '漏洞提交成功',
      data: vulnerability
    });
  } catch (error) {
    next(error);
  }
});

// 更新漏洞（仅提交者可更新待审核状态的漏洞）
router.put('/:id', authenticate, validate(updateVulnerabilitySchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    // 权限检查：只有提交者可以更新自己提交的漏洞
    if (vulnerability.submitterId !== req.user!.id) {
      throw new AppError('只能更新自己提交的漏洞', 403);
    }

    // 只有待审核的漏洞才能更新（简化后的工作流）
    if (vulnerability.status !== VulnerabilityStatus.PENDING) {
      throw new AppError('该漏洞当前状态不允许修改', 400);
    }

    const updatedVulnerability = await prisma.vulnerability.update({
      where: { id },
      data: {
        ...updateData,
        // 更新后保持待审核状态
        status: VulnerabilityStatus.PENDING
      },
      include: {
        submitter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: '漏洞更新成功',
      data: updatedVulnerability
    });
  } catch (error) {
    next(error);
  }
});

// 删除漏洞（仅提交者可删除待审核状态的漏洞）
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    // 权限检查：只有提交者或超级管理员可以删除
    const canDelete = req.user!.role === UserRole.VULNERABILITY_REVIEWER || 
                     vulnerability.submitterId === req.user!.id;
    
    if (!canDelete) {
      throw new AppError('权限不足', 403);
    }

    // 只有待审核状态的漏洞才能删除
    if (vulnerability.status !== VulnerabilityStatus.PENDING) {
      throw new AppError('只能删除待审核状态的漏洞', 400);
    }

    await prisma.vulnerability.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: '漏洞删除成功'
    });
  } catch (error) {
    next(error);
  }
});

// 审核漏洞（仅审核员和管理员）
router.post('/:id/review', 
  authenticate, 
  requireReviewer, 
  csrfProtection,
  sensitiveOperationRateLimit,
  checkResourcePermission('vulnerability', 'update', 'id'),
  validate(reviewVulnerabilitySchema), 
  async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    // 只有待审核或待复测的漏洞才能审核
    if (vulnerability.status !== VulnerabilityStatus.PENDING && vulnerability.status !== VulnerabilityStatus.PENDING_RETEST) {
      throw new AppError('该漏洞当前状态不允许审核', 400);
    }

    // 使用事务同时更新漏洞状态和创建审核记录
    const result = await prisma.$transaction(async (tx) => {
      // 更新漏洞状态
      const updatedVulnerability = await tx.vulnerability.update({
        where: { id },
        data: { status },
        include: {
          submitter: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // 创建审核记录
      const review = await tx.vulnerabilityReview.create({
        data: {
          vulnerabilityId: id,
          reviewerId: req.user!.id,
          status,
          comment
        },
        include: {
          reviewer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      return { vulnerability: updatedVulnerability, review };
    });

    // 发送审核通知给提交者
    const notificationEvents: Record<string, string> = {
      'APPROVED': NotificationEvent.VULNERABILITY_APPROVED,
      'REJECTED': NotificationEvent.VULNERABILITY_REJECTED
    };

    const event = notificationEvents[status];
    if (event) {
      notificationService.sendNotification(
        result.vulnerability.submitterId,
        result.vulnerability.id,
        event as any
      ).catch(error => {
        logger.error('Failed to send review notification:', error);
      });
    }

    res.json({
      success: true,
      message: '审核完成',
      data: {
        vulnerability: result.vulnerability,
        review: result.review
      }
    });
  } catch (error) {
    next(error);
  }
});

// 分配漏洞（仅审核员）
router.post('/:id/assign', authenticate, requireReviewer, csrfProtection, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { assigneeId } = req.body;
    
    if (!assigneeId) {
      throw new AppError('必须指定分配给谁', 400);
    }
    
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    // 只有已通过审核的漏洞才能分配
    if (vulnerability.status !== VulnerabilityStatus.APPROVED) {
      throw new AppError('只能分配已通过审核的漏洞', 400);
    }

    // 检查被分配人是否存在且是修复人员
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, role: true, isActive: true }
    });

    if (!assignee || !assignee.isActive) {
      throw new AppError('指定的用户不存在或已被禁用', 400);
    }

    if (assignee.role !== UserRole.FIX_ENGINEER) {
      throw new AppError('只能分配给修复人员', 400);
    }

    const updatedVulnerability = await prisma.vulnerability.update({
      where: { id },
      data: { 
        assigneeId,
        status: VulnerabilityStatus.ASSIGNED
      },
      include: {
        submitter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // 发送分配通知给提交者和修复人员
    Promise.all([
      notificationService.sendNotification(
        updatedVulnerability.submitterId,
        updatedVulnerability.id,
        NotificationEvent.VULNERABILITY_ASSIGNED
      ),
      notificationService.sendNotification(
        assigneeId,
        updatedVulnerability.id,
        NotificationEvent.VULNERABILITY_ASSIGNED
      )
    ]).catch(error => {
      logger.error('Failed to send assignment notifications:', error);
    });

    res.json({
      success: true,
      message: '漏洞分配成功',
      data: updatedVulnerability
    });
  } catch (error) {
    next(error);
  }
});

// 认领漏洞（修复人员自动认领）
router.post('/:id/claim', authenticate, csrfProtection, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    // 只有修复人员可以认领
    if (req.user!.role !== UserRole.FIX_ENGINEER) {
      throw new AppError('只有修复人员可以认领漏洞', 403);
    }
    
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    // 只有已通过审核的漏洞才能认领
    if (vulnerability.status !== VulnerabilityStatus.APPROVED) {
      throw new AppError('只能认领已通过审核的漏洞', 400);
    }

    // 检查是否已被认领
    if (vulnerability.assigneeId) {
      throw new AppError('该漏洞已被认领', 400);
    }

    const updatedVulnerability = await prisma.vulnerability.update({
      where: { id },
      data: { 
        assigneeId: req.user!.id,
        status: VulnerabilityStatus.ASSIGNED
      },
      include: {
        submitter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // 发送认领通知给提交者
    notificationService.sendNotification(
      updatedVulnerability.submitterId,
      updatedVulnerability.id,
      NotificationEvent.VULNERABILITY_ASSIGNED
    ).catch(error => {
      logger.error('Failed to send assignment notification:', error);
    });

    res.json({
      success: true,
      message: '漏洞认领成功',
      data: updatedVulnerability
    });
  } catch (error) {
    next(error);
  }
});

// 更新漏洞处理状态
router.patch('/:id/status', authenticate, csrfProtection, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!vulnerability) {
      throw new AppError('漏洞不存在', 404);
    }

    // 权限检查：只有认领人、超级管理员或漏洞审核员可以更新处理状态
    const canUpdate = req.user!.role === UserRole.VULNERABILITY_REVIEWER ||
                     vulnerability.assigneeId === req.user!.id;
    
    if (!canUpdate) {
      throw new AppError('权限不足', 403);
    }

    // 验证状态转换的合法性
    const validTransitions = {
      [VulnerabilityStatus.ASSIGNED]: [VulnerabilityStatus.IN_PROGRESS],
      [VulnerabilityStatus.IN_PROGRESS]: [VulnerabilityStatus.PENDING_RETEST, VulnerabilityStatus.ASSIGNED],
      [VulnerabilityStatus.PENDING_RETEST]: [VulnerabilityStatus.RESOLVED, VulnerabilityStatus.IN_PROGRESS],
      [VulnerabilityStatus.RESOLVED]: [VulnerabilityStatus.CLOSED]
    };

    const allowedStatuses = validTransitions[vulnerability.status as keyof typeof validTransitions] || [];
    
    if (!allowedStatuses.includes(status)) {
      throw new AppError('无效的状态转换', 400);
    }

    const updatedVulnerability = await prisma.vulnerability.update({
      where: { id },
      data: { status },
      include: {
        submitter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        assignee: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // 发送状态更新通知
    if (status === VulnerabilityStatus.PENDING_RETEST) {
      // 通知提交者进行复测
      notificationService.sendNotification(
        updatedVulnerability.submitterId,
        updatedVulnerability.id,
        NotificationEvent.VULNERABILITY_RESOLVED
      ).catch(error => {
        logger.error('Failed to send retest notification:', error);
      });
    } else if (status === VulnerabilityStatus.RESOLVED) {
      notificationService.sendNotification(
        updatedVulnerability.submitterId,
        updatedVulnerability.id,
        NotificationEvent.VULNERABILITY_RESOLVED
      ).catch(error => {
        logger.error('Failed to send resolution notification:', error);
      });
    }

    res.json({
      success: true,
      message: '状态更新成功',
      data: updatedVulnerability
    });
  } catch (error) {
    next(error);
  }
});

// 获取漏洞统计信息
router.get('/stats/overview', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const where: any = {};
    
    // 非超级管理员和审核员只看自己的统计
    if (req.user!.role === UserRole.SECURITY_RESEARCHER) {
      where.submitterId = req.user!.id;
    } else if (req.user!.role === UserRole.FIX_ENGINEER) {
      where.assigneeId = req.user!.id;
    }

    const [
      total,
      pending,
      approved,
      rejected,
      assigned,
      resolved,
      bySeverity,
      byStatus
    ] = await Promise.all([
      prisma.vulnerability.count({ where }),
      prisma.vulnerability.count({ where: { ...where, status: VulnerabilityStatus.PENDING } }),
      prisma.vulnerability.count({ where: { ...where, status: VulnerabilityStatus.APPROVED } }),
      prisma.vulnerability.count({ where: { ...where, status: VulnerabilityStatus.REJECTED } }),
      prisma.vulnerability.count({ where: { ...where, status: VulnerabilityStatus.ASSIGNED } }),
      prisma.vulnerability.count({ where: { ...where, status: VulnerabilityStatus.RESOLVED } }),
      prisma.vulnerability.groupBy({
        by: ['severity'],
        where,
        _count: true
      }),
      prisma.vulnerability.groupBy({
        by: ['status'],
        where,
        _count: true
      })
    ]);

    const stats = {
      total,
      pending,
      approved,
      rejected,
      assigned,
      resolved,
      bySeverity: bySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// 获取审核统计
router.get('/stats/review', authenticate, requireReviewer, async (req: AuthRequest, res, next) => {
  try {
    const pendingCount = await prisma.vulnerability.count({
      where: { 
        status: { 
          in: [VulnerabilityStatus.PENDING, VulnerabilityStatus.PENDING_RETEST] 
        } 
      }
    });

    const needInfoCount = await prisma.vulnerability.count({
      where: { status: 'NEED_INFO' }
    });

    const totalReviewed = await prisma.vulnerabilityReview.count({
      where: { reviewerId: req.user!.id }
    });

    const monthlyReviewed = await prisma.vulnerabilityReview.count({
      where: {
        reviewerId: req.user!.id,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });

    res.json({
      success: true,
      data: {
        pending: pendingCount,
        needInfo: needInfoCount,
        total: pendingCount + needInfoCount,
        totalReviewed,
        monthlyReviewed
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;