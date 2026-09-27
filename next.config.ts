import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // postgres driver must stay on the server and be loaded by Node directly
  serverExternalPackages: ["postgres"],
  experimental: {
    serverActions: {
      // uploads go through a route handler; actions only carry form data
      bodySizeLimit: "2mb",
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
