import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'vnlu-server',
    audience: 'vnlu-client'
  });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'vnlu-server',
      audience: 'vnlu-client'
    }) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function refreshToken(token: string): string {
  const payload = verifyToken(token);
  const newPayload: JwtPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role
  };

  return jwt.sign(newPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'vnlu-server',
    audience: 'vnlu-client'
  });
}