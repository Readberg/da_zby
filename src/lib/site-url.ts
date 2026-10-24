/**
 * Public site URL baked into the build (Open Graph, sitemap, robots).
 * An explicit non-localhost NEXT_PUBLIC_SITE_URL wins (a missing scheme is added: a bare host
 * pasted into a dashboard must not crash the server at start-up); otherwise a Railway build uses
 * the domain Railway generated for the service, so the stand never advertises localhost.
 */
export function resolveSiteUrl(env: Record<string, string | undefined>): string | undefined {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const withScheme =
    explicit && !/^[a-z][a-z\d+.-]*:\/\//i.test(explicit) ? `https://${explicit}` : explicit;
  const isLocal = !withScheme || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(withScheme);
  if (!isLocal) return withScheme;
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  return withScheme;
}
