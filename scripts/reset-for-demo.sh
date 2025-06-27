#!/bin/bash

# 漏洞管理平台 - 演示数据重置脚本
# 用于清空所有用户数据，保留系统测试账号

set -e

echo "🔒 漏洞管理平台 - 演示数据重置"
echo "================================"
echo ""

# 确认操作
read -p "⚠️  警告: 此操作将删除所有用户数据和漏洞记录，是否继续? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "❌ 操作已取消"
    exit 0
fi

echo ""
echo "🗑️ 开始重置数据库..."

# 切换到服务器目录
cd "$(dirname "$0")/../server"

# 执行数据库重置
node reset-database.js

# 清理上传的文件
echo ""
echo "🧹 清理上传文件..."
if [ -d "uploads" ]; then
    find uploads/ -name "img_*" -type f -delete 2>/dev/null || true
    echo "✅ 已清理上传文件"
else
    echo "ℹ️  上传目录不存在，跳过清理"
fi

echo ""
echo "🎉 重置完成！系统已恢复到初始演示状态"
echo ""
echo "🚀 现在可以使用以下命令启动系统:"
echo "   npm run dev"
echo ""