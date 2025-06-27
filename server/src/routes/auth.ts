import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { validate } from '../middleware/validation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { loginSchema, registerSchema } from 'vnlu-shared';
import { InputSanitizer } from '../utils/sanitizer';
import { validateAndSanitizeInput, validateEnums } from '../middleware/inputValidation';
import { loginRateLimit, registerRateLimit } from '../middleware/rateLimiter';
import { getCSRFToken } from '../middleware/csrfProtection';

const router = Router();

// 获取CSRF Token
router.get('/csrf-token', getCSRFToken);

// 用户注册 - 添加安全防护
router.post('/register', 
  registerRateLimit,
  validateAndSanitizeInput,
  validate(registerSchema), 
  async (req, res, next) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;

    // 额外的输入验证和清理
    const sanitizedEmail = InputSanitizer.sanitizeEmail(email);
    const sanitizedUsername = InputSanitizer.sanitizeUsername(username);
    
    if (!sanitizedEmail) {
      throw new AppError('无效的邮箱格式', 400);
    }
    
    if (!sanitizedUsername) {
      throw new AppError('用户名只能包含字母、数字、下划线和连字符', 400);
    }

    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
      throw new AppError('用户名长度必须在3-30个字符之间', 400);
    }

    // 检查密码强度
    if (password.length < 8) {
      throw new AppError('密码长度至少8个字符', 400);
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new AppError('密码必须包含大小写字母和数字', 400);
    }

    // 使用清理后的数据检查用户是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: sanitizedEmail },
          { username: sanitizedUsername }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === sanitizedEmail) {
        throw new AppError('该邮箱已被注册', 400);
      }
      if (existingUser.username === sanitizedUsername) {
        throw new AppError('该用户名已被使用', 400);
      }
    }

    // 哈希密码
    const hashedPassword = await hashPassword(password);

    // 使用清理后的数据创建用户
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        username: sanitizedUsername,
        password: hashedPassword,
        firstName: InputSanitizer.sanitizeText(firstName || ''),
        lastName: InputSanitizer.sanitizeText(lastName || '')
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // 生成JWT令牌
    const token = generateToken(user as any);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

// 用户登录 - 添加防爆破保护
router.post('/login', 
  loginRateLimit,
  validateAndSanitizeInput,
  validate(loginSchema), 
  async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 清理和验证输入
    const sanitizedEmail = InputSanitizer.sanitizeEmail(email);
    if (!sanitizedEmail) {
      throw new AppError('无效的邮箱格式', 400);
    }

    // 添加额外的延迟以防止时序攻击
    const startTime = Date.now();
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });

    // 即使用户不存在也执行密码哈希操作以防止时序攻击
    const dummyHash = '$2b$10$dummyhashtopreventtimingattacks1234567890123456789';
    const passwordToCheck = user ? user.password : dummyHash;
    const isPasswordValid = await comparePassword(password, passwordToCheck);

    if (!user || !isPasswordValid) {
      // 确保最小响应时间以防止时序攻击
      const elapsedTime = Date.now() - startTime;
      const minTime = 1000; // 最少1秒
      if (elapsedTime < minTime) {
        await new Promise(resolve => setTimeout(resolve, minTime - elapsedTime));
      }
      throw new AppError('邮箱或密码错误', 401);
    }

    // 检查用户是否激活
    if (!user.isActive) {
      throw new AppError('账户已被禁用，请联系管理员', 401);
    }

    // 生成JWT令牌
    const token = generateToken(user);

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: userWithoutPassword
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
        updatedAt: true
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

// 刷新令牌
router.post('/refresh', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user || !user.isActive) {
      throw new AppError('用户不存在或已被禁用', 401);
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: { token }
    });
  } catch (error) {
    next(error);
  }
});

// 登出（客户端处理，清除本地令牌）
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: '登出成功'
  });
});

export default router;