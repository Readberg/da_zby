/** Rules for profile photos (D-014): jpeg/png/webp, up to 2 MB. Mirrors the bucket settings. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const AVATAR_ACCEPT = Object.keys(EXTENSIONS).join(",");

export type AvatarProblem = "type" | "size" | "empty";

export function validateAvatarFile(file: { type: string; size: number }): AvatarProblem | null {
  if (!(file.type in EXTENSIONS)) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}

/** `<user id>/<random>.<ext>`: the first folder must be the user's id (storage RLS). */
export function buildAvatarPath(userId: string, mimeType: string, random: string): string {
  const extension = EXTENSIONS[mimeType];
  if (!extension) throw new Error(`Unsupported avatar type: ${mimeType}`);
  return `${userId}/${random}.${extension}`;
}

export const AVATAR_PATH_PATTERN = /^[0-9a-f-]{36}\/[\w-]{1,64}\.(jpg|png|webp)$/;
