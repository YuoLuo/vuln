import { z } from 'zod';
import { UserRole, VulnerabilityStatus, VulnerabilitySeverity } from './types';

// 用户相关验证
export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位字符')
});

export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  username: z.string().min(3, '用户名至少3位字符').max(20, '用户名最多20位字符'),
  password: z.string().min(6, '密码至少6位字符'),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional()
});

// 漏洞相关验证
export const createVulnerabilitySchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  description: z.string().min(1, '描述不能为空'),
  codeSnippet: z.string().optional(),
  severity: z.string(),
  affectedSystem: z.string().optional(),
  reproductionSteps: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional()
});

export const updateVulnerabilitySchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符').optional(),
  description: z.string().min(1, '描述不能为空').optional(),
  codeSnippet: z.string().optional(),
  severity: z.string().optional(),
  affectedSystem: z.string().optional(),
  reproductionSteps: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional()
});

export const reviewVulnerabilitySchema = z.object({
  status: z.string(),
  comment: z.string().optional()
});

export const assignVulnerabilitySchema = z.object({
  assigneeId: z.string().min(1, '请选择修复人员')
});

// 分页验证
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// 通知设置验证
export const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean().default(true),
  dingtalkEnabled: z.boolean().default(false),
  wechatEnabled: z.boolean().default(false),
  dingtalkWebhook: z.string().url().optional(),
  wechatWebhook: z.string().url().optional()
});

// 类型推断
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
export type CreateVulnerabilityData = z.infer<typeof createVulnerabilitySchema>;
export type UpdateVulnerabilityData = z.infer<typeof updateVulnerabilitySchema>;
export type ReviewVulnerabilityData = z.infer<typeof reviewVulnerabilitySchema>;
export type AssignVulnerabilityData = z.infer<typeof assignVulnerabilitySchema>;
export type PaginationData = z.infer<typeof paginationSchema>;
export type NotificationSettingsData = z.infer<typeof notificationSettingsSchema>;