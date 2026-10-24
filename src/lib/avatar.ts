import { publicEnv } from "@/lib/env";

/** Public URL of a file in the `avatars` bucket, or null when the user has no photo. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
