FROM node:18-alpine

WORKDIR /app

# 复制package文件
COPY server/package*.json ./
COPY shared/package*.json ../shared/

# 安装依赖
RUN npm ci --only=production

# 复制shared模块
COPY shared/ ../shared/
RUN cd ../shared && npm run build

# 复制源代码
COPY server/ .

# 生成Prisma客户端
RUN npx prisma generate

# 构建应用
RUN npm run build

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 创建日志目录
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3001

CMD ["npm", "start"]