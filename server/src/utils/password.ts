import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密码至少需要8个字符');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密码需要包含至少一个小写字母');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密码需要包含至少一个大写字母');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密码需要包含至少一个数字');
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('密码需要包含至少一个特殊字符');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}