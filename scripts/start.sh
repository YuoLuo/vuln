#!/bin/bash

echo "🚀 启动漏洞管理平台..."

# 检查是否存在 .env 文件
if [ ! -f .env ]; then
    echo "📋 复制环境变量模板..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件配置数据库和其他服务信息"
    echo "配置完成后，请重新运行此脚本"
    exit 1
fi

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

echo "📦 安装依赖..."
npm install

echo "🏗️  构建shared模块..."
cd shared && npm run build && cd ..

echo "🗄️  初始化数据库..."
cd server && npm run db:push && cd ..

echo "🐳 启动Docker容器..."
docker-compose up -d

echo "⏳ 等待服务启动..."
sleep 10

echo "✅ 启动完成！"
echo ""
echo "🌐 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:3001"
echo "📊 数据库: PostgreSQL (localhost:5432)"
echo ""
echo "📝 默认管理员账户需要手动创建，请访问前端注册页面"
echo "第一个注册的用户将自动设置为管理员"
echo ""
echo "🔍 查看日志: docker-compose logs -f"
echo "⏹️  停止服务: docker-compose down"