/**
 * 安全的API请求工具
 */

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  requiresCSRF?: boolean;
}

class ApiClient {
  private baseURL: string;
  private csrfToken: string | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '';
  }

  /**
   * 获取CSRF Token
   */
  private async getCSRFToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to get CSRF token');
      }

      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      throw error;
    }
  }

  /**
   * 清理CSRF Token
   */
  private clearCSRFToken(): void {
    this.csrfToken = null;
  }

  /**
   * HTML编码防止XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 验证URL防止SSRF
   */
  private validateURL(url: string): boolean {
    try {
      const urlObj = new URL(url, this.baseURL);
      
      // 只允许相对路径或同域名请求
      if (urlObj.origin !== new URL(this.baseURL).origin) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全的API请求
   */
  async request(url: string, config: RequestConfig = {}): Promise<Response> {
    const {
      method = 'GET',
      headers = {},
      body,
      requiresCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || 'GET')
    } = config;

    // 验证URL
    if (!this.validateURL(url)) {
      throw new Error('Invalid URL');
    }

    // 构建完整URL
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    // 准备请求头
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    // 添加认证token
    const token = localStorage.getItem('token');
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    // 添加CSRF Token（如果需要）
    if (requiresCSRF) {
      try {
        const csrfToken = await this.getCSRFToken();
        requestHeaders['X-CSRF-Token'] = csrfToken;
      } catch (error) {
        console.warn('Failed to get CSRF token, proceeding without it');
      }
    }

    // 处理请求体
    let requestBody: string | FormData | undefined;
    if (body) {
      if (body instanceof FormData) {
        // FormData时不设置Content-Type，让浏览器自动设置
        delete requestHeaders['Content-Type'];
        requestBody = body;
      } else {
        requestBody = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(fullURL, {
        method,
        headers: requestHeaders,
        body: requestBody,
        credentials: 'include',
        cache: 'no-cache'
      });

      // 如果是401错误，清理token和CSRF token
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.clearCSRFToken();
      }

      // 如果是403错误且是CSRF相关，清理CSRF token
      if (response.status === 403) {
        this.clearCSRFToken();
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * GET请求
   */
  async get(url: string, headers?: Record<string, string>): Promise<Response> {
    return this.request(url, { method: 'GET', headers });
  }

  /**
   * POST请求
   */
  async post(url: string, body?: any, headers?: Record<string, string>): Promise<Response> {
    return this.request(url, { method: 'POST', body, headers });
  }

  /**
   * PUT请求
   */
  async put(url: string, body?: any, headers?: Record<string, string>): Promise<Response> {
    return this.request(url, { method: 'PUT', body, headers });
  }

  /**
   * PATCH请求
   */
  async patch(url: string, body?: any, headers?: Record<string, string>): Promise<Response> {
    return this.request(url, { method: 'PATCH', body, headers });
  }

  /**
   * DELETE请求
   */
  async delete(url: string, headers?: Record<string, string>): Promise<Response> {
    return this.request(url, { method: 'DELETE', headers });
  }

  /**
   * 文件上传
   */
  async uploadFile(url: string, file: File, fieldName: string = 'file'): Promise<Response> {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('不支持的文件类型');
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('文件大小超过限制');
    }

    // 验证文件名
    const fileName = file.name;
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      throw new Error('文件名包含非法字符');
    }

    const formData = new FormData();
    formData.append(fieldName, file);

    return this.request(url, {
      method: 'POST',
      body: formData,
      requiresCSRF: true
    });
  }
}

// 创建API客户端实例
export const apiClient = new ApiClient();

// 导出便捷方法
export const api = {
  get: (url: string, headers?: Record<string, string>) => apiClient.get(url, headers),
  post: (url: string, body?: any, headers?: Record<string, string>) => apiClient.post(url, body, headers),
  put: (url: string, body?: any, headers?: Record<string, string>) => apiClient.put(url, body, headers),
  patch: (url: string, body?: any, headers?: Record<string, string>) => apiClient.patch(url, body, headers),
  delete: (url: string, headers?: Record<string, string>) => apiClient.delete(url, headers),
  upload: (url: string, file: File, fieldName?: string) => apiClient.uploadFile(url, file, fieldName)
};

/**
 * 输出转义工具
 */
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * 安全的JSON解析
 */
export const safeJsonParse = (text: string, fallback: any = null): any => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

/**
 * 验证用户输入
 */
export const validateInput = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  username: (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return usernameRegex.test(username);
  },
  
  password: (password: string): boolean => {
    return password.length >= 8 && 
           /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password);
  },
  
  filename: (filename: string): boolean => {
    const filenameRegex = /^[a-zA-Z0-9._-]+$/;
    return filenameRegex.test(filename) && filename.length <= 255;
  }
};