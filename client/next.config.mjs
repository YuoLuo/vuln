/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['vnlu-shared'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  }
};

export default nextConfig;