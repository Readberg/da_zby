import { Inter, Oswald } from "next/font/google";

/** Condensed display face for uppercase headings (docs/DESIGN.md → Типографика). */
export const headingFont = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700"],
  variable: "--font-heading",
  display: "swap",
  // Preloaded (DAZBY-123): the first screen waits for it, and the largest element is a heading.
  preload: true,
});

/** Body text. */
export const bodyFont = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
  preload: false,
});
