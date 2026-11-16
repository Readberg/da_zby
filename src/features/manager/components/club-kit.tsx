import { cx } from "@/lib/cx";

/**
 * The kit of a club: a plain shirt and shorts in the two colours of the club. The colours change
 * smoothly, so a quick succession of choices does not make the picture flicker.
 */
export function ClubKit({
  primary,
  secondary,
  label,
  className,
}: {
  primary: string;
  secondary: string;
  /** A description for screen readers; without it the picture is decorative. */
  label?: string;
  className?: string;
}) {
  const fade = { transition: "fill 220ms ease, stroke 220ms ease" } as const;
  return (
    <svg
      viewBox="0 0 120 140"
      className={cx("h-auto w-full", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Shorts */}
      <path
        d="M34 88 L86 88 L91 126 L65 126 L60 108 L55 126 L29 126 Z"
        style={{ ...fade, fill: secondary }}
        className="stroke-line"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Shirt */}
      <path
        d="M30 14 L48 8 Q60 22 72 8 L90 14 L112 36 L98 54 L86 46 L86 86 L34 86 L34 46 L22 54 L8 36 Z"
        style={{ ...fade, fill: primary }}
        className="stroke-line"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Collar and cuffs in the second colour */}
      <path
        d="M48 8 Q60 22 72 8"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        style={{ ...fade, stroke: secondary }}
      />
      <path
        d="M10 38 L24 52 M110 38 L96 52"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        style={{ ...fade, stroke: secondary }}
      />
    </svg>
  );
}
