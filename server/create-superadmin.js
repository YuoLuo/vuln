const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    // 创建测试用户
    const users = [
      {
        id: 'reviewer-001',
        email: 'reviewer@test.com',
        username: 'reviewer',
        password: '123456',
        firstName: '审核员',
        lastName: '测试',
        role: 'VULNERABILITY_REVIEWER'
      },
      {
        id: 'researcher-001', 
        email: 'researcher@test.com',
        username: 'researcher',
        password: '123456',
        firstName: '研究员',
        lastName: '测试',
        role: 'SECURITY_RESEARCHER'
      },
      {
        id: 'engineer-001',
        email: 'engineer@test.com', 
        username: 'engineer',
        password: '123456',
        firstName: '修复员',
        lastName: '测试',
        role: 'FIX_ENGINEER'
      }
    ];

    for (const userData of users) {
      const existing = await prisma.user.findFirst({
        where: { email: userData.email }
      });

      if (existing) {
        console.log(`用户已存在: ${userData.username}`);
        continue;
      }

      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      const user = await prisma.user.create({
        data: {
          ...userData,
          password: passwordHash,
          isActive: true
        }
      });

      console.log(`用户创建成功: ${user.username} (${user.role})`);
    }

  } catch (error) {
    console.error('创建测试用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();