const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('🗑️ 开始清理数据库...');

    // 1. 删除所有通知
    await prisma.notification.deleteMany({});
    console.log('✅ 已清理所有通知');

    // 2. 删除所有漏洞审核记录
    await prisma.vulnerabilityReview.deleteMany({});
    console.log('✅ 已清理所有漏洞审核记录');

    // 3. 删除所有漏洞
    await prisma.vulnerability.deleteMany({});
    console.log('✅ 已清理所有漏洞记录');

    // 4. 删除所有用户通知设置
    await prisma.userNotificationSettings.deleteMany({});
    console.log('✅ 已清理所有用户通知设置');

    // 5. 删除所有用户
    await prisma.user.deleteMany({});
    console.log('✅ 已清理所有用户');

    // 6. 删除系统设置
    await prisma.systemSettings.deleteMany({});
    console.log('✅ 已清理系统设置');

    console.log('🔧 开始创建系统测试账号...');

    // 创建密码哈希
    const defaultPassword = await bcrypt.hash('123456', 10);

    // 创建系统测试账号
    const testAccounts = [
      {
        email: 'admin@test.com',
        username: 'admin',
        password: defaultPassword,
        firstName: '系统',
        lastName: '管理员',
        role: 'SUPERADMIN',
        isActive: true
      },
      {
        email: 'reviewer@test.com',
        username: 'reviewer',
        password: defaultPassword,
        firstName: '安全',
        lastName: '审核员',
        role: 'VULNERABILITY_REVIEWER',
        isActive: true
      },
      {
        email: 'researcher@test.com',
        username: 'researcher',
        password: defaultPassword,
        firstName: '安全',
        lastName: '研究员',
        role: 'SECURITY_RESEARCHER',
        isActive: true
      },
      {
        email: 'engineer@test.com',
        username: 'engineer',
        password: defaultPassword,
        firstName: '修复',
        lastName: '工程师',
        role: 'FIX_ENGINEER',
        isActive: true
      }
    ];

    // 批量创建测试账号
    for (const account of testAccounts) {
      const user = await prisma.user.create({
        data: account
      });

      // 为每个用户创建默认通知设置
      await prisma.userNotificationSettings.create({
        data: {
          userId: user.id,
          emailEnabled: true,
          dingtalkEnabled: false,
          wechatEnabled: false
        }
      });

      console.log(`✅ 创建测试账号: ${account.username} (${account.role})`);
    }

    // 创建基础系统设置
    const systemSettings = [
      { key: 'system_initialized', value: 'true' },
      { key: 'notification_email_enabled', value: 'true' },
      { key: 'notification_dingtalk_enabled', value: 'false' },
      { key: 'notification_wechat_enabled', value: 'false' },
      { key: 'max_file_upload_size', value: '5242880' }, // 5MB
      { key: 'allowed_file_types', value: 'jpg,jpeg,png,gif,webp' }
    ];

    for (const setting of systemSettings) {
      await prisma.systemSettings.create({
        data: setting
      });
    }

    console.log('✅ 创建基础系统设置');

    console.log('🎉 数据库重置完成！');
    console.log('');
    console.log('📋 系统测试账号:');
    console.log('┌──────────────────────────────────────────────┐');
    console.log('│  账号类型    │  用户名    │  密码    │  邮箱        │');
    console.log('├──────────────────────────────────────────────┤');
    console.log('│  超级管理员  │  admin     │  123456  │  admin@test.com     │');
    console.log('│  安全审核员  │  reviewer  │  123456  │  reviewer@test.com  │');
    console.log('│  安全研究员  │  researcher│  123456  │  researcher@test.com│');
    console.log('│  修复工程师  │  engineer  │  123456  │  engineer@test.com  │');
    console.log('└──────────────────────────────────────────────┘');
    console.log('');
    console.log('⚠️  注意: 请在生产环境中修改默认密码！');

  } catch (error) {
    console.error('❌ 数据库重置失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行重置
resetDatabase()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });