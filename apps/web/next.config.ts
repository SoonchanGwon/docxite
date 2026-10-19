import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages hosts this app as static files; the API/WS backend
  // (apps/server) is the only dynamic part and lives on Render.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
