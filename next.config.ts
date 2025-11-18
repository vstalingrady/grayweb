import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/backend/:path*",
          destination: "http://127.0.0.1:8000/:path*",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
