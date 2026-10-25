/** Public URL of a file in the `club-logos` bucket, or null when the club has no logo. */
export function clubLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Literal read: inlined at build time and valid on the server as well.
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/club-logos/${path}`;
}
