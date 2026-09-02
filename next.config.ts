import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  logging: {
    browserToTerminal: true,
  },
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;