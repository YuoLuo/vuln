#!/bin/bash

echo "🚀 启动漏洞管理平台 (SQLite版本)..."

# 检查是否存在 .env 文件
if [ ! -f .env ]; then
    echo "📋 复制环境变量模板..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，使用SQLite数据库"
fi

echo "📦 安装依赖..."
npm install

echo "🏗️  构建shared模块..."
cd shared && npm run build && cd ..

echo "🗄️  初始化SQLite数据库..."
cd server && npm run db:push && cd ..

echo "🔨 构建应用..."
npm run build

echo "🚀 启动生产服务器..."
npm start &
CLIENT_PID=$!

cd server && npm start &
SERVER_PID=$!

echo "✅ 启动完成！"
echo ""
echo "🌐 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:3001"
echo "💾 数据库: SQLite (server/dev.db)"
echo ""
echo "⏹️  停止服务: kill $CLIENT_PID $SERVER_PID"

# 等待进程
wait $CLIENT_PID $SERVER_PID