/**
 * Public site URL baked into the build (Open Graph, sitemap, robots).
 * An explicit non-localhost NEXT_PUBLIC_SITE_URL wins; otherwise a Railway build uses the
 * domain Railway generated for the service, so the stand never advertises localhost.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>): string | undefined {
  const explicit = env.NEXT_PUBLIC_SITE_URL;
  const isLocal = !explicit || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(explicit);
  if (!isLocal) return explicit;
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  return explicit;
}
