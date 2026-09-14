// next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {},
  outputFileTracingRoot: path.join(__dirname, "./"),
  transpilePackages: ["three"],
};

export default nextConfig;