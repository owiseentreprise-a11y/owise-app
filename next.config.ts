import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ['firebase'],
  turbopack: {},
  async rewrites() {
    return [
      { source: '/', destination: '/vitrine.html' },
    ]
  },
};

export default nextConfig;
