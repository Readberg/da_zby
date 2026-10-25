import type { NextRequest } from "next/server";

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Origin to use in redirects. Behind a proxy (Railway) `request.nextUrl.origin` is the container's
 * internal address (localhost:8080), so a configured public site URL wins; locally the request's
 * own origin is right (any port).
 */
export function publicOrigin(
  request: Pick<NextRequest, "nextUrl">,
  // Literal read: inlined at build time (next.config.ts normalizes it, adding the Railway domain).
  siteUrl: string = process.env.NEXT_PUBLIC_SITE_URL ?? "",
): string {
  const configured = siteUrl.replace(/\/+$/, "");
  if (configured && !LOCAL.test(configured)) return configured;
  return request.nextUrl.origin;
}
