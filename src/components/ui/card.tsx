import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type CardProps = HTMLAttributes<HTMLElement> & {
  /** `accent`: black block with a yellow title, like the channel's posts. */
  variant?: "default" | "accent";
  /** Highlights the card (yellow ring) under the pointer: for cards that are links or rows. */
  interactive?: boolean;
  title?: ReactNode;
  as?: "section" | "article" | "div";
};

export function Card({
  variant = "default",
  interactive = false,
  title,
  as: Tag = "section",
  className,
  children,
  ...props
}: CardProps) {
  const accent = variant === "accent";
  return (
    <Tag
      className={cx(
        "rounded-lg p-5 shadow-soft sm:p-8",
        accent ? "bg-black text-white" : "bg-surface text-ink",
        interactive &&
          "ring-2 ring-transparent transition-shadow duration-200 hover:ring-accent group-hover:ring-accent",
        className,
      )}
      {...props}
    >
      {title && (
        <h3
          className={cx(
            "mb-4 border-b pb-3 text-lg sm:text-h3",
            accent ? "border-white/20 text-accent" : "border-line text-ink",
          )}
        >
          {title}
        </h3>
      )}
      {children}
    </Tag>
  );
}
