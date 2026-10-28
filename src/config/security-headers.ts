/**
 * Response headers for every page and API answer (D-074).
 *
 * The content security policy is enforcing (since the owner's go-ahead, D-076). It was run as
 * Report-Only first and e2e tests fail on any violation message (guest pages, the signed-in live
 * cycle, profile and photo upload, admin and logo upload), so a new external resource has to be
 * added here on purpose. Inline scripts are allowed because Next.js and the theme and loader
 * scripts are inline; nonces would make every page dynamic.
 */
/**
 * Storage and Realtime are allowed for this project's host only; without a configured URL
 * (a build with no Supabase settings) it falls back to every Supabase project.
 */
export function supabaseHost(url: string | undefined): string {
  try {
    return url ? new URL(url).host : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
}

export function contentSecurityPolicy(supabaseUrl?: string): string {
  const supabase = supabaseHost(supabaseUrl);
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cloud.umami.is",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://i.ytimg.com https://${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' https://${supabase} wss://${supabase} https://cloud.umami.is https://gateway.umami.is`,
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(supabaseUrl?: string): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(supabaseUrl) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Strict-Transport-Security", value: "max-age=15552000" },
  ];
}
