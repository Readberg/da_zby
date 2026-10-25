import Image from "next/image";
import { cx } from "@/lib/cx";

const sizes = { sm: 40, md: 64, lg: 128 } as const;

/** Round user photo; falls back to the first letter of the name on the accent colour. */
export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const px = sizes[size];
  const box = cx("shrink-0 overflow-hidden rounded-full ring-1 ring-line", className);

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={px}
        height={px}
        className={cx(box, "object-cover")}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cx(
        box,
        "flex items-center justify-center bg-accent font-display font-bold uppercase text-ink",
      )}
      style={{ width: px, height: px, fontSize: px / 2 }}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
