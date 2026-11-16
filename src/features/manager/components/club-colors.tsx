/** The colours of a club as two stripes; they are content of the club, so they come from the data. */
export function ClubColors({
  primary,
  secondary,
  size = "md",
}: {
  primary: string;
  secondary: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 overflow-hidden rounded-full border border-line ${size === "sm" ? "h-5 w-5" : "h-10 w-10"}`}
    >
      <span className="w-1/2" style={{ backgroundColor: primary }} />
      <span className="w-1/2" style={{ backgroundColor: secondary }} />
    </span>
  );
}
