import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for Server Actions to support large STL uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Ensure @prisma/client is bundled correctly if needed (usually auto-detected, but good practice if issues arise)
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
