import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    staticGenerationMaxConcurrency: 1,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '**.openmart.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_INTERNAL_URL
          ? `${process.env.API_INTERNAL_URL}/api/:path*`
          : 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
