import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disabling this makes the bug (and the test failure) go away
  cacheComponents: true,
};

export default nextConfig;
