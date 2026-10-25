import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type CardProps = HTMLAttributes<HTMLElement> & {
  /** `accent`: black block with a yellow title, like the channel's posts. */
  variant?: "default" | "accent";
  title?: ReactNode;
  as?: "section" | "article" | "div";
};

export function Card({
  variant = "default",
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
        "rounded-lg p-5 sm:p-8",
        accent ? "bg-black text-white" : "bg-surface text-ink",
        className,
      )}
      {...props}
    >
      {title && (
        <h3 className={cx("mb-3 text-lg sm:text-h3", accent ? "text-accent" : "text-ink")}>
          {title}
        </h3>
      )}
      {children}
    </Tag>
  );
}
