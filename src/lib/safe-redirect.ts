/**
 * Accepts only same-site relative paths ("/profile?tab=1"), so a crafted `next` parameter
 * can never send a freshly signed-in user to another site (open redirect).
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  // Control characters and encoded slashes/backslashes at the start are used to smuggle hosts.
  if (/[\u0000-\u001f]/.test(value) || /^\/%(2f|5c)/i.test(value)) return fallback;
  return value;
}
