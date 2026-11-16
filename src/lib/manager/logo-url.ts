/**
 * The public address of a club logo: the file lives in the "avatars" bucket of Supabase Storage,
 * in the folder of the owner. Null when the club has none.
 */
export function managerLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
