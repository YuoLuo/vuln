#!/bin/bash

echo "🔧 启动开发环境..."

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 18+，当前版本: $(node -v)"
    exit 1
fi

# 检查是否存在 .env 文件
if [ ! -f .env ]; then
    echo "📋 复制环境变量模板..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件配置数据库连接信息"
fi

echo "📦 安装根目录依赖..."
npm install

echo "📦 安装客户端依赖..."
cd client && npm install && cd ..

echo "📦 安装服务端依赖..."
cd server && npm install && cd ..

echo "📦 安装共享模块依赖..."
cd shared && npm install && npm run build && cd ..

echo "🗄️  初始化SQLite数据库..."
cd server

# 确保 .env 文件存在
if [ ! -f .env ]; then
    echo "📄 创建服务端 .env 文件..."
    cat > .env << 'EOF'
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=3001
EOF
fi

# 生成 Prisma 客户端并创建数据库
echo "🔄 生成 Prisma 客户端..."
if npx prisma generate > /dev/null 2>&1; then
    echo "✅ Prisma 客户端生成成功"
else
    echo "❌ Prisma 客户端生成失败"
    cd ..
    exit 1
fi

echo "📊 创建/更新数据库结构..."
if npx prisma db push > /dev/null 2>&1; then
    echo "✅ SQLite数据库初始化成功"
else
    echo "❌ 数据库初始化失败"
    echo "💡 检查配置: DATABASE_URL=\"file:./dev.db\""
    cd ..
    exit 1
fi

cd ..

echo "🚀 启动开发服务器..."
npm run dev