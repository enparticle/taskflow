@"
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
    responseLimit: '25mb',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};
export default nextConfig;
"@ | Set-Content "next.config.ts"