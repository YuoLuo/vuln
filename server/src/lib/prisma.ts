import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma = globalThis.__prisma || new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// 日志处理
prisma.$on('query', (e) => {
  logger.debug('Query: ' + e.query);
  logger.debug('Params: ' + e.params);
  logger.debug('Duration: ' + e.duration + 'ms');
});

prisma.$on('error', (e) => {
  logger.error('Database error: ' + e.message);
});

prisma.$on('info', (e) => {
  logger.info('Database info: ' + e.message);
});

prisma.$on('warn', (e) => {
  logger.warn('Database warning: ' + e.message);
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export { prisma };