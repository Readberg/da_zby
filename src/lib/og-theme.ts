/**
 * Colours of the generated link-preview images (D-091). The image renderer draws without CSS, so
 * the values of the dark theme tokens in `src/app/globals.css` are repeated here as literals; this
 * is the one file besides the token file where the design-tokens guard allows raw colours.
 */
export const OG_COLORS = {
  background: "#0e0e10",
  surface: "#19191c",
  ink: "#f2f2f3",
  muted: "#9a9aa2",
  accent: "#fede06",
  onAccent: "#000000",
} as const;

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";
