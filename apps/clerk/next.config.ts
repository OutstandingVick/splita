import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compile the workspace packages with the app so edits to their dist (rebuilt by tsc -w in
  // scripts/dev.sh) are picked up by the dev server.
  transpilePackages: ["@splita/core", "@splita/web"],
};

export default nextConfig;
