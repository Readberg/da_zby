/**
 * Club colours to choose from (the brief: "standard palette"). They are the content of a club, like
 * its logo, not part of the site theme, so they live here and not in the design tokens.
 */
export const CLUB_COLORS = [
  "#d32f2f",
  "#f57c00",
  "#fbc02d",
  "#388e3c",
  "#00796b",
  "#0288d1",
  "#1a237e",
  "#7b1fa2",
  "#c2185b",
  "#5d4037",
  "#212121",
  "#f5f5f5",
] as const;

export type ClubColor = (typeof CLUB_COLORS)[number];
