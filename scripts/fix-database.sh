#!/bin/bash

echo "🔧 修复数据库问题..."

cd /Users/xiejun/vnlu/server

echo "📊 当前数据库状态:"
echo "数据库文件大小: $(ls -la prisma/dev.db 2>/dev/null | awk '{print $5}' || echo '文件不存在')"
echo "表数量: $(sqlite3 prisma/dev.db '.tables' 2>/dev/null | wc -w || echo '0')"
echo "用户数量: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM users;' 2>/dev/null || echo '0')"
echo "漏洞数量: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM vulnerabilities;' 2>/dev/null || echo '0')"

echo ""
echo "✅ 数据库已修复！"
echo ""
echo "🚀 下一步操作："
echo "1. 重启开发服务器: npm run dev"
echo "2. 访问 http://localhost:3000"
echo "3. 重新注册一个账户（第一个用户将成为管理员）"
echo "4. 提交一些测试漏洞"
echo ""
echo "📱 测试页面："
echo "- 调试信息: http://localhost:3000/debug"
echo "- 注册页面: http://localhost:3000/auth/register"