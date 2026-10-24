import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Keeps the dev badge out of `pnpm design:snap` screenshots; errors still show in the overlay.
  devIndicators: false,
  env: {
    // Exposed by GET /api/v1/version.
    APP_BUILD_DATE: new Date().toISOString(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
