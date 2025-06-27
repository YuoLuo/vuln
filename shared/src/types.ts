import { z } from 'zod';

// 枚举类型
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',  // 超级管理员：系统管理
  SECURITY_RESEARCHER = 'SECURITY_RESEARCHER',  // 安全研究员：提交漏洞
  VULNERABILITY_REVIEWER = 'VULNERABILITY_REVIEWER',  // 漏洞审核员：审核漏洞，分配修复人员
  FIX_ENGINEER = 'FIX_ENGINEER'  // 修复人员：认领漏洞，修改状态为待复测
}

export enum VulnerabilityStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_RETEST = 'PENDING_RETEST',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export enum VulnerabilitySeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum NotificationType {
  EMAIL = 'EMAIL',
  DINGTALK = 'DINGTALK',
  WECHAT = 'WECHAT'
}

export enum NotificationEvent {
  VULNERABILITY_SUBMITTED = 'VULNERABILITY_SUBMITTED',
  VULNERABILITY_APPROVED = 'VULNERABILITY_APPROVED',
  VULNERABILITY_REJECTED = 'VULNERABILITY_REJECTED',
  VULNERABILITY_NEED_INFO = 'VULNERABILITY_NEED_INFO',
  VULNERABILITY_ASSIGNED = 'VULNERABILITY_ASSIGNED',
  VULNERABILITY_RESOLVED = 'VULNERABILITY_RESOLVED'
}

// 基础类型
export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  codeSnippet?: string;
  severity: VulnerabilitySeverity;
  status: VulnerabilityStatus;
  affectedSystem?: string;
  reproductionSteps?: string;
  impact?: string;
  recommendation?: string;
  attachments?: string; // JSON string of file paths array
  submitterId: string;
  submitter?: User;
  assigneeId?: string;
  assignee?: User;
  reviews?: VulnerabilityReview[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VulnerabilityReview {
  id: string;
  vulnerabilityId: string;
  reviewerId: string;
  reviewer?: User;
  status: VulnerabilityStatus;
  comment?: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  vulnerabilityId?: string;
  type: NotificationType;
  event: NotificationEvent;
  title: string;
  message: string;
  isSent: boolean;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
}

// API请求/响应类型
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface CreateVulnerabilityRequest {
  title: string;
  description: string;
  codeSnippet?: string;
  severity: VulnerabilitySeverity;
  affectedSystem?: string;
  reproductionSteps?: string;
  impact?: string;
  recommendation?: string;
}

export interface ReviewVulnerabilityRequest {
  status: VulnerabilityStatus;
  comment?: string;
}

export interface AssignVulnerabilityRequest {
  assigneeId: string;
}

// 分页相关
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: VulnerabilityStatus;
  severity?: VulnerabilitySeverity;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API响应包装
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

// 统计数据
export interface VulnerabilityStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  assigned: number;
  resolved: number;
  bySeverity: Record<VulnerabilitySeverity, number>;
  byStatus: Record<VulnerabilityStatus, number>;
}