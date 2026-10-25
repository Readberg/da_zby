/** Largest side of a stored club logo; logos are never enlarged beyond their own size. */
export const LOGO_MAX_SIDE = 256;

export type LogoFit = {
  /** Side of the square canvas. */
  side: number;
  drawWidth: number;
  drawHeight: number;
  x: number;
  y: number;
};

/**
 * Fits a picture into a square canvas without distorting it: big pictures are scaled down to
 * `maxSide`, small ones keep their pixels (no blurry upscaling) and are centred in a square of
 * their own longest side. Transparent margins make every logo the same shape.
 */
export function fitIntoSquare(width: number, height: number, maxSide = LOGO_MAX_SIDE): LogoFit {
  const longest = Math.max(width, height);
  const side = Math.max(1, Math.min(longest, maxSide));
  const scale = side / longest;
  const drawWidth = Math.max(1, Math.round(width * scale));
  const drawHeight = Math.max(1, Math.round(height * scale));
  return {
    side,
    drawWidth,
    drawHeight,
    x: Math.floor((side - drawWidth) / 2),
    y: Math.floor((side - drawHeight) / 2),
  };
}

/**
 * Re-draws a logo onto a square transparent canvas (see `fitIntoSquare`) and returns it as WebP
 * (PNG where WebP is not available). Anything that goes wrong — no canvas, an unreadable image —
 * returns the original file untouched, so a logo is never lost to the optimisation.
 */
export async function normalizeClubLogo(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bitmap = await createImageBitmap(file);
    const fit = fitIntoSquare(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = fit.side;
    canvas.height = fit.side;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, fit.x, fit.y, fit.drawWidth, fit.drawHeight);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.95),
    );
    if (!blob || blob.size === 0) return file;
    const extension = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `logo.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
}
