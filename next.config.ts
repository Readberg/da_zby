import type { NextConfig } from "next";
import { securityHeaders, supabaseHost } from "./src/config/security-headers";
import { resolveSiteUrl } from "./src/lib/site-url";

const siteUrl = resolveSiteUrl(process.env);
const supabase = supabaseHost(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Keeps the dev badge out of `pnpm design:snap` screenshots; errors still show in the overlay.
  devIndicators: false,
  images: {
    // 75 is the default; 85 is for the large cover of the first video.
    qualities: [75, 85],
    // YouTube video previews.
    remotePatterns: [
      new URL("https://i.ytimg.com/vi/**"),
      // User photos from the public Supabase Storage bucket "avatars".
      new URL(`https://${supabase}/storage/v1/object/public/avatars/**`),
      // Club logos uploaded by admins.
      new URL(`https://${supabase}/storage/v1/object/public/club-logos/**`),
    ],
  },
  // Not in development: the dev server needs eval and websockets that the policy would report.
  async headers() {
    return process.env.NODE_ENV === "production"
      ? [{ source: "/:path*", headers: securityHeaders(process.env.NEXT_PUBLIC_SUPABASE_URL) }]
      : [];
  },
  env: {
    // Exposed by GET /api/v1/version.
    APP_BUILD_DATE: new Date().toISOString(),
    ...(siteUrl ? { NEXT_PUBLIC_SITE_URL: siteUrl } : {}),
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
