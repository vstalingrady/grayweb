import type { NextConfig } from "next";

// Force server restart to clear HMR cache
const rawProxyTarget =
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const normalizeProxyTarget = (value: string) => value.replace(/\/+$/, "");
const proxyTarget = normalizeProxyTarget(rawProxyTarget);
console.log('Proxy Target:', proxyTarget);

const nextConfig: NextConfig = {
  // Enable standalone output for Docker builds
  output: 'standalone',
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  transpilePackages: ['three', '@react-three/fiber', 'react-reconciler'],

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY HARDENING - Updated after security incident on 2025-12-06
  // ═══════════════════════════════════════════════════════════════════════════

  // Disable server actions if not needed (reduces attack surface)
  // serverActions: { bodySizeLimit: '1mb' },

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

    // Security: Disable eval in production builds
    if (!dev) {
      config.devtool = false;
    }

    return config;
  },

  experimental: {
    // Keep optimizePackageImports conservative; three.js/@react-three/fiber can
    // break when the optimizer rewrites their entrypoints.
    optimizePackageImports: ['react-icons', 'recharts'],
  },

  // Production optimizations
  // Reduce build size - also prevents source map leakage
  productionBrowserSourceMaps: false,

  // Enable gzip compression
  compress: true,

  images: {
    formats: ['image/webp', 'image/avif'],
    // Next.js 16 default is 4 hours (14400 seconds)
    // Setting to 60 seconds to maintain previous behavior
    minimumCacheTTL: 60,
    // Security: Only allow images from trusted domains
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'secure.gravatar.com' },
      { protocol: 'https', hostname: 'www.gravatar.com' },
    ],
  },



  turbopack: {
    // Explicitly set the project root to avoid lockfile ambiguity warnings.
    root: __dirname,
    rules: {
      // Configure Turbopack rules if needed
    }
  },

  // Security: Hide server technology
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Force HTTPS for 2 years
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Enable XSS filter (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Cross-Origin policies for isolation
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          // Content Security Policy - strict but functional
          // Note: 'unsafe-inline' required for Next.js styles, 'unsafe-eval' for react-three-fiber
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: self + specific trusted CDNs only
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com https://api.midtrans.com https://app.midtrans.com https://simulator.sandbox.midtrans.com",
              // Styles: self + Google Fonts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: self + trusted sources
              "img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com https://avatars.githubusercontent.com https://*.githubusercontent.com https://cdn.discordapp.com https://secure.gravatar.com https://www.gravatar.com https://api.midtrans.com",
              // Fonts: self + Google Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // XHR/Fetch: self + trusted APIs
              "connect-src 'self' https://*.supabase.co https://*.googleusercontent.com https://www.youtube.com https://challenges.cloudflare.com wss://*.supabase.co https://api.midtrans.com https://app.midtrans.com https://simulator.sandbox.midtrans.com",
              // Frames: limited to YouTube and Cloudflare
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com https://api.midtrans.com https://app.midtrans.com https://simulator.sandbox.midtrans.com",
              // Ancestors: prevent embedding
              "frame-ancestors 'none'",
              // Base URI: prevent base tag hijacking
              "base-uri 'self'",
              // Forms: only submit to self
              "form-action 'self'",
              // Objects: disabled
              "object-src 'none'",
              // Upgrade insecure requests - only in production
              ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : []),
            ].join('; '),
          },
          // Restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://api.midtrans.com"), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
      // Additional headers for API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
