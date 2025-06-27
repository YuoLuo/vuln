#!/bin/bash

echo "🧪 测试 SQLite 版本的漏洞管理平台..."

# 检查数据库文件
if [ -f "server/prisma/dev.db" ]; then
    echo "✅ SQLite 数据库文件存在"
    echo "📊 数据库大小: $(du -h server/prisma/dev.db | cut -f1)"
else
    echo "❌ 数据库文件不存在"
    exit 1
fi

# 检查服务端启动
echo "🔍 检查后端服务..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ 后端服务运行正常"
    echo "📋 健康检查: $(curl -s http://localhost:3001/health)"
else
    echo "❌ 后端服务未启动，请先运行 ./scripts/dev.sh"
    exit 1
fi

# 检查前端启动
echo "🔍 检查前端服务..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务运行正常"
else
    echo "❌ 前端服务未启动，请先运行 ./scripts/dev.sh"
    exit 1
fi

echo ""
echo "🎉 所有服务运行正常！"
echo "🌐 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:3001"
echo "💾 数据库: SQLite (server/prisma/dev.db)"
echo ""
echo "📱 你现在可以："
echo "1. 访问 http://localhost:3000 注册账户"
echo "2. 第一个注册的用户将成为管理员"
echo "3. 开始提交和管理漏洞"