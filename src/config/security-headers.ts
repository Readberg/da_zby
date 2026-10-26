/**
 * Response headers for every page and API answer (D-074).
 *
 * The content security policy is enforcing (since the owner's go-ahead, D-076). It was run as
 * Report-Only first and e2e tests fail on any violation message (guest pages, the signed-in live
 * cycle, profile and photo upload, admin and logo upload), so a new external resource has to be
 * added here on purpose. Inline scripts are allowed because Next.js and the theme and loader
 * scripts are inline; nonces would make every page dynamic.
 */
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cloud.umami.is",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://cloud.umami.is https://gateway.umami.is",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Strict-Transport-Security", value: "max-age=15552000" },
  ];
}
