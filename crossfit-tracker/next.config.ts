import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.53', '10.0.20.22', '192.168.1.9'],
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // The persistent filesystem cache (on by default since 16.1) has repeatedly
    // corrupted itself ("Persisting failed: Another write batch or compaction
    // is already active") during normal dev use. Disabling it trades away some
    // rebuild speed for not having the dev server randomly break.
    turbopackFileSystemCacheForDev: false,
  },
  /* config options here */
};

export default nextConfig;
