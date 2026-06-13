import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/my-expense-tracker',
  assetPrefix: '/my-expense-tracker',
};

export default nextConfig;
