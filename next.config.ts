import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.53', '10.0.20.22', '192.168.1.9'],
  turbopack: {
    root: __dirname,
  },
  /* config options here */
};

export default nextConfig;
