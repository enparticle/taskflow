import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};
export default nextConfig;