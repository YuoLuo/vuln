#!/bin/bash

echo "🔍 验证数据库路径统一性..."

cd /Users/xiejun/vnlu

echo ""
echo "📋 检查配置文件中的数据库路径:"

# 检查所有配置文件
echo "1. .env.example:"
grep "DATABASE_URL" .env.example

echo "2. .env:"
grep "DATABASE_URL" .env 2>/dev/null || echo "   文件不存在"

echo "3. server/.env:"
grep "DATABASE_URL" server/.env 2>/dev/null || echo "   文件不存在"

echo ""
echo "📁 检查数据库文件存在:"
echo "server/dev.db: $([ -f server/dev.db ] && echo '❌ 存在(应删除)' || echo '✅ 不存在')"
echo "server/prisma/dev.db: $([ -f server/prisma/dev.db ] && echo '✅ 存在' || echo '❌ 不存在')"

echo ""
echo "📊 数据库统计:"
if [ -f "server/prisma/dev.db" ]; then
    cd server
    echo "文件大小: $(ls -lh prisma/dev.db | awk '{print $5}')"
    echo "表数量: $(sqlite3 prisma/dev.db '.tables' | wc -w)"
    echo "用户数: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM users;')"
    echo "漏洞数: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM vulnerabilities;')"
    cd ..
else
    echo "❌ 主数据库文件不存在"
fi

echo ""
echo "✅ 验证完成！"