import type { NextConfig } from "next";

// Force server restart to clear HMR cache
const rawProxyTarget =
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const normalizeProxyTarget = (value: string) => value.replace(/\/+$/, "");
const proxyTarget = normalizeProxyTarget(rawProxyTarget);

const nextConfig: NextConfig = {
  transpilePackages: ['three', '@react-three/fiber', 'react-reconciler'],



  typescript: {
    ignoreBuildErrors: true,
  },

  // Webpack config (use --webpack flag to use webpack instead of turbopack)
  webpack: (config, { isServer, dev, nextRuntime }) => {
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
    optimizePackageImports: ['react-icons', 'recharts', 'framer-motion']
  },

  // Production optimizations
  // Reduce build size
  productionBrowserSourceMaps: false,

  // Enable gzip compression
  compress: true,

  images: {
    formats: ['image/webp', 'image/avif'],
    // Next.js 16 default is 4 hours (14400 seconds)
    // Setting to 60 seconds to maintain previous behavior
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

  turbopack: {
    rules: {
      // Configure Turbopack rules if needed
    }
  }
};

export default nextConfig;
