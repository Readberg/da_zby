import { CLUB_LOGO_MAX_BYTES } from "@/lib/admin-schema";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CLUB_LOGO_ACCEPT = Object.keys(EXTENSIONS).join(",");

export type LogoProblem = "type" | "size" | "empty";

/** Same rules as the `club-logos` bucket (jpeg/png/webp, up to 1 MB). */
export function validateClubLogo(file: { type: string; size: number }): LogoProblem | null {
  if (!(file.type in EXTENSIONS)) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > CLUB_LOGO_MAX_BYTES) return "size";
  return null;
}

export function buildClubLogoPath(mimeType: string, random: string): string {
  const extension = EXTENSIONS[mimeType];
  if (!extension) throw new Error(`Unsupported logo type: ${mimeType}`);
  return `${random}.${extension}`;
}
