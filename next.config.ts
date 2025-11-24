import type { NextConfig } from "next";

const rawProxyTarget =
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const normalizeProxyTarget = (value: string) => value.replace(/\/+$/, "");
const proxyTarget = normalizeProxyTarget(rawProxyTarget);

const nextConfig: NextConfig = {
  transpilePackages: ['three', '@react-three/fiber', 'react-reconciler'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable persistent caching for faster rebuilds
  webpack: (config, { isServer }) => {
    // Enable persistent caching for faster rebuilds
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    };

    return config;
  },
  experimental: {
    // Keep optimizePackageImports conservative; three.js/@react-three/fiber can
    // break when the optimizer rewrites their entrypoints.
    optimizePackageImports: ['react-icons', 'recharts', 'framer-motion'],
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  // Production optimizations
  productionBrowserSourceMaps: false, // Reduce build size
  compress: true, // Enable gzip compression
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/backend/:path*",
          destination: `${proxyTarget}/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
