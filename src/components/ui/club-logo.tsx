import Image from "next/image";
import { cx } from "@/lib/cx";

/**
 * Club logo in a fixed square frame: every logo takes the same space whatever its proportions,
 * is shown whole (never cropped or stretched) and is requested at twice the size for sharp screens.
 */
export function ClubLogo({
  src,
  name,
  size = 28,
  className,
}: {
  src: string | null;
  /** Club name, used for the fallback letter; the logo itself is decorative. */
  name: string;
  size?: number;
  className?: string;
}) {
  const frame = cx(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
    className,
  );
  const style = { width: size, height: size };

  if (src) {
    return (
      <span className={frame} style={style}>
        <Image
          src={src}
          alt=""
          width={size * 2}
          height={size * 2}
          sizes={`${size}px`}
          quality={90}
          unoptimized={src.startsWith("blob:")}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cx(frame, "bg-surface font-display text-sm font-bold uppercase text-muted")}
      style={style}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
