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
  async headers() {
    return [
      {
        // the service worker must never be served stale, or app updates would not reach installed phones
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
