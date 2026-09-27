import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // postgres driver must stay on the server and be loaded by Node directly
  serverExternalPackages: ["postgres"],
  experimental: {
    serverActions: {
      // file uploads use a streaming route handler; actions carry forms, CSV and backup files
      bodySizeLimit: "25mb",
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
