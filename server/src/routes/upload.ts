import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { InputSanitizer } from '../utils/sanitizer';
import { validateFileUpload } from '../middleware/inputValidation';
import { uploadRateLimit, sensitiveOperationRateLimit } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrfProtection';

const router = Router();

// 创建安全的上传目录
const uploadDir = path.resolve(__dirname, '../../uploads');
const allowedDir = uploadDir;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

// 病毒文件签名检测
const MALICIOUS_SIGNATURES = [
  Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // JPEG头但可能伪装
  Buffer.from('<?php'), // PHP代码
  Buffer.from('<script'), // JavaScript
  Buffer.from('<%'), // ASP/JSP
  Buffer.from('#!/'), // Shell脚本
];

/**
 * 检查文件是否包含恶意内容
 */
const checkFileContent = (buffer: Buffer): boolean => {
  const content = buffer.toString();
  
  // 检查是否包含可执行代码
  const maliciousPatterns = [
    /<\?php/i,
    /<script/i,
    /<%/,
    /#!/,
    /eval\s*\(/i,
    /exec\s*\(/i,
    /system\s*\(/i,
    /shell_exec/i,
    /base64_decode/i,
    /file_get_contents/i,
    /include\s*\(/i,
    /require\s*\(/i
  ];

  return maliciousPatterns.some(pattern => pattern.test(content));
};

/**
 * 验证图片文件头
 */
const validateImageHeader = (buffer: Buffer, mimetype: string): boolean => {
  const headers: { [key: string]: Buffer[] } = {
    'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
    'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    'image/gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
    'image/webp': [Buffer.from('RIFF'), Buffer.from('WEBP')],
  };

  const expectedHeaders = headers[mimetype];
  if (!expectedHeaders) return false;

  return expectedHeaders.some(header => buffer.subarray(0, header.length).equals(header));
};

// 安全的文件存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 确保目录安全
    if (!InputSanitizer.validateFilePath(uploadDir, allowedDir)) {
      return cb(new Error('无效的上传目录'), '');
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    try {
      // 生成安全的文件名
      const user = (req as any).user;
      const timestamp = Date.now();
      const randomBytes = crypto.randomBytes(8).toString('hex');
      const sanitizedOriginalName = InputSanitizer.sanitizeFileName(file.originalname);
      const ext = path.extname(sanitizedOriginalName).toLowerCase();
      
      // 只允许特定扩展名
      const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      if (!allowedExts.includes(ext)) {
        return cb(new Error('不支持的文件扩展名'), '');
      }

      const filename = `img_${user?.id || 'anonymous'}_${timestamp}_${randomBytes}${ext}`;
      cb(null, filename);
    } catch (error) {
      cb(new Error('文件名生成失败'), '');
    }
  }
});

// 严格的文件过滤器
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    // 检查MIME类型
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('不支持的文件类型，只允许图片文件'));
    }

    // 检查文件名
    const sanitizedName = InputSanitizer.sanitizeFileName(file.originalname);
    if (!sanitizedName || sanitizedName.length === 0) {
      return cb(new Error('无效的文件名'));
    }

    // 检查文件扩展名
    const ext = path.extname(sanitizedName).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error('不支持的文件扩展名'));
    }

    cb(null, true);
  } catch (error) {
    cb(new Error('文件验证失败'));
  }
};

// 安全的multer配置
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
    files: 1, // 一次只能上传一个文件
    fields: 5, // 限制字段数量
    fieldNameSize: 100, // 限制字段名长度
    fieldSize: 1024 * 1024, // 限制字段值大小
  }
});

// 图片上传端点 - 添加多层安全检查
router.post('/image', 
  authenticate, 
  uploadRateLimit,
  csrfProtection,
  upload.single('image'), 
  validateFileUpload,
  async (req: AuthRequest, res, next) => {
    let uploadedFilePath: string | null = null;
    
    try {
      if (!req.file) {
        throw new AppError('没有上传文件', 400);
      }

      uploadedFilePath = req.file.path;

      // 读取文件内容进行深度检查
      const fileBuffer = fs.readFileSync(uploadedFilePath);
      
      // 验证文件头部签名
      if (!validateImageHeader(fileBuffer, req.file.mimetype)) {
        throw new AppError('文件头部验证失败，可能是伪造的图片文件', 400);
      }

      // 检查文件内容是否包含恶意代码
      if (checkFileContent(fileBuffer)) {
        throw new AppError('检测到文件包含可执行代码，上传被拒绝', 400);
      }

      // 验证文件路径安全性
      if (!InputSanitizer.validateFilePath(uploadedFilePath, allowedDir)) {
        throw new AppError('文件路径验证失败', 400);
      }

      // 构建安全的文件URL（不暴露真实路径）
      const securePath = `/uploads/${req.file.filename}`;
      
      // 记录上传日志（审计用途）
      console.log(`File uploaded: ${req.file.filename} by user: ${req.user?.id} from IP: ${req.ip}`);

      res.json({
        success: true,
        message: '图片上传成功',
        data: {
          filename: req.file.filename,
          originalName: path.basename(req.file.originalname), // 只返回文件名部分
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: securePath // 使用相对路径
        }
      });
    } catch (error) {
      // 如果验证失败，删除已上传的文件
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (deleteError) {
          console.error('Failed to delete invalid uploaded file:', deleteError);
        }
      }
      next(error);
    }
  }
);

// 安全的文件删除端点
router.delete('/image/:filename', 
  authenticate, 
  csrfProtection,
  sensitiveOperationRateLimit,
  async (req: AuthRequest, res, next) => {
    try {
      const { filename } = req.params;
      
      // 验证文件名安全性
      const sanitizedFilename = InputSanitizer.sanitizeFileName(filename);
      if (!sanitizedFilename || sanitizedFilename !== filename) {
        throw new AppError('无效的文件名', 400);
      }

      // 构建安全的文件路径
      const filePath = path.resolve(uploadDir, sanitizedFilename);
      
      // 验证文件路径在允许的目录内（防止路径遍历攻击）
      if (!InputSanitizer.validateFilePath(filePath, allowedDir)) {
        throw new AppError('文件路径验证失败', 400);
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new AppError('文件不存在', 404);
      }

      // 额外安全检查：确保文件确实在上传目录内
      const resolvedUploadDir = path.resolve(uploadDir);
      const resolvedFilePath = path.resolve(filePath);
      if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
        throw new AppError('权限不足，无法删除该文件', 403);
      }

      // 记录删除操作（审计用途）
      console.log(`File deletion requested: ${sanitizedFilename} by user: ${req.user?.id} from IP: ${req.ip}`);

      // 删除文件
      fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: '图片删除成功'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;