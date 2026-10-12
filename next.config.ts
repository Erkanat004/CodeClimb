import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: process.env.CODE_CLIMB_NETWORK === '1' ? '.next-network' : '.next',
  typescript: {tsconfigPath: process.env.CODE_CLIMB_NETWORK === '1' ? 'tsconfig.network.json' : 'tsconfig.json'},
  poweredByHeader: false,
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    ]}];
  },
};

export default nextConfig;
